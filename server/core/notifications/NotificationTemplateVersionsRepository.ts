/**
 * Repository pour gérer l'historique des versions des templates de notifications
 * 
 * Permet de :
 * - Créer un snapshot de la version actuelle avant modification
 * - Lister les versions historiques
 * - Restaurer une version précédente
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationSettings } from './NotificationSettingsRepository';

export interface NotificationTemplateVersion {
  id: number;
  salonId: string;
  createdAt: Date;
  createdBy: string | null;
  label: string | null;
  confirmationEmailSubject: string;
  confirmationEmailText: string; // Nouveau : texte simple (sans HTML)
  confirmationEmailHtml: string; // Conservé pour compatibilité
  confirmationSmsText: string;
  reminderSmsText: string;
  reminderOffsetHours: number;
}

/**
 * Crée une instance du repository
 */
export function createNotificationTemplateVersionsRepository(
  supabase: SupabaseClient
): NotificationTemplateVersionsRepository {
  return new NotificationTemplateVersionsRepository(supabase);
}

export class NotificationTemplateVersionsRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Crée un snapshot de la version actuelle de notification_settings
   * À appeler AVANT de modifier notification_settings
   * 
   * @param salonId - ID du salon
   * @param createdBy - Email ou ID du manager qui crée cette version (optionnel)
   * @param label - Label optionnel pour cette version (optionnel)
   */
  async createVersionFromCurrentSettings(
    salonId: string,
    createdBy?: string,
    label?: string
  ): Promise<NotificationTemplateVersion> {
    try {
      // Récupérer les settings actuels
      const { data: currentSettings, error: fetchError } = await this.supabase
        .from('notification_settings')
        .select('*')
        .eq('salon_id', salonId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Erreur lors de la récupération des settings: ${fetchError.message}`);
      }

      // Si aucune version actuelle n'existe, ne pas créer de version (première création)
      if (!currentSettings) {
        throw new Error('Aucune configuration actuelle trouvée. Impossible de créer un snapshot.');
      }

      // Créer la version dans l'historique
      const versionData = {
        salon_id: salonId,
        created_by: createdBy || null,
        label: label || null,
        confirmation_email_subject: currentSettings.confirmation_email_subject,
        confirmation_email_text: currentSettings.confirmation_email_text || null,
        confirmation_email_html: currentSettings.confirmation_email_html,
        confirmation_sms_text: currentSettings.confirmation_sms_text,
        reminder_sms_text: currentSettings.reminder_sms_text,
        reminder_offset_hours: currentSettings.reminder_offset_hours,
      };

      const { data, error } = await this.supabase
        .from('notification_template_versions')
        .insert(versionData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapToVersion(data);
    } catch (error: any) {
      console.error('[NotificationTemplateVersions] Erreur lors de la création de version:', error);
      throw error;
    }
  }

  /**
   * Liste les versions historiques pour un salon
   * 
   * @param salonId - ID du salon
   * @param limit - Nombre maximum de versions à retourner (défaut: 20)
   * @returns Liste des versions triées par date décroissante
   */
  async listVersions(
    salonId: string,
    limit: number = 20
  ): Promise<NotificationTemplateVersion[]> {
    try {
      const { data, error } = await this.supabase
        .from('notification_template_versions')
        .select('*')
        .eq('salon_id', salonId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data || []).map((row) => this.mapToVersion(row));
    } catch (error: any) {
      console.error('[NotificationTemplateVersions] Erreur lors de la liste des versions:', error);
      throw error;
    }
  }

  /**
   * Récupère une version spécifique par son ID
   * 
   * @param versionId - ID de la version
   * @param salonId - ID du salon (pour sécurité)
   * @returns La version ou null si non trouvée
   */
  async getVersionById(
    versionId: number,
    salonId: string
  ): Promise<NotificationTemplateVersion | null> {
    try {
      const { data, error } = await this.supabase
        .from('notification_template_versions')
        .select('*')
        .eq('id', versionId)
        .eq('salon_id', salonId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        return null;
      }

      return this.mapToVersion(data);
    } catch (error: any) {
      console.error('[NotificationTemplateVersions] Erreur lors de la récupération de version:', error);
      throw error;
    }
  }

  /**
   * Restaure une version précédente en l'appliquant à notification_settings
   * Crée également un snapshot de l'état actuel avant restauration
   * 
   * @param versionId - ID de la version à restaurer
   * @param salonId - ID du salon
   * @param createdBy - Email ou ID du manager qui restaure (optionnel)
   */
  async restoreVersion(
    versionId: number,
    salonId: string,
    createdBy?: string
  ): Promise<void> {
    try {
      // Récupérer la version à restaurer
      const version = await this.getVersionById(versionId, salonId);
      if (!version) {
        throw new Error(`Version ${versionId} non trouvée pour le salon ${salonId}`);
      }

      // Créer un snapshot de l'état actuel AVANT restauration
      try {
        await this.createVersionFromCurrentSettings(
          salonId,
          createdBy,
          `Snapshot avant restauration de la version du ${new Date(version.createdAt).toLocaleDateString('fr-FR')}`
        );
      } catch (error: any) {
        // Si c'est la première fois qu'on crée des settings, pas de snapshot à faire
        if (!error.message.includes('Aucune configuration actuelle trouvée')) {
          console.warn('[NotificationTemplateVersions] Impossible de créer un snapshot avant restauration:', error);
        }
      }

      // Appliquer la version restaurée à notification_settings
      // Générer le HTML depuis le texte si confirmationEmailText existe
      let confirmationEmailHtml = version.confirmationEmailHtml;
      if (version.confirmationEmailText) {
        const { generateEmailHtmlFromText } = await import('./emailHtmlGenerator.js');
        confirmationEmailHtml = generateEmailHtmlFromText(version.confirmationEmailText);
      }

      const updateData = {
        confirmation_email_subject: version.confirmationEmailSubject,
        confirmation_email_text: version.confirmationEmailText || null,
        confirmation_email_html: confirmationEmailHtml,
        confirmation_sms_text: version.confirmationSmsText,
        reminder_sms_text: version.reminderSmsText,
        reminder_offset_hours: version.reminderOffsetHours,
        updated_at: new Date().toISOString(),
      };

      // Vérifier si la ligne existe
      const { data: existing } = await this.supabase
        .from('notification_settings')
        .select('id')
        .eq('salon_id', salonId)
        .maybeSingle();

      if (existing) {
        // Mise à jour
        const { error: updateError } = await this.supabase
          .from('notification_settings')
          .update(updateData)
          .eq('salon_id', salonId);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Création
        const { error: insertError } = await this.supabase
          .from('notification_settings')
          .insert({
            salon_id: salonId,
            ...updateData,
          });

        if (insertError) {
          throw insertError;
        }
      }

      console.log(`[NotificationTemplateVersions] Version ${versionId} restaurée avec succès pour le salon ${salonId}`);
    } catch (error: any) {
      console.error('[NotificationTemplateVersions] Erreur lors de la restauration:', error);
      throw error;
    }
  }

  /**
   * Mappe les données de la base vers l'interface TypeScript
   */
  private mapToVersion(row: any): NotificationTemplateVersion {
    return {
      id: row.id,
      salonId: row.salon_id,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,
      label: row.label,
      confirmationEmailSubject: row.confirmation_email_subject,
      confirmationEmailText: row.confirmation_email_text || row.confirmation_email_html || '', // Fallback vers HTML si texte absent
      confirmationEmailHtml: row.confirmation_email_html,
      confirmationSmsText: row.confirmation_sms_text,
      reminderSmsText: row.reminder_sms_text,
      reminderOffsetHours: row.reminder_offset_hours,
    };
  }
}

