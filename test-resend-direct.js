/**
 * Script de test direct pour Resend
 * Permet de tester l'envoi d'email sans passer par toute l'application
 * 
 * Usage: node test-resend-direct.js [email]
 * Exemple: node test-resend-direct.js veignatpierre@gmail.com
 */

import { Resend } from 'resend';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Charger les variables d'environnement depuis .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const envContent = readFileSync(join(__dirname, '.env'), 'utf-8');
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
  
  // Injecter dans process.env
  Object.assign(process.env, envVars);
} catch (error) {
  console.warn('⚠️  Impossible de charger .env, utilisation des variables système');
}

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM || 'SalonPilot <noreply@salonpilot.ch>';

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 DIAGNOSTIC DIRECT RESEND');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

if (!resendApiKey) {
  console.error('❌ RESEND_API_KEY non définie dans .env');
  process.exit(1);
}

console.log('✅ RESEND_API_KEY trouvée:', resendApiKey.substring(0, 15) + '...');
console.log('✅ RESEND_FROM:', resendFrom);
console.log('');

// Créer le client Resend
const resend = new Resend(resendApiKey);

// Email de test
const testEmail = process.argv[2] || 'veignatpierre@gmail.com';
const testSubject = '[TEST] Email de test SalonPilot';
const testHtml = `
  <h1>Test d'envoi d'email</h1>
  <p>Ceci est un email de test envoyé directement depuis le script de diagnostic.</p>
  <p>Si vous recevez cet email, cela signifie que Resend fonctionne correctement.</p>
`;

console.log('📧 Préparation de l\'envoi...');
console.log('   To:', testEmail);
console.log('   From:', resendFrom);
console.log('   Subject:', testSubject);
console.log('');

const payload = {
  from: resendFrom,
  to: testEmail,
  subject: testSubject,
  html: testHtml,
  text: 'Test d\'envoi d\'email - Ceci est un email de test envoyé directement depuis le script de diagnostic.',
};

console.log('📤 Envoi à Resend...');
console.log('');

try {
  const result = await resend.emails.send(payload);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📥 RÉPONSE DE RESEND');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(JSON.stringify(result, null, 2));
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  if (result.error) {
    console.error('❌ ERREUR DE RESEND:');
    console.error(JSON.stringify(result.error, null, 2));
    console.log('');
    console.log('🔍 DIAGNOSTIC:');
    if (result.error.message?.includes('domain')) {
      console.log('   → Le domaine dans RESEND_FROM n\'est probablement pas vérifié dans Resend');
      console.log('   → Allez sur https://resend.com/domains pour vérifier votre domaine');
    }
    if (result.error.message?.includes('unauthorized') || result.error.message?.includes('401')) {
      console.log('   → La clé API est invalide ou expirée');
      console.log('   → Vérifiez votre clé API sur https://resend.com/api-keys');
    }
    process.exit(1);
  }
  
  if (result.data?.id) {
    console.log('✅ EMAIL ENVOYÉ AVEC SUCCÈS !');
    console.log('   Email ID:', result.data.id);
    console.log('');
    console.log('📬 Vérifiez votre boîte email dans quelques instants.');
    console.log('   Si l\'email n\'arrive pas, vérifiez le dashboard Resend:');
    console.log('   https://resend.com/emails');
    console.log('');
  } else {
    console.error('⚠️  Réponse inattendue de Resend (pas d\'ID)');
    console.error('   Réponse complète:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
  
} catch (error) {
  console.error('');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('❌ EXCEPTION LORS DE L\'ENVOI');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('Type:', error.constructor.name);
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('');
  process.exit(1);
}

