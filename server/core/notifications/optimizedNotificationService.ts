/**
 * Service de notifications optimisé pour les rendez-vous
 * 
 * Implémente la logique métier :
 * - Email toujours envoyé à la création
 * - SMS immédiat si RDV < 24h avant
 * - SMS après 3h si email non ouvert (si RDV ≥ 24h avant)
 * - SMS de rappel 24h avant (sauf si RDV pris < 24h avant)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendConfirmationEmail } from './emailService.js';
import { notificationService } from './index.js';
import { buildNotificationContext } from './utils.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * Calcule le délai en heures entre la création du RDV et l'heure du RDV
 */
function calculateLeadTimeHours(appointmentDate: Date, createdAt: Date): number {
  const diffMs = appointmentDate.getTime() - createdAt.getTime();
  return diffMs / (1000 * 60 * 60); // Convertir en heures
}

/**
 * Envoie un SMS de confirmation immédiatement
 */
async function sendImmediateConfirmationSms(
  appointmentId: string,
  context: Awaited<ReturnType<typeof buildNotificationContext>>,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  if (!context) {
    return { success: false, error: 'Contexte de notification manquant' };
  }

  if (!context.clientPhone || context.clientPhone.trim() === '') {
    console.warn(`[OptimizedNotificationService] ⚠️  Numéro de téléphone manquant pour ${appointmentId}`);
    return { success: false, error: 'Numéro de téléphone du client non disponible' };
  }

  // Construire le SMS avec le template standardisé (sans accents, <= 160 caractères)
  const { buildConfirmationSms, formatDateForSms, formatTimeForSms, formatWeekdayForSms } = await import('./smsTemplates.js');
  
  const smsContext = {
    clientFirstName: context.clientName.split(' ')[0] || context.clientName,
    serviceName: context.serviceName,
    salonName: context.salonName,
    appointmentWeekday: formatWeekdayForSms(context.startDate),
    appointmentDate: formatDateForSms(context.startDate),
    appointmentTime: formatTimeForSms(context.startDate),
  };
  
  const smsText = buildConfirmationSms(smsContext);

  console.log(`[OptimizedNotificationService] 📱 Envoi SMS de confirmation immédiat pour ${appointmentId}`);
  const smsResult = await notificationService.sendSms({
    to: context.clientPhone,
    message: smsText,
  });

  if (!smsResult.success) {
    console.error(`[OptimizedNotificationService] ❌ Erreur lors de l'envoi du SMS:`, smsResult.error);
    return { success: false, error: smsResult.error };
  }

  // Mettre à jour l'appointment
  const { error: updateError } = await supabase
    .from('appointments')
    .update({
      sms_confirmation_sent: true,
      sms_confirmation_type: 'immediate_less_24h',
      skip_reminder_sms: true, // Pas de rappel pour les RDV pris < 24h avant
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);

  if (updateError) {
    console.error(`[OptimizedNotificationService] ❌ Erreur lors de la mise à jour:`, updateError);
    // Ne pas faire échouer l'opération si la mise à jour échoue
  } else {
    console.log(`[OptimizedNotificationService] ✅ SMS de confirmation immédiat envoyé et statut mis à jour`);
  }

  return { success: true };
}

/**
 * Envoie les notifications lors de la création d'un rendez-vous
 * 
 * Règles métier :
 * 1. Email toujours envoyé
 * 2. Si RDV < 24h avant : SMS immédiat + skipReminderSms = true
 * 3. Si RDV ≥ 24h avant : pas de SMS immédiat, laisser le cron gérer (après 3h si email non ouvert)
 */
export async function sendAppointmentCreationNotifications(
  appointmentId: string,
  appointmentDate: Date,
  createdAt: Date
): Promise<{ 
  emailSent: boolean; 
  smsSent: boolean; 
  skipReminderSms: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let emailSent = false;
  let smsSent = false;
  let skipReminderSms = false;

  try {
    const supabase = getSupabaseClient();

    // 1. TOUJOURS envoyer l'email de confirmation
    console.log(`[OptimizedNotificationService] 📧 Envoi email de confirmation pour ${appointmentId}`);
    const emailResult = await sendConfirmationEmail(appointmentId);
    
    if (emailResult.success) {
      emailSent = true;
      console.log(`[OptimizedNotificationService] ✅ Email de confirmation envoyé`);
    } else {
      errors.push(`Email: ${emailResult.error || 'Erreur inconnue'}`);
      console.error(`[OptimizedNotificationService] ❌ Échec envoi email:`, emailResult.error);
    }

    // 2. Calculer le lead time (délai entre création et RDV)
    const leadTimeHours = calculateLeadTimeHours(appointmentDate, createdAt);
    console.log(`[OptimizedNotificationService] ⏱️  Lead time: ${leadTimeHours.toFixed(2)} heures`);

    // 3. Décider si SMS immédiat ou différé
    if (leadTimeHours < 24) {
      // CAS B1 : RDV pris moins de 24h avant → SMS immédiat
      console.log(`[OptimizedNotificationService] ⚡ RDV pris < 24h avant → SMS immédiat`);
      
      const context = await buildNotificationContext(appointmentId, supabase);
      const smsResult = await sendImmediateConfirmationSms(appointmentId, context, supabase);
      
      if (smsResult.success) {
        smsSent = true;
        skipReminderSms = true; // Pas de rappel pour les RDV pris < 24h avant
        console.log(`[OptimizedNotificationService] ✅ SMS de confirmation immédiat envoyé`);
      } else {
        errors.push(`SMS immédiat: ${smsResult.error || 'Erreur inconnue'}`);
        console.error(`[OptimizedNotificationService] ❌ Échec envoi SMS immédiat:`, smsResult.error);
      }
    } else {
      // CAS B2 : RDV pris ≥ 24h avant → pas de SMS immédiat, laisser le cron gérer
      console.log(`[OptimizedNotificationService] ⏳ RDV pris ≥ 24h avant → SMS différé (cron après 3h si email non ouvert)`);
      skipReminderSms = false; // Le rappel sera envoyé 24h avant
      
      // S'assurer que skipReminderSms est false en base
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          skip_reminder_sms: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId);

      if (updateError) {
        console.warn(`[OptimizedNotificationService] ⚠️  Erreur lors de la mise à jour de skipReminderSms:`, updateError);
      }
    }

    return {
      emailSent,
      smsSent,
      skipReminderSms,
      errors,
    };
  } catch (error: any) {
    console.error(`[OptimizedNotificationService] ❌ Erreur inattendue:`, error);
    errors.push(`Erreur inattendue: ${error.message || 'Erreur inconnue'}`);
    return {
      emailSent,
      smsSent,
      skipReminderSms,
      errors,
    };
  }
}

