import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationService } from '../notifications/NotificationService.js';
import { buildNotificationContext } from '../notifications/utils.js';
import type {
  BookingNotificationContext,
  ManagerCancellationNotificationContext,
} from '../notifications/types.js';

type CancelledByRole = 'client' | 'manager';

export interface CancelAppointmentParams {
  supabase: SupabaseClient<any, 'public', any>;
  appointmentId: string;
  cancelledById: string;
  cancelledByRole: CancelledByRole;
  cancellationReason?: string;
  /**
   * Utilisé pour s'assurer qu'un client ne peut annuler que ses RDV
   */
  expectedClientId?: string;
}

export interface CancelAppointmentResult {
  success: boolean;
  status?: number;
  error?: string;
  appointment?: any;
  alreadyCancelled?: boolean;
}

interface CancelAppointmentDeps {
  notificationService: NotificationService;
}

/**
 * Service centralisé pour gérer l'annulation d'un rendez-vous.
 * - Vérifie les permissions
 * - Met à jour le statut + payload
 * - Déclenche les notifications (client + manager)
 */
export async function cancelAppointment(
  params: CancelAppointmentParams,
  deps: CancelAppointmentDeps,
): Promise<CancelAppointmentResult> {
  const {
    supabase,
    appointmentId,
    cancelledById,
    cancelledByRole,
    cancellationReason,
    expectedClientId,
  } = params;

  console.log('[Appointments] 🛑 Cancellation requested:', {
    appointmentId,
    cancelledById,
    cancelledByRole,
  });

  // Rechercher le rendez-vous avec l'ID exact (la base accepte les IDs avec préfixe "appointment-")
  // Note: payload peut ne pas exister dans certaines versions de la table
  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, status, client_id, salon_id')
    .eq('id', appointmentId)
    .maybeSingle();

  if (appointmentError) {
    console.error('[Appointments] ❌ Erreur lors de la recherche du rendez-vous:', {
      appointmentId,
      error: appointmentError,
      code: appointmentError.code,
      message: appointmentError.message,
    });
    return { success: false, status: 500, error: 'Erreur lors de la recherche du rendez-vous' };
  }

  if (!appointment) {
    console.error('[Appointments] ❌ Appointment not found for cancellation', {
      appointmentId,
      searchedId: appointmentId,
    });
    
    // Log supplémentaire : chercher tous les rendez-vous récents pour debug
    const { data: recentAppointments } = await supabase
      .from('appointments')
      .select('id, appointment_date, status')
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log('[Appointments] 🔍 Derniers rendez-vous dans la base:', recentAppointments?.map(a => ({ id: a.id, date: a.appointment_date, status: a.status })));
    
    return { success: false, status: 404, error: 'Rendez-vous introuvable' };
  }

  console.log('[Appointments] ✅ Rendez-vous trouvé:', {
    id: appointment.id,
    status: appointment.status,
    client_id: appointment.client_id,
  });

  if (expectedClientId && appointment.client_id !== expectedClientId) {
    console.warn('[Appointments] ❌ Client tried to cancel someone else appointment', {
      appointmentId,
      clientId: expectedClientId,
      appointmentClientId: appointment.client_id,
    });
    return { success: false, status: 403, error: 'Accès refusé pour ce rendez-vous' };
  }

  if (appointment.status === 'cancelled') {
    console.log('[Appointments] ℹ️ Appointment already cancelled, skipping update.');
    return { success: true, alreadyCancelled: true, appointment };
  }

  const nowIso = new Date().toISOString();
  const reason =
    cancellationReason ||
    (cancelledByRole === 'client' ? 'Annulé par le client' : 'Annulé par le salon');

  // Construire les données de mise à jour (payload peut ne pas exister)
  const updateData: any = {
    status: 'cancelled',
    updated_at: nowIso,
  };
  
  // Essayer de mettre à jour payload seulement si la colonne existe
  // Pour l'instant, on ne met pas payload car la colonne n'existe pas dans cette version
  // Si besoin, on peut ajouter cancelled_at et cancelled_by séparément
  
  const { data: updatedAppointment, error: updateError } = await supabase
    .from('appointments')
    .update(updateData)
    .eq('id', appointmentId)
    .select('id, salon_id, client_id, service_id, stylist_id, appointment_date, duration, status')
    .single();

  if (updateError || !updatedAppointment) {
    console.error('[Appointments] ❌ Unable to update appointment status to cancelled', {
      appointmentId,
      error: updateError,
      code: updateError?.code,
      message: updateError?.message,
    });
    return { success: false, status: 500, error: "Impossible d'annuler le rendez-vous" };
  }

  console.log('[CANCEL] ✅ Appointment cancelled in DB:', {
    appointmentId,
    cancelledByRole,
    updatedId: updatedAppointment.id,
  });

  // Notifications
  try {
    const notificationContext = await buildNotificationContext(appointmentId, supabase);
    if (notificationContext) {
      notificationContext.cancellationReason = reason;
      notificationContext.cancelledByRole = cancelledByRole;
      
      // Vérifier si clientEmail === managerEmail pour éviter la duplication
      // On récupère d'abord l'email manager pour vérifier
      const managerContextTemp = await buildManagerCancellationContext(
        supabase,
        notificationContext,
        updatedAppointment.salon_id,
        cancelledByRole,
      );
      
      const isSameEmail = managerContextTemp && 
                          notificationContext.clientEmail &&
                          managerContextTemp.managerEmail &&
                          notificationContext.clientEmail.trim().toLowerCase() === managerContextTemp.managerEmail.trim().toLowerCase();

      if (isSameEmail) {
        // Si même email : seul l'email manager sera envoyé (fusionné)
        console.log('[CANCEL_EMAIL] 🔀 Same email as manager, client email will be merged:', {
          email: notificationContext.clientEmail,
          appointmentId,
        });
      } else {
        // Envoyer l'email au client avec idempotence (seulement si emails différents)
        console.log('[CANCEL_EMAIL] 📧 Preparing to send client cancellation email...');
        void sendClientCancelEmailWithIdempotence(
          supabase,
          deps.notificationService,
          notificationContext,
          appointmentId,
        ).catch((error) => {
          console.error('[CANCEL_EMAIL] ❌ Unhandled error in client email:', error);
        });
      }

      // Envoyer l'email au manager (toujours, pas seulement si cancelledByRole === 'client')
      // Si clientEmail === managerEmail, l'email sera fusionné dans sendBookingCancellationInfoToManager
      // Ne pas bloquer la réponse HTTP - utiliser void pour fire-and-forget avec timebox
      void sendManagerCancelEmailWithIdempotence(
        supabase,
        deps.notificationService,
        notificationContext,
        updatedAppointment.salon_id,
        cancelledByRole,
        appointmentId,
      ).catch((error) => {
        // Erreur déjà loggée dans la fonction, juste éviter les unhandled rejections
        console.error('[MANAGER_EMAIL] ❌ Unhandled error in manager email:', error);
      });
    } else {
      console.warn('[NOTIF] ⚠️ Unable to build notification context, skipping emails.');
    }
  } catch (notificationError) {
    console.error('[NOTIF] ❌ Error while sending cancellation notifications:', notificationError);
  }

  return { success: true, appointment: updatedAppointment };
}

/**
 * Envoie l'email au client avec idempotence et timebox (non-bloquant)
 */
async function sendClientCancelEmailWithIdempotence(
  supabase: SupabaseClient<any, 'public', any>,
  notificationService: NotificationService,
  baseContext: BookingNotificationContext,
  appointmentId: string,
): Promise<void> {
  const eventType = 'client_cancel_email';

  // Vérifier l'idempotence : tenter d'insérer l'événement
  const { error: insertError } = await supabase
    .from('notification_events')
    .insert({
      event_type: eventType,
      appointment_id: appointmentId,
    })
    .select()
    .single();

  if (insertError) {
    // Si erreur de contrainte unique => déjà envoyé
    if (insertError.code === '23505') {
      console.log('[CANCEL_EMAIL] ⏭️ Skipped (already sent):', {
        appointmentId,
        eventType,
      });
      return;
    }
    // Autre erreur => log et continuer quand même (ne pas bloquer)
    console.error('[CANCEL_EMAIL] ⚠️ Error checking idempotence:', {
      appointmentId,
      error: insertError,
    });
    // On continue quand même pour ne pas perdre l'email si la table n'existe pas encore
  }

  if (!baseContext.clientEmail || baseContext.clientEmail.trim() === '') {
    console.warn('[CANCEL_EMAIL] ⚠️ Client email unavailable, skipping:', {
      appointmentId,
      clientName: baseContext.clientName,
    });
    return;
  }

  console.log('[CANCEL_EMAIL] 📧 Preparing to send:', {
    clientEmail: baseContext.clientEmail,
    appointmentId,
  });

  // Timebox: 2s max pour ne pas bloquer la réponse HTTP
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Client email timeout after 2000ms'));
    }, 2000);
  });

  try {
    await Promise.race([
      notificationService.sendBookingCancellation(baseContext),
      timeoutPromise,
    ]);
    console.log('[CANCEL_EMAIL] ✅ Sent successfully:', {
      appointmentId,
      to: baseContext.clientEmail,
    });
  } catch (error: any) {
    if (error.message?.includes('timeout')) {
      console.warn('[CANCEL_EMAIL] ⏱️ Timeout after 2s (non-blocking):', {
        appointmentId,
        to: baseContext.clientEmail,
      });
    } else {
      console.error('[CANCEL_EMAIL] ❌ Failed to send:', {
        appointmentId,
        to: baseContext.clientEmail,
        error: error.message || error,
      });
    }
    // Ne pas throw - on continue même si l'email échoue
  }
}

/**
 * Envoie l'email au manager avec idempotence et timebox (non-bloquant)
 */
async function sendManagerCancelEmailWithIdempotence(
  supabase: SupabaseClient<any, 'public', any>,
  notificationService: NotificationService,
  baseContext: BookingNotificationContext,
  salonId: string,
  cancelledByRole: CancelledByRole,
  appointmentId: string,
): Promise<void> {
  // Feature flag: désactiver si ENABLE_MANAGER_CANCEL_EMAIL=false
  const enableManagerEmail = process.env.ENABLE_MANAGER_CANCEL_EMAIL !== 'false';
  if (!enableManagerEmail) {
    console.log('[MANAGER_EMAIL] ⚠️ Feature disabled via ENABLE_MANAGER_CANCEL_EMAIL=false');
    return;
  }

  const eventType = 'manager_cancel_email';

  // Vérifier l'idempotence : tenter d'insérer l'événement
  const { error: insertError } = await supabase
    .from('notification_events')
    .insert({
      event_type: eventType,
      appointment_id: appointmentId,
    })
    .select()
    .single();

  if (insertError) {
    // Si erreur de contrainte unique => déjà envoyé
    if (insertError.code === '23505') {
      console.log('[MANAGER_EMAIL] ⏭️ Skipped (already sent):', {
        appointmentId,
        eventType,
      });
      return;
    }
    // Autre erreur => log et continuer quand même (ne pas bloquer)
    console.error('[MANAGER_EMAIL] ⚠️ Error checking idempotence:', {
      appointmentId,
      error: insertError,
    });
    // On continue quand même pour ne pas perdre l'email si la table n'existe pas encore
  }

  // Construire le contexte manager
  const managerContext = await buildManagerCancellationContext(
    supabase,
    baseContext,
    salonId,
    cancelledByRole,
  );

  if (!managerContext) {
    console.warn('[MANAGER_EMAIL] ⚠️ Manager email unavailable, skipping:', {
      salonId,
      appointmentId,
    });
    return;
  }

  // Vérifier si clientEmail === managerEmail
  const isSameEmail = baseContext.clientEmail && 
                      managerContext.managerEmail &&
                      baseContext.clientEmail.trim().toLowerCase() === managerContext.managerEmail.trim().toLowerCase();

  if (isSameEmail) {
    console.log('[MANAGER_EMAIL] 🔀 Same email as client, manager email will be merged:', {
      email: managerContext.managerEmail,
      appointmentId,
    });
    // L'email manager sera fusionné dans sendBookingCancellationInfoToManager
    // On envoie quand même pour avoir l'idempotence manager_cancel_email
  }

  console.log('[MANAGER_EMAIL] 📧 Preparing to send:', {
    salonId,
    managerEmail: managerContext.managerEmail,
    appointmentId,
    merged_with_client_email: isSameEmail,
  });

  // Timebox: 2s max pour ne pas bloquer la réponse HTTP
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Manager email timeout after 2000ms'));
    }, 2000);
  });

  try {
    await Promise.race([
      notificationService.sendBookingCancellationInfoToManager(managerContext),
      timeoutPromise,
    ]);
    console.log('[MANAGER_EMAIL] ✅ Sent successfully:', {
      appointmentId,
      to: managerContext.managerEmail,
      merged_with_client_email: isSameEmail,
    });
  } catch (error: any) {
    if (error.message?.includes('timeout')) {
      console.warn('[MANAGER_EMAIL] ⏱️ Timeout after 2s (non-blocking):', {
        appointmentId,
        to: managerContext.managerEmail,
      });
    } else {
      console.error('[MANAGER_EMAIL] ❌ Failed to send:', {
        appointmentId,
        to: managerContext.managerEmail,
        error: error.message || error,
      });
    }
    // Ne pas throw - on continue même si l'email échoue
  }
}

async function buildManagerCancellationContext(
  supabase: SupabaseClient<any, 'public', any>,
  baseContext: BookingNotificationContext,
  salonId: string,
  cancelledByRole: CancelledByRole,
): Promise<ManagerCancellationNotificationContext | null> {
  const { data: salon, error: salonError } = await supabase
    .from('salons')
    .select('id, name, email, user_id')
    .eq('id', salonId)
    .maybeSingle();

  if (salonError) {
    console.error('[MANAGER_EMAIL] ❌ Impossible de récupérer le salon pour notification manager:', salonError);
    return null;
  }

  let managerEmail = salon?.email || '';
  if (!managerEmail && salon?.user_id) {
    const { data: owner, error: ownerError } = await supabase
      .from('users')
      .select('email')
      .eq('id', salon.user_id)
      .maybeSingle();

    if (ownerError) {
      console.warn('[MANAGER_EMAIL] ⚠️ Impossible de récupérer le propriétaire pour notification:', ownerError);
    }
    managerEmail = owner?.email || '';
  }

  // Fallback sur RESEND_TO_OVERRIDE en dev si configuré
  if (!managerEmail && process.env.RESEND_TO_OVERRIDE) {
    managerEmail = process.env.RESEND_TO_OVERRIDE;
    console.log('[MANAGER_EMAIL] 🔧 Using RESEND_TO_OVERRIDE fallback:', managerEmail);
  }

  if (!managerEmail) {
    return null;
  }

  return {
    ...baseContext,
    managerEmail,
    managerName: salon?.name || 'Manager',
    cancelledByRole,
  };
}
