-- Script de re-seeding des templates de notifications
-- À exécuter si les templates ont disparu ou sont corrompus
-- 
-- Ce script :
-- 1. Vérifie quels salons n'ont pas de templates
-- 2. Crée les templates par défaut pour tous les salons manquants
-- 3. Met à jour les templates existants avec les valeurs par défaut si NULL

-- Templates par défaut (alignés avec server/core/notifications/defaultTemplates.ts)
DO $$
DECLARE
  default_subject TEXT := 'Confirmation de votre rendez-vous chez {{salon_name}}';
  default_text TEXT := 'Bonjour {{client_full_name}},

Votre rendez-vous a été confirmé avec succès !

Salon : {{salon_name}}
Service : {{service_name}}
Coiffeur·euse : {{stylist_name}}
Date et heure : {{appointment_date}} à {{appointment_time}}

Nous avons hâte de vous accueillir !

Si vous avez des questions ou souhaitez modifier votre rendez-vous, n''hésitez pas à nous contacter.

Cet email a été envoyé automatiquement par {{salon_name}}';
  default_html TEXT := '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Arial, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container { 
      max-width: 600px; 
      margin: 20px auto; 
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      padding: 30px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content { 
      background: #f9f9f9; 
      padding: 30px; 
    }
    .content p {
      margin: 15px 0;
      color: #333;
    }
    .info-box { 
      background: white; 
      padding: 20px; 
      margin: 20px 0; 
      border-radius: 8px; 
      border-left: 4px solid #667eea; 
    }
    .info-row { 
      margin: 10px 0; 
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-row .label { 
      font-weight: bold; 
      color: #667eea; 
      display: inline-block;
      min-width: 120px;
    }
    .footer { 
      text-align: center; 
      margin-top: 30px; 
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #666; 
      font-size: 12px; 
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 0;
        border-radius: 0;
      }
      .content {
        padding: 20px;
      }
    }
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
      <p>Si vous avez des questions ou souhaitez modifier votre rendez-vous, n''hésitez pas à nous contacter.</p>
    </div>
    <div class="footer">
      <p>Cet email a été envoyé automatiquement par {{salon_name}}</p>
    </div>
  </div>
</body>
</html>';
  default_sms_confirmation TEXT := 'Bonjour {{client_first_name}}, votre rendez-vous {{service_name}} chez {{salon_name}} est confirmé le {{appointment_date}} à {{appointment_time}} avec {{stylist_name}}.';
  default_sms_reminder TEXT := 'Rappel : votre rendez-vous {{service_name}} chez {{salon_name}} est prévu le {{appointment_date}} à {{appointment_time}} avec {{stylist_name}}.';
  default_offset_hours INTEGER := 24;
  salon_record RECORD;
BEGIN
  -- Pour chaque salon qui n'a pas de templates, créer une entrée par défaut
  FOR salon_record IN SELECT id FROM salons
  LOOP
    -- Vérifier si une entrée existe déjà
    IF NOT EXISTS (
      SELECT 1 FROM notification_settings WHERE salon_id = salon_record.id
    ) THEN
      -- Créer une nouvelle entrée avec les valeurs par défaut
      INSERT INTO notification_settings (
        salon_id,
        confirmation_email_subject,
        confirmation_email_text,
        confirmation_email_html,
        confirmation_sms_text,
        reminder_sms_text,
        reminder_offset_hours
      ) VALUES (
        salon_record.id,
        default_subject,
        default_text,
        default_html,
        default_sms_confirmation,
        default_sms_reminder,
        default_offset_hours
      );
      RAISE NOTICE 'Créé templates par défaut pour salon: %', salon_record.id;
    ELSE
      -- Mettre à jour les champs NULL avec les valeurs par défaut
      UPDATE notification_settings
      SET 
        confirmation_email_subject = COALESCE(confirmation_email_subject, default_subject),
        confirmation_email_text = COALESCE(confirmation_email_text, default_text),
        confirmation_email_html = COALESCE(confirmation_email_html, default_html),
        confirmation_sms_text = COALESCE(confirmation_sms_text, default_sms_confirmation),
        reminder_sms_text = COALESCE(reminder_sms_text, default_sms_reminder),
        reminder_offset_hours = COALESCE(reminder_offset_hours, default_offset_hours),
        updated_at = NOW()
      WHERE salon_id = salon_record.id
        AND (
          confirmation_email_subject IS NULL OR
          confirmation_email_text IS NULL OR
          confirmation_email_html IS NULL OR
          confirmation_sms_text IS NULL OR
          reminder_sms_text IS NULL OR
          reminder_offset_hours IS NULL
        );
      
      IF FOUND THEN
        RAISE NOTICE 'Mis à jour templates NULL pour salon: %', salon_record.id;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Re-seeding terminé avec succès';
END $$;

-- Vérification : Afficher le résultat
SELECT 
  salon_id,
  confirmation_email_subject IS NOT NULL as has_subject,
  confirmation_email_text IS NOT NULL as has_text,
  confirmation_email_html IS NOT NULL as has_html,
  confirmation_sms_text IS NOT NULL as has_sms_confirmation,
  reminder_sms_text IS NOT NULL as has_sms_reminder,
  reminder_offset_hours IS NOT NULL as has_offset
FROM notification_settings
ORDER BY salon_id;

