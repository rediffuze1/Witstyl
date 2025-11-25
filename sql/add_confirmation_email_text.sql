-- Migration pour ajouter confirmation_email_text
-- Cette colonne stocke le contenu texte simple (sans HTML) que le manager édite
-- Le HTML sera généré automatiquement côté backend

-- Ajouter la colonne confirmation_email_text
ALTER TABLE notification_settings 
ADD COLUMN IF NOT EXISTS confirmation_email_text TEXT;

-- Mettre à jour les valeurs existantes avec un texte par défaut extrait du HTML
-- On extrait le texte du HTML existant pour la migration
UPDATE notification_settings
SET confirmation_email_text = COALESCE(
  confirmation_email_text,
  -- Extraire le texte du HTML par défaut si confirmation_email_html contient le template par défaut
  CASE 
    WHEN confirmation_email_html LIKE '%Bonjour {{client_full_name}}%' THEN
      'Bonjour {{client_full_name}},

Votre rendez-vous a été confirmé avec succès !

Salon : {{salon_name}}
Service : {{service_name}}
Coiffeur·euse : {{stylist_name}}
Date et heure : {{appointment_date}} à {{appointment_time}}

Nous avons hâte de vous accueillir !

Si vous avez des questions ou souhaitez modifier votre rendez-vous, n''hésitez pas à nous contacter.

Cet email a été envoyé automatiquement par {{salon_name}}'
    ELSE
      -- Pour les templates personnalisés, on garde le HTML pour l'instant
      -- Un script de migration séparé pourra extraire le texte
      'Bonjour {{client_full_name}},

Votre rendez-vous a été confirmé avec succès !

Salon : {{salon_name}}
Service : {{service_name}}
Coiffeur·euse : {{stylist_name}}
Date et heure : {{appointment_date}} à {{appointment_time}}

Nous avons hâte de vous accueillir !

Si vous avez des questions ou souhaitez modifier votre rendez-vous, n''hésitez pas à nous contacter.

Cet email a été envoyé automatiquement par {{salon_name}}'
  END
)
WHERE confirmation_email_text IS NULL;

-- Mettre à jour la table notification_template_versions également
ALTER TABLE notification_template_versions 
ADD COLUMN IF NOT EXISTS confirmation_email_text TEXT;

-- Commentaire pour documenter
COMMENT ON COLUMN notification_settings.confirmation_email_text IS 'Contenu texte simple (sans HTML) du template d''email de confirmation. Le HTML est généré automatiquement côté backend.';
COMMENT ON COLUMN notification_template_versions.confirmation_email_text IS 'Snapshot du contenu texte simple lors de la création de la version.';



