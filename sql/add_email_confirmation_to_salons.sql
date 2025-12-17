-- Migration : Ajout de la gestion de confirmation d'email pour les salons
-- Permet de changer l'email de connexion Supabase Auth de manière sécurisée

-- Ajouter pending_email : email en attente de confirmation
ALTER TABLE salons 
ADD COLUMN IF NOT EXISTS pending_email TEXT;

-- Ajouter email_verified_at : timestamp de la dernière confirmation d'email
ALTER TABLE salons 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Index pour les requêtes de recherche par pending_email
CREATE INDEX IF NOT EXISTS idx_salons_pending_email ON salons(pending_email) WHERE pending_email IS NOT NULL;

-- Commentaires pour documentation
COMMENT ON COLUMN salons.pending_email IS 'Email en attente de confirmation. Sera copié vers email après validation via Supabase Auth.';
COMMENT ON COLUMN salons.email_verified_at IS 'Timestamp de la dernière confirmation d''email. NULL si jamais confirmé.';

-- RLS déjà activé sur salons, pas besoin de modifier les politiques
-- Les owners peuvent déjà modifier leur salon via RLS existante

