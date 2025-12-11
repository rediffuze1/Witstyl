/**
 * Utilitaires pour construire le contexte de notification à partir des données de la base
 */

import { BookingNotificationContext } from './types.js';
import { createClient } from '@supabase/supabase-js';
import { AppointmentTemplateContext } from './templateRenderer.js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Construit le contexte de notification à partir d'un ID de rendez-vous
 * Récupère toutes les données nécessaires (client, service, styliste, salon) depuis Supabase
 */
export async function buildNotificationContext(
  appointmentId: string,
  supabase: ReturnType<typeof createClient>
): Promise<BookingNotificationContext | null> {
  try {
    // Récupérer le rendez-vous
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, appointment_date, duration, client_id, service_id, stylist_id, salon_id')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error('[Notifications] Erreur lors de la récupération du rendez-vous:', appointmentError);
      return null;
    }

    // Type assertion pour les données Supabase
    const appointmentData = appointment as any;

    // Vérifier si stylist_id est valide (pas "none", null ou undefined)
    const hasStylist = appointmentData.stylist_id && 
                       appointmentData.stylist_id !== 'none' && 
                       appointmentData.stylist_id !== null && 
                       appointmentData.stylist_id !== undefined;

    // Récupérer les données liées en parallèle
    const queries: Promise<any>[] = [
      supabase
        .from('clients')
        .select('first_name, last_name, email, phone')
        .eq('id', appointmentData.client_id)
        .single(),
      supabase
        .from('services')
        .select('name')
        .eq('id', appointmentData.service_id)
        .single(),
      supabase
        .from('salons')
        .select('name')
        .eq('id', appointmentData.salon_id)
        .single(),
    ];

    // Ajouter la requête styliste seulement si stylist_id est valide
    if (hasStylist) {
      queries.push(
        supabase
          .from('stylistes')
          .select('first_name, last_name')
          .eq('id', appointmentData.stylist_id)
          .single()
      );
    }

    const results = await Promise.all(queries);

    const clientResult = results[0];
    const serviceResult = results[1];
    const salonResult = results[2];
    const stylistResult = hasStylist ? results[3] : { data: null, error: null };

    // Vérifier les erreurs (styliste est optionnel)
    if (clientResult.error || !clientResult.data) {
      console.error('[Notifications] Erreur lors de la récupération du client:', clientResult.error);
      return null;
    }
    if (serviceResult.error || !serviceResult.data) {
      console.error('[Notifications] Erreur lors de la récupération du service:', serviceResult.error);
      return null;
    }
    if (salonResult.error || !salonResult.data) {
      console.error('[Notifications] Erreur lors de la récupération du salon:', salonResult.error);
      return null;
    }
    // Le styliste est optionnel (peut être "none" ou null)
    if (hasStylist && (stylistResult.error || !stylistResult.data)) {
      console.warn('[Notifications] Avertissement: styliste non trouvé, utilisation du nom par défaut:', stylistResult.error);
    }

    const client = clientResult.data as any;
    const service = serviceResult.data as any;
    const stylist = stylistResult.data as any;
    const salon = salonResult.data as any;

    const startDate = new Date(appointmentData.appointment_date);
    const endDate = new Date(startDate.getTime() + (appointmentData.duration || 30) * 60000);

    // Construire le nom du styliste (ou utiliser un nom par défaut)
    let stylistName = 'un·e coiffeur·euse';
    if (hasStylist && stylist) {
      stylistName = `${stylist.first_name || ''} ${stylist.last_name || ''}`.trim() || 'un·e coiffeur·euse';
    }

    // Logs détaillés pour le debug du numéro de téléphone
    console.log('[buildNotificationContext] 📞 TRACE DU NUMÉRO DE TÉLÉPHONE:');
    console.log('[buildNotificationContext] 📞   client.phone (depuis DB):', client.phone || '(vide ou null)');
    console.log('[buildNotificationContext] 📞   client.phone type:', typeof client.phone);
    console.log('[buildNotificationContext] 📞   client.phone length:', client.phone?.length || 0);

    const context = {
      bookingId: appointmentData.id,
      salonId: appointmentData.salon_id, // Ajouter salonId pour récupérer les templates
      clientName: `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client',
      clientEmail: client.email || '',
      clientPhone: client.phone || '',
      serviceName: service.name || 'Service',
      salonName: salon.name || 'Salon',
      stylistName,
      startDate,
      endDate,
    };

    console.log('[buildNotificationContext] 📞   context.clientPhone (final):', context.clientPhone || '(vide)');
    console.log('[buildNotificationContext] 📞   context.clientPhone type:', typeof context.clientPhone);

    return context;
  } catch (error: any) {
    console.error('[Notifications] Erreur lors de la construction du contexte:', error);
    return null;
  }
}

/**
 * Construit un contexte de template de test avec des valeurs factices
 * Utile pour les emails de test depuis l'interface manager
 * 
 * @param salonId - ID du salon
 * @param salonName - Nom du salon (optionnel, défaut: "Salon de Test")
 * @returns Contexte de template avec des valeurs de test
 */
export function buildAppointmentTemplateContextForTest(
  salonId: string,
  salonName?: string
): AppointmentTemplateContext {
  // Date de test : demain à 15h00
  const testDate = new Date();
  testDate.setDate(testDate.getDate() + 1);
  testDate.setHours(15, 0, 0, 0);

  // Utiliser date-fns pour formater la date (cohérence avec NotificationService)
  const formattedDate = format(testDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
  const formattedTime = format(testDate, "HH:mm", { locale: fr });

  return {
    clientFirstName: 'TestClient',
    clientFullName: 'Test Client',
    appointmentDate: formattedDate,
    appointmentTime: formattedTime,
    serviceName: 'Coupe Test',
    salonName: salonName || 'Salon de Test',
    stylistName: 'Coiffeur·euse Test',
  };
}

