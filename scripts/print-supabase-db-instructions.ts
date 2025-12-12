/**
 * Script d'instructions pour configurer DATABASE_URL avec Supabase Supavisor pooler
 * Affiche les étapes pour obtenir l'URL du pooler depuis Supabase Dashboard
 */

console.log('\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 Instructions pour configurer DATABASE_URL avec Supabase Supavisor');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n');

console.log('🎯 OBJECTIF:');
console.log('   Utiliser le pooler Supavisor (Transaction Mode) pour Vercel/serverless');
console.log('   au lieu de la connexion PostgreSQL directe.\n');

console.log('📍 ÉTAPE 1: Obtenir l\'URL du pooler depuis Supabase Dashboard\n');
console.log('   1. Ouvrez https://supabase.com/dashboard');
console.log('   2. Sélectionnez votre projet');
console.log('   3. Allez dans Settings > Database');
console.log('   4. Cliquez sur le bouton "Connect" ou "Connection string"');
console.log('   5. Dans la section "Connection pooling", sélectionnez:');
console.log('      ✅ "Transaction mode" (port 6543)');
console.log('      OU');
console.log('      ✅ "Session Pooler / Transaction Mode"');
console.log('   6. Copiez l\'URI de connexion complète\n');

console.log('📝 ÉTAPE 2: Format attendu de l\'URL\n');
console.log('   Format Transaction Mode (recommandé pour Vercel/serverless):');
console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('   postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1');
console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('   Exemple concret:');
console.log('   postgres://postgres.nmyulnvgngaepseiwcwb:VotreMotDePasse@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1\n');

console.log('   ⚠️  IMPORTANT:');
console.log('   - Le port doit être 6543 (Transaction Mode)');
console.log('   - L\'URL doit contenir "pooler.supabase.com"');
console.log('   - Le paramètre "pgbouncer=true" est requis');
console.log('   - Le paramètre "connection_limit=1" est recommandé pour serverless\n');

console.log('🔧 ÉTAPE 3: Configurer DATABASE_URL dans Vercel\n');
console.log('   1. Ouvrez Vercel Dashboard > Votre projet > Settings > Environment Variables');
console.log('   2. Trouvez la variable DATABASE_URL');
console.log('   3. Remplacez la valeur par l\'URL du pooler copiée à l\'étape 1');
console.log('   4. Assurez-vous que la variable est définie pour:');
console.log('      ✅ Production');
console.log('      ✅ Preview (si nécessaire)');
console.log('   5. Sauvegardez\n');

console.log('🚀 ÉTAPE 4: Redéployer sur Vercel\n');
console.log('   1. Vercel redéploiera automatiquement après la sauvegarde');
console.log('   2. OU déclenchez manuellement un redeploy depuis le Dashboard\n');

console.log('✅ ÉTAPE 5: Vérifier la connexion\n');
console.log('   En local (après avoir mis à jour votre .env):');
console.log('   $ npm run test:db\n');

console.log('   Sur Vercel:');
console.log('   - Vérifiez les logs Functions dans Vercel Dashboard');
console.log('   - Vous devriez voir: "[DB] ✅ Connexion à la base de données réussie"\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 POURQUOI UTILISER LE POOLER?');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('   ✅ Supporte IPv4 (la connexion directe nécessite IPv6)');
console.log('   ✅ Optimisé pour les environnements serverless (Vercel)');
console.log('   ✅ Gestion automatique des connexions');
console.log('   ✅ Meilleure performance pour les fonctions serverless');
console.log('   ✅ Évite les erreurs DNS avec db.*.supabase.co\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('❌ PROBLÈMES COURANTS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('   ❌ Erreur DNS (ENOTFOUND db.*.supabase.co)');
console.log('      → Solution: Utiliser le pooler au lieu de la connexion directe\n');
console.log('   ❌ Port 5432 au lieu de 6543');
console.log('      → Solution: Utiliser Transaction Mode (port 6543) pour serverless\n');
console.log('   ❌ Paramètre pgbouncer=true manquant');
console.log('      → Solution: Ajouter ?pgbouncer=true à la fin de l\'URL\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

