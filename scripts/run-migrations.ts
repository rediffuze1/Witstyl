#!/usr/bin/env tsx

// Script de migration automatique (fallback pour environments sans Drizzle)
// Ce script exécute les migrations SQL directement

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

// Charger les variables d'environnement depuis .env
try {
  const envPath = join(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf8');
  
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim().replace(/[^\x20-\x7E]/g, '');
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (error) {
  console.log('⚠️ Impossible de charger .env, utilisation des variables système');
}

// Fonction pour exécuter une migration SQL
async function runMigration(client: Client, sqlContent: string, filename: string): Promise<void> {
  try {
    console.log(`🔧 Applying migration: ${filename}`);
    await client.query(sqlContent);
    console.log(`✅ Migration applied: ${filename}`);
  } catch (error: any) {
    console.error(`❌ Error applying migration ${filename}:`, error.message);
    throw error;
  }
}

// Fonction principale
async function main() {
  console.log('🗄️  Exécution des migrations automatiques');
  console.log('=========================================');
  console.log('');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL manquant dans les variables d\'environnement');
    console.log('   Configurez DATABASE_URL dans votre fichier .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connexion à la base de données établie');
    console.log('');

    // Vérifier si le dossier drizzle/sql existe
    const drizzleSqlPath = join(process.cwd(), 'drizzle', 'sql');
    const sqlPath = join(process.cwd(), 'sql');
    
    let migrationsToRun: { filename: string; content: string }[] = [];

    try {
      // Essayer d'abord avec Drizzle
      const drizzleFiles = readdirSync(drizzleSqlPath).filter(file => file.endsWith('.sql'));
      if (drizzleFiles.length > 0) {
        console.log(`📁 Dossier Drizzle trouvé: ${drizzleFiles.length} fichiers SQL`);
        
        for (const file of drizzleFiles.sort()) {
          const filePath = join(drizzleSqlPath, file);
          const content = readFileSync(filePath, 'utf8');
          migrationsToRun.push({ filename: file, content });
        }
      }
    } catch (error) {
      console.log('📁 Dossier Drizzle non trouvé, utilisation du fallback SQL');
    }

    // Si pas de migrations Drizzle, utiliser le fallback
    if (migrationsToRun.length === 0) {
      try {
        const schemaFile = join(sqlPath, 'schema.sql');
        const content = readFileSync(schemaFile, 'utf8');
        migrationsToRun.push({ filename: 'schema.sql', content });
        console.log('📁 Utilisation du fichier schema.sql comme fallback');
      } catch (error) {
        console.error('❌ Aucun fichier de migration trouvé');
        console.log('   Créez un fichier sql/schema.sql ou exécutez d\'abord: npm run db:generate');
        process.exit(1);
      }
    }

    // Exécuter les migrations
    console.log(`🚀 Exécution de ${migrationsToRun.length} migration(s)...`);
    console.log('');

    for (const migration of migrationsToRun) {
      await runMigration(client, migration.content, migration.filename);
    }

    console.log('');
    console.log('🎉 Toutes les migrations ont été appliquées avec succès !');
    console.log('');
    console.log('📋 Prochaines étapes :');
    console.log('   npm run health       # Vérifier la santé de l\'API');
    console.log('   npm run dev          # Démarrer le serveur');

  } catch (error: any) {
    console.error('❌ Erreur lors de l\'exécution des migrations:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Exécuter le script
main().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
