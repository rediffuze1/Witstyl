#!/usr/bin/env tsx

/**
 * Cron job : Vérifier les emails non ouverts et envoyer SMS de confirmation (Option B)
 * 
 * Ce cron job :
 * 1. Récupère tous les RDV créés dans les 12-18 dernières heures
 * 2. Filtre ceux où :
 *    - emailSentAt ≠ null
 *    - emailOpenedAt = null
 *    - smsConfirmationSent = false
 * 3. Envoie un SMS de confirmation
 * 4. Met à jour smsConfirmationSent = true
 * 
 * Fréquence recommandée : Toutes les heures
 * 
 * Usage:
 *   - Via cron système : 0 * * * * tsx server/cron/check-email-opened-and-send-sms.ts
 *   - Via Vercel Cron : Ajouter dans vercel.json
 *   - Via node-cron : Importer et scheduler dans server/index.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
// IMPORTANT: En ESM, les imports relatifs TypeScript doivent inclure l'extension .js
import { sendSmsConfirmationIfNeeded } from '../core/notifications/smsService.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[CronEmailOpened] ❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non définis');
  process.exit(1);
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[CronEmailOpened] 🕐 Démarrage du cron job');
  console.log('[CronEmailOpened] 📅 Date:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Calculer la fenêtre de temps : 3-6 heures en arrière
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    console.log(`[CronEmailOpened] 🔍 Recherche des appointments avec email envoyé entre ${sixHoursAgo.toISOString()} et ${threeHoursAgo.toISOString()}`);

    // Récupérer les appointments qui répondent aux critères
    const { data: appointments, error: queryError } = await supabase
      .from('appointments')
      .select('id, appointment_date, created_at, email_sent_at, email_opened_at, sms_confirmation_sent, status')
      .not('email_sent_at', 'is', null) // Email doit avoir été envoyé
      .is('email_opened_at', null) // Email ne doit pas avoir été ouvert
      .eq('sms_confirmation_sent', false) // SMS de confirmation ne doit pas avoir été envoyé
      .in('status', ['scheduled', 'confirmed']) // Statut doit être scheduled ou confirmed
      .gte('email_sent_at', sixHoursAgo.toISOString()) // Email envoyé il y a moins de 6h
      .lte('email_sent_at', threeHoursAgo.toISOString()); // Email envoyé il y a plus de 3h

    if (queryError) {
      console.error('[CronEmailOpened] ❌ Erreur lors de la récupération des appointments:', queryError);
      process.exit(1);
    }

    if (!appointments || appointments.length === 0) {
      console.log('[CronEmailOpened] ℹ️  Aucun appointment à traiter');
      console.log('');
      process.exit(0);
    }

    console.log(`[CronEmailOpened] 📋 ${appointments.length} appointment(s) à traiter`);
    console.log('');

    let successCount = 0;
    let errorCount = 0;

    // Traiter chaque appointment
    for (const appointment of appointments) {
      console.log(`[CronEmailOpened] 🔄 Traitement de l'appointment ${appointment.id}`);
      
      // Vérifier que le RDV a été pris ≥ 24h avant (lead time ≥ 24h)
      const appointmentDate = new Date(appointment.appointment_date);
      const createdAt = new Date(appointment.created_at);
      const leadTimeHours = (appointmentDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      
      if (leadTimeHours < 24) {
        console.log(`[CronEmailOpened] ⏭️  RDV pris ${leadTimeHours.toFixed(1)}h avant (moins de 24h), skip (SMS déjà envoyé immédiatement)`);
        continue;
      }
      
      const result = await sendSmsConfirmationIfNeeded(appointment.id);

      if (result.success) {
        // Vérifier si c'est un vrai succès ou juste un skip
        if (result.metadata?.reason && result.metadata.reason !== 'sms_sent') {
          // C'est un skip (email déjà ouvert, etc.)
          console.log(`[CronEmailOpened] ⏭️  ${result.metadata.reason} pour ${appointment.id}`);
        } else {
          successCount++;
          console.log(`[CronEmailOpened] ✅ SMS envoyé pour ${appointment.id}`);
        }
        if (result.metadata) {
          console.log(`[CronEmailOpened] 📊 Métadonnées:`, JSON.stringify(result.metadata, null, 2));
        }
      } else {
        errorCount++;
        console.log(`[CronEmailOpened] ⚠️  ${result.error} pour ${appointment.id}`);
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[CronEmailOpened] 📊 Résumé:');
    console.log(`  ✅ Succès: ${successCount}`);
    console.log(`  ⚠️  Erreurs/Skipped: ${errorCount}`);
    console.log(`  📋 Total traité: ${appointments.length}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('[CronEmailOpened] ❌ Erreur fatale:', error);
    process.exit(1);
  }
}

// Exécuter le cron job
main().catch((error) => {
  console.error('[CronEmailOpened] ❌ Erreur non gérée:', error);
  process.exit(1);
});

