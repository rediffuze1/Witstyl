/**
 * Implémentation du provider SMS utilisant Twilio SMS (pas WhatsApp)
 * 
 * Documentation Twilio SMS : https://www.twilio.com/docs/sms
 * 
 * Pour utiliser ce provider :
 * 1. Installer le package Twilio : npm install twilio
 * 2. Configurer les variables d'environnement (voir ci-dessous)
 * 3. Modifier server/core/notifications/index.ts pour utiliser TwilioSmsProvider
 */

import { SmsProvider } from '../../core/notifications/types.js';

type TwilioSmsProviderConfig = {
  accountSid?: string;
  authToken?: string;
  from?: string; // Numéro Twilio au format +14155238886 OU Sender ID alphanumérique (ex: "Witstyl")
  messagingServiceSid?: string; // Optionnel : utilisez un Messaging Service SID si vous en avez un
  dryRun?: boolean;
};

export class TwilioSmsProvider implements SmsProvider {
  private accountSid?: string;
  private authToken?: string;
  private from?: string;
  private messagingServiceSid?: string;
  private dryRun: boolean;
  private twilioClient: any;
  private twilioClientPromise: Promise<any> | null = null;

  constructor({
    accountSid,
    authToken,
    from,
    messagingServiceSid,
    dryRun = true,
  }: TwilioSmsProviderConfig) {
    this.accountSid = accountSid?.trim();
    this.authToken = authToken?.trim();
    this.from = from?.trim();
    this.messagingServiceSid = messagingServiceSid?.trim();
    this.dryRun = dryRun;

    // Vérifier que le numéro n'a pas le préfixe whatsapp: (c'est pour SMS, pas WhatsApp)
    if (from && from.startsWith('whatsapp:')) {
      console.warn('[TwilioSms] ⚠️  Le numéro SMS ne doit PAS avoir le préfixe "whatsapp:" (ex: +14155238886)');
    }

    // Détecter si c'est un Sender ID alphanumérique (nom) ou un numéro
    // Un Sender ID alphanumérique contient des lettres et fait généralement moins de 11 caractères
    const isAlphanumericSender = from && /^[A-Za-z0-9]+$/.test(from) && from.length <= 11 && /[A-Za-z]/.test(from);
    if (isAlphanumericSender) {
      console.log('[TwilioSms] 📝 Sender ID alphanumérique détecté:', from);
      console.log('[TwilioSms] ⚠️  Note: Les Sender ID alphanumériques ne sont pas disponibles dans tous les pays');
    }

    if (!this.dryRun) {
      if (!this.accountSid || !this.authToken) {
        throw new Error('TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN sont requis lorsque dryRun est false');
      }

      if (!this.from && !this.messagingServiceSid) {
        throw new Error('TWILIO_SMS_FROM (numéro ou Sender ID) ou TWILIO_MESSAGING_SERVICE_SID est requis lorsque dryRun est false');
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
      console.error('[TwilioSms] ❌ Erreur lors de l\'importation de Twilio:', error);
      console.error('[TwilioSms] 💡 Installez le package : npm install twilio');
      throw new Error('Package Twilio non installé. Exécutez: npm install twilio');
    }
  }

  /**
   * Normalise un numéro de téléphone au format international
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
   * Envoie un SMS via Twilio
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
      console.log(`[TwilioSms] 📞 Numéro normalisé: "${to}" → "${normalizedPhone}"`);
    } else {
      console.log(`[TwilioSms] 📞 Numéro: "${normalizedPhone}"`);
    }

    // Mode dry run : log le payload et retourner success sans appeler l'API
    if (this.dryRun) {
      console.log('[TwilioSms] [DRY RUN] Envoi SMS vers', normalizedPhone);
      console.log('[TwilioSms] [DRY RUN] Message:', message);
      console.log('[TwilioSms] [DRY RUN] Depuis:', this.from || this.messagingServiceSid || 'non configuré');
      return {
        success: true,
        metadata: {
          dryRun: true,
          to: normalizedPhone,
          from: this.from || this.messagingServiceSid,
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

      // Utiliser Messaging Service SID si disponible, sinon utiliser le numéro
      if (this.messagingServiceSid) {
        messageParams.messagingServiceSid = this.messagingServiceSid;
      } else if (this.from) {
        messageParams.from = this.from;
      } else {
        return {
          success: false,
          error: 'TWILIO_SMS_FROM ou TWILIO_MESSAGING_SERVICE_SID doit être configuré',
        };
      }

      console.log('[TwilioSms] 📱 Envoi SMS vers', normalizedPhone);
      console.log('[TwilioSms] 📱 Depuis:', messageParams.messagingServiceSid || messageParams.from);

      // Envoyer le message via Twilio
      const twilioMessage = await this.twilioClient.messages.create(messageParams);

      console.log('[TwilioSms] ✅ SMS envoyé avec succès');
      console.log('[TwilioSms] 📋 SID:', twilioMessage.sid);
      console.log('[TwilioSms] 📊 Statut:', twilioMessage.status);

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
      const errorMessage = error.message || 'Erreur inconnue lors de l\'envoi SMS';
      const errorCode = error.code || 'UNKNOWN';

      console.error('[TwilioSms] ❌ Erreur lors de l\'envoi SMS:', errorMessage);
      console.error('[TwilioSms] 📋 Code d\'erreur:', errorCode);

      // Codes d'erreur Twilio courants
      let userFriendlyError = errorMessage;
      if (errorCode === 21211) {
        userFriendlyError = 'Numéro de téléphone invalide';
      } else if (errorCode === 21266) {
        userFriendlyError = 'Le numéro destinataire ne peut pas être le même que le numéro expéditeur. Utilisez un autre numéro de test.';
      } else if (errorCode === 21408) {
        userFriendlyError = 'Permission non activée pour envoyer des SMS vers cette région. Activez les permissions géographiques dans votre compte Twilio ou utilisez un numéro d\'une région autorisée.';
      } else if (errorCode === 21659) {
        userFriendlyError = 'Le numéro TWILIO_SMS_FROM n\'est pas un numéro Twilio valide. Vous devez acheter un numéro Twilio dans la console Twilio (Phone Numbers → Buy a number) OU utiliser un Sender ID alphanumérique enregistré.';
      } else if (errorCode === 21620) {
        userFriendlyError = 'Le Sender ID alphanumérique n\'est pas disponible pour ce pays. Utilisez un numéro Twilio ou vérifiez les pays supportés pour les Sender ID.';
      } else if (errorCode === 21614) {
        userFriendlyError = 'Numéro de téléphone invalide ou non supporté';
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

