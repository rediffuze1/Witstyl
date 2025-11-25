import 'dotenv/config';
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

async function addOwnerNotesColumn() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL non défini dans .env');
    console.log('\n📝 Veuillez ajouter DATABASE_URL dans votre fichier .env:');
    console.log('DATABASE_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE@db.VOTRE_PROJET.supabase.co:5432/postgres?sslmode=require\n');
    return;
  }

  console.log('🔄 Tentative d\'ajout de la colonne owner_notes via connexion Postgres directe...');

  const pgClient = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Pour les certificats auto-signés Supabase
  });

  try {
    await pgClient.connect();
    console.log('✅ Connexion à Postgres réussie');

    const sql = `
      -- Ajout de la colonne owner_notes à la table clients
      ALTER TABLE "clients"
      ADD COLUMN IF NOT EXISTS "owner_notes" text;

      -- Commentaire pour documenter la colonne
      COMMENT ON COLUMN "clients"."owner_notes" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';
    `;

    await pgClient.query(sql);
    console.log('✅ Colonne owner_notes ajoutée avec succès!');

    // Vérifier que la colonne existe
    const checkQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'owner_notes';
    `;
    const checkResult = await pgClient.query(checkQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Vérification: La colonne owner_notes existe bien dans la table clients');
      console.log('   Type:', checkResult.rows[0].data_type);
    } else {
      console.warn('⚠️ La colonne owner_notes n\'a pas été trouvée après l\'ajout');
    }

  } catch (error: any) {
    console.error('❌ Erreur lors de l\'ajout de la colonne:', error.message);
    console.error('   Code:', error.code);
    console.error('   Détails:', error.detail);
    
    if (error.code === '42P07') {
      console.log('\n✅ La colonne existe déjà, pas besoin de l\'ajouter');
    } else {
      console.log('\n📝 Si l\'ajout automatique échoue, veuillez exécuter manuellement le script SQL suivant dans Supabase SQL Editor:');
      console.log('────────────────────────────────────────────────────────────');
      console.log(`
ALTER TABLE "clients"
ADD COLUMN IF NOT EXISTS "owner_notes" text;

COMMENT ON COLUMN "clients"."owner_notes" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';
      `);
      console.log('────────────────────────────────────────────────────────────\n');
    }
  } finally {
    await pgClient.end();
  }
}

addOwnerNotesColumn();








