/**
 * Script pour ajouter la colonne owner_notes à la table clients
 * Exécutez ce script une seule fois pour créer la colonne dans Supabase
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

async function addOwnerNotesColumn() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Variables d\'environnement Supabase manquantes');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  console.log('🔄 Ajout de la colonne owner_notes à la table clients...');
  
  try {
    // Vérifier si la colonne existe déjà
    const { data: columns, error: checkError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'clients' 
        AND column_name = 'owner_notes';
      `
    });
    
    if (checkError) {
      console.log('⚠️ Impossible de vérifier si la colonne existe, tentative d\'ajout...');
    }
    
    // Ajouter la colonne
    const { error: addError } = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE clients 
        ADD COLUMN IF NOT EXISTS owner_notes text;
      `
    });
    
    if (addError) {
      // Si exec_sql n'existe pas, utiliser une requête directe
      console.log('⚠️ RPC exec_sql non disponible, utilisation d\'une méthode alternative...');
      console.log('📝 Veuillez exécuter manuellement dans Supabase SQL Editor:');
      console.log('');
      console.log('ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_notes text;');
      console.log('');
      return;
    }
    
    console.log('✅ Colonne owner_notes ajoutée avec succès!');
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'ajout de la colonne:', error);
    console.log('');
    console.log('📝 Veuillez exécuter manuellement dans Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_notes text;');
    console.log('');
  }
}

addOwnerNotesColumn();

