/**
 * Script de test pour envoyer un SMS directement via SMSup
 * Permet de diagnostiquer les problèmes d'envoi SMS
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SmsUpProvider } from '../server/infrastructure/sms/SmsUpProvider';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env') });

const SMSUP_API_TOKEN = process.env.SMSUP_API_TOKEN || '';
const SMSUP_SENDER = process.env.SMSUP_SENDER || 'SalonPilot';
const SMS_DRY_RUN = process.env.SMS_DRY_RUN ?? 'true';
const TEST_PHONE = process.argv[2] || '+41791338240'; // Votre numéro par défaut

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 TEST D\'ENVOI SMS DIRECT VIA SMSUP');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('Configuration:');
console.log(
  '  SMSUP_API_TOKEN:',
  SMSUP_API_TOKEN ? `${SMSUP_API_TOKEN.substring(0, 4)}…` : '❌ NON DÉFINI',
);
console.log('  SMSUP_SENDER:', SMSUP_SENDER);
console.log('  SMS_DRY_RUN:', SMS_DRY_RUN);
console.log('  TEST_PHONE:', TEST_PHONE);
console.log('');

if (!SMSUP_API_TOKEN && SMS_DRY_RUN === 'false') {
  console.error('❌ ERREUR: SMSUP_API_TOKEN est requis lorsque SMS_DRY_RUN=false');
  process.exit(1);
}

// Normaliser le numéro de téléphone
function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('0')) {
      normalized = '+41' + normalized.substring(1);
    } else {
      normalized = '+41' + normalized;
    }
  }
  
  return normalized;
}

const normalizedPhone = normalizePhoneNumber(TEST_PHONE);
const testMessage = 'Test SMS depuis SalonPilot - ' + new Date().toLocaleString('fr-CH');

async function testSms() {
  try {
    const dryRun = SMS_DRY_RUN === 'true';
    const provider = new SmsUpProvider({
      token: SMSUP_API_TOKEN,
      sender: SMSUP_SENDER,
      dryRun,
      legacyLogin: process.env.SMSUP_LOGIN,
      legacyPassword: process.env.SMSUP_PASSWORD,
      apiUrl: process.env.SMSUP_API_URL,
    });

    console.log(`📤 Tentative d'envoi vers ${normalizedPhone} (dry-run=${dryRun})...`);
    const result = await provider.sendSms({
      to: normalizedPhone,
      message: testMessage,
    });

    if (!result.success) {
      console.error('❌ Envoi échoué:', result.error);
      process.exit(1);
    }

    console.log('');
    if (dryRun) {
      console.log('✅ Simulation terminée. Aucune requête réseau n’a été effectuée.');
    } else {
      console.log('✅ SMS envoyé avec succès !');
      console.log('   Vérifiez votre téléphone et le dashboard SMSup');
      if (result.metadata) {
        console.log('   Détails:', JSON.stringify(result.metadata, null, 2));
      }
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

