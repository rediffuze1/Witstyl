import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function inspectClosedDates() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase
    .from('salon_closed_dates')
    .select('id, salon_id, date, reason, start_time, end_time')
    .order('date', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Erreur Supabase:', error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

inspectClosedDates();


