#!/usr/bin/env tsx

/**
 * Script pour configurer les cron jobs automatiquement
 * 
 * Ce script configure les cron jobs pour les notifications intelligentes
 * en utilisant node-cron dans le serveur Express.
 * 
 * Usage:
 *   tsx scripts/setup-cron-jobs.ts
 * 
 * Ou importez-le dans server/index.ts pour l'activer automatiquement
 */

import 'dotenv/config';

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('⏰ Configuration des cron jobs pour les notifications');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Vérifier si node-cron est installé
let cron: any;
try {
  const cronModule = await import('node-cron');
  cron = cronModule.default;
  console.log('✅ node-cron trouvé');
} catch (error) {
  console.warn('⚠️  node-cron non installé');
  console.log('   Installez-le avec: npm install node-cron');
  console.log('   Ou configurez les cron jobs via votre système (crontab, Vercel Cron, etc.)');
  console.log('');
  process.exit(0);
}

// Fonction pour exécuter le cron job de vérification email ouvert
async function runCheckEmailOpened() {
  try {
    console.log('[Cron] 🕐 Exécution du cron job: check-email-opened-and-send-sms');
    await import('../server/cron/check-email-opened-and-send-sms.js');
  } catch (error: any) {
    console.error('[Cron] ❌ Erreur lors de l\'exécution du cron job:', error);
  }
}

// Fonction pour exécuter le cron job de rappel SMS
async function runSendReminder() {
  try {
    console.log('[Cron] 🕐 Exécution du cron job: send-reminder-sms');
    await import('../server/cron/send-reminder-sms.js');
  } catch (error: any) {
    console.error('[Cron] ❌ Erreur lors de l\'exécution du cron job:', error);
  }
}

// Configurer les cron jobs
// Toutes les heures à la minute 0
cron.schedule('0 * * * *', async () => {
  await runCheckEmailOpened();
});

// Toutes les heures à la minute 0 (même schedule)
cron.schedule('0 * * * *', async () => {
  await runSendReminder();
});

console.log('✅ Cron jobs configurés:');
console.log('   - Vérification email ouvert + SMS (toutes les heures)');
console.log('   - Envoi SMS de rappel (toutes les heures)');
console.log('');
console.log('💡 Les cron jobs s\'exécuteront automatiquement toutes les heures');
console.log('');

// Exécuter immédiatement pour test (optionnel)
if (process.env.RUN_CRON_ON_START === 'true') {
  console.log('🚀 Exécution immédiate des cron jobs (RUN_CRON_ON_START=true)...');
  console.log('');
  await runCheckEmailOpened();
  await runSendReminder();
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Exporter les fonctions pour utilisation dans server/index.ts
export { runCheckEmailOpened, runSendReminder };




