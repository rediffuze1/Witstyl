// scripts/test-prod-import.ts
// Test simple pour vérifier que l'import production fonctionne

process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

console.log('🧪 Test d\'import du module production...');
console.log('VERCEL:', process.env.VERCEL);
console.log('NODE_ENV:', process.env.NODE_ENV);

import('../server/prod.js')
  .then((module) => {
    console.log('✅ Import réussi !');
    console.log('Type de l\'export default:', typeof module.default);
    if (module.default) {
      console.log('✅ L\'app Express est bien exportée');
      process.exit(0);
    } else {
      console.error('❌ L\'export default est undefined');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Erreur lors de l\'import:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 10).join('\n'));
    }
    process.exit(1);
  });

