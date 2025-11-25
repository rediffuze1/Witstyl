-- Migration: Ajouter la colonne stylist_id à la table salon_closed_dates
-- Date: 2025
-- Description: Permet de gérer les fermetures par styliste spécifique

-- Vérifier si la colonne existe déjà avant de l'ajouter
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'salon_closed_dates' 
        AND column_name = 'stylist_id'
    ) THEN
        -- Ajouter la colonne stylist_id (nullable pour permettre les fermetures du salon entier)
        ALTER TABLE salon_closed_dates 
        ADD COLUMN stylist_id UUID REFERENCES stylistes(id) ON DELETE CASCADE;
        
        -- Ajouter un commentaire pour documenter la colonne
        COMMENT ON COLUMN salon_closed_dates.stylist_id IS 
        'ID du styliste concerné par la fermeture. NULL = fermeture pour tout le salon';
        
        RAISE NOTICE 'Colonne stylist_id ajoutée avec succès à salon_closed_dates';
    ELSE
        RAISE NOTICE 'La colonne stylist_id existe déjà dans salon_closed_dates';
    END IF;
END $$;

-- Optionnel: Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_salon_closed_dates_stylist_id 
ON salon_closed_dates(stylist_id) 
WHERE stylist_id IS NOT NULL;



