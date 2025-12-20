#!/usr/bin/env tsx
/**
 * Script de test pour vérifier la suppression d'un rendez-vous
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testDelete() {
  console.log('🔍 Recherche d\'un rendez-vous à supprimer...\n');
  
  // Récupérer un rendez-vous non annulé
  const { data: appointments, error: fetchError } = await supabase
    .from('appointments')
    .select('id, appointment_date, status')
    .neq('status', 'cancelled')
    .order('appointment_date', { ascending: false })
    .limit(1);
  
  if (fetchError) {
    console.error('❌ Erreur lors de la récupération:', fetchError);
    process.exit(1);
  }
  
  if (!appointments || appointments.length === 0) {
    console.log('⚠️ Aucun rendez-vous trouvé à supprimer');
    process.exit(0);
  }
  
  const appointment = appointments[0];
  console.log('✅ Rendez-vous trouvé:');
  console.log('   ID:', appointment.id);
  console.log('   Date:', appointment.appointment_date);
  console.log('   Status:', appointment.status);
  console.log('');
  
  // Tester la suppression via l'API
  console.log('🧪 Test de suppression via API...\n');
  
  const testUrl = `http://localhost:5001/api/appointments/${appointment.id}`;
  console.log('URL:', testUrl);
  
  try {
    const response = await fetch(testUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Suppression réussie !');
    } else {
      console.log('\n❌ Erreur lors de la suppression');
    }
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'appel API:', error.message);
    process.exit(1);
  }
}

testDelete().catch(console.error);




