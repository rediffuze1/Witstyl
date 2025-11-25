-- Migration pour créer la table notification_settings
-- Cette table stocke les templates de notifications configurables par l'owner/manager
--
-- NOTE IMPORTANTE : Le type de salon_id est TEXT pour correspondre au schéma existant
-- Dans sql/schema.sql, la table salons utilise id TEXT PRIMARY KEY
-- Cette migration est donc alignée sur ce schéma pour éviter les erreurs de FK

CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    confirmation_email_subject TEXT NOT NULL DEFAULT 'Confirmation de votre rendez-vous chez {{salon_name}}',
    confirmation_email_html TEXT NOT NULL DEFAULT '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; } .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; } .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; } .info-row { margin: 10px 0; } .label { font-weight: bold; color: #667eea; } .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }</style></head><body><div class="container"><div class="header"><h1>✨ Rendez-vous confirmé</h1></div><div class="content"><p>Bonjour {{client_full_name}},</p><p>Votre rendez-vous a été confirmé avec succès !</p><div class="info-box"><div class="info-row"><span class="label">Salon :</span> {{salon_name}}</div><div class="info-row"><span class="label">Service :</span> {{service_name}}</div><div class="info-row"><span class="label">Coiffeur·euse :</span> {{stylist_name}}</div><div class="info-row"><span class="label">Date et heure :</span> {{appointment_date}} à {{appointment_time}}</div></div><p>Nous avons hâte de vous accueillir !</p><p>Si vous avez des questions ou souhaitez modifier votre rendez-vous, n''hésitez pas à nous contacter.</p></div><div class="footer"><p>Cet email a été envoyé automatiquement par {{salon_name}}</p></div></div></body></html>',
    confirmation_sms_text TEXT NOT NULL DEFAULT 'Bonjour {{client_first_name}}, votre rendez-vous {{service_name}} chez {{salon_name}} est confirmé le {{appointment_date}} à {{appointment_time}} avec {{stylist_name}}.',
    reminder_sms_text TEXT NOT NULL DEFAULT 'Rappel : votre rendez-vous {{service_name}} chez {{salon_name}} est prévu le {{appointment_date}} à {{appointment_time}} avec {{stylist_name}}.',
    reminder_offset_hours INTEGER NOT NULL DEFAULT 24 CHECK (reminder_offset_hours IN (12, 24, 48)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(salon_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_notification_settings_salon_id ON notification_settings(salon_id);

-- RLS (Row Level Security) - Lecture/écriture uniquement pour le backend
-- Les modifications se font via l'API sécurisée
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre au service role de tout faire
CREATE POLICY "Service role can do everything on notification_settings"
    ON notification_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insérer un template par défaut pour chaque salon existant
-- (sera créé automatiquement lors de la première utilisation si nécessaire)
-- Note: On ne crée pas de ligne par défaut ici car on veut un salon_id spécifique



