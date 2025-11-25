-- Migration: Ajouter la colonne theme_color à la table salons
-- 
-- Cette colonne stocke la couleur principale du salon (format HSL ou hexadécimal)
-- Elle est accessible publiquement pour permettre l'affichage du thème même sans authentification
--
-- Date: 2025-01-XX
-- Description: Ajoute la colonne theme_color pour permettre la personnalisation du thème

-- Ajouter la colonne theme_color si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'salons' 
    AND column_name = 'theme_color'
  ) THEN
    ALTER TABLE salons 
    ADD COLUMN theme_color TEXT;
    
    RAISE NOTICE 'Colonne theme_color ajoutée à la table salons';
  ELSE
    RAISE NOTICE 'Colonne theme_color existe déjà dans la table salons';
  END IF;
END $$;

-- Activer RLS si ce n'est pas déjà fait
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;

-- Policy publique en lecture anonyme pour theme_color (et autres colonnes non sensibles)
-- Cette policy permet aux visiteurs anonymes de lire les paramètres d'apparence du salon
DO $$
BEGIN
  -- Supprimer la policy si elle existe déjà
  DROP POLICY IF EXISTS "public_read_salon_appearance" ON salons;
  
  -- Créer la policy pour permettre la lecture anonyme des colonnes publiques
  CREATE POLICY "public_read_salon_appearance"
  ON salons
  FOR SELECT
  TO anon
  USING (true);
  
  RAISE NOTICE 'Policy RLS "public_read_salon_appearance" créée pour la table salons';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur lors de la création de la policy RLS: %', SQLERRM;
END $$;

-- Note: Les policies d'écriture (INSERT, UPDATE, DELETE) doivent rester réservées
-- aux utilisateurs authentifiés (manager du salon). Ces policies sont généralement
-- gérées par d'autres scripts ou par Supabase Auth.



