-- Script SQL complet pour créer toutes les tables nécessaires dans Supabase
-- Exécutez ce script dans le SQL Editor de Supabase

-- ============================================
-- 1. Table opening_hours (horaires d'ouverture du salon)
-- ============================================
CREATE TABLE IF NOT EXISTS public.opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TEXT NOT NULL, -- format HH:MM
  close_time TEXT NOT NULL, -- format HH:MM
  is_closed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(salon_id, day_of_week)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_opening_hours_salon_id ON public.opening_hours(salon_id);
CREATE INDEX IF NOT EXISTS idx_opening_hours_day_of_week ON public.opening_hours(day_of_week);

-- Enable Row Level Security (RLS)
ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;

-- Policies pour opening_hours
DROP POLICY IF EXISTS "Allow owners to view opening hours" ON public.opening_hours;
CREATE POLICY "Allow owners to view opening hours" ON public.opening_hours FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to insert opening hours" ON public.opening_hours;
CREATE POLICY "Allow owners to insert opening hours" ON public.opening_hours FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to update opening hours" ON public.opening_hours;
CREATE POLICY "Allow owners to update opening hours" ON public.opening_hours FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to delete opening hours" ON public.opening_hours;
CREATE POLICY "Allow owners to delete opening hours" ON public.opening_hours FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

-- Policy pour permettre la lecture publique (pour la landing page)
DROP POLICY IF EXISTS "Allow public to view opening hours" ON public.opening_hours;
CREATE POLICY "Allow public to view opening hours" ON public.opening_hours FOR SELECT USING (true);

-- ============================================
-- 2. Table stylist_hours (horaires spécifiques des stylistes)
-- ============================================
CREATE TABLE IF NOT EXISTS public.stylist_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  stylist_id UUID NOT NULL REFERENCES public.stylistes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TEXT NOT NULL, -- format HH:MM
  close_time TEXT NOT NULL, -- format HH:MM
  is_closed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(salon_id, stylist_id, day_of_week)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_stylist_hours_salon_stylist ON public.stylist_hours(salon_id, stylist_id);
CREATE INDEX IF NOT EXISTS idx_stylist_hours_day_of_week ON public.stylist_hours(day_of_week);

-- Enable Row Level Security (RLS)
ALTER TABLE public.stylist_hours ENABLE ROW LEVEL SECURITY;

-- Policies pour stylist_hours
DROP POLICY IF EXISTS "Allow owners to view stylist hours" ON public.stylist_hours;
CREATE POLICY "Allow owners to view stylist hours" ON public.stylist_hours FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to insert stylist hours" ON public.stylist_hours;
CREATE POLICY "Allow owners to insert stylist hours" ON public.stylist_hours FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to update stylist hours" ON public.stylist_hours;
CREATE POLICY "Allow owners to update stylist hours" ON public.stylist_hours FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to delete stylist hours" ON public.stylist_hours;
CREATE POLICY "Allow owners to delete stylist hours" ON public.stylist_hours FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

-- ============================================
-- 3. Table salon_closed_dates (dates de fermeture exceptionnelles)
-- ============================================
CREATE TABLE IF NOT EXISTS public.salon_closed_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- format YYYY-MM-DD
  reason TEXT,
  start_time TEXT, -- format HH:MM (pour fermetures partielles)
  end_time TEXT, -- format HH:MM (pour fermetures partielles)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(salon_id, date)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_salon_closed_dates_salon_date ON public.salon_closed_dates(salon_id, date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.salon_closed_dates ENABLE ROW LEVEL SECURITY;

-- Policies pour salon_closed_dates
DROP POLICY IF EXISTS "Allow owners to view closed dates" ON public.salon_closed_dates;
CREATE POLICY "Allow owners to view closed dates" ON public.salon_closed_dates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to insert closed dates" ON public.salon_closed_dates;
CREATE POLICY "Allow owners to insert closed dates" ON public.salon_closed_dates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to update closed dates" ON public.salon_closed_dates;
CREATE POLICY "Allow owners to update closed dates" ON public.salon_closed_dates FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to delete closed dates" ON public.salon_closed_dates;
CREATE POLICY "Allow owners to delete closed dates" ON public.salon_closed_dates FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

-- ============================================
-- Vérification
-- ============================================
-- Vérifiez que les tables ont été créées avec:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('opening_hours', 'stylist_hours', 'salon_closed_dates');






