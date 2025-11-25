-- Script SQL pour ajouter la colonne owner_notes à la table clients
-- À exécuter dans Supabase SQL Editor

-- Vérifier si la colonne existe déjà
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'clients' 
        AND column_name = 'owner_notes'
    ) THEN
        -- Ajouter la colonne si elle n'existe pas
        ALTER TABLE clients 
        ADD COLUMN owner_notes text;
        
        RAISE NOTICE 'Colonne owner_notes ajoutée avec succès à la table clients';
    ELSE
        RAISE NOTICE 'La colonne owner_notes existe déjà dans la table clients';
    END IF;
END $$;








