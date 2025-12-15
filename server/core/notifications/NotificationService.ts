/**
 * Service central de notifications
 * 
 * Ce service expose des méthodes métier de haut niveau pour envoyer des notifications.
 * Il ne dépend PAS directement des implémentations concrètes (SMSup, Resend, etc.),
 * mais uniquement des interfaces abstraites (SmsProvider, EmailProvider).
 * 
 * Pour changer de provider :
 * 1. Créer une nouvelle implémentation de SmsProvider ou EmailProvider
 * 2. Modifier uniquement le fichier de composition (index.ts) pour utiliser le nouveau provider
 * 3. Aucune modification nécessaire dans ce fichier ni dans la logique métier
 */

import {
  SmsProvider,
  EmailProvider,
  BookingNotificationContext,
  ManagerCancellationNotificationContext,
} from './types.js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { NotificationSettingsRepository } from './NotificationSettingsRepository.js';
import { renderTemplate, AppointmentTemplateContext } from './templateRenderer.js';
import { DEFAULT_NOTIFICATION_TEMPLATES } from './defaultTemplates.js';

/**
 * Mode DEBUG pour les notifications
 * Active les logs détaillés si NOTIFICATIONS_DEBUG=true dans .env
 */
const DEBUG_MODE = process.env.NOTIFICATIONS_DEBUG === 'true';

/**
 * Fonction helper pour les logs DEBUG
 */
function debugLog(message: string, data?: any): void {
  if (DEBUG_MODE) {
    if (data) {
      console.log(`[NotificationService DEBUG] ${message}`, data);
    } else {
      console.log(`[NotificationService DEBUG] ${message}`);
    }
  }
}

export class NotificationService {
  constructor(
    private smsProvider: SmsProvider,
    private emailProvider: EmailProvider,
    private settingsRepositoryFactory: (salonId: string) => NotificationSettingsRepository,
  ) {}

  /**
   * Expose le emailProvider pour les services externes (emailService)
   */
  getEmailProvider(): EmailProvider {
    return this.emailProvider;
  }

  /**
   * Expose le smsProvider pour les services externes (smsService)
   */
  getSmsProvider(): SmsProvider {
    return this.smsProvider;
  }

  /**
   * Expose le settingsRepositoryFactory pour les services externes
   */
  getSettingsRepositoryFactory(): (salonId: string) => NotificationSettingsRepository {
    return this.settingsRepositoryFactory;
  }

  /**
   * Envoie une confirmation de rendez-vous
   * - 1 email au client
   * - 1 SMS au client
   * 
   * Les erreurs sont loggées mais n'interrompent pas l'exécution (non-bloquant)
   * 
   * ✅ UTILISE LES TEMPLATES CONFIGURÉS DANS notification_settings
   * Les templates proviennent de la base de données (via NotificationSettingsRepository)
   * avec fallback vers DEFAULT_NOTIFICATION_TEMPLATES si non configurés.
   */
  async sendBookingConfirmation(ctx: BookingNotificationContext): Promise<void> {
    const formattedDate = format(ctx.startDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
    const formattedTime = format(ctx.startDate, "HH:mm", { locale: fr });

    // Récupérer les templates personnalisés ou utiliser les valeurs par défaut
    const settingsRepo = this.settingsRepositoryFactory(ctx.salonId);
    const settings = await settingsRepo.getSettings(ctx.salonId);

    // Construire le contexte pour le rendu des templates
    const templateContext: AppointmentTemplateContext = {
      clientFirstName: ctx.clientName.split(' ')[0] || ctx.clientName,
      clientFullName: ctx.clientName,
      appointmentDate: formattedDate,
      appointmentTime: formattedTime,
      serviceName: ctx.serviceName,
      salonName: ctx.salonName,
      stylistName: ctx.stylistName,
    };

    // Récupérer les templates bruts (depuis DB ou defaults)
    const rawEmailSubject = settings.confirmationEmailSubject || DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailSubject;
    const rawEmailHtml = settings.confirmationEmailHtml || DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailHtml;
    const rawSmsText = settings.confirmationSmsText || DEFAULT_NOTIFICATION_TEMPLATES.confirmationSmsText;

    // Rendre les templates avec les placeholders
    const emailSubject = renderTemplate(rawEmailSubject, templateContext);
    const emailHtml = renderTemplate(rawEmailHtml, templateContext);
    const smsText = renderTemplate(rawSmsText, templateContext);

    // Logs détaillés pour validation (toujours affichés)
    console.log('[NotificationService] 📧 Email de confirmation:');
    console.log('  Template brut (sujet):', rawEmailSubject.substring(0, 100) + (rawEmailSubject.length > 100 ? '...' : ''));
    console.log('  Contexte:', JSON.stringify(templateContext, null, 2));
    console.log('  Sujet rendu:', emailSubject);
    console.log('[NotificationService] 📱 SMS de confirmation:');
    console.log('  Template brut:', rawSmsText);
    console.log('  SMS rendu:', smsText);

    // Logs DEBUG supplémentaires
    debugLog('📧 Email de confirmation - Détails complets:', {
      rawEmailSubject,
      rawEmailHtml: rawEmailHtml.substring(0, 500) + (rawEmailHtml.length > 500 ? '...' : ''),
      emailSubject,
      emailHtml: emailHtml.substring(0, 500) + (emailHtml.length > 500 ? '...' : ''),
      templateContext,
    });
    debugLog('📱 SMS de confirmation - Détails complets:', {
      rawSmsText,
      smsText,
      templateContext,
    });

    // Générer la version texte de l'email (fallback)
    const emailText = this.htmlToText(emailHtml);

    // Envoyer l'email de confirmation seulement si l'email est fourni
    if (ctx.clientEmail && ctx.clientEmail.trim() !== '') {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[NotificationService] 📧 ENVOI EMAIL DE CONFIRMATION');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[NotificationService] 📧 To:', ctx.clientEmail);
      console.log('[NotificationService] 📧 Subject:', emailSubject);
      console.log('[NotificationService] 📧 HTML length:', emailHtml.length, 'chars');
      
      const emailResult = await this.emailProvider.sendEmail({
        to: ctx.clientEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      if (emailResult.success) {
        console.log('[NotificationService] ✅ Email de confirmation envoyé avec succès');
        // Note: emailResult peut avoir metadata si le provider le supporte
        const metadata = (emailResult as any).metadata;
        if (metadata?.dryRun) {
          console.log('[NotificationService] ⚠️  Mode DRY RUN : Email loggé mais pas envoyé');
        }
      } else {
        console.error('[NotificationService] ❌ Erreur lors de l\'envoi de l\'email de confirmation:', emailResult.error);
      }
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
    } else {
      console.warn('[NotificationService] ⚠️  Email non envoyé: adresse email manquante pour le client', ctx.clientName);
    }

    // Gestion intelligente du SMS :
    // - Si RDV dans les 12h → SMS immédiat (important pour ne pas rater le RDV)
    // - Sinon → SMS différé (Option B) : envoyé seulement si email non ouvert après 12h
    const now = new Date();
    const hoursUntilAppointment = (ctx.startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isSameDayOrSoon = hoursUntilAppointment <= 12;
    
    // Logs de debug pour comprendre pourquoi le SMS n'est pas envoyé
    console.log('[NotificationService] 🔍 Calcul SMS immédiat:');
    console.log('[NotificationService] 🔍   Date/heure actuelle:', now.toISOString());
    console.log('[NotificationService] 🔍   Date/heure RDV:', ctx.startDate.toISOString());
    console.log('[NotificationService] 🔍   Heures jusqu\'au RDV:', hoursUntilAppointment.toFixed(2));
    console.log('[NotificationService] 🔍   RDV dans les 12h?', isSameDayOrSoon);
    console.log('[NotificationService] 🔍   Téléphone disponible?', ctx.clientPhone && ctx.clientPhone.trim() !== '');
    
    if (isSameDayOrSoon && ctx.clientPhone && ctx.clientPhone.trim() !== '') {
      // RDV le jour même ou dans les 12h → SMS immédiat
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[NotificationService] 📱 ENVOI SMS IMMÉDIAT (RDV dans les 12h)');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[NotificationService] 📱 RDV dans:', hoursUntilAppointment.toFixed(1), 'heures');
      console.log('[NotificationService] 📱 To:', ctx.clientPhone);
      console.log('[NotificationService] 📱 Message:', smsText);
      
      const smsResult = await this.smsProvider.sendSms({
        to: ctx.clientPhone,
        message: smsText,
      });
      
      if (smsResult.success) {
        console.log('[NotificationService] ✅ SMS de confirmation envoyé immédiatement');
        const metadata = smsResult.metadata;
        if (metadata?.dryRun) {
          console.log('[NotificationService] ⚠️  Mode DRY RUN : SMS loggé mais pas envoyé');
        } else {
          // Enregistrer que le SMS a été envoyé en base (pour éviter les doublons)
          // Note: bookingId dans le contexte correspond à l'ID du rendez-vous
          try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (supabaseUrl && supabaseKey && ctx.bookingId) {
              const supabase = createClient(supabaseUrl, supabaseKey);
              const appointmentId = ctx.bookingId;
              const { error: updateError } = await supabase
                .from('appointments')
                .update({
                  sms_confirmation_sent: true,
                  sms_confirmation_type: 'immediate_same_day',
                })
                .eq('id', appointmentId);
              
              if (updateError) {
                console.warn('[NotificationService] ⚠️  Erreur lors de la mise à jour du statut SMS en base:', updateError.message);
              } else {
                console.log('[NotificationService] ✅ Statut SMS mis à jour en base pour', appointmentId);
              }
            }
          } catch (dbError: any) {
            console.warn('[NotificationService] ⚠️  Erreur lors de la mise à jour du statut SMS en base:', dbError.message);
            // Ne pas faire échouer l'envoi si la mise à jour DB échoue
          }
        }
      } else {
        console.error('[NotificationService] ❌ Erreur lors de l\'envoi du SMS:', smsResult.error);
      }
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
    } else {
      // RDV dans plus de 12h → SMS différé (Option B)
      console.log('[NotificationService] ℹ️  SMS de confirmation différé (Option B)');
      console.log('[NotificationService] ℹ️  RDV dans', hoursUntilAppointment.toFixed(1), 'heures (>12h)');
      console.log('[NotificationService] ℹ️  Le SMS sera envoyé automatiquement si l\'email n\'est pas ouvert après 12h');
      
      // Log pour debug (garder les traces mais ne pas envoyer)
      if (ctx.clientPhone && ctx.clientPhone.trim() !== '') {
        console.log('[NotificationService] 📞 Numéro disponible:', ctx.clientPhone);
        console.log('[NotificationService] 📞 SMS sera envoyé automatiquement si email non ouvert après 12h');
      } else {
        console.warn('[NotificationService] ⚠️ SMS non disponible: numéro de téléphone manquant pour le client', ctx.clientName);
      }
    }
  }

  /**
   * Envoie un rappel de rendez-vous
   * - 1 SMS au client
   * 
   * Les erreurs sont loggées mais n'interrompent pas l'exécution (non-bloquant)
   * 
   * ✅ UTILISE LE TEMPLATE CONFIGURÉ DANS notification_settings
   * Le template provient de la base de données (via NotificationSettingsRepository)
   * avec fallback vers DEFAULT_NOTIFICATION_TEMPLATES si non configuré.
   */
  async sendBookingReminder(ctx: BookingNotificationContext): Promise<void> {
    // Envoyer le SMS de rappel seulement si le téléphone est fourni
    if (!ctx.clientPhone || ctx.clientPhone.trim() === '') {
      console.warn('[NotificationService] SMS de rappel non envoyé: numéro de téléphone manquant pour le client', ctx.clientName);
      return;
    }

    // Récupérer les templates personnalisés ou utiliser les valeurs par défaut
    const settingsRepo = this.settingsRepositoryFactory(ctx.salonId);
    const settings = await settingsRepo.getSettings(ctx.salonId);

    const formattedDate = format(ctx.startDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
    const formattedTime = format(ctx.startDate, "HH:mm", { locale: fr });

    // Construire le contexte pour le rendu des templates
    const templateContext: AppointmentTemplateContext = {
      clientFirstName: ctx.clientName.split(' ')[0] || ctx.clientName,
      clientFullName: ctx.clientName,
      appointmentDate: formattedDate,
      appointmentTime: formattedTime,
      serviceName: ctx.serviceName,
      salonName: ctx.salonName,
      stylistName: ctx.stylistName,
    };

    // Récupérer le template brut (depuis DB ou defaults)
    const rawSmsText = settings.reminderSmsText || DEFAULT_NOTIFICATION_TEMPLATES.reminderSmsText;

    // Rendre le template SMS de rappel
    const smsText = renderTemplate(rawSmsText, templateContext);

    // Logs détaillés pour validation
    console.log('[NotificationService] 📱 SMS de rappel:');
    console.log('  Template brut:', rawSmsText);
    console.log('  Contexte:', JSON.stringify(templateContext, null, 2));
    console.log('  SMS rendu:', smsText);

    // Logs DEBUG supplémentaires
    debugLog('📱 SMS de rappel - Détails complets:', {
      rawSmsText,
      smsText,
      templateContext,
    });

    const smsResult = await this.smsProvider.sendSms({
      to: ctx.clientPhone,
      message: smsText,
    });

    if (!smsResult.success) {
      console.error('[NotificationService] Erreur lors de l\'envoi du SMS de rappel:', smsResult.error);
    }
  }

  /**
   * Envoie une notification d'annulation de rendez-vous
   * - 1 email au client
   * 
   * Les erreurs sont loggées mais n'interrompent pas l'exécution (non-bloquant)
   * 
   * ⚠️ NOTE: Cette méthode utilise encore des templates codés en dur.
   * Pour l'instant, les templates d'annulation ne sont pas configurables via l'interface.
   * Si besoin, ajouter les colonnes cancellation_email_subject et cancellation_email_html
   * dans notification_settings et utiliser NotificationSettingsRepository.
   */
  async sendBookingCancellation(ctx: BookingNotificationContext): Promise<void> {
    // Envoyer l'email d'annulation seulement si l'email est fourni
    if (!ctx.clientEmail || ctx.clientEmail.trim() === '') {
      console.warn('[NotificationService] Email d\'annulation non envoyé: adresse email manquante pour le client', ctx.clientName);
      return;
    }

    const formattedDate = format(ctx.startDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });

    const emailResult = await this.emailProvider.sendEmail({
      to: ctx.clientEmail,
      subject: `Annulation de votre rendez-vous - ${ctx.salonName}`,
      html: this.generateCancellationEmailHtml(ctx, formattedDate),
      text: this.generateCancellationEmailText(ctx, formattedDate),
    });

    if (!emailResult.success) {
      console.error('[NotificationService] Erreur lors de l\'envoi de l\'email d\'annulation:', emailResult.error);
    }
  }

  /**
   * Informe le manager/owner qu'une annulation a eu lieu
   * (principalement utilisé lorsque l'annulation est déclenchée par le client).
   */
  async sendBookingCancellationInfoToManager(
    ctx: ManagerCancellationNotificationContext,
  ): Promise<void> {
    if (!ctx.managerEmail || ctx.managerEmail.trim() === '') {
      console.warn('[MANAGER_EMAIL] ⚠️ Email info manager non envoyé: adresse manquante');
      return;
    }

    const formattedDate = format(ctx.startDate, "EEEE d MMMM yyyy", { locale: fr });
    const formattedTime = format(ctx.startDate, 'HH:mm', { locale: fr });
    const cancelledByText = ctx.cancelledByRole === 'client' ? 'Client' : 'Manager';

    const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1b1b1b;">
    <h2 style="color:#6b4dff;">💡 Rendez-vous annulé</h2>
    <p>Bonjour ${ctx.managerName || 'Manager'},</p>
    <p>Un rendez-vous a été annulé sur Witstyl.</p>
    <div style="background:#f7f5ff;border-radius:12px;padding:16px;border:1px solid #e4ddff;">
      <p><strong>Client :</strong> ${ctx.clientName}</p>
      <p><strong>Service :</strong> ${ctx.serviceName}</p>
      <p><strong>Coiffeur·euse :</strong> ${ctx.stylistName}</p>
      <p><strong>Date :</strong> ${formattedDate}</p>
      <p><strong>Heure :</strong> ${formattedTime}</p>
      <p><strong>Annulé par :</strong> ${cancelledByText}</p>
      ${
        ctx.cancellationReason
          ? `<p><strong>Raison :</strong> ${ctx.cancellationReason}</p>`
          : ''
      }
    </div>
    <p>Salon : <strong>${ctx.salonName}</strong></p>
    <p>ID du rendez-vous : <strong>${ctx.bookingId}</strong></p>
    <p style="color:#7a7a7a;">Cet email est généré automatiquement par Witstyl.</p>
  </body>
</html>
    `.trim();

    const text = [
      'Rendez-vous annulé',
      `Client : ${ctx.clientName}`,
      `Service : ${ctx.serviceName}`,
      `Coiffeur·euse : ${ctx.stylistName}`,
      `Date : ${formattedDate}`,
      `Heure : ${formattedTime}`,
      `Annulé par : ${cancelledByText}`,
      ctx.cancellationReason ? `Raison : ${ctx.cancellationReason}` : '',
      `Salon : ${ctx.salonName}`,
      `ID du rendez-vous : ${ctx.bookingId}`,
    ]
      .filter(Boolean)
      .join('\n');

    // Sujet recommandé: "Annulation RDV — {client_full_name} — {appointment_date} {appointment_time}"
    const subject = `Annulation RDV — ${ctx.clientName} — ${formattedDate} ${formattedTime}`;

    console.log('[MANAGER_EMAIL] 📤 Sending email:', {
      to: ctx.managerEmail,
      subject,
      bookingId: ctx.bookingId,
    });

    const emailResult = await this.emailProvider.sendEmail({
      to: ctx.managerEmail,
      subject,
      html,
      text,
    });

    if (!emailResult.success) {
      console.error(
        '[MANAGER_EMAIL] ❌ Erreur lors de l\'envoi de l\'email d\'info manager:',
        {
          managerEmail: ctx.managerEmail,
          bookingId: ctx.bookingId,
          error: emailResult.error,
        },
      );
      throw new Error(`Failed to send manager email: ${emailResult.error}`);
    }

    console.log('[MANAGER_EMAIL] ✅ Email sent successfully:', {
      managerEmail: ctx.managerEmail,
      bookingId: ctx.bookingId,
    });
  }

  /**
   * Envoie une notification de modification de rendez-vous
   * - 1 email au client
   * 
   * Les erreurs sont loggées mais n'interrompent pas l'exécution (non-bloquant)
   * 
   * ⚠️ NOTE: Cette méthode utilise encore des templates codés en dur.
   * Pour l'instant, les templates de modification ne sont pas configurables via l'interface.
   * Si besoin, ajouter les colonnes modification_email_subject et modification_email_html
   * dans notification_settings et utiliser NotificationSettingsRepository.
   */
  async sendBookingModification(ctx: BookingNotificationContext): Promise<void> {
    // Envoyer l'email de modification seulement si l'email est fourni
    if (!ctx.clientEmail || ctx.clientEmail.trim() === '') {
      console.warn('[NotificationService] Email de modification non envoyé: adresse email manquante pour le client', ctx.clientName);
      return;
    }

    const formattedDate = format(ctx.startDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });

    const emailResult = await this.emailProvider.sendEmail({
      to: ctx.clientEmail,
      subject: `Modification de votre rendez-vous - ${ctx.salonName}`,
      html: this.generateModificationEmailHtml(ctx, formattedDate),
      text: this.generateModificationEmailText(ctx, formattedDate),
    });

    if (!emailResult.success) {
      console.error('[NotificationService] Erreur lors de l\'envoi de l\'email de modification:', emailResult.error);
    }
  }

  // ========== Méthodes privées de génération de contenu ==========
  
  // NOTE: Les méthodes generateConfirmationEmailHtml/Text ont été supprimées car
  // elles ne sont plus utilisées. Les templates de confirmation proviennent maintenant
  // de notification_settings (via NotificationSettingsRepository) et sont rendus avec renderTemplate().

  private generateCancellationEmailHtml(ctx: BookingNotificationContext, formattedDate: string): string {
    const reasonText = ctx.cancellationReason 
      ? `<p><strong>Raison :</strong> ${ctx.cancellationReason}</p>`
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #e74c3c; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #e74c3c; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #e74c3c; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Rendez-vous annulé</h1>
    </div>
    <div class="content">
      <p>Bonjour ${ctx.clientName},</p>
      <p>Votre rendez-vous a été annulé.</p>
      
      <div class="info-box">
        <div class="info-row">
          <span class="label">Date prévue :</span> ${formattedDate}
        </div>
        <div class="info-row">
          <span class="label">Service :</span> ${ctx.serviceName}
        </div>
        ${reasonText}
      </div>

      <p>Nous sommes désolés pour ce désagrément. Vous pouvez réserver un nouveau rendez-vous à tout moment.</p>
      <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
    </div>
    <div class="footer">
      <p>Cet email a été envoyé automatiquement par ${ctx.salonName}</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private generateCancellationEmailText(ctx: BookingNotificationContext, formattedDate: string): string {
    const reasonText = ctx.cancellationReason 
      ? `\nRaison : ${ctx.cancellationReason}`
      : '';

    return `
Bonjour ${ctx.clientName},

Votre rendez-vous a été annulé.

Date prévue : ${formattedDate}
Service : ${ctx.serviceName}${reasonText}

Nous sommes désolés pour ce désagrément. Vous pouvez réserver un nouveau rendez-vous à tout moment.

Si vous avez des questions, n'hésitez pas à nous contacter.

---
Cet email a été envoyé automatiquement par ${ctx.salonName}
    `.trim();
  }

  private generateModificationEmailHtml(ctx: BookingNotificationContext, formattedDate: string): string {
    const modificationText = ctx.modificationDetails 
      ? `<p><strong>Détails de la modification :</strong> ${ctx.modificationDetails}</p>`
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f39c12; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #f39c12; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #f39c12; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔄 Rendez-vous modifié</h1>
    </div>
    <div class="content">
      <p>Bonjour ${ctx.clientName},</p>
      <p>Votre rendez-vous a été modifié.</p>
      
      <div class="info-box">
        <div class="info-row">
          <span class="label">Nouvelle date et heure :</span> ${formattedDate}
        </div>
        <div class="info-row">
          <span class="label">Service :</span> ${ctx.serviceName}
        </div>
        <div class="info-row">
          <span class="label">Coiffeur·euse :</span> ${ctx.stylistName}
        </div>
        ${modificationText}
      </div>

      <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
    </div>
    <div class="footer">
      <p>Cet email a été envoyé automatiquement par ${ctx.salonName}</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private generateModificationEmailText(ctx: BookingNotificationContext, formattedDate: string): string {
    const modificationText = ctx.modificationDetails 
      ? `\nDétails de la modification : ${ctx.modificationDetails}`
      : '';

    return `
Bonjour ${ctx.clientName},

Votre rendez-vous a été modifié.

Nouvelle date et heure : ${formattedDate}
Service : ${ctx.serviceName}
Coiffeur·euse : ${ctx.stylistName}${modificationText}

Si vous avez des questions, n'hésitez pas à nous contacter.

---
Cet email a été envoyé automatiquement par ${ctx.salonName}
    `.trim();
  }

  private formatDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}h${minutes}min`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}min`;
    }
  }

  private isTomorrow(date: Date): boolean {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    return checkDate.getTime() === tomorrow.getTime();
  }

  /**
   * Convertit du HTML en texte brut (fallback simple)
   * @param html - Contenu HTML
   * @returns Texte brut approximatif
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Supprimer les styles
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Supprimer les scripts
      .replace(/<[^>]+>/g, '') // Supprimer toutes les balises HTML
      .replace(/&nbsp;/g, ' ') // Remplacer &nbsp; par espace
      .replace(/&amp;/g, '&') // Remplacer &amp; par &
      .replace(/&lt;/g, '<') // Remplacer &lt; par <
      .replace(/&gt;/g, '>') // Remplacer &gt; par >
      .replace(/&quot;/g, '"') // Remplacer &quot; par "
      .replace(/&#39;/g, "'") // Remplacer &#39; par '
      .replace(/\n\s*\n/g, '\n\n') // Supprimer les lignes vides multiples
      .trim();
  }

  /**
   * Récupère le délai d'envoi du rappel configuré pour un salon
   * @param salonId - ID du salon
   * @returns Nombre d'heures avant le rendez-vous (défaut: 24)
   */
  async getReminderOffsetHours(salonId: string): Promise<number> {
    const settingsRepo = this.settingsRepositoryFactory(salonId);
    const settings = await settingsRepo.getSettings(salonId);
    return settings.reminderOffsetHours;
  }

  /**
   * Envoie un email de test de confirmation avec les templates actuels
   * Utilise un contexte de test factice pour valider visuellement les templates
   * 
   * @param params - Paramètres d'envoi
   * @param params.to - Adresse email de destination
   * @param params.salonId - ID du salon
   * @param params.salonName - Nom du salon (optionnel, pour le contexte de test)
   * @returns Détails de l'envoi avec templates bruts et rendus
   */
  async sendTestConfirmationEmail(params: {
    to: string;
    salonId: string;
    salonName?: string;
  }): Promise<{
    subjectTemplate: string;
    htmlTemplate: string;
    subjectRendered: string;
    htmlRendered: string;
    emailResult: { success: boolean; error?: string };
  }> {
    const { to, salonId, salonName } = params;

    try {
      // Récupérer les templates actuels
      const settingsRepo = this.settingsRepositoryFactory(salonId);
      const settings = await settingsRepo.getSettings(salonId);

      // Construire un contexte de test (inliné pour éviter les problèmes d'import ESM sur Vercel)
      const testDate = new Date();
      testDate.setDate(testDate.getDate() + 1);
      testDate.setHours(15, 0, 0, 0);
      const formattedDate = format(testDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
      const formattedTime = format(testDate, "HH:mm", { locale: fr });
      const templateContext: AppointmentTemplateContext = {
        clientFirstName: 'TestClient',
        clientFullName: 'Test Client',
        appointmentDate: formattedDate,
        appointmentTime: formattedTime,
        serviceName: 'Coupe Test',
        salonName: salonName || 'Salon de Test',
        stylistName: 'Coiffeur·euse Test',
      };

      // Récupérer les templates bruts
      const subjectTemplate = settings.confirmationEmailSubject || DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailSubject;
      const htmlTemplate = settings.confirmationEmailHtml || DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailHtml;

      // Rendre les templates
      let subjectRendered: string;
      let htmlRendered: string;
      try {
        subjectRendered = `[TEST] ${renderTemplate(subjectTemplate, templateContext)}`;
        htmlRendered = renderTemplate(htmlTemplate, templateContext);
      } catch (renderError: any) {
        console.error('[NotificationService] ❌ Erreur lors du rendu des templates:', renderError);
        throw new Error(`Erreur lors du rendu des templates: ${renderError.message}`);
      }
      
      const emailText = this.htmlToText(htmlRendered);

    // Logs détaillés
    console.log('[NotificationService] 📧 Email de test:');
    console.log('  Destinataire:', to);
    console.log('  Template brut (sujet):', subjectTemplate.substring(0, 100) + (subjectTemplate.length > 100 ? '...' : ''));
    console.log('  Contexte de test:', JSON.stringify(templateContext, null, 2));
    console.log('  Sujet rendu:', subjectRendered);

    // Logs DEBUG supplémentaires
    debugLog('📧 Email de test - Détails complets:', {
      to,
      subjectTemplate,
      htmlTemplate: htmlTemplate.substring(0, 500) + (htmlTemplate.length > 500 ? '...' : ''),
      subjectRendered,
      htmlRendered: htmlRendered.substring(0, 500) + (htmlRendered.length > 500 ? '...' : ''),
      templateContext,
    });

      // Envoyer l'email
      console.log('[NotificationService] 📤 Appel à emailProvider.sendEmail()...');
      console.log('[NotificationService]   - To:', to);
      console.log('[NotificationService]   - Subject:', subjectRendered);
      console.log('[NotificationService]   - HTML length:', htmlRendered.length);
      console.log('[NotificationService]   - Text length:', emailText.length);
      
      let emailResult;
      try {
        emailResult = await this.emailProvider.sendEmail({
          to,
          subject: subjectRendered,
          html: htmlRendered,
          text: emailText,
        });
      } catch (sendError: any) {
        console.error('[NotificationService] ❌ Exception lors de l\'envoi de l\'email:', sendError);
        emailResult = {
          success: false,
          error: `Exception lors de l'envoi: ${sendError.message || sendError}`,
        };
      }

      console.log('[NotificationService] 📥 Résultat de emailProvider.sendEmail():', JSON.stringify(emailResult, null, 2));

      if (!emailResult.success) {
        console.error('');
        console.error('═══════════════════════════════════════════════════════════════');
        console.error('[NotificationService] ❌ ÉCHEC DE L\'ENVOI DE L\'EMAIL DE TEST');
        console.error('═══════════════════════════════════════════════════════════════');
        console.error('[NotificationService] Erreur:', emailResult.error);
        console.error('[NotificationService] Destinataire:', to);
        console.error('[NotificationService] Sujet:', subjectRendered);
        console.error('═══════════════════════════════════════════════════════════════');
        console.error('');
      } else {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[NotificationService] ✅ EMAIL DE TEST ENVOYÉ AVEC SUCCÈS');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[NotificationService] Destinataire:', to);
        console.log('[NotificationService] Sujet:', subjectRendered);
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
      }

      return {
        subjectTemplate,
        htmlTemplate,
        subjectRendered,
        htmlRendered,
        emailResult,
      };
    } catch (error: any) {
      console.error('[NotificationService] ❌ Erreur dans sendTestConfirmationEmail:', error);
      console.error('[NotificationService] Stack:', error.stack);
      // Retourner un résultat d'erreur plutôt que de throw pour que l'appelant puisse gérer
      return {
        subjectTemplate: '',
        htmlTemplate: '',
        subjectRendered: '',
        htmlRendered: '',
        emailResult: {
          success: false,
          error: `Erreur lors de la préparation de l'email de test: ${error.message || error}`,
        },
      };
    }
  }

  /**
   * Méthode de test pour envoyer des notifications et obtenir les résultats détaillés
   * Utile pour les endpoints de test et le débogage
   * 
   * ✅ UTILISE LES TEMPLATES CONFIGURÉS DANS notification_settings
   * 
   * @param ctx - Contexte de notification
   * @returns Résultats détaillés de l'envoi (SMS et Email) avec les templates utilisés
   */
  async testNotification(ctx: BookingNotificationContext): Promise<{
    sms?: { success: boolean; error?: string; template?: string; rendered?: string };
    email?: { success: boolean; error?: string; subjectTemplate?: string; subjectRendered?: string; htmlTemplate?: string; htmlRendered?: string };
    templates?: {
      confirmationEmailSubject: string;
      confirmationEmailHtml: string;
      confirmationSmsText: string;
      reminderSmsText: string;
    };
    context?: AppointmentTemplateContext;
  }> {
    const results: {
      sms?: { success: boolean; error?: string; template?: string; rendered?: string };
      email?: { success: boolean; error?: string; subjectTemplate?: string; subjectRendered?: string; htmlTemplate?: string; htmlRendered?: string };
      templates?: {
        confirmationEmailSubject: string;
        confirmationEmailHtml: string;
        confirmationSmsText: string;
        reminderSmsText: string;
      };
      context?: AppointmentTemplateContext;
    } = {};

    // Récupérer les templates personnalisés ou utiliser les valeurs par défaut
    const settingsRepo = this.settingsRepositoryFactory(ctx.salonId);
    const settings = await settingsRepo.getSettings(ctx.salonId);

    const formattedDate = format(ctx.startDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
    const formattedTime = format(ctx.startDate, "HH:mm", { locale: fr });

    // Construire le contexte pour le rendu des templates
    const templateContext: AppointmentTemplateContext = {
      clientFirstName: ctx.clientName.split(' ')[0] || ctx.clientName,
      clientFullName: ctx.clientName,
      appointmentDate: formattedDate,
      appointmentTime: formattedTime,
      serviceName: ctx.serviceName,
      salonName: ctx.salonName,
      stylistName: ctx.stylistName,
    };

    // Stocker les templates bruts et le contexte dans les résultats
    results.templates = {
      confirmationEmailSubject: settings.confirmationEmailSubject || DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailSubject,
      confirmationEmailHtml: settings.confirmationEmailHtml || DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailHtml,
      confirmationSmsText: settings.confirmationSmsText || DEFAULT_NOTIFICATION_TEMPLATES.confirmationSmsText,
      reminderSmsText: settings.reminderSmsText || DEFAULT_NOTIFICATION_TEMPLATES.reminderSmsText,
    };
    results.context = templateContext;

    // Test SMS
    if (ctx.clientPhone && ctx.clientPhone.trim() !== '') {
      // Récupérer le template brut
      const smsTemplate = results.templates.confirmationSmsText;
      // Rendre le template SMS avec préfixe [TEST]
      const smsText = `[TEST] ${renderTemplate(smsTemplate, templateContext)}`;
      
      const smsResult = await this.smsProvider.sendSms({
        to: ctx.clientPhone,
        message: smsText,
      });
      
      results.sms = {
        template: smsTemplate,
        rendered: smsText,
        success: smsResult.success,
        error: smsResult.error,
      };
    }

    // Test Email
    if (ctx.clientEmail && ctx.clientEmail.trim() !== '') {
      // Récupérer les templates bruts
      const emailSubjectTemplate = results.templates.confirmationEmailSubject;
      const emailHtmlTemplate = results.templates.confirmationEmailHtml;
      
      // Rendre les templates email
      const emailSubject = `[TEST] ${renderTemplate(emailSubjectTemplate, templateContext)}`;
      const emailHtml = renderTemplate(emailHtmlTemplate, templateContext);
      const emailText = this.htmlToText(emailHtml);

      const emailResult = await this.emailProvider.sendEmail({
        to: ctx.clientEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });
      
      results.email = {
        subjectTemplate: emailSubjectTemplate,
        subjectRendered: emailSubject,
        htmlTemplate: emailHtmlTemplate.substring(0, 200) + (emailHtmlTemplate.length > 200 ? '...' : ''),
        htmlRendered: emailHtml.substring(0, 200) + (emailHtml.length > 200 ? '...' : ''),
        success: emailResult.success,
        error: emailResult.error,
      };
    }

    return results;
  }

  /**
   * Envoie un SMS directement via le provider SMS
   * Méthode utilitaire pour les tests et les envois directs
   * 
   * @param params - Paramètres d'envoi
   * @param params.to - Numéro de téléphone au format international (ex: +41791234567)
   * @param params.message - Message à envoyer
   * @returns Résultat de l'envoi avec success: true si réussi, false sinon avec un message d'erreur
   */
  async sendSms(params: {
    to: string;
    message: string;
  }): Promise<{ success: boolean; error?: string; metadata?: Record<string, unknown> }> {
    return await this.smsProvider.sendSms(params);
  }
}

