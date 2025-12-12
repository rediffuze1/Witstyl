/**
 * Script de test de connexion à la base de données PostgreSQL
 * Vérifie que DATABASE_URL est configurée et que la connexion fonctionne
 */

import 'dotenv/config';
import { Client } from 'pg';

async function testDatabaseConnection() {
  console.log('🔍 Test de connexion à la base de données PostgreSQL\n');

  // Vérifier que DATABASE_URL est définie
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL n\'est pas définie dans les variables d\'environnement');
    console.error('\n💡 Pour définir DATABASE_URL:');
    console.error('   - En local: Ajoutez-la dans votre fichier .env');
    console.error('   - Sur Vercel: Ajoutez-la dans Vercel Dashboard > Settings > Environment Variables');
    console.error('\n📝 Format attendu (Pooler Supavisor pour Vercel):');
    console.error('   DATABASE_URL=postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1');
    console.error('\n💡 Pour obtenir l\'URL du pooler:');
    console.error('   Exécutez: npm run print:db-instructions');
    process.exit(1);
  }

  // Masquer le mot de passe dans les logs
  const maskedUrl = DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log(`✅ DATABASE_URL trouvée: ${maskedUrl}\n`);

  // Vérifier le format de l'URL
  const isPoolerUrl = DATABASE_URL.includes('pooler.supabase.com');
  const isDirectUrl = DATABASE_URL.includes('db.') && DATABASE_URL.includes('.supabase.co');
  const hasPort6543 = DATABASE_URL.includes(':6543');
  const hasPgbouncer = DATABASE_URL.includes('pgbouncer=true');

  if (isDirectUrl && !isPoolerUrl) {
    console.warn('⚠️  ATTENTION: Vous utilisez une connexion directe (db.*.supabase.co)');
    console.warn('   Cette méthode peut échouer sur Vercel/serverless avec des erreurs DNS.');
    console.warn('   Recommandation: Utilisez le pooler Supavisor (Transaction Mode)');
    console.warn('   Exécutez: npm run print:db-instructions\n');
  } else if (isPoolerUrl) {
    console.log('✅ Format pooler détecté (recommandé pour Vercel/serverless)');
    if (!hasPort6543) {
      console.warn('⚠️  Port 6543 non détecté. Assurez-vous d\'utiliser Transaction Mode pour serverless.');
    }
    if (!hasPgbouncer) {
      console.warn('⚠️  Paramètre pgbouncer=true manquant. Ajoutez-le à l\'URL.');
    }
    console.log('');
  }

  // Créer un client PostgreSQL
  // Configuration SSL selon le type de connexion
  const isPooler = DATABASE_URL.includes('pooler.supabase.com');
  const sslConfig = isPooler 
    ? { rejectUnauthorized: false } // Pooler nécessite SSL
    : process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } // Pour les certificats auto-signés Supabase
      : false;

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: sslConfig,
  });

  try {
    console.log('🔄 Tentative de connexion...');
    await client.connect();
    console.log('✅ Connexion réussie!\n');

    // Tester une requête simple
    console.log('🔄 Test de requête SQL (SELECT 1)...');
    const result = await client.query('SELECT 1 as test');
    
    if (result.rows.length > 0 && result.rows[0].test === 1) {
      console.log('✅ Requête SQL réussie!\n');
    } else {
      console.warn('⚠️ Requête SQL retournée mais résultat inattendu');
    }

    // Tester une requête sur une table système pour vérifier l'accès
    console.log('🔄 Test d\'accès aux tables système...');
    const tableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      LIMIT 5
    `);
    
    console.log(`✅ Accès aux tables OK (${tableResult.rows.length} tables trouvées)\n`);

    console.log('✅ Tous les tests de connexion ont réussi!\n');
    console.log('📊 Résumé:');
    console.log('   - Connexion PostgreSQL: ✅');
    console.log('   - Requêtes SQL: ✅');
    console.log('   - Accès aux tables: ✅\n');

  } catch (error: any) {
    console.error('❌ Erreur lors de la connexion à la base de données:\n');
    console.error(`   Type: ${error.constructor.name}`);
    console.error(`   Message: ${error.message}`);
    
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    
    if (error.host) {
      console.error(`   Host: ${error.host}`);
    }
    
    if (error.port) {
      console.error(`   Port: ${error.port}`);
    }

    // Messages d'aide selon le type d'erreur
    if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      console.error('\n💡 Problème DNS: Vérifiez que l\'URL de connexion est correcte');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 Problème de connexion réseau: Vérifiez que le serveur est accessible');
    } else if (error.message.includes('password') || error.message.includes('authentication')) {
      console.error('\n💡 Problème d\'authentification: Vérifiez les identifiants dans DATABASE_URL');
    } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
      console.error('\n💡 Problème SSL: Vérifiez la configuration SSL dans DATABASE_URL');
    }

    console.error('\n📝 Vérifiez votre DATABASE_URL dans les variables d\'environnement');
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Connexion fermée');
  }
}

// Exécuter le test
testDatabaseConnection().catch((error) => {
  console.error('❌ Erreur inattendue:', error);
  process.exit(1);
});

