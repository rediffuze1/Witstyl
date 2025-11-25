-- Migration pour créer la table notification_template_versions
-- Cette table stocke l'historique des versions des templates de notifications
-- Permet de restaurer une version précédente si nécessaire

CREATE TABLE IF NOT EXISTS notification_template_versions (
    id BIGSERIAL PRIMARY KEY,
    salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by TEXT NULL, -- Email ou ID du manager qui a créé cette version
    label TEXT NULL, -- Optionnel : petit nom/version (ex: "Version avant modif du 25/11")
    
    -- Copie des champs de notification_settings
    confirmation_email_subject TEXT NOT NULL,
    confirmation_email_html TEXT NOT NULL,
    confirmation_sms_text TEXT NOT NULL,
    reminder_sms_text TEXT NOT NULL,
    reminder_offset_hours INTEGER NOT NULL CHECK (reminder_offset_hours IN (12, 24, 48))
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_notification_template_versions_salon_id ON notification_template_versions(salon_id);
CREATE INDEX IF NOT EXISTS idx_notification_template_versions_created_at ON notification_template_versions(created_at DESC);

-- RLS (Row Level Security) - Lecture/écriture uniquement pour le backend
ALTER TABLE notification_template_versions ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre au service role de tout faire
CREATE POLICY "Service role can do everything on notification_template_versions"
    ON notification_template_versions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Commentaire sur la table
COMMENT ON TABLE notification_template_versions IS 'Historique des versions des templates de notifications. Une nouvelle version est créée à chaque modification de notification_settings.';



