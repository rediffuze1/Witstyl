#!/usr/bin/env tsx

/**
 * Script pour créer la fonction insert_client_without_owner_notes dans Supabase
 * Cette fonction permet de contourner PostgREST qui valide le schéma avant d'exécuter les requêtes
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sqlFilePath = path.join(process.cwd(), 'sql', 'create_insert_client_function.sql');
const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');

async function createInsertClientFunction() {
  console.log('🔄 Tentative de création de la fonction insert_client_without_owner_notes...');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Variables d\'environnement Supabase manquantes');
    displayManualInstructions();
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Essayer d'exécuter le script SQL via RPC exec_sql si disponible
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      query: sqlScript
    });

    if (rpcError) {
      console.error('⚠️ RPC exec_sql non disponible ou erreur:', rpcError.message);
      displayManualInstructions();
      return;
    }

    console.log('✅ Fonction insert_client_without_owner_notes créée avec succès via Supabase RPC!');
  } catch (error: any) {
    console.error('❌ Erreur lors de la création de la fonction via Supabase RPC:', error);
    displayManualInstructions();
  }
}

function displayManualInstructions() {
  console.log('\n❌ Impossible de créer automatiquement la fonction insert_client_without_owner_notes.\n');
  console.log('📝 Veuillez exécuter manuellement le script SQL suivant dans Supabase SQL Editor:\n');
  console.log('────────────────────────────────────────────────────────────');
  console.log(sqlScript);
  console.log('────────────────────────────────────────────────────────────\n');
  console.log('Instructions:\n1. Allez dans votre projet Supabase\n2. Ouvrez le SQL Editor\n3. Collez le script SQL ci-dessus\n4. Exécutez le script\n');
}

createInsertClientFunction();








