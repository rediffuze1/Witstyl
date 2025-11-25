-- Script SQL pour créer la table opening_hours dans Supabase
-- Cette table stocke les horaires d'ouverture du salon

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
CREATE POLICY "Allow owners to view opening hours" ON public.opening_hours FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

CREATE POLICY "Allow owners to insert opening hours" ON public.opening_hours FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

CREATE POLICY "Allow owners to update opening hours" ON public.opening_hours FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

CREATE POLICY "Allow owners to delete opening hours" ON public.opening_hours FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.salons WHERE salons.id = salon_id AND salons.user_id = auth.uid())
);

-- Policy pour permettre la lecture publique (pour la landing page)
CREATE POLICY "Allow public to view opening hours" ON public.opening_hours FOR SELECT USING (true);






