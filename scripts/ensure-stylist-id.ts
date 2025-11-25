import 'dotenv/config';
import { Client } from 'pg';

async function ensureStylistIdColumn() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL manquant. Impossible de se connecter à la base de données.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  const sql = `
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'salon_closed_dates'
              AND column_name = 'stylist_id'
        ) THEN
            ALTER TABLE salon_closed_dates
            ADD COLUMN stylist_id UUID REFERENCES stylistes(id) ON DELETE CASCADE;

            COMMENT ON COLUMN salon_closed_dates.stylist_id IS
            'ID du styliste concerné par la fermeture. NULL = fermeture pour tout le salon';
        END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_salon_closed_dates_stylist_id
      ON salon_closed_dates(stylist_id)
      WHERE stylist_id IS NOT NULL;
  `;

  try {
    console.log('🔄 Ajout/validation de la colonne stylist_id dans salon_closed_dates...');
    await client.connect();
    await client.query(sql);
    console.log('✅ Colonne stylist_id prête (déjà existante ou ajoutée).');
  } catch (error: any) {
    console.error('❌ Erreur lors de la mise à jour de la colonne stylist_id:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

ensureStylistIdColumn();




