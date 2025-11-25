-- Script SQL pour créer la table stylist_schedule dans Supabase
-- Cette table stocke les horaires spécifiques de chaque styliste

CREATE TABLE IF NOT EXISTS public.stylist_schedule (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  stylist_id VARCHAR NOT NULL REFERENCES public.stylistes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(stylist_id, day_of_week)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_stylist_schedule_stylist_id ON public.stylist_schedule(stylist_id);
CREATE INDEX IF NOT EXISTS idx_stylist_schedule_day_of_week ON public.stylist_schedule(day_of_week);

-- Enable Row Level Security (RLS)
ALTER TABLE public.stylist_schedule ENABLE ROW LEVEL SECURITY;

-- Policies pour stylist_schedule
-- Note: Utilisation de ::text pour éviter les erreurs de type entre text et uuid
DROP POLICY IF EXISTS "Allow owners to view stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to view stylist schedule" ON public.stylist_schedule FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id::text = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow owners to insert stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to insert stylist schedule" ON public.stylist_schedule FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id::text = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow owners to update stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to update stylist schedule" ON public.stylist_schedule FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id::text = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow owners to delete stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to delete stylist schedule" ON public.stylist_schedule FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id::text = auth.uid()::text)
);


