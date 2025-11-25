/**
 * Script pour créer automatiquement la table opening_hours dans Supabase
 * Exécutez ce script une seule fois pour créer la table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

async function createOpeningHoursTable() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  
  console.log('🔄 Création de la table opening_hours...');
  
  try {
    // Vérifier si la table existe déjà
    const { data: existingTable, error: checkError } = await supabase
      .from('opening_hours')
      .select('id')
      .limit(1);
    
    if (!checkError && existingTable !== null) {
      console.log('✅ La table opening_hours existe déjà!');
      return;
    }
    
    // La table n'existe pas, on doit la créer via SQL
    // Note: Supabase JS client ne permet pas de créer des tables directement
    // Il faut utiliser le SQL Editor de Supabase ou une fonction RPC
    
    console.log('⚠️ La table opening_hours n\'existe pas.');
    console.log('📝 Veuillez exécuter le script SQL suivant dans le SQL Editor de Supabase:');
    console.log('');
    console.log('-- Script SQL pour créer opening_hours');
    console.log('CREATE TABLE IF NOT EXISTS public.opening_hours (');
    console.log('  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
    console.log('  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,');
    console.log('  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),');
    console.log('  open_time TEXT NOT NULL,');
    console.log('  close_time TEXT NOT NULL,');
    console.log('  is_closed BOOLEAN DEFAULT false NOT NULL,');
    console.log('  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,');
    console.log('  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,');
    console.log('  UNIQUE(salon_id, day_of_week)');
    console.log(');');
    console.log('');
    console.log('ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;');
    console.log('');
    console.log('Ou exécutez le fichier: supabase_all_tables_complete.sql');
    console.log('');
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    console.log('');
    console.log('📝 Veuillez exécuter le script SQL supabase_all_tables_complete.sql dans Supabase SQL Editor');
  }
}

createOpeningHoursTable()
  .then(() => {
    console.log('✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });






