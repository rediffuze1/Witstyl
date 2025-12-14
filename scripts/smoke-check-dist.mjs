#!/usr/bin/env node

/**
 * Smoke test post-build : Vérifie que les specifiers .js sont présents dans les fichiers critiques
 * 
 * Ce script vérifie que les imports relatifs utilisent bien .js dans les fichiers
 * qui seront déployés sur Vercel (api/, server/).
 * 
 * Usage: npm run smoke:dist
 * 
 * Exit code:
 * - 0: Tous les imports sont corrects
 * - 1: Au moins un import incorrect trouvé
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CRITICAL_FILES = [
  'api/index.ts',
  'server/index.prod.ts',
  'server/publicApp.ts',
];

const REQUIRED_IMPORTS = [
  { file: 'api/index.ts', patterns: ['publicApp.js', 'index.prod.js'] },
  { file: 'server/index.prod.ts', patterns: ['index.js'] },
  { file: 'server/publicApp.ts', patterns: ['publicIsolated.js'] },
];

let errors = 0;

console.log('🔍 Smoke test: Vérification des specifiers .js dans les fichiers critiques...\n');

for (const file of CRITICAL_FILES) {
  const filePath = join(process.cwd(), file);
  
  if (!existsSync(filePath)) {
    console.error(`❌ Fichier manquant: ${file}`);
    errors++;
    continue;
  }
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const required = REQUIRED_IMPORTS.find(r => r.file === file);
    
    if (required) {
      for (const pattern of required.patterns) {
        if (!content.includes(pattern)) {
          console.error(`❌ ${file}: Import '${pattern}' manquant ou incorrect`);
          errors++;
        } else {
          console.log(`✅ ${file}: Import '${pattern}' présent`);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Erreur lors de la lecture de ${file}:`, error.message);
    errors++;
  }
}

console.log('');

if (errors === 0) {
  console.log('✅ Smoke test réussi : Tous les imports critiques utilisent .js');
  process.exit(0);
} else {
  console.error(`❌ Smoke test échoué : ${errors} erreur(s) trouvée(s)`);
  console.error('💡 Exécutez: npm run check:esm pour voir tous les imports incorrects');
  process.exit(1);
}


