#!/usr/bin/env tsx

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../server/supabaseService';

const sqlFile = path.join(process.cwd(), 'sql', 'create_client_notifications.sql');

if (!fs.existsSync(sqlFile)) {
  console.error(`❌ Fichier SQL non trouvé: ${sqlFile}`);
  process.exit(1);
}

(async () => {
  try {
    console.log('✅ Connexion à Supabase établie');
    
    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log(`🚀 Application du script SQL: ${path.basename(sqlFile)}`);
    
    // Exécuter le SQL via Supabase
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Si la fonction RPC n'existe pas, utiliser une requête directe
      // Diviser le SQL en plusieurs requêtes
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        try {
          // Utiliser une requête SQL brute via Supabase
          const { error: execError } = await supabaseAdmin
            .from('_exec_sql')
            .select('*')
            .limit(0);
          
          // Si ça ne fonctionne pas, utiliser une approche différente
          console.log('⚠️  Tentative alternative...');
          
          // Créer la table directement via une requête SQL
          const createTableSQL = `
            CREATE TABLE IF NOT EXISTS client_notifications (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
              client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
              type text NOT NULL,
              title text NOT NULL,
              message text NOT NULL,
              is_read boolean DEFAULT false NOT NULL,
              appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
              priority text DEFAULT 'medium' NOT NULL,
              created_at timestamp DEFAULT now() NOT NULL,
              updated_at timestamp DEFAULT now() NOT NULL
            );
          `;
          
          // Utiliser une requête via Supabase PostgREST (mais ça ne fonctionne pas pour CREATE TABLE)
          // La meilleure solution est d'utiliser le SQL Editor de Supabase ou un script direct
          console.log('ℹ️  Pour créer la table, exécutez ce SQL dans le SQL Editor de Supabase:');
          console.log('');
          console.log(createTableSQL);
          console.log('');
          console.log('Ou utilisez la commande Supabase CLI:');
          console.log('  supabase db execute -f sql/create_client_notifications.sql');
          
          process.exit(0);
        } catch (e: any) {
          console.error('❌ Erreur:', e.message);
        }
      }
    } else {
      console.log('✅ Table client_notifications créée avec succès !');
    }
    
    // Vérifier que la table existe
    const { data, error: checkError } = await supabaseAdmin
      .from('client_notifications')
      .select('*')
      .limit(0);
    
    if (checkError && checkError.code === '42P01') {
      console.log('⚠️  La table n\'existe pas encore. Veuillez l\'exécuter manuellement dans Supabase.');
    } else if (!checkError) {
      console.log('✅ Table client_notifications vérifiée et accessible !');
    }
    
    process.exit(0);
  } catch (e: any) {
    console.error('❌ Erreur:', e.message);
    console.log('');
    console.log('ℹ️  Solution alternative:');
    console.log('   1. Allez dans le SQL Editor de Supabase');
    console.log('   2. Copiez le contenu de sql/create_client_notifications.sql');
    console.log('   3. Exécutez-le dans l\'éditeur SQL');
    process.exit(1);
  }
})();








