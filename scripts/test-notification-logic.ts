#!/usr/bin/env tsx

/**
 * Script de test pour valider la logique complète des notifications
 * 
 * Teste tous les cas :
 * - Email toujours envoyé
 * - SMS immédiat si RDV < 24h
 * - SMS différé si RDV ≥ 24h (après 3h si email non ouvert)
 * - SMS de rappel 24h avant (sauf si RDV < 24h)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non définis');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Calcule le lead time en heures
 */
function calculateLeadTimeHours(appointmentDate: Date, createdAt: Date): number {
  return (appointmentDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
}

/**
 * Teste la logique pour un appointment
 */
async function testAppointmentLogic(appointmentId: string) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`🧪 Test de la logique pour l'appointment: ${appointmentId}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Récupérer l'appointment
  const { data: appointment, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single();

  if (error || !appointment) {
    console.error(`❌ Erreur lors de la récupération:`, error);
    return;
  }

  const appointmentDate = new Date(appointment.appointment_date);
  const createdAt = new Date(appointment.created_at);
  const now = new Date();
  const leadTimeHours = calculateLeadTimeHours(appointmentDate, createdAt);
  const hoursUntilAppointment = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  console.log(`📅 Date du RDV: ${appointmentDate.toISOString()}`);
  console.log(`📅 Date de création: ${createdAt.toISOString()}`);
  console.log(`⏱️  Lead time (création → RDV): ${leadTimeHours.toFixed(2)} heures`);
  console.log(`⏱️  Temps restant jusqu'au RDV: ${hoursUntilAppointment.toFixed(2)} heures`);
  console.log('');

  // 1. Vérifier l'email
  console.log('📧 ÉTAT DE L\'EMAIL:');
  console.log(`   ✅ Email envoyé: ${appointment.email_sent_at ? 'OUI' : 'NON'}`);
  if (appointment.email_sent_at) {
    console.log(`   📅 Date d'envoi: ${new Date(appointment.email_sent_at).toISOString()}`);
    const hoursSinceEmailSent = (now.getTime() - new Date(appointment.email_sent_at).getTime()) / (1000 * 60 * 60);
    console.log(`   ⏱️  Temps écoulé depuis l'envoi: ${hoursSinceEmailSent.toFixed(2)} heures`);
  }
  console.log(`   ✅ Email ouvert: ${appointment.email_opened_at ? 'OUI' : 'NON'}`);
  if (appointment.email_opened_at) {
    console.log(`   📅 Date d'ouverture: ${new Date(appointment.email_opened_at).toISOString()}`);
  }
  console.log('');

  // 2. Vérifier le SMS de confirmation
  console.log('📱 ÉTAT DU SMS DE CONFIRMATION:');
  console.log(`   ✅ SMS envoyé: ${appointment.sms_confirmation_sent ? 'OUI' : 'NON'}`);
  if (appointment.sms_confirmation_sent) {
    console.log(`   📋 Type: ${appointment.sms_confirmation_type || 'non spécifié'}`);
  }
  console.log('');

  // 3. Vérifier le SMS de rappel
  console.log('🔔 ÉTAT DU SMS DE RAPPEL:');
  console.log(`   ✅ SMS envoyé: ${appointment.sms_reminder_sent ? 'OUI' : 'NON'}`);
  console.log(`   ⏭️  Skip reminder SMS: ${appointment.skip_reminder_sms ? 'OUI' : 'NON'}`);
  console.log('');

  // 4. Analyser la logique attendue
  console.log('🧠 LOGIQUE ATTENDUE:');
  
  // Cas A : RDV > 36h avant
  if (leadTimeHours > 36) {
    console.log(`   📌 Cas A : RDV réservé > 36h à l'avance (${leadTimeHours.toFixed(2)}h)`);
    console.log(`      ✅ Email envoyé immédiatement`);
    console.log(`      ⏳ Attente de 3h après l'envoi de l'email`);
    if (appointment.email_sent_at) {
      const hoursSinceEmailSent = (now.getTime() - new Date(appointment.email_sent_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceEmailSent >= 3) {
        if (appointment.email_opened_at) {
          console.log(`      ✅ Email ouvert → PAS de SMS de confirmation`);
        } else {
          console.log(`      ⚠️  Email non ouvert après 3h → SMS de confirmation DEVRAIT être envoyé`);
          if (!appointment.sms_confirmation_sent) {
            console.log(`      ❌ PROBLÈME : SMS de confirmation non envoyé alors qu'il devrait l'être`);
          } else {
            console.log(`      ✅ SMS de confirmation envoyé`);
          }
        }
      } else {
        console.log(`      ⏳ Encore ${(3 - hoursSinceEmailSent).toFixed(2)}h avant de vérifier l'ouverture de l'email`);
      }
    }
    console.log(`      🔔 SMS de rappel sera envoyé 24h avant le RDV (dans ${(hoursUntilAppointment - 24).toFixed(2)}h)`);
  }
  // Cas B : RDV < 24h avant
  else if (leadTimeHours < 24) {
    console.log(`   📌 Cas B : RDV réservé < 24h avant (${leadTimeHours.toFixed(2)}h)`);
    console.log(`      ✅ Email envoyé immédiatement`);
    console.log(`      ✅ SMS de confirmation envoyé immédiatement (remplace le rappel)`);
    if (!appointment.sms_confirmation_sent) {
      console.log(`      ❌ PROBLÈME : SMS de confirmation immédiat non envoyé alors qu'il devrait l'être`);
    } else {
      console.log(`      ✅ SMS de confirmation immédiat envoyé`);
    }
    console.log(`      ⏭️  Pas de SMS de rappel (remplacé par le SMS immédiat)`);
    if (!appointment.skip_reminder_sms) {
      console.log(`      ❌ PROBLÈME : skip_reminder_sms devrait être true`);
    } else {
      console.log(`      ✅ skip_reminder_sms = true`);
    }
  }
  // Cas intermédiaire : 24h ≤ RDV ≤ 36h
  else {
    console.log(`   📌 Cas intermédiaire : RDV réservé entre 24h et 36h à l'avance (${leadTimeHours.toFixed(2)}h)`);
    console.log(`      ✅ Email envoyé immédiatement`);
    console.log(`      ⏳ Attente de 3h après l'envoi de l'email`);
    if (appointment.email_sent_at) {
      const hoursSinceEmailSent = (now.getTime() - new Date(appointment.email_sent_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceEmailSent >= 3) {
        if (appointment.email_opened_at) {
          console.log(`      ✅ Email ouvert → PAS de SMS de confirmation`);
        } else {
          console.log(`      ⚠️  Email non ouvert après 3h → SMS de confirmation DEVRAIT être envoyé`);
          if (!appointment.sms_confirmation_sent) {
            console.log(`      ❌ PROBLÈME : SMS de confirmation non envoyé alors qu'il devrait l'être`);
          } else {
            console.log(`      ✅ SMS de confirmation envoyé`);
          }
        }
      } else {
        console.log(`      ⏳ Encore ${(3 - hoursSinceEmailSent).toFixed(2)}h avant de vérifier l'ouverture de l'email`);
      }
    }
    if (hoursUntilAppointment > 24) {
      console.log(`      🔔 SMS de rappel sera envoyé 24h avant le RDV (dans ${(hoursUntilAppointment - 24).toFixed(2)}h)`);
    } else if (hoursUntilAppointment >= 0) {
      console.log(`      ⚠️  Le RDV est dans moins de 24h, le SMS de rappel DEVRAIT être envoyé maintenant`);
      if (!appointment.sms_reminder_sent && !appointment.skip_reminder_sms) {
        console.log(`      ❌ PROBLÈME : SMS de rappel non envoyé alors qu'il devrait l'être`);
      } else if (appointment.sms_reminder_sent) {
        console.log(`      ✅ SMS de rappel envoyé`);
      }
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

/**
 * Fonction principale
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: tsx scripts/test-notification-logic.ts <appointment_id>');
    console.log('');
    console.log('Exemple:');
    console.log('  tsx scripts/test-notification-logic.ts 123e4567-e89b-12d3-a456-426614174000');
    process.exit(1);
  }

  const appointmentId = args[0];
  await testAppointmentLogic(appointmentId);
}

main().catch((error) => {
  console.error('❌ Erreur:', error);
  process.exit(1);
});




