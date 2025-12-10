#!/usr/bin/env tsx

/**
 * Script pour appliquer la migration de tracking des notifications
 * 
 * Ce script applique la migration SQL qui ajoute :
 * - Les colonnes de tracking aux appointments (email_sent_at, email_opened_at, etc.)
 * - La table email_events pour tracker les événements Resend
 * 
 * Usage:
 *   tsx scripts/apply-notification-tracking-migration.ts
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🗄️  Application de la migration de tracking des notifications');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans les variables d\'environnement');
    console.log('   Configurez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans votre fichier .env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('✅ Connexion à Supabase établie');
    console.log('');

    // Lire le fichier SQL de migration
    const migrationPath = join(process.cwd(), 'sql', 'add_notification_tracking.sql');
    let sqlContent: string;

    try {
      sqlContent = readFileSync(migrationPath, 'utf8');
      console.log(`📁 Fichier de migration trouvé: ${migrationPath}`);
    } catch (error: any) {
      console.error(`❌ Erreur lors de la lecture du fichier de migration: ${error.message}`);
      process.exit(1);
    }

    // Exécuter la migration
    console.log('🚀 Application de la migration...');
    console.log('');

    try {
      // Exécuter chaque instruction SQL séparément
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
          if (error) {
            // Si la fonction RPC n'existe pas, utiliser une requête directe
            // Note: Supabase ne permet pas d'exécuter du DDL directement via l'API REST
            // Il faut utiliser le SQL Editor ou psql
            console.warn('⚠️  Impossible d\'exécuter via RPC, utilisez le SQL Editor Supabase');
            console.warn('   Ou exécutez directement: psql $DATABASE_URL -f sql/add_notification_tracking.sql');
            throw new Error('Migration doit être exécutée via SQL Editor Supabase ou psql');
          }
        }
      }
      
      console.log('✅ Migration appliquée avec succès');
      console.log('');
      console.log('📋 Colonnes ajoutées à la table appointments:');
      console.log('   - email_sent_at');
      console.log('   - email_opened_at');
      console.log('   - sms_confirmation_sent');
      console.log('   - sms_reminder_sent');
      console.log('   - sms_confirmation_type');
      console.log('');
      console.log('📋 Table créée:');
      console.log('   - email_events');
      console.log('');
      console.log('📋 Index créés pour améliorer les performances');
      console.log('');
    } catch (error: any) {
      // Vérifier si les colonnes/tables existent déjà
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️  Certaines colonnes ou tables existent déjà');
        console.log('   La migration a peut-être déjà été appliquée');
        console.log('   Vérifiez manuellement si tout est en place');
        console.log('');
      } else {
        console.error('❌ Erreur lors de l\'application de la migration:', error.message);
        throw error;
      }
    }

    // Vérifier que les colonnes existent
    console.log('🔍 Vérification de la migration...');
    console.log('');

    const { data: appointmentColumns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'appointments')
      .in('column_name', ['email_sent_at', 'email_opened_at', 'sms_confirmation_sent', 'sms_reminder_sent', 'sms_confirmation_type']);

    const { data: emailEventsTable, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'email_events');

    if (appointmentColumns && appointmentColumns.length === 5) {
      console.log('✅ Toutes les colonnes sont présentes dans appointments');
    } else {
      const count = appointmentColumns?.length || 0;
      console.warn(`⚠️  Seulement ${count}/5 colonnes trouvées dans appointments`);
      if (appointmentColumns && appointmentColumns.length > 0) {
        console.warn('   Colonnes trouvées:', appointmentColumns.map((r: any) => r.column_name).join(', '));
      }
    }

    if (emailEventsTable && emailEventsTable.length > 0) {
      console.log('✅ Table email_events créée');
    } else {
      console.warn('⚠️  Table email_events non trouvée');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎉 Migration terminée !');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 Prochaines étapes :');
    console.log('   1. Configurer le webhook Resend (voir GUIDE_NOTIFICATIONS_INTELLIGENTES.md)');
    console.log('   2. Configurer les cron jobs (voir GUIDE_NOTIFICATIONS_INTELLIGENTES.md)');
    console.log('   3. Tester avec les routes API de test');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'application de la migration:', error.message);
    console.error('   Détails:', error);
    console.log('');
    console.log('💡 Solution: Exécutez la migration SQL directement via le SQL Editor Supabase');
    console.log('   1. Allez dans Supabase Dashboard → SQL Editor');
    console.log('   2. Copiez le contenu de sql/add_notification_tracking.sql');
    console.log('   3. Exécutez la requête');
    console.log('');
    process.exit(1);
  }
}

// Exécuter le script
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

