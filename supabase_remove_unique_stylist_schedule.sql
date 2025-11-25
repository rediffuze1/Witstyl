-- Script SQL pour permettre plusieurs créneaux par jour pour les stylistes
-- Ce script enlève la contrainte UNIQUE sur (stylist_id, day_of_week) dans stylist_schedule

-- Supprimer la contrainte UNIQUE existante
ALTER TABLE public.stylist_schedule 
DROP CONSTRAINT IF EXISTS stylist_schedule_stylist_id_day_of_week_key;

-- Optionnel : Ajouter un index pour améliorer les performances (sans contrainte UNIQUE)
CREATE INDEX IF NOT EXISTS idx_stylist_schedule_stylist_day 
ON public.stylist_schedule(stylist_id, day_of_week);





