/**
 * Implémentation du provider SMS utilisant Twilio WhatsApp
 * 
 * Documentation Twilio WhatsApp : https://www.twilio.com/docs/whatsapp
 * 
 * Pour utiliser ce provider :
 * 1. Installer le package Twilio : npm install twilio
 * 2. Configurer les variables d'environnement (voir ci-dessous)
 * 3. Modifier server/core/notifications/index.ts pour utiliser TwilioWhatsAppProvider
 */

// IMPORTANT: En ESM, les imports relatifs TypeScript doivent inclure l'extension .js
import { SmsProvider } from '../../core/notifications/types.js';

type TwilioWhatsAppProviderConfig = {
  accountSid?: string;
  authToken?: string;
  whatsappFrom?: string; // Format: whatsapp:+14155238886 ou votre numéro WhatsApp Business
  messagingServiceSid?: string; // Optionnel : utilisez un Messaging Service SID si vous en avez un
  dryRun?: boolean;
};

export class TwilioWhatsAppProvider implements SmsProvider {
  private accountSid?: string;
  private authToken?: string;
  private whatsappFrom?: string;
  private messagingServiceSid?: string;
  private dryRun: boolean;
  private twilioClient: any;
  private twilioClientPromise: Promise<any> | null = null;

  constructor({
    accountSid,
    authToken,
    whatsappFrom,
    messagingServiceSid,
    dryRun = true,
  }: TwilioWhatsAppProviderConfig) {
    this.accountSid = accountSid?.trim();
    this.authToken = authToken?.trim();
    this.whatsappFrom = whatsappFrom?.trim();
    this.messagingServiceSid = messagingServiceSid?.trim();
    this.dryRun = dryRun;

    // Vérifier que le numéro WhatsApp est au bon format
    if (whatsappFrom && !whatsappFrom.startsWith('whatsapp:')) {
      console.warn('[TwilioWhatsApp] ⚠️  Le numéro WhatsApp devrait commencer par "whatsapp:" (ex: whatsapp:+14155238886)');
    }

    if (!this.dryRun) {
      if (!this.accountSid || !this.authToken) {
        throw new Error('TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN sont requis lorsque dryRun est false');
      }

      if (!this.whatsappFrom && !this.messagingServiceSid) {
        throw new Error('TWILIO_WHATSAPP_FROM ou TWILIO_MESSAGING_SERVICE_SID est requis lorsque dryRun est false');
      }

      // Initialiser le client Twilio de manière asynchrone (lazy loading)
      this.twilioClientPromise = this.initializeTwilioClient();
    }
  }

  /**
   * Initialise le client Twilio de manière asynchrone
   */
  private async initializeTwilioClient(): Promise<any> {
    try {
      const twilioModule = await import('twilio');
      const twilio = twilioModule.default || twilioModule;
      return twilio(this.accountSid!, this.authToken!);
    } catch (error) {
      console.error('[TwilioWhatsApp] ❌ Erreur lors de l\'importation de Twilio:', error);
      console.error('[TwilioWhatsApp] 💡 Installez le package : npm install twilio');
      throw new Error('Package Twilio non installé. Exécutez: npm install twilio');
    }
  }

  /**
   * Normalise un numéro de téléphone au format WhatsApp
   * @param phone - Numéro de téléphone (ex: +41791234567 ou 41791234567)
   * @returns Numéro au format whatsapp:+41791234567
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

    // Ajouter le préfixe whatsapp: si ce n'est pas déjà présent
    if (!normalized.startsWith('whatsapp:')) {
      normalized = 'whatsapp:' + normalized;
    }

    return normalized;
  }

  /**
   * Envoie un message WhatsApp via Twilio
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
      console.log(`[TwilioWhatsApp] 📞 Numéro normalisé: "${to}" → "${normalizedPhone}"`);
    } else {
      console.log(`[TwilioWhatsApp] 📞 Numéro: "${normalizedPhone}"`);
    }

    // Mode dry run : log le payload et retourner success sans appeler l'API
    if (this.dryRun) {
      console.log('[TwilioWhatsApp] [DRY RUN] Envoi WhatsApp vers', normalizedPhone);
      console.log('[TwilioWhatsApp] [DRY RUN] Message:', message);
      console.log('[TwilioWhatsApp] [DRY RUN] Depuis:', this.whatsappFrom || this.messagingServiceSid || 'non configuré');
      return {
        success: true,
        metadata: {
          dryRun: true,
          to: normalizedPhone,
          from: this.whatsappFrom || this.messagingServiceSid,
        },
      };
    }

    // Initialiser le client Twilio si nécessaire
    if (!this.twilioClient && this.twilioClientPromise) {
      this.twilioClient = await this.twilioClientPromise;
    }

    // Vérifier que le client Twilio est initialisé
    if (!this.twilioClient) {
      return {
        success: false,
        error: 'Client Twilio non initialisé',
      };
    }

    try {
      // Préparer les paramètres d'envoi
      const messageParams: any = {
        body: message,
        to: normalizedPhone,
      };

      // Utiliser Messaging Service SID si disponible, sinon utiliser le numéro WhatsApp
      if (this.messagingServiceSid) {
        messageParams.messagingServiceSid = this.messagingServiceSid;
      } else if (this.whatsappFrom) {
        messageParams.from = this.whatsappFrom;
      } else {
        return {
          success: false,
          error: 'TWILIO_WHATSAPP_FROM ou TWILIO_MESSAGING_SERVICE_SID doit être configuré',
        };
      }

      console.log('[TwilioWhatsApp] 📱 Envoi WhatsApp vers', normalizedPhone);
      console.log('[TwilioWhatsApp] 📱 Depuis:', messageParams.messagingServiceSid || messageParams.from);

      // Envoyer le message via Twilio
      const twilioMessage = await this.twilioClient.messages.create(messageParams);

      console.log('[TwilioWhatsApp] ✅ WhatsApp envoyé avec succès');
      console.log('[TwilioWhatsApp] 📋 SID:', twilioMessage.sid);
      console.log('[TwilioWhatsApp] 📊 Statut:', twilioMessage.status);

      return {
        success: true,
        metadata: {
          sid: twilioMessage.sid,
          status: twilioMessage.status,
          to: normalizedPhone,
          from: messageParams.messagingServiceSid || messageParams.from,
        },
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur inconnue lors de l\'envoi WhatsApp';
      const errorCode = error.code || 'UNKNOWN';

      console.error('[TwilioWhatsApp] ❌ Erreur lors de l\'envoi WhatsApp:', errorMessage);
      console.error('[TwilioWhatsApp] 📋 Code d\'erreur:', errorCode);

      // Codes d'erreur Twilio courants
      let userFriendlyError = errorMessage;
      if (errorCode === 21211) {
        userFriendlyError = 'Numéro de téléphone invalide';
      } else if (errorCode === 21608) {
        userFriendlyError = 'Numéro WhatsApp non autorisé (pas dans la liste d\'approbation)';
      } else if (errorCode === 21614) {
        userFriendlyError = 'Numéro WhatsApp invalide ou non supporté';
      } else if (errorCode === 20003) {
        userFriendlyError = 'Authentification Twilio échouée (vérifiez Account SID et Auth Token)';
      } else if (errorCode === 20001) {
        userFriendlyError = 'Compte Twilio non autorisé ou suspendu';
      }

      return {
        success: false,
        error: userFriendlyError,
        metadata: {
          code: errorCode,
          originalError: errorMessage,
        },
      };
    }
  }
}

