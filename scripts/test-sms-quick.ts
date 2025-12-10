#!/usr/bin/env tsx

/**
 * Script de test rapide pour l'envoi de SMS
 * 
 * Usage:
 *   tsx scripts/test-sms-quick.ts
 *   tsx scripts/test-sms-quick.ts +41791234567
 *   tsx scripts/test-sms-quick.ts +41791234567 "Mon message de test"
 */

import 'dotenv/config';
import { notificationService } from '../server/core/notifications/index.js';

const testPhone = process.argv[2] || '+41791234567';
const testMessage = process.argv[3] || 'Test SMS depuis SalonPilot - ClickSend';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 Test d\'envoi SMS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📱 Numéro: ${testPhone}`);
  console.log(`💬 Message: ${testMessage}`);
  console.log('');

  // Vérifier la configuration
  const smsProvider = process.env.SMS_PROVIDER || 'twilio-sms';
  const smsDryRun = process.env.SMS_DRY_RUN === 'true' || process.env.SMS_DRY_RUN === undefined;
  
  console.log(`⚙️  Provider: ${smsProvider}`);
  console.log(`⚙️  Mode: ${smsDryRun ? '⚠️  DRY RUN (log uniquement)' : '✅ ENVOI RÉEL'}`);
  console.log('');

  if (smsDryRun) {
    console.log('ℹ️  Mode DRY RUN activé : le SMS sera loggé mais pas envoyé');
    console.log('   Pour envoyer de vrais SMS, mettez SMS_DRY_RUN=false dans .env');
    console.log('');
  }

  try {
    const result = await notificationService.sendSms({
      to: testPhone,
      message: testMessage,
    });

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 Résultat:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    if (result.success) {
      console.log('✅ Test réussi !');
      if (result.metadata?.dryRun) {
        console.log('⚠️  Mode DRY RUN : SMS loggé mais pas envoyé');
        console.log('   Pour envoyer de vrais SMS, mettez SMS_DRY_RUN=false dans .env');
      } else {
        console.log('📱 SMS réellement envoyé !');
        if (result.metadata) {
          console.log('📋 Métadonnées:', JSON.stringify(result.metadata, null, 2));
        }
      }
    } else {
      console.log('❌ Test échoué :', result.error);
      if (result.metadata) {
        console.log('📋 Métadonnées:', JSON.stringify(result.metadata, null, 2));
      }
    }
    console.log('');

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error('❌ Erreur lors du test:', error);
    console.error('   Détails:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});


