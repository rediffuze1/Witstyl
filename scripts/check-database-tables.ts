import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Liste des tables à vérifier (basée sur le schéma du projet)
const tables = [
  'users',
  'salons',
  'services',
  'stylistes',
  'clients',
  'appointments',
  'salon_hours',
  'notifications',
  'reviews',
  'payments',
  'inventory',
  'products',
];

async function checkTable(tableName: string) {
  try {
    // Compter le nombre d'enregistrements
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      // La table n'existe peut-être pas
      return { table: tableName, exists: false, count: 0, error: countError.message };
    }

    // Récupérer les données (limité à 10 pour l'affichage)
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(10);

    if (error) {
      return { table: tableName, exists: true, count: count || 0, error: error.message, data: [] };
    }

    return {
      table: tableName,
      exists: true,
      count: count || 0,
      data: data || [],
      error: null,
    };
  } catch (error: any) {
    return {
      table: tableName,
      exists: false,
      count: 0,
      error: error.message || 'Erreur inconnue',
      data: [],
    };
  }
}

async function main() {
  console.log('🔍 Vérification des tables de la base de données...\n');
  console.log('='.repeat(80));

  const results: any[] = [];

  for (const table of tables) {
    const result = await checkTable(table);
    results.push(result);

    if (!result.exists) {
      console.log(`\n❌ ${table.toUpperCase()}: Table inexistante ou erreur - ${result.error}`);
    } else if (result.count === 0) {
      console.log(`\n📭 ${table.toUpperCase()}: ${result.count} enregistrement(s) - Table vide`);
    } else {
      console.log(`\n✅ ${table.toUpperCase()}: ${result.count} enregistrement(s)`);
      
      if (result.data && result.data.length > 0) {
        console.log(`   Aperçu (${Math.min(result.data.length, 10)} premiers enregistrements):`);
        result.data.forEach((row: any, index: number) => {
          console.log(`   [${index + 1}]`, JSON.stringify(row, null, 2).substring(0, 200) + '...');
        });
      }
    }
    console.log('-'.repeat(80));
  }

  // Résumé
  console.log('\n\n📊 RÉSUMÉ:');
  console.log('='.repeat(80));
  const existingTables = results.filter(r => r.exists);
  const filledTables = results.filter(r => r.exists && r.count > 0);
  const emptyTables = results.filter(r => r.exists && r.count === 0);
  const missingTables = results.filter(r => !r.exists);

  console.log(`\n✅ Tables existantes: ${existingTables.length}/${tables.length}`);
  console.log(`📦 Tables remplies: ${filledTables.length} (${filledTables.map(t => `${t.table}: ${t.count}`).join(', ')})`);
  console.log(`📭 Tables vides: ${emptyTables.length} (${emptyTables.map(t => t.table).join(', ')})`);
  console.log(`❌ Tables manquantes: ${missingTables.length} (${missingTables.map(t => t.table).join(', ')})`);

  // Détails par table remplie
  if (filledTables.length > 0) {
    console.log('\n\n📋 DÉTAILS DES TABLES REMPLIES:');
    console.log('='.repeat(80));
    filledTables.forEach(result => {
      console.log(`\n📦 ${result.table.toUpperCase()} (${result.count} enregistrement(s)):`);
      if (result.data && result.data.length > 0) {
        // Afficher les colonnes disponibles
        const columns = Object.keys(result.data[0]);
        console.log(`   Colonnes: ${columns.join(', ')}`);
        // Afficher un exemple complet
        console.log(`   Exemple d'enregistrement:`);
        console.log(JSON.stringify(result.data[0], null, 4));
      }
    });
  }
}

main()
  .then(() => {
    console.log('\n✅ Vérification terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });








