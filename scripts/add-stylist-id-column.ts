/**
 * Script pour ajouter la colonne stylist_id à la table salon_closed_dates
 * 
 * Usage: npx tsx scripts/add-stylist-id-column.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addStylistIdColumn() {
  console.log('🔄 Vérification de l\'existence de la colonne stylist_id...\n');

  try {
    // Vérifier si la colonne existe déjà
    const { data: columns, error: checkError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'salon_closed_dates' 
          AND column_name = 'stylist_id';
        `
      });

    // Alternative: essayer une requête simple pour voir si la colonne existe
    const testQuery = await supabase
      .from('salon_closed_dates')
      .select('stylist_id')
      .limit(1);

    if (!testQuery.error) {
      console.log('✅ La colonne stylist_id existe déjà dans salon_closed_dates');
      return;
    }

    // Si on arrive ici, la colonne n'existe probablement pas
    console.log('📝 Ajout de la colonne stylist_id...\n');

    // Exécuter la migration SQL
    const sql = `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'salon_closed_dates' 
              AND column_name = 'stylist_id'
          ) THEN
              ALTER TABLE salon_closed_dates 
              ADD COLUMN stylist_id UUID REFERENCES stylistes(id) ON DELETE CASCADE;
              
              COMMENT ON COLUMN salon_closed_dates.stylist_id IS 
              'ID du styliste concerné par la fermeture. NULL = fermeture pour tout le salon';
              
              RAISE NOTICE 'Colonne stylist_id ajoutée avec succès';
          ELSE
              RAISE NOTICE 'La colonne stylist_id existe déjà';
          END IF;
      END $$;
      
      CREATE INDEX IF NOT EXISTS idx_salon_closed_dates_stylist_id 
      ON salon_closed_dates(stylist_id) 
      WHERE stylist_id IS NOT NULL;
    `;

    // Note: Supabase PostgREST ne supporte pas directement l'exécution de SQL arbitraire
    // Il faut utiliser le SQL Editor dans le dashboard Supabase
    console.log('⚠️  Supabase PostgREST ne permet pas l\'exécution directe de SQL.');
    console.log('📋 Veuillez exécuter ce script SQL dans Supabase Dashboard → SQL Editor:\n');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    console.log('\n💡 Instructions:');
    console.log('   1. Allez sur https://supabase.com/dashboard');
    console.log('   2. Sélectionnez votre projet');
    console.log('   3. Allez dans "SQL Editor"');
    console.log('   4. Copiez-collez le script ci-dessus');
    console.log('   5. Cliquez sur "Run"\n');

  } catch (error: any) {
    console.error('❌ Erreur lors de l\'ajout de la colonne:', error.message);
    console.error('\n💡 Solution alternative:');
    console.log('   Exécutez ce SQL dans Supabase Dashboard → SQL Editor:');
    console.log('   ALTER TABLE salon_closed_dates ADD COLUMN IF NOT EXISTS stylist_id UUID REFERENCES stylistes(id) ON DELETE CASCADE;');
    process.exit(1);
  }
}

addStylistIdColumn()
  .then(() => {
    console.log('✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });



