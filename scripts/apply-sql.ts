import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL manquant. Ajoute-le dans ton .env');
  process.exit(1);
}

const root = process.cwd();
const preferred = ['supabase_complete_schema.sql'];
const fallbackOrder = [
  'supabase_tables_complete.sql',
  'supabase_services_table.sql',
  'supabase_sample_services.sql',
  'supabase_rls_policies.sql',
  'supabase_verify.sql',
];

function fileIfExists(p: string) {
  const abs = path.join(root, p);
  return fs.existsSync(abs) ? abs : null;
}

let files: string[] = [];
const preferredFile = preferred.map(f => fileIfExists(f)).find(Boolean);
if (preferredFile) {
  files = [preferredFile];
} else {
  files = fallbackOrder
    .map(f => fileIfExists(f))
    .filter((v): v is string => Boolean(v));
}

if (files.length === 0) {
  console.error('❌ Aucun fichier SQL trouvé (supabase_complete_schema.sql ou fallback).');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const file of files) {
      const sql = fs.readFileSync(file, 'utf8');
      console.log(`🚀 Applying: ${path.basename(file)} (${sql.length} bytes)`);
      await client.query(sql);
      console.log(`✅ Done: ${path.basename(file)}`);
    }
    await client.query('COMMIT');
    console.log('🎉 Toutes les migrations SQL ont été appliquées.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Erreur pendant les migrations :', e);
    try { await client.query('ROLLBACK'); } catch {}
    process.exit(2);
  } finally {
    await client.end().catch(() => {});
  }
})();
