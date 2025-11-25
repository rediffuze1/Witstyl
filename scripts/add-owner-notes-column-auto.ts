#!/usr/bin/env tsx

/**
 * Script pour ajouter automatiquement la colonne owner_notes à la table clients
 * Utilise DATABASE_URL si disponible, sinon affiche les instructions pour Supabase SQL Editor
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function addOwnerNotesColumn() {
  const sqlFile = path.join(process.cwd(), 'sql', 'add_owner_notes_column.sql');
  
  if (!fs.existsSync(sqlFile)) {
    console.error(`❌ Fichier SQL non trouvé: ${sqlFile}`);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  // Essayer d'abord avec DATABASE_URL (connexion Postgres directe)
  if (DATABASE_URL) {
    try {
      console.log('🔄 Tentative d\'ajout de la colonne via connexion Postgres directe...');
      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: DATABASE_URL });
      await pgClient.connect();
      
      await pgClient.query(sql);
      await pgClient.end();
      
      console.log('✅ Colonne owner_notes ajoutée avec succès via connexion Postgres directe!');
      return;
    } catch (error: any) {
      console.warn('⚠️ Erreur avec connexion Postgres directe:', error.message);
      console.log('🔄 Tentative avec Supabase...');
    }
  }
  
  // Essayer avec Supabase RPC si disponible
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Essayer avec RPC exec_sql si disponible
      const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (!rpcError) {
        console.log('✅ Colonne owner_notes ajoutée avec succès via Supabase RPC!');
        return;
      }
      
      console.warn('⚠️ RPC exec_sql non disponible ou erreur:', rpcError.message);
    } catch (error: any) {
      console.warn('⚠️ Erreur avec Supabase:', error.message);
    }
  }
  
  // Si aucune méthode automatique n'a fonctionné, afficher les instructions
  console.log('');
  console.log('❌ Impossible d\'ajouter automatiquement la colonne owner_notes.');
  console.log('');
  console.log('📝 Veuillez exécuter manuellement le script SQL suivant dans Supabase SQL Editor:');
  console.log('');
  console.log('─'.repeat(60));
  console.log(sql);
  console.log('─'.repeat(60));
  console.log('');
  console.log('Instructions:');
  console.log('1. Allez dans votre projet Supabase');
  console.log('2. Ouvrez le SQL Editor');
  console.log('3. Collez le script SQL ci-dessus');
  console.log('4. Exécutez le script');
  console.log('');
}

addOwnerNotesColumn().catch((error) => {
  console.error('❌ Erreur inattendue:', error);
  process.exit(1);
});








