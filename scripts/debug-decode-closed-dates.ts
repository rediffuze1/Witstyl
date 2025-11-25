import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { normalizeClosedDateRecord } from '../server/utils/closed-dates.js';

async function debug() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env vars');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('salon_closed_dates')
    .select('id,date,reason,start_time,end_time')
    .order('date', { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const normalized = (data || []).map(normalizeClosedDateRecord);
  console.log(JSON.stringify(normalized, null, 2));
}

debug();


