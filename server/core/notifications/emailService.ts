/**
 * Service de gestion des emails de confirmation
 * 
 * Ce service gère l'envoi des emails de confirmation et le stockage
 * des événements email pour le tracking (Option B).
 */

import { createClient } from '@supabase/supabase-js';
import { notificationService } from './index.js';
import { buildNotificationContext } from './utils.js';
import type { BookingNotificationContext } from './types.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('[EmailService] ⚠️  SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non définis');
}

/**
 * Envoie un email de confirmation pour un rendez-vous
 * et enregistre l'événement en base de données
 * 
 * @param appointmentId - ID du rendez-vous
 * @returns Résultat de l'envoi avec success: true si réussi
 */
export async function sendConfirmationEmail(
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

    // Construire le contexte de notification
    const context = await buildNotificationContext(appointmentId, supabase);
    if (!context) {
      return {
        success: false,
        error: 'Impossible de construire le contexte de notification',
      };
    }

    // Vérifier que l'email est disponible
    if (!context.clientEmail || context.clientEmail.trim() === '') {
      console.warn(`[EmailService] ⚠️  Email non disponible pour le rendez-vous ${appointmentId}`);
      return {
        success: false,
        error: 'Adresse email du client non disponible',
      };
    }

    // Envoyer l'email via NotificationService
    // Note: NotificationService.sendBookingConfirmation envoie email + SMS
    // Ici, on veut seulement l'email, donc on va utiliser directement le provider email
    const notificationModule = await import('./index');
    const notificationServiceInstance = notificationModule.notificationService;
    
    // Accéder au emailProvider via la méthode publique
    const emailProvider = notificationServiceInstance.getEmailProvider();
    if (!emailProvider) {
      return {
        success: false,
        error: 'Email provider non disponible',
      };
    }
    
    // Récupérer les templates
    const settingsRepoFactory = notificationServiceInstance.getSettingsRepositoryFactory();
    const settingsRepo = settingsRepoFactory(context.salonId);
    const settings = await settingsRepo.getSettings(context.salonId);
    
    const { renderTemplate } = await import('./templateRenderer');
    const { format } = await import('date-fns');
    const { fr } = await import('date-fns/locale');
    const { DEFAULT_NOTIFICATION_TEMPLATES } = await import('./defaultTemplates');
    
    const formattedDate = format(context.startDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
    const formattedTime = format(context.startDate, "HH:mm", { locale: fr });
    
    const templateContext = {
      clientFirstName: context.clientName.split(' ')[0] || context.clientName,
      clientFullName: context.clientName,
      appointmentDate: formattedDate,
      appointmentTime: formattedTime,
      serviceName: context.serviceName,
      salonName: context.salonName,
      stylistName: context.stylistName,
    };
    
    const rawEmailSubject = settings.confirmationEmailSubject || DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailSubject;
    const rawEmailHtml = settings.confirmationEmailHtml || DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailHtml;
    
    const emailSubject = renderTemplate(rawEmailSubject, templateContext);
    const emailHtml = renderTemplate(rawEmailHtml, templateContext);
    
    // Générer la version texte
    const emailText = emailHtml.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n');
    
    // Envoyer l'email avec metadata pour le webhook Resend
    const emailResult = await emailProvider.sendEmail({
      to: context.clientEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      metadata: {
        appointmentId: appointmentId, // Pour permettre au webhook de relier l'email au RDV
      },
    });
    
    if (!emailResult.success) {
      console.error(`[EmailService] ❌ Erreur lors de l'envoi de l'email pour ${appointmentId}:`, emailResult.error);
      return {
        success: false,
        error: emailResult.error || 'Erreur inconnue lors de l\'envoi de l\'email',
      };
    }
    
    // Enregistrer l'événement "email sent" en base
    await storeEmailSentEvent(appointmentId, supabase);
    
    console.log(`[EmailService] ✅ Email de confirmation envoyé pour le rendez-vous ${appointmentId}`);
    
    return {
      success: true,
      metadata: {
        appointmentId,
        emailSentTo: context.clientEmail,
      },
    };
  } catch (error: any) {
    console.error(`[EmailService] ❌ Erreur lors de l'envoi de l'email pour ${appointmentId}:`, error);
    return {
      success: false,
      error: error.message || 'Erreur inconnue',
    };
  }
}

/**
 * Enregistre l'événement "email sent" en base de données
 * 
 * @param appointmentId - ID du rendez-vous
 * @param supabase - Client Supabase
 */
export async function storeEmailSentEvent(
  appointmentId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  try {
    // Mettre à jour l'appointment avec emailSentAt
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);
    
    if (updateError) {
      console.error(`[EmailService] ❌ Erreur lors de la mise à jour de email_sent_at:`, updateError);
      return;
    }
    
    // Créer un événement email de type "sent" (ou "delivered" si on reçoit le webhook)
    // Pour l'instant, on crée juste l'événement "sent" manuellement
    // Le webhook Resend créera l'événement "delivered" et "opened"
    const { error: eventError } = await supabase
      .from('email_events')
      .insert({
        appointment_id: appointmentId,
        type: 'sent',
        provider: 'Resend',
        timestamp: new Date().toISOString(),
      });
    
    if (eventError) {
      console.error(`[EmailService] ❌ Erreur lors de la création de l'événement email:`, eventError);
      // Ne pas faire échouer l'opération si l'événement ne peut pas être créé
    }
    
    console.log(`[EmailService] ✅ Événement email "sent" enregistré pour ${appointmentId}`);
  } catch (error: any) {
    console.error(`[EmailService] ❌ Erreur lors du stockage de l'événement email:`, error);
    // Ne pas faire échouer l'opération
  }
}

/**
 * Met à jour l'appointment avec emailOpenedAt quand un email est ouvert
 * 
 * @param appointmentId - ID du rendez-vous
 * @param supabase - Client Supabase
 */
export async function markEmailAsOpened(
  appointmentId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  try {
    // Vérifier si emailOpenedAt n'est pas déjà défini
    const { data: appointment } = await supabase
      .from('appointments')
      .select('email_opened_at')
      .eq('id', appointmentId)
      .single();
    
    if (appointment && appointment.email_opened_at) {
      console.log(`[EmailService] ℹ️  Email déjà marqué comme ouvert pour ${appointmentId}`);
      return;
    }
    
    // Mettre à jour l'appointment avec emailOpenedAt
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        email_opened_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);
    
    if (updateError) {
      console.error(`[EmailService] ❌ Erreur lors de la mise à jour de email_opened_at:`, updateError);
      return;
    }
    
    console.log(`[EmailService] ✅ Email marqué comme ouvert pour ${appointmentId}`);
  } catch (error: any) {
    console.error(`[EmailService] ❌ Erreur lors du marquage de l'email comme ouvert:`, error);
  }
}

