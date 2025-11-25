-- Tables pour la gestion des horaires des stylistes et des dates de fermeture

-- Table pour les horaires spécifiques des stylistes
CREATE TABLE IF NOT EXISTS stylist_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  stylist_id UUID NOT NULL REFERENCES stylistes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(salon_id, stylist_id, day_of_week)
);

-- Table pour les dates de fermeture exceptionnelles du salon
CREATE TABLE IF NOT EXISTS salon_closed_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(salon_id, date)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_stylist_hours_salon_stylist ON stylist_hours(salon_id, stylist_id);
CREATE INDEX IF NOT EXISTS idx_salon_closed_dates_salon_date ON salon_closed_dates(salon_id, date);






