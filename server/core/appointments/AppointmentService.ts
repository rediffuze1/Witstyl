import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationService } from '../notifications/NotificationService';
import { buildNotificationContext } from '../notifications/utils';
import type {
  BookingNotificationContext,
  ManagerCancellationNotificationContext,
} from '../notifications/types';

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

  console.log('[Appointments] ✅ Appointment cancelled in DB:', {
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
      
      console.log('[Appointments] 📧 Sending cancellation email to client...');
      await deps.notificationService.sendBookingCancellation(notificationContext);
      console.log('[Appointments] ✅ Client cancellation email sent');

      if (cancelledByRole === 'client') {
        const managerContext = await buildManagerCancellationContext(
          supabase,
          notificationContext,
          updatedAppointment.salon_id,
          cancelledByRole,
        );

        if (managerContext) {
          console.log('[Appointments] 📧 Sending cancellation info email to manager...');
          await deps.notificationService.sendBookingCancellationInfoToManager(managerContext);
          console.log('[Appointments] ✅ Manager informed about cancellation');
        } else {
          console.warn(
            '[Appointments] ⚠️ Manager email unavailable, skipping info notification.',
          );
        }
      }
    } else {
      console.warn('[Appointments] ⚠️ Unable to build notification context, skipping emails.');
    }
  } catch (notificationError) {
    console.error('[Appointments] ❌ Error while sending cancellation notifications:', notificationError);
  }

  return { success: true, appointment: updatedAppointment };
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
    console.error('[Appointments] ❌ Impossible de récupérer le salon pour notification manager:', salonError);
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
      console.warn('[Appointments] ⚠️ Impossible de récupérer le propriétaire pour notification:', ownerError);
    }
    managerEmail = owner?.email || '';
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
