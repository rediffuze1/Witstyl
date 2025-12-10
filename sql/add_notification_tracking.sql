-- Migration: Ajout du tracking des notifications email/SMS
-- Date: 2024
-- Description: Ajoute les colonnes nécessaires pour l'Option B (SMS si email non ouvert) et Option C (SMS rappel intelligent)

-- Ajouter les colonnes de tracking aux appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS email_opened_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sms_confirmation_sent BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS sms_reminder_sent BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS sms_confirmation_type TEXT;

-- Créer la table email_events pour tracker les événements Resend
-- Note: appointment_id est TEXT pour correspondre au type de appointments.id dans Supabase
CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'delivered', 'opened', 'bounced', 'complained', etc.
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  provider TEXT NOT NULL DEFAULT 'Resend', -- 'Resend', 'SendGrid', etc.
  provider_event_id TEXT, -- ID de l'événement côté provider
  metadata JSONB, -- Métadonnées supplémentaires (IP, user-agent, etc.)
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Créer les index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_email_events_appointment_id ON email_events(appointment_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(type);
CREATE INDEX IF NOT EXISTS idx_email_events_timestamp ON email_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_appointments_email_sent_at ON appointments(email_sent_at);
CREATE INDEX IF NOT EXISTS idx_appointments_email_opened_at ON appointments(email_opened_at);
CREATE INDEX IF NOT EXISTS idx_appointments_sms_confirmation_sent ON appointments(sms_confirmation_sent);
CREATE INDEX IF NOT EXISTS idx_appointments_sms_reminder_sent ON appointments(sms_reminder_sent);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_date ON appointments(appointment_date);

-- Commentaires pour documentation
COMMENT ON COLUMN appointments.email_sent_at IS 'Date d''envoi de l''email de confirmation';
COMMENT ON COLUMN appointments.email_opened_at IS 'Date d''ouverture de l''email (via webhook Resend)';
COMMENT ON COLUMN appointments.sms_confirmation_sent IS 'SMS de confirmation envoyé (Option B)';
COMMENT ON COLUMN appointments.sms_reminder_sent IS 'SMS de rappel envoyé (Option C)';
COMMENT ON COLUMN appointments.sms_confirmation_type IS 'Type de SMS: "confirmation_missing_email_open" ou autre';
COMMENT ON TABLE email_events IS 'Événements email reçus via webhooks (Resend, etc.)';

