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

type SmsUpProviderConfig = {
  token?: string;
  sender: string;
  apiUrl?: string;
  dryRun?: boolean;
  /**
   * Anciennes variables pour rétro-compatibilité / messages d'erreur plus clairs.
   * Elles ne sont plus utilisées pour l'appel réel mais permettent d'avertir l'utilisateur.
   */
  legacyLogin?: string;
  legacyPassword?: string;
};

export class SmsUpProvider implements SmsProvider {
  private token?: string;
  private sender: string;
  private apiUrl: string;
  private dryRun: boolean;
  private legacyLogin?: string;
  private legacyPassword?: string;

  constructor({
    token,
    sender,
    apiUrl,
    dryRun = true,
    legacyLogin,
    legacyPassword,
  }: SmsUpProviderConfig) {
    if (!sender) {
      throw new Error('SMSUP_SENDER is required');
    }

    this.token = token?.trim();
    this.sender = sender;
    this.dryRun = dryRun;
    this.legacyLogin = legacyLogin;
    this.legacyPassword = legacyPassword;
    this.apiUrl = apiUrl || process.env.SMSUP_API_URL || 'https://api.smsup.ch/send';

    if (!this.dryRun && !this.token) {
      throw new Error('SMSUP_API_TOKEN is required when dryRun is false');
    }
  }

  /**
   * Envoie un SMS via SMSup
   * @param params - Paramètres d'envoi
   * @param params.to - Numéro de téléphone au format international (ex: +41791234567)
   * @param params.message - Message à envoyer (max 160 caractères pour SMS simple)
   * @returns Résultat de l'envoi avec success: true si réussi, false sinon avec un message d'erreur
   */
  async sendSms({
    to,
    message,
  }: {
    to: string;
    message: string;
  }): Promise<{ success: boolean; error?: string; metadata?: Record<string, unknown> }> {
    // Normaliser le numéro de téléphone (s'assurer qu'il commence par +)
    const normalizedPhone = this.normalizePhoneNumber(to);
    
    // Log du numéro original vs normalisé pour debug
    if (to !== normalizedPhone) {
      console.log(`[SmsUp] 📞 Numéro normalisé: "${to}" → "${normalizedPhone}"`);
    } else {
      console.log(`[SmsUp] 📞 Numéro: "${normalizedPhone}"`);
    }

    // Vérifier la longueur du message (SMSup limite généralement à 160 caractères pour SMS simple)
    if (message.length > 160) {
      console.warn(`[SmsUp] Message trop long (${message.length} caractères), risque de SMS multipart`);
    }

    const payloadForLogs = {
      text: message,
      to: normalizedPhone,
      sender: this.sender,
    };
    const payloadForRequest = {
      to: normalizedPhone,
      text: message,
      sender: this.sender,
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
      console.log('[SmsUp] [DRY RUN]   Payload:');
      console.log(JSON.stringify(payloadForLogs, null, 2));
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      return { success: true };
    }

    try {
      if (!this.token) {
        const legacyInfo = this.legacyLogin || this.legacyPassword
          ? ' (les anciennes variables SMSUP_LOGIN / SMSUP_PASSWORD ne sont plus supportées)'
          : '';
        const errorMessage = `[SmsUp] ❌ Impossible d'envoyer le SMS: SMSUP_API_TOKEN manquant${legacyInfo}`;
        console.error(errorMessage);
        return { success: false, error: errorMessage };
      }

      console.log(`[SmsUp] ENVOI RÉEL → ${normalizedPhone}`);
      console.log(`[SmsUp] URL de base: ${this.apiUrl}`);
      console.log(`[SmsUp] Sender original: "${this.sender}"`);
      console.log(`[SmsUp] Payload avant nettoyage:`, JSON.stringify(payloadForLogs, null, 2));
      
      const requestUrl = this.buildRequestUrl(payloadForRequest);
      // Extraire le sender final depuis l'URL pour voir ce qui est réellement envoyé
      const urlObj = new URL(requestUrl);
      const finalSender = urlObj.searchParams.get('sender');
      console.log(`[SmsUp] Sender final dans l'URL: "${finalSender}"`);
      console.log(`[SmsUp] URL complète de la requête (token masqué): ${requestUrl.replace(new RegExp(this.token, 'g'), 'TOKEN_MASQUÉ')}`);

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      });

      const responseText = await response.text();
      console.log(`[SmsUp] Réponse HTTP ${response.status}:`, responseText);

      if (!response.ok) {
        const errorMessage = `SMSUP_SEND_FAILED: HTTP ${response.status} - ${responseText}`;
        console.error(`[SmsUp] Erreur HTTP ${response.status}:`, responseText);
        return { success: false, error: errorMessage };
      }

      const parsed = this.safeParseJson(responseText);
      const status = parsed?.status ?? -1;
      const messageText = parsed?.message ?? 'Réponse SMSup non interprétée';

      const isModerationPending = status === -8;

      if (status < 0 && !isModerationPending) {
        const errorMessage = `SMSUP_SEND_FAILED: Status ${status} - ${messageText}`;
        console.error(`[SmsUp] Erreur API (status ${status}):`, messageText);
        return { success: false, error: errorMessage };
      }

      if (isModerationPending) {
        console.warn('');
        console.warn('═══════════════════════════════════════════════════════════════');
        console.warn(`[SmsUp] ⚠️  STATUT -8 : MODÉRATION EN ATTENTE`);
        console.warn('═══════════════════════════════════════════════════════════════');
        console.warn(`[SmsUp] 📋 Ticket: ${parsed?.ticket || 'N/A'}`);
        console.warn(`[SmsUp] 📞 Destinataire: ${normalizedPhone}`);
        console.warn(`[SmsUp] 📝 Expéditeur: ${this.sender}`);
        console.warn(`[SmsUp] 💰 Coût: ${parsed?.cost || 'N/A'} crédit(s) (débité)`);
        console.warn('');
        console.warn(`[SmsUp] ❌ PROBLÈME : L'expéditeur "${this.sender}" n'est pas encore validé dans SMSup.`);
        console.warn(`[SmsUp] 📱 Le SMS est accepté mais BLOQUÉ jusqu'à validation de l'expéditeur.`);
        console.warn('');
        console.warn(`[SmsUp] ✅ ACTION REQUISE :`);
        console.warn(`[SmsUp]    1. Connectez-vous au dashboard SMSup`);
        console.warn(`[SmsUp]    2. Allez dans l'onglet "Expéditeurs" ou "Senders"`);
        console.warn(`[SmsUp]    3. Validez/Approuvez l'expéditeur "${this.sender}"`);
        console.warn(`[SmsUp]    4. Vérifiez le ticket ${parsed?.ticket || 'N/A'} dans l'historique`);
        console.warn('');
        console.warn(`[SmsUp] ⏳ Une fois validé, ce SMS partira automatiquement (5-15 min).`);
        console.warn(`[SmsUp] 🚀 Les prochains SMS partiront directement (statut 1).`);
        console.warn('═══════════════════════════════════════════════════════════════');
        console.warn('');
      } else {
        console.log(`[SmsUp] ✅ SMS envoyé avec succès à ${normalizedPhone} (status: ${status}, ticket: ${parsed?.ticket || 'N/A'})`);
      }

      return {
        success: true,
        metadata: {
          status,
          ticket: parsed?.ticket,
          cost: parsed?.cost,
          raw: responseText,
          moderated: isModerationPending,
          message: messageText,
        },
      };
    } catch (error: any) {
      const errorMessage = `SMSUP_SEND_FAILED: ${error.message || 'Erreur inconnue'}`;
      console.error('[SmsUp] Erreur lors de l\'envoi du SMS:', error);
      return { success: false, error: errorMessage };
    }
  }

  private buildRequestUrl({ to, text, sender }: { to: string; text: string; sender: string }) {
    const url = new URL(this.apiUrl);
    const params = url.searchParams;
    params.set('to', to);
    params.set('text', text);
    if (sender) {
      // Nettoyer le sender : retirer le + si c'est un numéro (les senders ne doivent pas avoir de +)
      // Les senders peuvent être des noms (ex: "SalonPilot") ou des numéros sans préfixe (ex: "41791338240")
      const cleanedSender = sender.startsWith('+') ? sender.substring(1) : sender;
      params.set('sender', cleanedSender);
    }
    return url.toString();
  }

  private safeParseJson(responseText: string) {
    try {
      return JSON.parse(responseText);
    } catch {
      return null;
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

