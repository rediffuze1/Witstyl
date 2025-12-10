#!/usr/bin/env tsx

/**
 * Script de migration pour normaliser les numéros de téléphone suisses
 * 
 * Ce script :
 * 1. Convertit tous les numéros suisses au format E.164 (+41...)
 * 2. Normalise les formats locaux (commençant par 0) en +41
 * 3. Nettoie les espaces et caractères non numériques
 * 4. Laisse les numéros internationaux non-suisses tels quels
 * 
 * Tables concernées :
 * - users.phone
 * - salons.phone
 * - stylistes.phone
 * - clients.phone
 * 
 * Usage: tsx scripts/normalize-phone-numbers.ts
 *   ou: npm run normalize:phones
 */

import 'dotenv/config';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL manquant. Ajoute-le dans ton .env');
  console.error('   💡 Trouve-le dans Supabase > Settings > Database > Connection string > URI');
  process.exit(1);
}

/**
 * Normalise un numéro de téléphone suisse au format E.164
 */
function normalizeSwissPhone(phone: string): string | null {
  if (!phone || phone.trim() === '') {
    return null;
  }

  const cleaned = phone.trim();

  // Si déjà au format E.164 suisse, le retourner tel quel
  if (cleaned.startsWith('+41')) {
    try {
      const parsed = parsePhoneNumber(cleaned, 'CH');
      if (parsed.isValid() && parsed.country === 'CH') {
        return parsed.format('E.164');
      }
    } catch (e) {
      // Continuer avec la logique de normalisation
    }
  }

  // Si commence par 0 (format local suisse), convertir en +41
  if (cleaned.startsWith('0')) {
    const withoutZero = cleaned.substring(1);
    const withPrefix = `+41${withoutZero.replace(/\D/g, '')}`;
    try {
      const parsed = parsePhoneNumber(withPrefix, 'CH');
      if (parsed.isValid() && parsed.country === 'CH') {
        return parsed.format('E.164');
      }
    } catch (e) {
      console.warn(`⚠️  Impossible de parser ${withPrefix}:`, e);
    }
  }

  // Essayer de parser comme numéro suisse
  try {
    const parsed = parsePhoneNumber(cleaned, 'CH');
    if (parsed.isValid() && parsed.country === 'CH') {
      return parsed.format('E.164');
    }
  } catch (e) {
    // Pas un numéro suisse valide
  }

  // Si c'est un numéro international valide (non suisse), le garder tel quel
  try {
    if (isValidPhoneNumber(cleaned)) {
      const parsed = parsePhoneNumber(cleaned);
      return parsed.format('E.164');
    }
  } catch (e) {
    // Numéro invalide
  }

  // Si on arrive ici, le numéro n'est pas valide ou n'a pas pu être normalisé
  console.warn(`⚠️  Numéro non normalisable: ${phone}`);
  return null;
}

/**
 * Met à jour les numéros de téléphone dans une table
 */
async function updatePhoneNumbers(client: Client, table: string, idColumn: string = 'id') {
  console.log(`\n📱 Traitement de la table: ${table}`);

  // Récupérer tous les enregistrements avec un numéro de téléphone
  const result = await client.query(
    `SELECT ${idColumn}, phone FROM ${table} WHERE phone IS NOT NULL AND phone != ''`
  );

  if (result.rows.length === 0) {
    console.log(`   ℹ️  Aucun numéro de téléphone trouvé dans ${table}`);
    return { updated: 0, skipped: 0, errors: 0 };
  }

  console.log(`   📊 ${result.rows.length} numéro(s) trouvé(s)`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of result.rows) {
    const oldPhone = record.phone;
    const normalizedPhone = normalizeSwissPhone(oldPhone);

    if (!normalizedPhone) {
      console.warn(`   ⚠️  ${table}[${record[idColumn]}]: "${oldPhone}" → non normalisable`);
      errors++;
      continue;
    }

    if (normalizedPhone === oldPhone) {
      // Déjà au bon format
      skipped++;
      continue;
    }

    // Mettre à jour le numéro
    try {
      await client.query(
        `UPDATE ${table} SET phone = $1 WHERE ${idColumn} = $2`,
        [normalizedPhone, record[idColumn]]
      );
      console.log(`   ✅ ${table}[${record[idColumn]}]: "${oldPhone}" → "${normalizedPhone}"`);
      updated++;
    } catch (updateError: any) {
      console.error(`   ❌ Erreur lors de la mise à jour de ${table}[${record[idColumn]}]:`, updateError.message);
      errors++;
    }
  }

  return { updated, skipped, errors };
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Début de la normalisation des numéros de téléphone suisses\n');
  console.log('📋 Tables à traiter:');
  console.log('   - users');
  console.log('   - salons');
  console.log('   - stylistes');
  console.log('   - clients\n');

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('✅ Connexion à la base de données établie\n');

    const results = {
      users: { updated: 0, skipped: 0, errors: 0 },
      salons: { updated: 0, skipped: 0, errors: 0 },
      stylistes: { updated: 0, skipped: 0, errors: 0 },
      clients: { updated: 0, skipped: 0, errors: 0 },
    };

    // Traiter chaque table
    results.users = await updatePhoneNumbers(client, 'users', 'id');
    results.salons = await updatePhoneNumbers(client, 'salons', 'id');
    results.stylistes = await updatePhoneNumbers(client, 'stylistes', 'id');
    results.clients = await updatePhoneNumbers(client, 'clients', 'id');

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DE LA MIGRATION');
  console.log('='.repeat(60));

  const totalUpdated = Object.values(results).reduce((sum, r) => sum + r.updated, 0);
  const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);
  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);

  for (const [table, stats] of Object.entries(results)) {
    console.log(`\n${table}:`);
    console.log(`   ✅ Mis à jour: ${stats.updated}`);
    console.log(`   ⏭️  Déjà au bon format: ${stats.skipped}`);
    console.log(`   ❌ Erreurs: ${stats.errors}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📈 TOTAL:`);
  console.log(`   ✅ Mis à jour: ${totalUpdated}`);
  console.log(`   ⏭️  Déjà au bon format: ${totalSkipped}`);
  console.log(`   ❌ Erreurs: ${totalErrors}`);
  console.log('='.repeat(60));

    if (totalErrors === 0) {
      console.log('\n✅ Migration terminée avec succès !');
    } else {
      console.log('\n⚠️  Migration terminée avec des erreurs. Vérifiez les logs ci-dessus.');
    }
  } catch (error: any) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

// Exécuter le script
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

