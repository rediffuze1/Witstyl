-- Migration: Ajout de la table notification_events pour l'idempotence
-- Date: 2024
-- Description: Permet d'éviter les doublons d'envoi de notifications (ex: email manager lors d'annulation)

-- Créer la table notification_events pour tracker les événements de notifications
CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'manager_cancel_email', 'client_cancel_email', etc.
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(event_type, appointment_id) -- Clé unique pour garantir l'idempotence
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_notification_events_appointment_id ON notification_events(appointment_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_event_type ON notification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_created_at ON notification_events(created_at DESC);

-- RLS (Row Level Security) - Lecture/écriture uniquement pour le backend
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre au service role de tout faire
CREATE POLICY "Service role can do everything on notification_events"
    ON notification_events
    FOR ALL
    USING (true)
    WITH CHECK (true);

