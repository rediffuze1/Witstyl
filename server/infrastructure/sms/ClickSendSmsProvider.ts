/**
 * Implémentation du provider SMS utilisant ClickSend
 * 
 * Documentation ClickSend : https://developers.clicksend.com/docs/rest/v3/
 * 
 * Pour utiliser ce provider :
 * 1. Créer un compte ClickSend et obtenir votre username et API key
 * 2. Configurer les variables d'environnement (voir ci-dessous)
 * 3. Modifier server/core/notifications/index.ts pour utiliser ClickSendSmsProvider
 */

import { SmsProvider } from '../../core/notifications/types';

type ClickSendSmsProviderConfig = {
  username?: string;
  apiKey?: string;
  from?: string; // Sender ID alphanumérique ou numéro (ex: "Witstyl" ou "+41791234567")
  dryRun?: boolean;
};

export class ClickSendSmsProvider implements SmsProvider {
  private username?: string;
  private apiKey?: string;
  private from?: string;
  private dryRun: boolean;
  private apiUrl = 'https://rest.clicksend.com/v3/sms/send';

  constructor({
    username,
    apiKey,
    from,
    dryRun = true,
  }: ClickSendSmsProviderConfig) {
    this.username = username?.trim();
    this.apiKey = apiKey?.trim();
    this.from = from?.trim();
    this.dryRun = dryRun;

    if (!this.dryRun) {
      if (!this.username || !this.apiKey) {
        throw new Error('CLICKSEND_USERNAME et CLICKSEND_API_KEY sont requis lorsque dryRun est false');
      }

      if (!this.from) {
        throw new Error('CLICKSEND_SMS_FROM est requis lorsque dryRun est false');
      }
    }
  }

  /**
   * Normalise un numéro de téléphone au format international E.164
   * @param phone - Numéro de téléphone (ex: +41791234567 ou 41791234567)
   * @returns Numéro au format +41791234567
   */
  private normalizePhoneNumber(phone: string): string {
    // Supprimer les espaces et caractères spéciaux
    let normalized = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');

    // S'assurer que le numéro commence par +
    if (!normalized.startsWith('+')) {
      // Si le numéro commence par 00, remplacer par +
      if (normalized.startsWith('00')) {
        normalized = '+' + normalized.substring(2);
      } else {
        // Sinon, ajouter + (suppose que c'est un numéro international)
        normalized = '+' + normalized;
      }
    }

    return normalized;
  }

  /**
   * Envoie un SMS via ClickSend
   * @param params - Paramètres d'envoi
   * @param params.to - Numéro de téléphone au format international (ex: +41791234567)
   * @param params.message - Message à envoyer
   * @returns Résultat de l'envoi avec success: true si réussi, false sinon avec un message d'erreur
   */
  async sendSms({
    to,
    message,
  }: {
    to: string;
    message: string;
  }): Promise<{ success: boolean; error?: string; metadata?: Record<string, unknown> }> {
    // Normaliser le numéro de téléphone
    const normalizedPhone = this.normalizePhoneNumber(to);

    // Log du numéro original vs normalisé pour debug
    if (to !== normalizedPhone) {
      console.log(`[ClickSend] 📞 Numéro normalisé: "${to}" → "${normalizedPhone}"`);
    } else {
      console.log(`[ClickSend] 📞 Numéro: "${normalizedPhone}"`);
    }

    // Mode dry run : log le payload et retourner success sans appeler l'API
    if (this.dryRun) {
      console.log('[ClickSend] [DRY RUN] Envoi SMS vers', normalizedPhone);
      console.log('[ClickSend] [DRY RUN] Message:', message);
      console.log('[ClickSend] [DRY RUN] Depuis:', this.from || 'non configuré');
      return {
        success: true,
        metadata: {
          dryRun: true,
          to: normalizedPhone,
          from: this.from,
        },
      };
    }

    // Vérifier que les credentials sont définis
    if (!this.username || !this.apiKey) {
      return {
        success: false,
        error: 'CLICKSEND_USERNAME et CLICKSEND_API_KEY sont requis',
      };
    }

    if (!this.from) {
      return {
        success: false,
        error: 'CLICKSEND_SMS_FROM est requis',
      };
    }

    try {
      // Préparer le payload selon l'API ClickSend
      // ClickSend attend un tableau de messages
      const payload = {
        messages: [
          {
            source: 'sdk', // Source du message
            from: this.from, // Sender ID ou numéro
            body: message, // Contenu du message
            to: normalizedPhone, // Numéro destinataire
          },
        ],
      };

      // Créer les credentials pour l'authentification Basic Auth
      const credentials = Buffer.from(`${this.username}:${this.apiKey}`).toString('base64');

      console.log('[ClickSend] 📱 Envoi SMS vers', normalizedPhone);
      console.log('[ClickSend] 📱 Depuis:', this.from);

      // Appeler l'API ClickSend
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      // Vérifier le statut de la réponse
      if (!response.ok) {
        const errorMessage = responseData.message || responseData.error || `Erreur HTTP ${response.status}`;
        console.error('[ClickSend] ❌ Erreur lors de l\'envoi SMS:', errorMessage);
        console.error('[ClickSend] 📋 Réponse complète:', JSON.stringify(responseData, null, 2));

        return {
          success: false,
          error: errorMessage,
          metadata: {
            statusCode: response.status,
            response: responseData,
          },
        };
      }

      // Vérifier le statut dans la réponse ClickSend
      // ClickSend retourne généralement { http_code: 200, response_code: "SUCCESS", data: {...} }
      if (responseData.response_code !== 'SUCCESS' && responseData.http_code !== 200) {
        const errorMessage = responseData.message || 'Erreur inconnue lors de l\'envoi SMS';
        console.error('[ClickSend] ❌ Erreur ClickSend:', errorMessage);
        console.error('[ClickSend] 📋 Réponse complète:', JSON.stringify(responseData, null, 2));

        return {
          success: false,
          error: errorMessage,
          metadata: {
            response: responseData,
          },
        };
      }

      // Extraire les informations du message envoyé
      const messageData = responseData.data?.messages?.[0];
      const messageId = messageData?.message_id || responseData.data?.message_id;

      console.log('[ClickSend] ✅ SMS envoyé avec succès');
      if (messageId) {
        console.log('[ClickSend] 📋 Message ID:', messageId);
      }
      if (messageData?.status) {
        console.log('[ClickSend] 📊 Statut:', messageData.status);
      }

      return {
        success: true,
        metadata: {
          messageId: messageId,
          status: messageData?.status,
          to: normalizedPhone,
          from: this.from,
          response: responseData,
        },
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur inconnue lors de l\'envoi SMS';
      console.error('[ClickSend] ❌ Erreur réseau ou autre:', errorMessage);
      console.error('[ClickSend] 📋 Détails:', error);

      // Gérer les erreurs réseau spécifiques
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Erreur de connexion à l\'API ClickSend. Vérifiez votre connexion internet.',
        };
      }

      return {
        success: false,
        error: errorMessage,
        metadata: {
          originalError: error.message,
        },
      };
    }
  }
}


