#!/usr/bin/env tsx

/**
 * Script pour ajouter la colonne owner_notes via l'API Supabase Management
 * ou via une connexion Postgres directe
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

const SQL_QUERY = `
ALTER TABLE "clients" 
ADD COLUMN IF NOT EXISTS "owner_notes" text;

COMMENT ON COLUMN "clients"."owner_notes" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';
`;

async function addColumnViaSupabaseRPC() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Variables d\'environnement Supabase manquantes');
    return false;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Essayer d'appeler une fonction RPC si elle existe
  // Note: Cette fonction doit être créée dans Supabase SQL Editor d'abord
  try {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: SQL_QUERY 
    });

    if (!error) {
      console.log('✅ Colonne ajoutée via RPC exec_sql');
      return true;
    }
  } catch (e) {
    // RPC n'existe probablement pas
  }

  return false;
}

async function addColumnViaPostgres() {
  if (!DATABASE_URL) {
    return false;
  }

  try {
    const { Client } = await import('pg');
    const client = new Client({ 
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Pour les certificats auto-signés
    });

    await client.connect();
    await client.query(SQL_QUERY);
    await client.end();

    console.log('✅ Colonne ajoutée via connexion Postgres directe');
    return true;
  } catch (error: any) {
    console.warn('⚠️ Erreur avec connexion Postgres:', error.message);
    return false;
  }
}

async function checkColumnExists(): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return false;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Essayer de sélectionner owner_notes pour voir si la colonne existe
    const { error } = await supabase
      .from('clients')
      .select('owner_notes')
      .limit(1);

    // Si pas d'erreur, la colonne existe
    if (!error) {
      return true;
    }

    // Si l'erreur est liée à owner_notes, la colonne n'existe pas
    if (error.message?.includes('owner_notes') || error.code === 'PGRST204') {
      return false;
    }

    // Autre erreur, on ne sait pas
    return false;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log('🔍 Vérification si la colonne owner_notes existe...');

  const exists = await checkColumnExists();
  if (exists) {
    console.log('✅ La colonne owner_notes existe déjà!');
    return;
  }

  console.log('❌ La colonne owner_notes n\'existe pas. Tentative d\'ajout...\n');

  // Essayer via Postgres direct
  if (await addColumnViaPostgres()) {
    return;
  }

  // Essayer via RPC
  if (await addColumnViaSupabaseRPC()) {
    return;
  }

  // Si aucune méthode automatique n'a fonctionné
  console.log('\n❌ Impossible d\'ajouter automatiquement la colonne.');
  console.log('\n📝 Veuillez exécuter manuellement dans Supabase SQL Editor:');
  console.log('\n' + '─'.repeat(60));
  console.log(SQL_QUERY);
  console.log('─'.repeat(60) + '\n');
}

main().catch(console.error);








