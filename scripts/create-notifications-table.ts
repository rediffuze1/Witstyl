#!/usr/bin/env tsx

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL manquant. Ajoute-le dans ton .env');
  process.exit(1);
}

const sqlFile = path.join(process.cwd(), 'sql', 'create_client_notifications.sql');

if (!fs.existsSync(sqlFile)) {
  console.error(`❌ Fichier SQL non trouvé: ${sqlFile}`);
  process.exit(1);
}

(async () => {
  const client = new Client({ 
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connexion à la base de données établie');
    
    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log(`🚀 Application du script SQL: ${path.basename(sqlFile)}`);
    
    await client.query(sql);
    
    console.log('✅ Table client_notifications créée avec succès !');
    console.log('');
    console.log('📋 Vérification de la table...');
    
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'client_notifications'
      ORDER BY ordinal_position;
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Colonnes de la table:');
      result.rows.forEach((row: any) => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    }
    
    process.exit(0);
  } catch (e: any) {
    console.error('❌ Erreur lors de la création de la table:', e.message);
    if (e.message.includes('already exists')) {
      console.log('ℹ️  La table existe déjà, c\'est normal.');
      process.exit(0);
    }
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();

