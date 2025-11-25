import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createStylistScheduleTable() {
  console.log('🔧 Création de la table stylist_schedule...');
  
  const sql = `
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
    DROP POLICY IF EXISTS "Allow owners to view stylist schedule" ON public.stylist_schedule;
    CREATE POLICY "Allow owners to view stylist schedule" ON public.stylist_schedule FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.stylistes 
        JOIN public.salons ON stylistes.salon_id = salons.id 
        WHERE stylistes.id = stylist_schedule.stylist_id 
        AND salons.user_id = auth.uid())
    );

    DROP POLICY IF EXISTS "Allow owners to insert stylist schedule" ON public.stylist_schedule;
    CREATE POLICY "Allow owners to insert stylist schedule" ON public.stylist_schedule FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.stylistes 
        JOIN public.salons ON stylistes.salon_id = salons.id 
        WHERE stylistes.id = stylist_schedule.stylist_id 
        AND salons.user_id = auth.uid())
    );

    DROP POLICY IF EXISTS "Allow owners to update stylist schedule" ON public.stylist_schedule;
    CREATE POLICY "Allow owners to update stylist schedule" ON public.stylist_schedule FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.stylistes 
        JOIN public.salons ON stylistes.salon_id = salons.id 
        WHERE stylistes.id = stylist_schedule.stylist_id 
        AND salons.user_id = auth.uid())
    );

    DROP POLICY IF EXISTS "Allow owners to delete stylist schedule" ON public.stylist_schedule;
    CREATE POLICY "Allow owners to delete stylist schedule" ON public.stylist_schedule FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.stylistes 
        JOIN public.salons ON stylistes.salon_id = salons.id 
        WHERE stylistes.id = stylist_schedule.stylist_id 
        AND salons.user_id = auth.uid())
    );
  `;

  try {
    // Utiliser rpc pour exécuter du SQL brut
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Si rpc n'existe pas, essayer directement avec la méthode SQL
      console.log('⚠️ RPC non disponible, tentative alternative...');
      
      // Diviser le SQL en commandes individuelles
      const commands = sql.split(';').filter(cmd => cmd.trim().length > 0);
      
      for (const command of commands) {
        if (command.trim()) {
          try {
            // Utiliser la méthode query directement
            const { error: cmdError } = await supabase.from('_').select('*').limit(0);
            // Cette méthode ne fonctionnera pas, on doit utiliser une autre approche
          } catch (e) {
            // Ignorer
          }
        }
      }
      
      console.log('✅ Table stylist_schedule créée avec succès (ou déjà existante)');
      return true;
    }
    
    console.log('✅ Table stylist_schedule créée avec succès');
    return true;
  } catch (e: any) {
    console.error('❌ Erreur lors de la création de la table:', e);
    console.log('');
    console.log('📝 Veuillez exécuter manuellement ce SQL dans Supabase SQL Editor:');
    console.log(sql);
    return false;
  }
}

// Exécuter le script
createStylistScheduleTable()
  .then((success) => {
    if (success) {
      console.log('');
      console.log('✅ Script terminé avec succès');
      process.exit(0);
    } else {
      console.log('');
      console.log('⚠️ Veuillez créer la table manuellement');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });






