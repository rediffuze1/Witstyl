/**
 * Service de gestion des SMS conditionnels
 * 
 * Ce service gère l'envoi des SMS selon les règles :
 * - Option B : SMS de confirmation si email non ouvert après 12h
 * - Option C : SMS de rappel uniquement pour RDV du lendemain entre 6h-20h
 */

import { createClient } from '@supabase/supabase-js';
import { notificationService } from './index.js';
import { buildNotificationContext } from './utils.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('[SmsService] ⚠️  SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non définis');
}

/**
 * Envoie un SMS de confirmation si l'email n'a pas été ouvert après 3h
 * 
 * Règles :
 * - Email doit avoir été envoyé
 * - Email ne doit pas avoir été ouvert
 * - Au moins 3h doivent s'être écoulées depuis l'envoi de l'email
 * - RDV doit avoir été pris ≥ 24h avant (lead time ≥ 24h)
 * - SMS de confirmation ne doit pas avoir déjà été envoyé
 * 
 * @param appointmentId - ID du rendez-vous
 * @returns Résultat de l'envoi avec success: true si réussi
 */
export async function sendSmsConfirmationIfNeeded(
  appointmentId: string
): Promise<{ success: boolean; error?: string; metadata?: Record<string, unknown> }> {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return {
        success: false,
        error: 'Configuration Supabase manquante',
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Récupérer l'appointment avec toutes les données nécessaires
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, appointment_date, created_at, email_sent_at, email_opened_at, sms_confirmation_sent, client_id, status')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error(`[SmsService] ❌ Erreur lors de la récupération du rendez-vous ${appointmentId}:`, appointmentError);
      return {
        success: false,
        error: 'Rendez-vous non trouvé',
      };
    }

    // 1. Email doit avoir été envoyé
    if (!appointment.email_sent_at) {
      console.log(`[SmsService] ℹ️  Email non envoyé pour ${appointmentId}, pas de SMS de confirmation`);
      return {
        success: true, // Pas une erreur, juste pas de SMS à envoyer
        metadata: { reason: 'email_not_sent' },
      };
    }

    // 2. Email ne doit pas avoir été ouvert
    if (appointment.email_opened_at) {
      console.log(`[SmsService] ℹ️  Email déjà ouvert pour ${appointmentId}, pas de SMS de confirmation`);
      return {
        success: true, // Pas une erreur, juste pas de SMS à envoyer
        metadata: { reason: 'email_already_opened' },
      };
    }

    // 3. SMS de confirmation ne doit pas avoir déjà été envoyé
    if (appointment.sms_confirmation_sent) {
      console.log(`[SmsService] ℹ️  SMS de confirmation déjà envoyé pour ${appointmentId}`);
      return {
        success: true, // Pas une erreur, juste déjà envoyé
        metadata: { reason: 'sms_already_sent' },
      };
    }

    // 4. Vérifier que le RDV a été pris ≥ 24h avant (lead time ≥ 24h)
    const appointmentDate = new Date(appointment.appointment_date);
    const createdAt = new Date(appointment.created_at);
    const leadTimeHours = (appointmentDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    if (leadTimeHours < 24) {
      console.log(`[SmsService] ℹ️  RDV pris ${leadTimeHours.toFixed(1)}h avant (moins de 24h), pas de SMS différé (déjà envoyé immédiatement)`);
      return {
        success: true, // Pas une erreur, juste pas de SMS différé pour ce cas
        metadata: { reason: 'lead_time_less_24h', leadTimeHours },
      };
    }

    // 5. Vérifier que 3 heures se sont écoulées depuis l'envoi de l'email
    const emailSentAt = new Date(appointment.email_sent_at);
    const now = new Date();
    const hoursSinceEmailSent = (now.getTime() - emailSentAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceEmailSent < 3) {
      console.log(`[SmsService] ℹ️  Seulement ${hoursSinceEmailSent.toFixed(1)}h depuis l'envoi de l'email pour ${appointmentId}, attente de 3h`);
      return {
        success: true, // Pas une erreur, juste trop tôt
        metadata: { reason: 'less_than_3_hours', hoursSinceEmailSent },
      };
    }

    // 5. Vérifier que le statut est toujours "scheduled" ou "confirmed"
    if (appointment.status !== 'scheduled' && appointment.status !== 'confirmed') {
      console.log(`[SmsService] ℹ️  Rendez-vous ${appointmentId} a le statut "${appointment.status}", pas de SMS de confirmation`);
      return {
        success: false,
        error: `Rendez-vous avec statut "${appointment.status}"`,
      };
    }

    // Construire le contexte de notification
    const context = await buildNotificationContext(appointmentId, supabase);
    if (!context) {
      return {
        success: false,
        error: 'Impossible de construire le contexte de notification',
      };
    }

    // Vérifier que le téléphone est disponible
    if (!context.clientPhone || context.clientPhone.trim() === '') {
      console.warn(`[SmsService] ⚠️  Téléphone non disponible pour le rendez-vous ${appointmentId}`);
      return {
        success: false,
        error: 'Numéro de téléphone du client non disponible',
      };
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

    // Envoyer le SMS
    const smsResult = await notificationService.sendSms({
      to: context.clientPhone,
      message: smsText,
    });

    if (!smsResult.success) {
      console.error(`[SmsService] ❌ Erreur lors de l'envoi du SMS pour ${appointmentId}:`, smsResult.error);
      return {
        success: false,
        error: smsResult.error || 'Erreur inconnue lors de l\'envoi du SMS',
      };
    }

    // Mettre à jour l'appointment
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        sms_confirmation_sent: true,
        sms_confirmation_type: 'confirmation_missing_email_open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (updateError) {
      console.error(`[SmsService] ❌ Erreur lors de la mise à jour de sms_confirmation_sent:`, updateError);
      // Ne pas faire échouer l'opération si la mise à jour échoue
    }

    console.log(`[SmsService] ✅ SMS de confirmation envoyé pour le rendez-vous ${appointmentId} (email non ouvert après 3h)`);

    return {
      success: true,
      metadata: {
        appointmentId,
        smsSentTo: context.clientPhone,
        hoursSinceEmailSent: hoursSinceEmailSent.toFixed(1),
      },
    };
  } catch (error: any) {
    console.error(`[SmsService] ❌ Erreur lors de l'envoi du SMS de confirmation pour ${appointmentId}:`, error);
    return {
      success: false,
      error: error.message || 'Erreur inconnue',
    };
  }
}

/**
 * Envoie un SMS de rappel si les conditions sont remplies (Option C)
 * 
 * Conditions :
 * - RDV dans les 24-36h
 * - Fenêtre horaire 6h-20h
 * - SMS de rappel pas déjà envoyé
 * - Statut "scheduled" ou "confirmed"
 * 
 * @param appointmentId - ID du rendez-vous
 * @returns Résultat de l'envoi avec success: true si réussi, ou metadata avec shouldRetry si hors fenêtre
 */
export async function sendSmsReminderIfNeeded(
  appointmentId: string
): Promise<{ success: boolean; error?: string; shouldRetry?: boolean; retryAt?: Date; metadata?: Record<string, unknown> }> {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return {
        success: false,
        error: 'Configuration Supabase manquante',
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Récupérer l'appointment avec skipReminderSms
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, appointment_date, sms_reminder_sent, skip_reminder_sms, status')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error(`[SmsService] ❌ Erreur lors de la récupération du rendez-vous ${appointmentId}:`, appointmentError);
      return {
        success: false,
        error: 'Rendez-vous non trouvé',
      };
    }

    // 1. Vérifier que skipReminderSms = false (RDV pris ≥ 24h avant)
    if (appointment.skip_reminder_sms) {
      console.log(`[SmsService] ℹ️  skipReminderSms = true pour ${appointmentId} (RDV pris < 24h avant), pas de SMS de rappel`);
      return {
        success: true, // Pas une erreur, juste pas de rappel pour ce cas
        metadata: { reason: 'skip_reminder_sms' },
      };
    }

    // 2. SMS de rappel ne doit pas avoir déjà été envoyé
    if (appointment.sms_reminder_sent) {
      console.log(`[SmsService] ℹ️  SMS de rappel déjà envoyé pour ${appointmentId}`);
      return {
        success: true, // Pas une erreur, juste déjà envoyé
        metadata: { reason: 'sms_already_sent' },
      };
    }

    // 3. Vérifier que le statut est "scheduled" ou "confirmed"
    if (appointment.status !== 'scheduled' && appointment.status !== 'confirmed') {
      console.log(`[SmsService] ℹ️  Rendez-vous ${appointmentId} a le statut "${appointment.status}", pas de SMS de rappel`);
      return {
        success: true, // Pas une erreur, juste pas de rappel pour ce statut
        metadata: { reason: 'appointment_not_active', status: appointment.status },
      };
    }

    // 4. Vérifier que le RDV est exactement dans 24h (± fenêtre du cron, ex: 24h à 24h15min)
    const appointmentDate = new Date(appointment.appointment_date);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const minutesUntilAppointment = (appointmentDate.getTime() - now.getTime()) / (1000 * 60);

    // Fenêtre : entre 24h et 24h15min (pour permettre au cron de tourner toutes les 15min)
    const minHours = 24;
    const maxHours = 24.25; // 24h15min

    if (hoursUntilAppointment < minHours) {
      console.log(`[SmsService] ℹ️  Rendez-vous ${appointmentId} dans ${hoursUntilAppointment.toFixed(1)}h (minimum 24h requis), pas encore le moment`);
      return {
        success: true, // Pas une erreur, juste trop tôt
        metadata: { reason: 'too_early', hoursUntilAppointment },
      };
    }

    if (hoursUntilAppointment > maxHours) {
      console.log(`[SmsService] ℹ️  Rendez-vous ${appointmentId} dans ${hoursUntilAppointment.toFixed(1)}h (maximum ${maxHours}h), trop tard`);
      return {
        success: true, // Pas une erreur, juste trop tard
        metadata: { reason: 'too_late', hoursUntilAppointment },
      };
    }

    // Construire le contexte de notification
    const context = await buildNotificationContext(appointmentId, supabase);
    if (!context) {
      return {
        success: false,
        error: 'Impossible de construire le contexte de notification',
      };
    }

    // Vérifier que le téléphone est disponible
    if (!context.clientPhone || context.clientPhone.trim() === '') {
      console.warn(`[SmsService] ⚠️  Téléphone non disponible pour le rendez-vous ${appointmentId}`);
      return {
        success: false,
        error: 'Numéro de téléphone du client non disponible',
      };
    }

    // Construire le SMS de rappel avec le template standardisé (sans accents, <= 160 caractères)
    const { buildReminderSms, formatDateForSms, formatTimeForSms, formatWeekdayForSms } = await import('./smsTemplates.js');
    
    const smsContext = {
      clientFirstName: context.clientName.split(' ')[0] || context.clientName,
      serviceName: context.serviceName,
      salonName: context.salonName,
      appointmentWeekday: formatWeekdayForSms(context.startDate),
      appointmentDate: formatDateForSms(context.startDate),
      appointmentTime: formatTimeForSms(context.startDate),
    };
    
    const smsText = buildReminderSms(smsContext);

    // Envoyer le SMS
    const smsResult = await notificationService.sendSms({
      to: context.clientPhone,
      message: smsText,
    });

    if (!smsResult.success) {
      console.error(`[SmsService] ❌ Erreur lors de l'envoi du SMS de rappel pour ${appointmentId}:`, smsResult.error);
      return {
        success: false,
        error: smsResult.error || 'Erreur inconnue lors de l\'envoi du SMS',
      };
    }

    // Mettre à jour l'appointment
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        sms_reminder_sent: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (updateError) {
      console.error(`[SmsService] ❌ Erreur lors de la mise à jour de sms_reminder_sent:`, updateError);
      // Ne pas faire échouer l'opération si la mise à jour échoue
    }

    console.log(`[SmsService] ✅ SMS de rappel envoyé pour le rendez-vous ${appointmentId} (${hoursUntilAppointment.toFixed(1)}h avant)`);

    return {
      success: true,
      metadata: {
        appointmentId,
        smsSentTo: context.clientPhone,
        hoursUntilAppointment: hoursUntilAppointment.toFixed(1),
      },
    };
  } catch (error: any) {
    console.error(`[SmsService] ❌ Erreur lors de l'envoi du SMS de rappel pour ${appointmentId}:`, error);
    return {
      success: false,
      error: error.message || 'Erreur inconnue',
    };
  }
}

