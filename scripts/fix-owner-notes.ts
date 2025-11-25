#!/usr/bin/env node
/**
 * Script pour résoudre l'erreur owner_notes
 * Tente plusieurs méthodes pour ajouter la colonne owner_notes à la table clients
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

const SQL_ADD_COLUMN = `
ALTER TABLE "clients"
ADD COLUMN IF NOT EXISTS "owner_notes" text;

COMMENT ON COLUMN "clients"."owner_notes" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';
`;

const SQL_CREATE_FUNCTION = `
CREATE OR REPLACE FUNCTION add_owner_notes_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Vérifier si la colonne existe déjà
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'clients'
        AND column_name = 'owner_notes'
    ) THEN
        -- Ajouter la colonne
        ALTER TABLE "clients"
        ADD COLUMN "owner_notes" text;

        -- Ajouter le commentaire
        COMMENT ON COLUMN "clients"."owner_notes" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';

        RAISE NOTICE 'Colonne owner_notes ajoutée avec succès';
    ELSE
        RAISE NOTICE 'La colonne owner_notes existe déjà';
    END IF;
END;
$$;
`;

async function method1_DirectPostgres(): Promise<boolean> {
  if (!DATABASE_URL) {
    console.log('⚠️ Méthode 1: DATABASE_URL non défini, passage à la méthode suivante...');
    console.log('   💡 Pour utiliser cette méthode, ajoutez DATABASE_URL dans .env');
    console.log('   💡 Trouvez-le dans Supabase > Settings > Database > Connection string > URI\n');
    return false;
  }

  console.log('🔄 Méthode 1: Tentative via connexion Postgres directe...');
  
  // Configuration SSL pour Supabase (certificats auto-signés)
  // En développement, on accepte les certificats auto-signés
  // Si NODE_TLS_REJECT_UNAUTHORIZED=0 est défini, on l'utilise
  const sslConfig = process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
    ? false // Désactiver complètement SSL
    : process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false };
  
  const pgClient = new Client({
    connectionString: DATABASE_URL,
    ssl: sslConfig === false ? false : sslConfig
  });

  try {
    await pgClient.connect();
    console.log('✅ Connexion Postgres réussie');

    // Vérifier si la colonne existe
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'owner_notes';
    `;
    const checkResult = await pgClient.query(checkQuery);

    if (checkResult.rows.length > 0) {
      console.log('✅ La colonne owner_notes existe déjà!');
      await pgClient.end();
      return true;
    }

    // Ajouter la colonne
    await pgClient.query(SQL_ADD_COLUMN);
    console.log('✅ Colonne owner_notes ajoutée avec succès via Postgres direct!');

    // Vérifier
    const verifyResult = await pgClient.query(checkQuery);
    if (verifyResult.rows.length > 0) {
      console.log('✅ Vérification: La colonne existe bien');
      await pgClient.end();
      return true;
    }

    await pgClient.end();
    return false;
  } catch (error: any) {
    console.warn('❌ Erreur avec connexion Postgres directe:', error.message);
    try {
      await pgClient.end();
    } catch {}
    return false;
  }
}

async function method2_CreateRPCFunction(): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('⚠️ Méthode 2: Variables Supabase manquantes, passage à la méthode suivante...');
    return false;
  }

  console.log('🔄 Méthode 2: Tentative de création de la fonction RPC add_owner_notes_column...');

  if (!DATABASE_URL) {
    console.log('⚠️ DATABASE_URL requis pour créer la fonction RPC, passage à la méthode suivante...');
    console.log('   💡 Pour utiliser cette méthode, ajoutez DATABASE_URL dans .env');
    console.log('   💡 Trouvez-le dans Supabase > Settings > Database > Connection string > URI\n');
    return false;
  }

  // Configuration SSL (même logique que méthode 1)
  const sslConfig = process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
    ? false
    : process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false };

  const pgClient = new Client({
    connectionString: DATABASE_URL,
    ssl: sslConfig === false ? false : sslConfig
  });

  try {
    await pgClient.connect();
    await pgClient.query(SQL_CREATE_FUNCTION);
    console.log('✅ Fonction RPC add_owner_notes_column créée avec succès!');
    await pgClient.end();

    // Maintenant, appeler la fonction via Supabase RPC
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { error } = await supabase.rpc('add_owner_notes_column');
    
    if (error) {
      console.warn('⚠️ Erreur lors de l\'appel de la fonction RPC:', error.message);
      return false;
    }

    console.log('✅ Colonne owner_notes ajoutée via fonction RPC!');
    return true;
  } catch (error: any) {
    console.warn('❌ Erreur lors de la création de la fonction RPC:', error.message);
    try {
      await pgClient.end();
    } catch {}
    return false;
  }
}

async function method3_CheckIfExists(): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return false;
  }

  console.log('🔄 Méthode 3: Vérification si la colonne existe déjà...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Tenter une requête qui inclut owner_notes pour voir si elle existe
  const { data, error } = await supabase
    .from('clients')
    .select('id, owner_notes')
    .limit(1);

  if (!error) {
    console.log('✅ La colonne owner_notes existe déjà dans la base de données!');
    return true;
  }

  if (error && (error.message.includes('owner_notes') || error.code === 'PGRST204')) {
    console.log('⚠️ La colonne owner_notes n\'existe pas encore');
    return false;
  }

  // Autre erreur, on ne sait pas
  console.warn('⚠️ Impossible de vérifier l\'existence de la colonne:', error.message);
  return false;
}

function displayManualInstructions() {
  console.log('\n' + '='.repeat(70));
  console.log('📝 INSTRUCTIONS MANUELLES');
  console.log('='.repeat(70));
  console.log('\n1. Allez dans votre projet Supabase : https://supabase.com/dashboard');
  console.log('2. Sélectionnez votre projet');
  console.log('3. Dans le menu de gauche, cliquez sur "SQL Editor"');
  console.log('4. Cliquez sur "New query"');
  console.log('5. Copiez et collez EXACTEMENT le script SQL suivant :\n');
  console.log('─'.repeat(70));
  console.log(SQL_ADD_COLUMN);
  console.log('─'.repeat(70));
  console.log('\n6. Cliquez sur "Run" (ou appuyez sur Cmd/Ctrl + Enter)');
  console.log('7. Vérifiez que le message "Success. No rows returned" s\'affiche');
  console.log('8. Testez à nouveau la réservation sur http://localhost:5001/book\n');
  console.log('='.repeat(70));
}

async function main() {
  console.log('🔧 Script de résolution de l\'erreur owner_notes\n');
  console.log('Tentative de plusieurs méthodes pour ajouter la colonne owner_notes...\n');

  // Méthode 1: Connexion Postgres directe
  const method1Success = await method1_DirectPostgres();
  if (method1Success) {
    console.log('\n✅ Problème résolu! La colonne owner_notes a été ajoutée.');
    return;
  }

  // Méthode 2: Créer et utiliser la fonction RPC
  const method2Success = await method2_CreateRPCFunction();
  if (method2Success) {
    console.log('\n✅ Problème résolu! La colonne owner_notes a été ajoutée.');
    return;
  }

  // Méthode 3: Vérifier si elle existe déjà
  const method3Success = await method3_CheckIfExists();
  if (method3Success) {
    console.log('\n✅ La colonne owner_notes existe déjà! Le problème devrait être résolu.');
    return;
  }

  // Toutes les méthodes automatiques ont échoué
  console.log('\n❌ Toutes les méthodes automatiques ont échoué.');
  console.log('📝 Veuillez ajouter la colonne manuellement dans Supabase SQL Editor.\n');
  
  displayManualInstructions();

  // Suggestions
  console.log('\n💡 SUGGESTIONS:');
  console.log('   - Si vous avez accès au mot de passe de la base de données Supabase,');
  console.log('     ajoutez DATABASE_URL dans votre fichier .env:');
  console.log('     DATABASE_URL=postgresql://postgres:[MOT_DE_PASSE]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require');
  console.log('   - Le mot de passe se trouve dans Supabase > Settings > Database > Connection string > URI\n');
}

main().catch(console.error);

