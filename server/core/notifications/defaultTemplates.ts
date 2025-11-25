/**
 * Templates par défaut pour les notifications
 * 
 * Ces templates sont utilisés si aucun template personnalisé n'est configuré
 * ou si un champ est vide dans la base de données.
 */

export const DEFAULT_NOTIFICATION_TEMPLATES = {
  confirmationEmailSubject: 'Confirmation de votre rendez-vous chez {{salon_name}}',
  
  // Texte simple par défaut (sans HTML)
  confirmationEmailText: `Bonjour {{client_full_name}},

Votre rendez-vous a été confirmé avec succès !

Salon : {{salon_name}}
Service : {{service_name}}
Coiffeur·euse : {{stylist_name}}
Date et heure : {{appointment_date}} à {{appointment_time}}

Nous avons hâte de vous accueillir !

Si vous avez des questions ou souhaitez modifier votre rendez-vous, n'hésitez pas à nous contacter.

Cet email a été envoyé automatiquement par {{salon_name}}`,
  
  // HTML par défaut (généré depuis confirmationEmailText, conservé pour compatibilité)
  confirmationEmailHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #667eea; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ Rendez-vous confirmé</h1>
    </div>
    <div class="content">
      <p>Bonjour {{client_full_name}},</p>
      <p>Votre rendez-vous a été confirmé avec succès !</p>
      
      <div class="info-box">
        <div class="info-row">
          <span class="label">Salon :</span> {{salon_name}}
        </div>
        <div class="info-row">
          <span class="label">Service :</span> {{service_name}}
        </div>
        <div class="info-row">
          <span class="label">Coiffeur·euse :</span> {{stylist_name}}
        </div>
        <div class="info-row">
          <span class="label">Date et heure :</span> {{appointment_date}} à {{appointment_time}}
        </div>
      </div>

      <p>Nous avons hâte de vous accueillir !</p>
      <p>Si vous avez des questions ou souhaitez modifier votre rendez-vous, n'hésitez pas à nous contacter.</p>
    </div>
    <div class="footer">
      <p>Cet email a été envoyé automatiquement par {{salon_name}}</p>
    </div>
  </div>
</body>
</html>
  `.trim(),
  
  confirmationSmsText: 'Bonjour {{client_first_name}}, votre rendez-vous {{service_name}} chez {{salon_name}} est confirmé le {{appointment_date}} à {{appointment_time}} avec {{stylist_name}}.',
  
  reminderSmsText: 'Rappel : votre rendez-vous {{service_name}} chez {{salon_name}} est prévu le {{appointment_date}} à {{appointment_time}} avec {{stylist_name}}.',
  
  reminderOffsetHours: 24, // 24 heures par défaut
} as const;



