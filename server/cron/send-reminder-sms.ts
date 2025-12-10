#!/usr/bin/env tsx

/**
 * Cron job : Envoyer les SMS de rappel (Option C)
 * 
 * Ce cron job :
 * 1. Récupère les RDV entre +24h et +36h
 * 2. Filtre selon :
 *    - Fenêtre horaire 6h-20h
 *    - smsReminderSent = false
 *    - status = scheduled ou confirmed
 * 3. Envoie un SMS de rappel
 * 4. Met à jour smsReminderSent = true
 * 
 * Si hors fenêtre horaire, le SMS n'est pas envoyé (sera envoyé au prochain run à 6h)
 * 
 * Fréquence recommandée : Toutes les heures (ou toutes les 30 minutes)
 * 
 * Usage:
 *   - Via cron système : 0 * * * * tsx server/cron/send-reminder-sms.ts
 *   - Via Vercel Cron : Ajouter dans vercel.json
 *   - Via node-cron : Importer et scheduler dans server/index.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { sendSmsReminderIfNeeded } from '../core/notifications/smsService.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[CronReminderSms] ❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non définis');
  process.exit(1);
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[CronReminderSms] 🕐 Démarrage du cron job');
  console.log('[CronReminderSms] 📅 Date:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Calculer la fenêtre de temps : RDV exactement dans 24h à 24h15min
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in24Hours15Min = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 1000);

    console.log(`[CronReminderSms] 🔍 Recherche des appointments entre ${in24Hours.toISOString()} et ${in24Hours15Min.toISOString()}`);

    // Récupérer les appointments qui répondent aux critères
    const { data: appointments, error: queryError } = await supabase
      .from('appointments')
      .select('id, appointment_date, sms_reminder_sent, skip_reminder_sms, status')
      .eq('sms_reminder_sent', false) // SMS de rappel ne doit pas avoir été envoyé
      .eq('skip_reminder_sms', false) // RDV doit avoir été pris ≥ 24h avant
      .in('status', ['scheduled', 'confirmed']) // Statut doit être scheduled ou confirmed
      .gte('appointment_date', in24Hours.toISOString()) // RDV dans au moins 24h
      .lte('appointment_date', in24Hours15Min.toISOString()); // RDV dans au plus 24h15min

    if (queryError) {
      console.error('[CronReminderSms] ❌ Erreur lors de la récupération des appointments:', queryError);
      process.exit(1);
    }

    if (!appointments || appointments.length === 0) {
      console.log('[CronReminderSms] ℹ️  Aucun appointment à traiter');
      console.log('');
      process.exit(0);
    }

    console.log(`[CronReminderSms] 📋 ${appointments.length} appointment(s) à traiter`);
    console.log('');

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Traiter chaque appointment
    for (const appointment of appointments) {
      console.log(`[CronReminderSms] 🔄 Traitement de l'appointment ${appointment.id}`);
      
      const result = await sendSmsReminderIfNeeded(appointment.id);

      if (result.success) {
        // Vérifier si c'est un vrai succès ou juste un skip
        if (result.metadata?.reason && result.metadata.reason !== 'sms_sent') {
          // C'est un skip (trop tôt, trop tard, etc.)
          skippedCount++;
          console.log(`[CronReminderSms] ⏭️  ${result.metadata.reason} pour ${appointment.id}`);
        } else {
          successCount++;
          console.log(`[CronReminderSms] ✅ SMS envoyé pour ${appointment.id}`);
        }
        if (result.metadata) {
          console.log(`[CronReminderSms] 📊 Métadonnées:`, JSON.stringify(result.metadata, null, 2));
        }
      } else {
        errorCount++;
        console.log(`[CronReminderSms] ⚠️  ${result.error} pour ${appointment.id}`);
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[CronReminderSms] 📊 Résumé:');
    console.log(`  ✅ Succès: ${successCount}`);
    console.log(`  ⏭️  Skipped (hors fenêtre): ${skippedCount}`);
    console.log(`  ⚠️  Erreurs: ${errorCount}`);
    console.log(`  📋 Total traité: ${appointments.length}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('[CronReminderSms] ❌ Erreur fatale:', error);
    process.exit(1);
  }
}

// Exécuter le cron job
main().catch((error) => {
  console.error('[CronReminderSms] ❌ Erreur non gérée:', error);
  process.exit(1);
});

