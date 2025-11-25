-- Ajouter les colonnes start_time et end_time à la table salon_closed_dates
-- pour permettre les fermetures partielles (ex: fermer plus tôt un jour férié)

-- Vérifier si les colonnes existent déjà avant de les ajouter
DO $$
BEGIN
  -- Ajouter start_time si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'salon_closed_dates' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE salon_closed_dates ADD COLUMN start_time TIME;
  END IF;

  -- Ajouter end_time si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'salon_closed_dates' AND column_name = 'end_time'
  ) THEN
    ALTER TABLE salon_closed_dates ADD COLUMN end_time TIME;
  END IF;
END $$;

-- Commentaires pour la documentation
COMMENT ON COLUMN salon_closed_dates.start_time IS 'Heure de début de fermeture (optionnel). Si NULL, fermeture toute la journée.';
COMMENT ON COLUMN salon_closed_dates.end_time IS 'Heure de fin de fermeture (optionnel). Si NULL, fermeture toute la journée.';






