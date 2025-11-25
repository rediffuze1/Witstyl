import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function listStylists() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Env vars missing');
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('stylistes')
    .select('id, first_name, last_name, salon_id')
    .limit(20);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

listStylists();


