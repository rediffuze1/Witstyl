/**
 * Script de test pour envoyer un SMS directement via Twilio
 * Permet de tester l'envoi SMS sur votre propre numéro
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TwilioSmsProvider } from '../server/infrastructure/sms/TwilioSmsProvider';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env') });

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM || '';
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID || '';
const SMS_DRY_RUN = process.env.SMS_DRY_RUN ?? 'true';
const TEST_PHONE = process.argv[2]; // Votre numéro de téléphone en argument

if (!TEST_PHONE) {
  console.error('❌ ERREUR: Vous devez fournir un numéro de téléphone');
  console.error('');
  console.error('Usage:');
  console.error('  npx tsx scripts/test-twilio-sms.ts +41791234567');
  console.error('');
  console.error('Exemple:');
  console.error('  npx tsx scripts/test-twilio-sms.ts +41791234567');
  process.exit(1);
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 TEST D\'ENVOI SMS DIRECT VIA TWILIO');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('Configuration:');
console.log(
  '  TWILIO_ACCOUNT_SID:',
  TWILIO_ACCOUNT_SID ? `${TWILIO_ACCOUNT_SID.substring(0, 4)}…` : '❌ NON DÉFINI',
);
console.log(
  '  TWILIO_AUTH_TOKEN:',
  TWILIO_AUTH_TOKEN ? '✅ Défini' : '❌ NON DÉFINI',
);
console.log('  TWILIO_SMS_FROM:', TWILIO_SMS_FROM || '❌ NON DÉFINI');
if (TWILIO_MESSAGING_SERVICE_SID) {
  console.log('  TWILIO_MESSAGING_SERVICE_SID:', '✅ Défini (priorité)');
}
console.log('  SMS_DRY_RUN:', SMS_DRY_RUN);
console.log('  TEST_PHONE:', TEST_PHONE);
console.log('');

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.error('❌ ERREUR: TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN sont requis');
  process.exit(1);
}

if (!TWILIO_SMS_FROM && !TWILIO_MESSAGING_SERVICE_SID) {
  console.error('❌ ERREUR: TWILIO_SMS_FROM ou TWILIO_MESSAGING_SERVICE_SID est requis');
  process.exit(1);
}

// Normaliser le numéro de téléphone
function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('00')) {
      normalized = '+' + normalized.substring(2);
    } else if (normalized.startsWith('0')) {
      normalized = '+41' + normalized.substring(1);
    } else {
      normalized = '+' + normalized;
    }
  }
  
  return normalized;
}

const normalizedPhone = normalizePhoneNumber(TEST_PHONE);
const testMessage = `Test SMS depuis SalonPilot - ${new Date().toLocaleString('fr-CH')}\n\nCeci est un message de test pour vérifier la configuration Twilio.`;

async function testSms() {
  try {
    const dryRun = SMS_DRY_RUN === 'true';
    const provider = new TwilioSmsProvider({
      accountSid: TWILIO_ACCOUNT_SID,
      authToken: TWILIO_AUTH_TOKEN,
      from: TWILIO_SMS_FROM,
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      dryRun,
    });

    console.log(`📤 Tentative d'envoi vers ${normalizedPhone} (dry-run=${dryRun})...`);
    console.log('');
    
    const result = await provider.sendSms({
      to: normalizedPhone,
      message: testMessage,
    });

    if (!result.success) {
      console.error('❌ Envoi échoué:', result.error);
      if (result.metadata?.code) {
        console.error('   Code d\'erreur:', result.metadata.code);
      }
      process.exit(1);
    }

    console.log('');
    if (dryRun) {
      console.log('✅ Simulation terminée. Aucune requête réseau n\'a été effectuée.');
      console.log('');
      console.log('💡 Pour envoyer un vrai SMS, mettez SMS_DRY_RUN=false dans votre .env');
    } else {
      console.log('✅ SMS envoyé avec succès !');
      console.log('   Vérifiez votre téléphone dans quelques secondes');
      if (result.metadata) {
        console.log('');
        console.log('   Détails:');
        console.log('   - SID:', result.metadata.sid);
        console.log('   - Statut:', result.metadata.status);
        console.log('   - Vers:', result.metadata.to);
        console.log('   - Depuis:', result.metadata.from);
      }
      console.log('');
      console.log('💡 Vous pouvez vérifier le message dans la console Twilio:');
      console.log('   https://console.twilio.com/us1/monitor/logs/sms');
    }
    console.log('');
  } catch (error: any) {
    console.error('❌ ERREUR lors de l\'envoi du SMS:');
    console.error('   Type:', error.constructor.name);
    console.error('   Message:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

testSms();


