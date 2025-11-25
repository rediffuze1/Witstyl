-- Ajouter la colonne color à la table stylistes
ALTER TABLE public.stylistes
ADD COLUMN IF NOT EXISTS color VARCHAR;





