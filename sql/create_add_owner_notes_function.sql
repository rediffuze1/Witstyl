-- Fonction SQL pour ajouter la colonne owner_notes si elle n'existe pas
-- À exécuter dans Supabase SQL Editor UNE FOIS pour créer la fonction

CREATE OR REPLACE FUNCTION add_owner_notes_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Vérifier si la colonne existe déjà
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'clients' 
        AND column_name = 'owner_notes'
    ) THEN
        -- Ajouter la colonne
        ALTER TABLE "clients" 
        ADD COLUMN "owner_notes" text;
        
        -- Ajouter le commentaire
        COMMENT ON COLUMN "clients"."owner_notes" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';
        
        RAISE NOTICE 'Colonne owner_notes ajoutée avec succès';
    ELSE
        RAISE NOTICE 'La colonne owner_notes existe déjà';
    END IF;
END;
$$;

-- Exécuter la fonction immédiatement
SELECT add_owner_notes_column();








