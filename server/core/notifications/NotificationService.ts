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

import { SmsProvider, EmailProvider, BookingNotificationContext } from './types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { NotificationSettingsRepository } from './NotificationSettingsRepository';
import { renderTemplate, AppointmentTemplateContext } from './templateRenderer';
import { DEFAULT_NOTIFICATION_TEMPLATES } from './defaultTemplates';

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
      const emailResult = await this.emailProvider.sendEmail({
        to: ctx.clientEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      if (!emailResult.success) {
        console.error('[NotificationService] Erreur lors de l\'envoi de l\'email de confirmation:', emailResult.error);
      }
    } else {
      console.warn('[NotificationService] Email non envoyé: adresse email manquante pour le client', ctx.clientName);
    }

    // Envoyer le SMS de confirmation seulement si le téléphone est fourni
    if (ctx.clientPhone && ctx.clientPhone.trim() !== '') {
      const smsResult = await this.smsProvider.sendSms({
        to: ctx.clientPhone,
        message: smsText,
      });

      if (!smsResult.success) {
        console.error('[NotificationService] Erreur lors de l\'envoi du SMS de confirmation:', smsResult.error);
      }
    } else {
      console.warn('[NotificationService] SMS non envoyé: numéro de téléphone manquant pour le client', ctx.clientName);
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

    // Récupérer les templates actuels
    const settingsRepo = this.settingsRepositoryFactory(salonId);
    const settings = await settingsRepo.getSettings(salonId);

    // Construire un contexte de test
    const { buildAppointmentTemplateContextForTest } = await import('./utils.js');
    const templateContext = buildAppointmentTemplateContextForTest(salonId, salonName);

    // Récupérer les templates bruts
    const subjectTemplate = settings.confirmationEmailSubject || DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailSubject;
    const htmlTemplate = settings.confirmationEmailHtml || DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailHtml;

    // Rendre les templates
    const subjectRendered = `[TEST] ${renderTemplate(subjectTemplate, templateContext)}`;
    const htmlRendered = renderTemplate(htmlTemplate, templateContext);
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
    
    const emailResult = await this.emailProvider.sendEmail({
      to,
      subject: subjectRendered,
      html: htmlRendered,
      text: emailText,
    });

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
      
      results.sms = {
        template: smsTemplate,
        rendered: smsText,
      };
      
      const smsResult = await this.smsProvider.sendSms({
        to: ctx.clientPhone,
        message: smsText,
      });
      results.sms.success = smsResult.success;
      if (smsResult.error) {
        results.sms.error = smsResult.error;
      }
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

      results.email = {
        subjectTemplate: emailSubjectTemplate,
        subjectRendered: emailSubject,
        htmlTemplate: emailHtmlTemplate.substring(0, 200) + (emailHtmlTemplate.length > 200 ? '...' : ''),
        htmlRendered: emailHtml.substring(0, 200) + (emailHtml.length > 200 ? '...' : ''),
      };

      const emailResult = await this.emailProvider.sendEmail({
        to: ctx.clientEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });
      results.email.success = emailResult.success;
      if (emailResult.error) {
        results.email.error = emailResult.error;
      }
    }

    return results;
  }
}

