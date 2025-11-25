/**
 * Implémentation du provider SMS utilisant SMSup
 * 
 * Documentation SMSup : https://www.smsup.ch/api/
 * 
 * Pour utiliser un autre provider (ex: Twilio) :
 * 1. Créer une nouvelle classe implémentant SmsProvider (ex: TwilioSmsProvider)
 * 2. Modifier uniquement server/core/notifications/index.ts pour utiliser le nouveau provider
 * 3. Aucune autre modification nécessaire
 */

import { SmsProvider } from '../../core/notifications/types';

export class SmsUpProvider implements SmsProvider {
  private apiKey: string;
  private sender: string;
  private apiUrl: string;
  private dryRun: boolean;

  constructor(apiKey: string, sender: string, dryRun: boolean = false) {
    if (!apiKey && !dryRun) {
      throw new Error('SMSUP_API_KEY is required when dryRun is false');
    }
    if (!sender) {
      throw new Error('SMSUP_SENDER is required');
    }

    this.apiKey = apiKey || '';
    this.sender = sender;
    this.dryRun = dryRun;
    // URL de l'API SMSup (à adapter selon leur documentation exacte)
    this.apiUrl = process.env.SMSUP_API_URL || 'https://api.smsup.ch/send';
  }

  /**
   * Envoie un SMS via SMSup
   * @param params - Paramètres d'envoi
   * @param params.to - Numéro de téléphone au format international (ex: +41791234567)
   * @param params.message - Message à envoyer (max 160 caractères pour SMS simple)
   * @returns Résultat de l'envoi avec success: true si réussi, false sinon avec un message d'erreur
   */
  async sendSms({ to, message }: { to: string; message: string }): Promise<{ success: boolean; error?: string }> {
    // Normaliser le numéro de téléphone (s'assurer qu'il commence par +)
    const normalizedPhone = this.normalizePhoneNumber(to);

    // Vérifier la longueur du message (SMSup limite généralement à 160 caractères pour SMS simple)
    if (message.length > 160) {
      console.warn(`[SmsUp] Message trop long (${message.length} caractères), risque de SMS multipart`);
    }

    const payload = {
      key: this.apiKey,
      sender: this.sender,
      phone: normalizedPhone,
      message: message,
    };

    // Mode dry run : log le payload et retourner success sans appeler l'API
    if (this.dryRun) {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[SmsUp] [DRY RUN] 📱 SMS qui serait envoyé');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[SmsUp] [DRY RUN]   To:', normalizedPhone);
      console.log('[SmsUp] [DRY RUN]   Message:', message);
      console.log('[SmsUp] [DRY RUN]   Longueur:', message.length, 'caractères');
      console.log('[SmsUp] [DRY RUN]   Payload complet:');
      console.log(JSON.stringify(payload, null, 2));
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      return { success: true };
    }

    try {
      console.log(`[SmsUp] Envoi SMS à ${normalizedPhone}...`);
      console.log(`[SmsUp] URL: ${this.apiUrl}`);
      console.log(`[SmsUp] Payload:`, JSON.stringify(payload, null, 2));
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: SMSup utilise généralement la clé API dans le body, pas dans le header
          // Si l'API nécessite un header d'authentification, décommenter la ligne suivante :
          // 'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const errorMessage = `SMSUP_SEND_FAILED: HTTP ${response.status} - ${errorBody}`;
        console.error(`[SmsUp] Erreur HTTP ${response.status}:`, errorBody);
        return { success: false, error: errorMessage };
      }

      const result = await response.json().catch(() => ({}));
      console.log(`[SmsUp] SMS envoyé avec succès à ${normalizedPhone}`, result);
      return { success: true };
    } catch (error: any) {
      const errorMessage = `SMSUP_SEND_FAILED: ${error.message || 'Erreur inconnue'}`;
      console.error('[SmsUp] Erreur lors de l\'envoi du SMS:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Normalise un numéro de téléphone au format international
   * @param phone - Numéro de téléphone (peut être avec ou sans +)
   * @returns Numéro normalisé avec +
   */
  private normalizePhoneNumber(phone: string): string {
    // Supprimer tous les espaces et caractères non numériques sauf +
    let normalized = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');

    // Si le numéro ne commence pas par +, ajouter +41 (code pays suisse)
    if (!normalized.startsWith('+')) {
      // Si le numéro commence par 0, le remplacer par +41
      if (normalized.startsWith('0')) {
        normalized = '+41' + normalized.substring(1);
      } else {
        // Sinon, ajouter +41
        normalized = '+41' + normalized;
      }
    }

    return normalized;
  }
}

