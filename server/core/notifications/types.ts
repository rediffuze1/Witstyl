/**
 * Types et interfaces pour le système de notifications
 * 
 * Ce module définit les interfaces abstraites pour les providers de notifications.
 * L'objectif est de permettre de changer facilement de provider (SMSup → Twilio, Resend → Brevo, etc.)
 * sans modifier la logique métier.
 */

/**
 * Interface pour un provider de SMS
 * 
 * Toute implémentation (SMSup, Twilio, etc.) doit respecter cette interface.
 */
export interface SmsProvider {
  /**
   * Envoie un SMS
   * @param params - Paramètres d'envoi
   * @param params.to - Numéro de téléphone au format international (ex: +41791234567)
   * @param params.message - Message à envoyer
   * @returns Résultat de l'envoi avec success: true si réussi, false sinon avec un message d'erreur
   */
  sendSms(params: { to: string; message: string }): Promise<{ success: boolean; error?: string }>;
}

/**
 * Interface pour un provider d'email
 * 
 * Toute implémentation (Resend, Brevo, SendGrid, etc.) doit respecter cette interface.
 */
export interface EmailProvider {
  /**
   * Envoie un email
   * @param params - Paramètres d'envoi
   * @param params.to - Adresse email du destinataire
   * @param params.subject - Sujet de l'email
   * @param params.html - Contenu HTML de l'email
   * @param params.text - Contenu texte brut (optionnel, utilisé comme fallback)
   * @param params.from - Adresse email de l'expéditeur (optionnel, peut être défini dans le provider)
   * @returns Résultat de l'envoi avec success: true si réussi, false sinon avec un message d'erreur
   */
  sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    from?: string;
  }): Promise<{ success: boolean; error?: string }>;
}

/**
 * Contexte d'une notification de réservation
 * 
 * Contient toutes les informations nécessaires pour générer les notifications
 * (confirmation, rappel, annulation, modification).
 */
export type BookingNotificationContext = {
  bookingId: string;
  salonId: string; // ID du salon (nécessaire pour récupérer les templates personnalisés)
  clientName: string;
  clientEmail: string;
  clientPhone: string; // Format international (ex: +41791234567)
  serviceName: string;
  salonName: string;
  stylistName: string;
  startDate: Date;
  endDate: Date;
  // Informations optionnelles pour les modifications/annulations
  cancellationReason?: string;
  modificationDetails?: string;
};

