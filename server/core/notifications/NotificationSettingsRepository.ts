/**
 * Repository pour gérer les paramètres de notifications
 * 
 * Gère la lecture et l'écriture des templates de notifications depuis Supabase.
 * Inclut un cache in-memory pour éviter de requêter la base à chaque notification.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_NOTIFICATION_TEMPLATES } from './defaultTemplates.js';

export interface NotificationSettings {
  id: string;
  salonId: string;
  confirmationEmailSubject: string;
  confirmationEmailText: string; // Nouveau : texte simple (sans HTML)
  confirmationEmailHtml: string; // Conservé pour compatibilité, généré automatiquement
  confirmationSmsText: string;
  reminderSmsText: string;
  reminderOffsetHours: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cache in-memory pour les settings
 * Clé: salonId, Valeur: { settings, timestamp }
 */
const settingsCache = new Map<
  string,
  { settings: NotificationSettings; timestamp: number }
>();

// TTL du cache: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Crée une instance du repository
 */
export function createNotificationSettingsRepository(
  supabase: SupabaseClient
): NotificationSettingsRepository {
  return new NotificationSettingsRepository(supabase);
}

export class NotificationSettingsRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Récupère les settings pour un salon
   * Crée automatiquement une ligne avec les valeurs par défaut si elle n'existe pas
   */
  async getSettings(salonId: string): Promise<NotificationSettings> {
    // Valider le format du salonId pour éviter les erreurs
    if (!salonId || typeof salonId !== 'string' || salonId.trim().length === 0) {
      throw new Error(`salonId invalide: ${salonId}`);
    }

    // Vérifier le cache
    // ⚠️ NOTE: Le cache est utile pour les performances, mais peut retourner de vieilles valeurs
    // Si vous avez des problèmes de persistance, vous pouvez désactiver le cache en retournant toujours depuis la DB
    const cached = settingsCache.get(salonId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log('[NotificationSettings] getSettings - Utilisation du cache:', {
        salonId,
        confirmationEmailText: cached.settings.confirmationEmailText ? `[${cached.settings.confirmationEmailText.length} chars]` : 'VIDE',
        age: Math.round((Date.now() - cached.timestamp) / 1000) + 's',
      });
      return cached.settings;
    }

    try {
      // Récupérer depuis la base
      // Note: salonId peut être "salon-{uuid}" ou "{uuid}", Supabase gère les deux formats
      const { data, error } = await this.supabase
        .from('notification_settings')
        .select('*')
        .eq('salon_id', salonId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, ce qui est OK (on va créer)
        console.error('[NotificationSettings] Erreur lors de la récupération:', error);
        // En cas d'erreur, retourner les valeurs par défaut
        return await this.getDefaultSettings(salonId);
      }

      if (!data) {
        // Créer avec les valeurs par défaut
        return await this.createDefaultSettings(salonId);
      }

      // Mapper les données de la base vers notre interface
      // ⚠️ CRITIQUE: Si une ligne existe en DB, on retourne EXACTEMENT ce qui est stocké.
      // On utilise les fallbacks UNIQUEMENT si la valeur est NULL (pas si c'est une chaîne vide).
      // Cela permet de distinguer "pas encore défini" (NULL → fallback) de "défini mais vide" ("" → retourner "").
      
      // Log pour debug - TOUJOURS activé pour diagnostiquer le problème
      console.log('[NotificationSettings] getSettings - Valeurs brutes depuis DB:', {
        confirmation_email_text: data.confirmation_email_text !== null && data.confirmation_email_text !== undefined 
          ? `[${data.confirmation_email_text.length} chars] "${data.confirmation_email_text.substring(0, 50)}..."`
          : 'NULL/UNDEFINED',
        confirmation_email_subject: data.confirmation_email_subject !== null && data.confirmation_email_subject !== undefined
          ? `[${data.confirmation_email_subject.length} chars] "${data.confirmation_email_subject}"`
          : 'NULL/UNDEFINED',
        confirmation_sms_text: data.confirmation_sms_text !== null && data.confirmation_sms_text !== undefined
          ? `[${data.confirmation_sms_text.length} chars]`
          : 'NULL/UNDEFINED',
      });

      // Pour confirmationEmailSubject: utiliser la valeur DB si elle existe (même vide), sinon fallback
      const confirmationEmailSubject = 
        (data.confirmation_email_subject !== null && data.confirmation_email_subject !== undefined)
          ? data.confirmation_email_subject
          : DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailSubject;
      
      // Pour confirmationEmailText: utiliser la valeur DB si elle existe (même vide), sinon fallback
      const confirmationEmailText = 
        (data.confirmation_email_text !== null && data.confirmation_email_text !== undefined)
          ? data.confirmation_email_text
          : DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailText;

      // Pour confirmationEmailHtml: générer depuis le texte si absent
      let confirmationEmailHtml = data.confirmation_email_html;
      if (!confirmationEmailHtml && confirmationEmailText) {
        const { generateEmailHtmlFromText } = await import('./emailHtmlGenerator.js');
        confirmationEmailHtml = generateEmailHtmlFromText(confirmationEmailText);
      } else if (!confirmationEmailHtml) {
        confirmationEmailHtml = '';
      }

      const settings: NotificationSettings = {
        id: data.id,
        salonId: data.salon_id,
        confirmationEmailSubject,
        confirmationEmailText,
        confirmationEmailHtml,
        confirmationSmsText: (data.confirmation_sms_text !== null && data.confirmation_sms_text !== undefined)
          ? data.confirmation_sms_text
          : DEFAULT_NOTIFICATION_TEMPLATES.confirmationSmsText,
        reminderSmsText: (data.reminder_sms_text !== null && data.reminder_sms_text !== undefined)
          ? data.reminder_sms_text
          : DEFAULT_NOTIFICATION_TEMPLATES.reminderSmsText,
        reminderOffsetHours: data.reminder_offset_hours ?? DEFAULT_NOTIFICATION_TEMPLATES.reminderOffsetHours,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      console.log('[NotificationSettings] getSettings - Valeurs retournées:', {
        confirmationEmailText: settings.confirmationEmailText ? `[${settings.confirmationEmailText.length} chars] "${settings.confirmationEmailText.substring(0, 50)}..."`
          : 'VIDE',
        confirmationEmailSubject: settings.confirmationEmailSubject ? `[${settings.confirmationEmailSubject.length} chars] "${settings.confirmationEmailSubject}"`
          : 'VIDE',
      });

      // Log DEBUG si un fallback a été utilisé
      if (process.env.NOTIFICATIONS_DEBUG === 'true') {
        if (data.confirmation_email_subject === null) {
          console.log('[NotificationSettings DEBUG] ⚠️ Fallback utilisé pour confirmationEmailSubject');
        }
        if (data.confirmation_email_text === null) {
          console.log('[NotificationSettings DEBUG] ⚠️ Fallback utilisé pour confirmationEmailText');
        }
        if (data.confirmation_email_html === null) {
          console.log('[NotificationSettings DEBUG] ⚠️ Fallback utilisé pour confirmationEmailHtml (généré depuis texte)');
        }
        if (data.confirmation_sms_text === null) {
          console.log('[NotificationSettings DEBUG] ⚠️ Fallback utilisé pour confirmationSmsText');
        }
        if (data.reminder_sms_text === null) {
          console.log('[NotificationSettings DEBUG] ⚠️ Fallback utilisé pour reminderSmsText');
        }
      }

      // ⚠️ IMPORTANT: Toujours invalider le cache avant de le mettre à jour
      settingsCache.delete(salonId);
      settingsCache.set(salonId, { settings, timestamp: Date.now() });
      
      console.log('[NotificationSettings] getSettings - Settings chargés depuis DB et mis en cache:', {
        salonId,
        confirmationEmailText: settings.confirmationEmailText ? `[${settings.confirmationEmailText.length} chars]` : 'VIDE/NULL',
        confirmationEmailSubject: settings.confirmationEmailSubject ? `[${settings.confirmationEmailSubject.length} chars]` : 'VIDE/NULL',
        fromCache: false,
      });

      return settings;
    } catch (error) {
      console.error('[NotificationSettings] Erreur inattendue:', error);
      // En cas d'erreur, retourner les valeurs par défaut SANS les mettre en cache
      // pour éviter de polluer le cache avec des valeurs par défaut
      return await this.getDefaultSettings(salonId);
    }
  }

  /**
   * Met à jour les settings pour un salon
   */
  async updateSettings(
    salonId: string,
    partial: Partial<Omit<NotificationSettings, 'id' | 'salonId' | 'createdAt' | 'updatedAt'>>
  ): Promise<NotificationSettings> {
    // Valider le format du salonId pour éviter les erreurs
    if (!salonId || typeof salonId !== 'string' || salonId.trim().length === 0) {
      throw new Error(`salonId invalide: ${salonId}`);
    }

    try {
      // Préparer les données à mettre à jour (mapper vers les noms de colonnes de la base)
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (partial.confirmationEmailSubject !== undefined) {
        updateData.confirmation_email_subject = partial.confirmationEmailSubject;
      }
      if (partial.confirmationEmailText !== undefined) {
        // IMPORTANT: Sauvegarder exactement ce qui est envoyé, même si c'est une chaîne vide
        updateData.confirmation_email_text = partial.confirmationEmailText;
        // Générer automatiquement le HTML depuis le texte
        const { generateEmailHtmlFromText } = await import('./emailHtmlGenerator.js');
        updateData.confirmation_email_html = generateEmailHtmlFromText(partial.confirmationEmailText);
        
        // Log pour debug - TOUJOURS activé
        console.log('[NotificationSettings] updateSettings - Sauvegarde confirmationEmailText:', {
          length: partial.confirmationEmailText.length,
          preview: partial.confirmationEmailText.substring(0, 50) + '...',
          fullValue: partial.confirmationEmailText,
        });
      }
      // Garder confirmationEmailHtml pour compatibilité (mais ne plus l'utiliser directement)
      if (partial.confirmationEmailHtml !== undefined) {
        updateData.confirmation_email_html = partial.confirmationEmailHtml;
      }
      if (partial.confirmationSmsText !== undefined) {
        updateData.confirmation_sms_text = partial.confirmationSmsText;
      }
      if (partial.reminderSmsText !== undefined) {
        updateData.reminder_sms_text = partial.reminderSmsText;
      }
      if (partial.reminderOffsetHours !== undefined) {
        // Valider que c'est une valeur autorisée (12, 24, ou 48)
        if (![12, 24, 48].includes(partial.reminderOffsetHours)) {
          throw new Error(`reminder_offset_hours doit être 12, 24 ou 48, reçu: ${partial.reminderOffsetHours}`);
        }
        updateData.reminder_offset_hours = partial.reminderOffsetHours;
      }

      // Vérifier si la ligne existe
      const { data: existing } = await this.supabase
        .from('notification_settings')
        .select('id')
        .eq('salon_id', salonId)
        .maybeSingle();

      let result;
      if (existing) {
        // Log pour vérifier ce qui va être mis à jour - TOUJOURS activé
        console.log('[NotificationSettings] updateSettings - Données à mettre à jour:', {
          confirmation_email_text: updateData.confirmation_email_text !== undefined 
            ? `[${updateData.confirmation_email_text.length} chars] "${updateData.confirmation_email_text.substring(0, 50)}..."`
            : 'NON INCLUS',
          confirmation_email_subject: updateData.confirmation_email_subject !== undefined
            ? `[${updateData.confirmation_email_subject.length} chars] "${updateData.confirmation_email_subject}"`
            : 'NON INCLUS',
          keys: Object.keys(updateData),
        });
        
        // Mise à jour
        const { data, error } = await this.supabase
          .from('notification_settings')
          .update(updateData)
          .eq('salon_id', salonId)
          .select()
          .single();

        if (error) {
          console.error('[NotificationSettings] Erreur Supabase lors de l\'update:', error);
          throw error;
        }
        result = data;
      } else {
        // Création avec les valeurs par défaut + les valeurs fournies
      // Générer le HTML depuis le texte si confirmationEmailText est fourni
      const { generateEmailHtmlFromText } = await import('./emailHtmlGenerator.js');
      const confirmationEmailText = partial.confirmationEmailText ?? DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailText;
      const confirmationEmailHtml = partial.confirmationEmailHtml ?? generateEmailHtmlFromText(confirmationEmailText);

      const insertData = {
        salon_id: salonId,
        confirmation_email_subject: partial.confirmationEmailSubject ?? DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailSubject,
        confirmation_email_text: confirmationEmailText,
        confirmation_email_html: confirmationEmailHtml,
        confirmation_sms_text: partial.confirmationSmsText ?? DEFAULT_NOTIFICATION_TEMPLATES.confirmationSmsText,
        reminder_sms_text: partial.reminderSmsText ?? DEFAULT_NOTIFICATION_TEMPLATES.reminderSmsText,
        reminder_offset_hours: partial.reminderOffsetHours ?? DEFAULT_NOTIFICATION_TEMPLATES.reminderOffsetHours,
        ...updateData,
      };

        const { data, error } = await this.supabase
          .from('notification_settings')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          throw error;
        }
        result = data;
      }

      // Log pour vérifier ce qui a été sauvegardé - TOUJOURS activé
      console.log('[NotificationSettings] updateSettings - Valeurs sauvegardées en DB (après UPDATE):', {
        confirmation_email_text: result.confirmation_email_text !== null && result.confirmation_email_text !== undefined
          ? `[${result.confirmation_email_text.length} chars] "${result.confirmation_email_text.substring(0, 50)}..."`
          : 'NULL/UNDEFINED',
        confirmation_email_subject: result.confirmation_email_subject !== null && result.confirmation_email_subject !== undefined
          ? `[${result.confirmation_email_subject.length} chars] "${result.confirmation_email_subject}"`
          : 'NULL/UNDEFINED',
      });

      // Mapper vers notre interface - retourner EXACTEMENT ce qui est en DB
      // ⚠️ CRITIQUE: Ne jamais utiliser de fallback si la valeur existe en DB (même si c'est une chaîne vide)
      // Le fallback ne doit être utilisé QUE si la valeur est NULL ou UNDEFINED
      const confirmationEmailSubject =
        (result.confirmation_email_subject !== null && result.confirmation_email_subject !== undefined)
          ? result.confirmation_email_subject
          : DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailSubject;
      
      const confirmationEmailText =
        (result.confirmation_email_text !== null && result.confirmation_email_text !== undefined)
          ? result.confirmation_email_text
          : DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailText;

      // Générer le HTML depuis le texte si nécessaire
      let confirmationEmailHtml = result.confirmation_email_html;
      if (!confirmationEmailHtml && confirmationEmailText) {
        const { generateEmailHtmlFromText } = await import('./emailHtmlGenerator.js');
        confirmationEmailHtml = generateEmailHtmlFromText(confirmationEmailText);
      } else if (!confirmationEmailHtml) {
        confirmationEmailHtml = '';
      }

      const settings: NotificationSettings = {
        id: result.id,
        salonId: result.salon_id,
        confirmationEmailSubject,
        confirmationEmailText,
        confirmationEmailHtml,
        confirmationSmsText: (result.confirmation_sms_text !== null && result.confirmation_sms_text !== undefined)
          ? result.confirmation_sms_text
          : DEFAULT_NOTIFICATION_TEMPLATES.confirmationSmsText,
        reminderSmsText: (result.reminder_sms_text !== null && result.reminder_sms_text !== undefined)
          ? result.reminder_sms_text
          : DEFAULT_NOTIFICATION_TEMPLATES.reminderSmsText,
        reminderOffsetHours: result.reminder_offset_hours ?? DEFAULT_NOTIFICATION_TEMPLATES.reminderOffsetHours,
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
      };

      // Invalider le cache et le mettre à jour avec les nouvelles valeurs
      settingsCache.delete(salonId);
      settingsCache.set(salonId, { settings, timestamp: Date.now() });
      
      // Log - TOUJOURS activé
      console.log('[NotificationSettings] updateSettings - Cache invalidé et mis à jour pour salonId:', salonId);
      console.log('[NotificationSettings] updateSettings - Nouvelles valeurs en cache:', {
        confirmationEmailText: settings.confirmationEmailText ? `[${settings.confirmationEmailText.length} chars] "${settings.confirmationEmailText.substring(0, 50)}..."`
          : 'VIDE',
        confirmationEmailSubject: settings.confirmationEmailSubject ? `[${settings.confirmationEmailSubject.length} chars] "${settings.confirmationEmailSubject}"`
          : 'VIDE',
      });

      return settings;
    } catch (error: any) {
      console.error('[NotificationSettings] Erreur lors de la mise à jour:', error);
      throw error;
    }
  }

  /**
   * Crée une ligne avec les valeurs par défaut
   */
  private async createDefaultSettings(salonId: string): Promise<NotificationSettings> {
    try {
      const { generateEmailHtmlFromText } = await import('./emailHtmlGenerator.js');
      const confirmationEmailText = DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailText;
      const confirmationEmailHtml = generateEmailHtmlFromText(confirmationEmailText);

      const insertData = {
        salon_id: salonId,
        confirmation_email_subject: DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailSubject,
        confirmation_email_text: confirmationEmailText,
        confirmation_email_html: confirmationEmailHtml,
        confirmation_sms_text: DEFAULT_NOTIFICATION_TEMPLATES.confirmationSmsText,
        reminder_sms_text: DEFAULT_NOTIFICATION_TEMPLATES.reminderSmsText,
        reminder_offset_hours: DEFAULT_NOTIFICATION_TEMPLATES.reminderOffsetHours,
      };

      const { data, error } = await this.supabase
        .from('notification_settings')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // ⚠️ CRITIQUE: Retourner EXACTEMENT ce qui est en DB, même si c'est une chaîne vide
      // Ne pas utiliser trim() car une chaîne vide est une valeur valide
      const settings: NotificationSettings = {
        id: data.id,
        salonId: data.salon_id,
        confirmationEmailSubject: data.confirmation_email_subject ?? DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailSubject,
        confirmationEmailText: (data.confirmation_email_text !== null && data.confirmation_email_text !== undefined)
          ? data.confirmation_email_text
          : confirmationEmailText,
        confirmationEmailHtml: (data.confirmation_email_html !== null && data.confirmation_email_html !== undefined)
          ? data.confirmation_email_html
          : confirmationEmailHtml,
        confirmationSmsText: data.confirmation_sms_text ?? DEFAULT_NOTIFICATION_TEMPLATES.confirmationSmsText,
        reminderSmsText: data.reminder_sms_text ?? DEFAULT_NOTIFICATION_TEMPLATES.reminderSmsText,
        reminderOffsetHours: data.reminder_offset_hours ?? DEFAULT_NOTIFICATION_TEMPLATES.reminderOffsetHours,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      // Mettre en cache
      settingsCache.set(salonId, { settings, timestamp: Date.now() });

      return settings;
    } catch (error: any) {
      console.error('[NotificationSettings] Erreur lors de la création des settings par défaut:', error);
      // En cas d'erreur, retourner les valeurs par défaut sans les persister
      return await this.getDefaultSettings(salonId);
    }
  }

  /**
   * Retourne les valeurs par défaut sans les persister
   */
  private async getDefaultSettings(salonId: string): Promise<NotificationSettings> {
    const { generateEmailHtmlFromText } = await import('./emailHtmlGenerator.js');
    const confirmationEmailText = DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailText;
    const confirmationEmailHtml = generateEmailHtmlFromText(confirmationEmailText);
    
    return {
      id: 'default',
      salonId,
      confirmationEmailSubject: DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailSubject,
      confirmationEmailText,
      confirmationEmailHtml,
      confirmationSmsText: DEFAULT_NOTIFICATION_TEMPLATES.confirmationSmsText,
      reminderSmsText: DEFAULT_NOTIFICATION_TEMPLATES.reminderSmsText,
      reminderOffsetHours: DEFAULT_NOTIFICATION_TEMPLATES.reminderOffsetHours,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Invalide le cache pour un salon (utile après une mise à jour)
   */
  invalidateCache(salonId: string): void {
    settingsCache.delete(salonId);
  }
}



