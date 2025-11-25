-- Ajout de la colonne owner_notes à la table clients
-- Cette colonne stocke les notes privées visibles uniquement par le owner (post-it)

ALTER TABLE "clients" 
ADD COLUMN IF NOT EXISTS "owner_notes" text;

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN "clients"."owner_notes" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';








