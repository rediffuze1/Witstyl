-- Migration SQL pour ajouter le champ skip_reminder_sms
-- Ce champ indique si le SMS de rappel doit être ignoré (RDV pris < 24h avant)

-- Ajouter la colonne skip_reminder_sms à la table appointments
ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "skip_reminder_sms" boolean DEFAULT false NOT NULL;

-- Créer un index pour améliorer les performances des requêtes de cron
CREATE INDEX IF NOT EXISTS "idx_appointments_skip_reminder_sms" ON "appointments" ("skip_reminder_sms");

-- Commentaire pour documentation
COMMENT ON COLUMN "appointments"."skip_reminder_sms" IS 'Si true, le SMS de rappel ne sera pas envoyé. Utilisé pour les RDV pris moins de 24h avant l''heure du RDV.';




