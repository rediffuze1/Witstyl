-- Création de la table client_notifications
-- Cette table stocke les notifications pour les clients

CREATE TABLE IF NOT EXISTS "client_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"appointment_id" uuid,
	"priority" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_notifications_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "client_notifications_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action
);

-- Création d'un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS "client_notifications_client_id_idx" ON "client_notifications" ("client_id");
CREATE INDEX IF NOT EXISTS "client_notifications_is_read_idx" ON "client_notifications" ("is_read");
CREATE INDEX IF NOT EXISTS "client_notifications_created_at_idx" ON "client_notifications" ("created_at" DESC);








