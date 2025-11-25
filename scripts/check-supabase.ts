import 'dotenv/config';
import { Client } from 'pg';

function ok(v?: string) { return v && v.trim().length > 0; }

const envs = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
};

console.log('🔎 Env check:');
Object.entries(envs).forEach(([k, v]) => {
  console.log(`${ok(v) ? '✅' : '❌'} ${k}`);
});

if (!ok(envs.DATABASE_URL)) {
  console.error('❌ DATABASE_URL manquant : impossible de tester la DB.');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: envs.DATABASE_URL });
  try {
    await client.connect();
    const r = await client.query('SELECT 1 as ok');
    console.log('✅ DB SELECT 1 →', r.rows[0]);
    process.exit(0);
  } catch (e) {
    console.error('❌ Échec connexion DB:', e);
    process.exit(2);
  } finally {
    await client.end().catch(() => {});
  }
})();