/**
 * Point d'entrée pour le système de notifications
 * 
 * Ce fichier instancie les providers concrets et le service de notifications.
 * 
 * IMPORTANT : Seul ClickSend est maintenant supporté pour les SMS.
 * Twilio et SMSup ne sont plus utilisés.
 * 
 * Pour changer de provider (si nécessaire dans le futur) :
 * 1. Créer une nouvelle implémentation de SmsProvider ou EmailProvider
 * 2. Modifier uniquement ce fichier pour utiliser le nouveau provider
 * 3. Aucune modification nécessaire dans NotificationService ni dans la logique métier
 * 
 * Exemple pour utiliser ClickSend (déjà configuré) :
 * ```ts
 * import { ClickSendSmsProvider } from '@/infrastructure/sms/ClickSendSmsProvider';
 * const smsProvider = new ClickSendSmsProvider({
 *   username: process.env.CLICKSEND_USERNAME!,
 *   apiKey: process.env.CLICKSEND_API_KEY!,
 *   from: process.env.CLICKSEND_SMS_FROM!,
 *   dryRun: process.env.SMS_DRY_RUN === 'true',
 * });
 * ```
 * 
 * ============================================================================
 * UTILISATION DANS LE CODE
 * ============================================================================
 * 
 * Pour utiliser le service de notifications dans votre code :
 * 
 * ```ts
 * import { notificationService } from './core/notifications/index.js';
 * import { buildNotificationContext } from './core/notifications/utils.js';
 * 
 * // Après avoir créé/modifié un rendez-vous
 * const context = await buildNotificationContext(appointmentId, supabase);
 * if (context) {
 *   await notificationService.sendBookingConfirmation(context);
 * }
 * ```
 * 
 * ============================================================================
 * VARIABLES D'ENVIRONNEMENT REQUISES
 * ============================================================================
 * 
 * - SMSUP_API_TOKEN : Token API SMSup (optionnel si SMS_DRY_RUN=true)
 * - SMSUP_SENDER : Nom de l'expéditeur SMS (défaut: "Witstyl") - Legacy, non utilisé
 * - SMSUP_LOGIN / SMSUP_PASSWORD : (legacy) uniquement pour les logs / debug - Non utilisé
 * - SMSUP_API_URL : URL de l'API SMSup (défaut: "https://api.smsup.ch/send") - Legacy, non utilisé
 * - RESEND_API_KEY : Clé API Resend (optionnel si EMAIL_DRY_RUN=true)
 * - RESEND_FROM : Adresse email de l'expéditeur (défaut: "Witstyl <noreply@witstyl.ch>")
 * - CLICKSEND_USERNAME : Username ClickSend (obligatoire si SMS_DRY_RUN=false)
 * - CLICKSEND_API_KEY : Clé API ClickSend (obligatoire si SMS_DRY_RUN=false)
 * - CLICKSEND_SMS_FROM : Sender ID alphanumérique ou numéro (ex: "Witstyl" ou "+41791234567")
 * - SMS_DRY_RUN : "true" pour activer le mode dry-run pour les SMS (défaut: true)
 * - EMAIL_DRY_RUN : "true" pour activer le mode dry-run pour les emails (défaut: false)
 * - NOTIFICATIONS_DRY_RUN : (déprécié) Fallback pour rétrocompatibilité, utilisez SMS_DRY_RUN et EMAIL_DRY_RUN
 * 
 * ============================================================================
 * MODE DRY RUN (SMS et EMAIL indépendants)
 * ============================================================================
 * 
 * Les modes dry-run sont maintenant indépendants pour SMS et Email :
 * 
 * - SMS_DRY_RUN=true (défaut) : Les SMS sont loggés mais pas envoyés
 * - EMAIL_DRY_RUN=false (défaut) : Les emails sont réellement envoyés
 * 
 * Configuration recommandée :
 * - Développement local : SMS_DRY_RUN=true, EMAIL_DRY_RUN=true
 * - Production : SMS_DRY_RUN=true, EMAIL_DRY_RUN=false (emails réels, SMS en test)
 * 
 * En mode dry-run :
 * - Les notifications sont loggées dans la console mais pas envoyées
 * - Aucune clé API n'est requise pour le canal en dry-run
 * - Utile pour tester sans consommer de crédits
 * 
 * En mode réel :
 * - Les notifications sont réellement envoyées aux providers
 * - Les clés API sont requises
 * - Les erreurs sont loggées mais n'interrompent pas le flux principal
 * 
 * ============================================================================
 * POINT D'ENTRÉE EXPORTÉ
 * ============================================================================
 * 
 * - notificationService : Instance de NotificationService prête à l'emploi
 * - BookingNotificationContext : Type TypeScript pour le contexte de notification
 */

import { NotificationService } from './NotificationService.js';
// Uniquement ClickSend est utilisé maintenant (Twilio et SMSup ne sont plus supportés)
import { ClickSendSmsProvider } from '../../infrastructure/sms/ClickSendSmsProvider.js';
import { ResendEmailProvider } from '../../infrastructure/email/ResendEmailProvider.js';
import { SmsProvider, EmailProvider } from './types.js';
import { createNotificationSettingsRepository, NotificationSettingsRepository } from './NotificationSettingsRepository.js';
import { createClient } from '@supabase/supabase-js';

// Lire les variables d'environnement
// Provider SMS : uniquement 'clicksend' (Twilio et SMSup ne sont plus utilisés)
const smsProviderType = process.env.SMS_PROVIDER || 'clicksend'; // Uniquement 'clicksend'

// Variables SMSup (legacy)
const smsupToken = process.env.SMSUP_API_TOKEN || '';
const smsupLogin = process.env.SMSUP_LOGIN || '';
const smsupPassword = process.env.SMSUP_PASSWORD || '';
const smsupSender = process.env.SMSUP_SENDER || 'Witstyl';

// Variables Twilio (partagées entre SMS et WhatsApp)
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || ''; // Optionnel

// Variables Twilio WhatsApp
const twilioWhatsappFrom = process.env.TWILIO_WHATSAPP_FROM || ''; // Format: whatsapp:+14155238886

// Variables Twilio SMS
const twilioSmsFrom = process.env.TWILIO_SMS_FROM || ''; // Format: +14155238886 (sans préfixe whatsapp:)

// Variables ClickSend
const clicksendUsername = process.env.CLICKSEND_USERNAME || '';
const clicksendApiKey = process.env.CLICKSEND_API_KEY || '';
const clicksendSmsFrom = process.env.CLICKSEND_SMS_FROM || ''; // Sender ID alphanumérique ou numéro

// Variables Email
const resendApiKey = process.env.RESEND_API_KEY || '';
const resendFrom = process.env.RESEND_FROM || 'Witstyl <noreply@witstyl.ch>';

// ============================================================================
// CONFIGURATION DRY-RUN (SMS et EMAIL séparés)
// ============================================================================
// 
// Ancienne logique (dépréciée) : NOTIFICATIONS_DRY_RUN contrôlait les deux
// Nouvelle logique : SMS_DRY_RUN et EMAIL_DRY_RUN sont indépendants
//
// Si NOTIFICATIONS_DRY_RUN est défini, il est utilisé comme fallback pour
// rétrocompatibilité, mais SMS_DRY_RUN et EMAIL_DRY_RUN ont la priorité.
// ============================================================================

// Lire les flags dry-run séparés pour SMS et Email
// Valeurs par défaut :
// - SMS_DRY_RUN: true (SMS en mode test par défaut)
// - EMAIL_DRY_RUN: false (emails réellement envoyés par défaut)
// 
// IMPORTANT: EMAIL_DRY_RUN et SMS_DRY_RUN ont la priorité absolue.
// NOTIFICATIONS_DRY_RUN n'est utilisé que comme fallback SI les flags spécifiques ne sont pas définis.
const legacyDryRun = process.env.NOTIFICATIONS_DRY_RUN === 'true';

// Pour SMS: défaut = true (dry run)
const smsDryRun = process.env.SMS_DRY_RUN !== undefined
  ? process.env.SMS_DRY_RUN === 'true'
  : (legacyDryRun !== undefined ? legacyDryRun : true); // Fallback vers legacyDryRun si défini, sinon true

// Pour EMAIL: défaut = false (envoi réel) - PRIORITÉ ABSOLUE
// EMAIL_DRY_RUN a la priorité absolue. Si non défini, on utilise false (envoi réel).
// NOTIFICATIONS_DRY_RUN n'est utilisé QUE si EMAIL_DRY_RUN n'est pas défini (pour rétrocompatibilité).
// Mais par défaut, si rien n'est défini, on envoie réellement (false).
const emailDryRun = process.env.EMAIL_DRY_RUN !== undefined
  ? process.env.EMAIL_DRY_RUN === 'true'
  : (process.env.NOTIFICATIONS_DRY_RUN !== undefined ? legacyDryRun : false); // Fallback vers legacyDryRun SEULEMENT si NOTIFICATIONS_DRY_RUN est défini, sinon false (envoi réel)

// Logs de configuration (TOUJOURS afficher pour debug)
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('[Notifications] ⚙️  CONFIGURATION DES NOTIFICATIONS');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`[Notifications] 📱 SMS Provider: ${smsProviderType.toUpperCase()}`);
console.log(`[Notifications] 📱 SMS: ${smsDryRun ? '⚠️  DRY RUN (log uniquement)' : '✅ ENVOI RÉEL'}`);
// Uniquement ClickSend est supporté
if (smsProviderType === 'clicksend') {
  console.log(`[Notifications] 🔑 CLICKSEND_USERNAME: ${clicksendUsername ? `✅ Défini (${clicksendUsername.substring(0, 10)}… )` : '❌ NON DÉFINI'}`);
  console.log(`[Notifications] 🔑 CLICKSEND_API_KEY: ${clicksendApiKey ? `✅ Défini (${clicksendApiKey.substring(0, 8)}… )` : '❌ NON DÉFINI'}`);
  console.log(`[Notifications] 📱 CLICKSEND_SMS_FROM: ${clicksendSmsFrom || '❌ NON DÉFINI'}`);
} else {
  console.log(`[Notifications] ⚠️  ATTENTION: SMS_PROVIDER="${smsProviderType}" n'est pas supporté. Seul "clicksend" est disponible.`);
  console.log(`[Notifications] 💡 Utilisation de ClickSend par défaut.`);
}
console.log(`[Notifications] 🔧 SMS_DRY_RUN: ${process.env.SMS_DRY_RUN || 'non défini (défaut: true)'}`);
console.log(`[Notifications] 📧 Email: ${emailDryRun ? '⚠️  DRY RUN (log uniquement)' : '✅ ENVOI RÉEL'}`);
console.log(`[Notifications] 🔑 RESEND_API_KEY: ${resendApiKey ? '✅ Définie (' + resendApiKey.substring(0, 10) + '...)' : '❌ NON DÉFINIE'}`);
console.log(`[Notifications] 📧 RESEND_FROM: ${resendFrom || '❌ NON DÉFINI'}`);
console.log(`[Notifications] 🔧 EMAIL_DRY_RUN: ${process.env.EMAIL_DRY_RUN || 'non défini (défaut: false)'}`);
console.log(`[Notifications] 🔧 NOTIFICATIONS_DRY_RUN: ${process.env.NOTIFICATIONS_DRY_RUN || 'non défini'}`);
if (legacyDryRun && (process.env.SMS_DRY_RUN === undefined || process.env.EMAIL_DRY_RUN === undefined)) {
  console.log('[Notifications] ⚠️  NOTIFICATIONS_DRY_RUN est utilisé comme fallback (déprécié)');
  console.log('[Notifications] 💡 Utilisez SMS_DRY_RUN et EMAIL_DRY_RUN pour un contrôle indépendant');
}
if (smsDryRun) {
  console.log('[Notifications] ⚠️  ATTENTION: Les SMS sont en mode DRY RUN - aucun SMS ne sera réellement envoyé !');
}
if (!smsDryRun) {
  if (smsProviderType === 'clicksend' && (!clicksendUsername || !clicksendApiKey)) {
    console.log('[Notifications] ❌ ERREUR: SMS_DRY_RUN=false mais CLICKSEND_USERNAME ou CLICKSEND_API_KEY non défini !');
    console.log('[Notifications] ❌ Les SMS ne pourront pas être envoyés.');
  } else if (smsProviderType === 'clicksend' && !clicksendSmsFrom) {
    console.log('[Notifications] ❌ ERREUR: CLICKSEND_SMS_FROM non défini !');
    console.log('[Notifications] ❌ Les SMS ne pourront pas être envoyés.');
  }
}
if (emailDryRun) {
  console.log('[Notifications] ⚠️  ATTENTION: Les emails sont en mode DRY RUN - aucun email ne sera réellement envoyé !');
}
if (!emailDryRun && !resendApiKey) {
  console.log('[Notifications] ❌ ERREUR: EMAIL_DRY_RUN=false mais RESEND_API_KEY non définie !');
  console.log('[Notifications] ❌ Les emails ne pourront pas être envoyés.');
}
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Instancier les providers avec leurs flags dry-run respectifs
// En mode dry run, on peut créer les providers même sans clés API
// Sinon, on crée des providers mock si les clés ne sont pas définies
let smsProvider: SmsProvider;
let emailProvider: EmailProvider;

// Provider SMS avec son propre flag dry-run
// Uniquement ClickSend (Twilio et SMSup ne sont plus utilisés)
if (smsProviderType === 'clicksend') {
  smsProvider = new ClickSendSmsProvider({
    username: clicksendUsername,
    apiKey: clicksendApiKey,
    from: clicksendSmsFrom,
    dryRun: smsDryRun,
  });
} else {
  // Fallback vers ClickSend si SMS_PROVIDER n'est pas défini ou invalide
  console.warn(`[Notifications] ⚠️  SMS_PROVIDER="${smsProviderType}" non supporté. Utilisation de ClickSend par défaut.`);
  smsProvider = new ClickSendSmsProvider({
    username: clicksendUsername,
    apiKey: clicksendApiKey,
    from: clicksendSmsFrom,
    dryRun: smsDryRun,
  });
}

// Provider Email avec son propre flag dry-run
if (emailDryRun || resendApiKey) {
  emailProvider = new ResendEmailProvider(resendApiKey, resendFrom, emailDryRun);
  if (!emailDryRun && !resendApiKey) {
    console.warn('[Notifications] RESEND_API_KEY non définie, mais provider créé en mode dry run');
  }
} else {
  console.warn('[Notifications] RESEND_API_KEY non définie et EMAIL_DRY_RUN=false, création d\'un provider mock');
  // Créer un provider mock pour le développement
  emailProvider = {
    async sendEmail({ to, subject, html }) {
      console.log('[Notifications] [MOCK EMAIL] Envoi à', to, ':', subject);
      console.log('[Notifications] [MOCK EMAIL] Contenu:', html.substring(0, 200) + '...');
      return { success: true };
    }
  };
}

// Factory pour créer le repository de settings (nécessite Supabase)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createSettingsRepositoryFactory(): (salonId: string) => NotificationSettingsRepository {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('[Notifications] ⚠️  SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non définis, les templates personnalisés ne seront pas disponibles');
    // Retourner une factory qui crée un repository mock (utilisera les templates par défaut)
    return (salonId: string) => {
      // Créer un client Supabase mock (ne fonctionnera pas mais évitera les erreurs)
      const mockSupabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_SERVICE_KEY || 'placeholder');
      return createNotificationSettingsRepository(mockSupabase);
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  return (salonId: string) => {
    return createNotificationSettingsRepository(supabase);
  };
}

// Instancier le service de notifications avec la factory du repository
export const notificationService = new NotificationService(
  smsProvider,
  emailProvider,
  createSettingsRepositoryFactory(),
);

// Exporter aussi les types pour faciliter l'utilisation
export type { BookingNotificationContext } from './types';

