/**
 * Point d'entrée pour le système de notifications
 * 
 * Ce fichier instancie les providers concrets et le service de notifications.
 * 
 * IMPORTANT : Pour changer de provider :
 * 1. Créer une nouvelle implémentation de SmsProvider ou EmailProvider
 * 2. Modifier uniquement ce fichier pour utiliser le nouveau provider
 * 3. Aucune modification nécessaire dans NotificationService ni dans la logique métier
 * 
 * Exemple pour changer de SMSup à Twilio :
 * ```ts
 * import { TwilioSmsProvider } from '@/infrastructure/sms/TwilioSmsProvider';
 * const smsProvider = new TwilioSmsProvider(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
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
 * - SMSUP_API_KEY : Clé API SMSup (optionnel si SMS_DRY_RUN=true)
 * - SMSUP_SENDER : Nom de l'expéditeur SMS (défaut: "SalonPilot")
 * - SMSUP_API_URL : URL de l'API SMSup (défaut: "https://api.smsup.ch/send")
 * - RESEND_API_KEY : Clé API Resend (optionnel si EMAIL_DRY_RUN=true)
 * - RESEND_FROM : Adresse email de l'expéditeur (défaut: "SalonPilot <noreply@salonpilot.ch>")
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

import { NotificationService } from './NotificationService';
import { SmsUpProvider } from '../../infrastructure/sms/SmsUpProvider';
import { ResendEmailProvider } from '../../infrastructure/email/ResendEmailProvider';
import { SmsProvider, EmailProvider } from './types';
import { createNotificationSettingsRepository, NotificationSettingsRepository } from './NotificationSettingsRepository';
import { createClient } from '@supabase/supabase-js';

// Lire les variables d'environnement
const smsupApiKey = process.env.SMSUP_API_KEY || '';
const smsupSender = process.env.SMSUP_SENDER || 'SalonPilot';
const resendApiKey = process.env.RESEND_API_KEY || '';
const resendFrom = process.env.RESEND_FROM || 'SalonPilot <noreply@salonpilot.ch>';

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
console.log(`[Notifications] 📱 SMS: ${smsDryRun ? '⚠️  DRY RUN (log uniquement)' : '✅ ENVOI RÉEL'}`);
console.log(`[Notifications] 📧 Email: ${emailDryRun ? '⚠️  DRY RUN (log uniquement)' : '✅ ENVOI RÉEL'}`);
console.log(`[Notifications] 🔑 RESEND_API_KEY: ${resendApiKey ? '✅ Définie (' + resendApiKey.substring(0, 10) + '...)' : '❌ NON DÉFINIE'}`);
console.log(`[Notifications] 📧 RESEND_FROM: ${resendFrom || '❌ NON DÉFINI'}`);
console.log(`[Notifications] 🔧 EMAIL_DRY_RUN: ${process.env.EMAIL_DRY_RUN || 'non défini (défaut: false)'}`);
console.log(`[Notifications] 🔧 NOTIFICATIONS_DRY_RUN: ${process.env.NOTIFICATIONS_DRY_RUN || 'non défini'}`);
if (legacyDryRun && (process.env.SMS_DRY_RUN === undefined || process.env.EMAIL_DRY_RUN === undefined)) {
  console.log('[Notifications] ⚠️  NOTIFICATIONS_DRY_RUN est utilisé comme fallback (déprécié)');
  console.log('[Notifications] 💡 Utilisez SMS_DRY_RUN et EMAIL_DRY_RUN pour un contrôle indépendant');
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
if (smsDryRun || smsupApiKey) {
  smsProvider = new SmsUpProvider(smsupApiKey, smsupSender, smsDryRun);
  if (!smsDryRun && !smsupApiKey) {
    console.warn('[Notifications] SMSUP_API_KEY non définie, mais provider créé en mode dry run');
  }
} else {
  console.warn('[Notifications] SMSUP_API_KEY non définie et SMS_DRY_RUN=false, création d\'un provider mock');
  // Créer un provider mock pour le développement
  smsProvider = {
    async sendSms({ to, message }) {
      console.log('[Notifications] [MOCK SMS] Envoi à', to, ':', message);
      return { success: true };
    }
  };
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

