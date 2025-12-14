#!/usr/bin/env node

/**
 * Script de vérification : Vérifie que les imports .js sont présents dans api/index.ts
 * 
 * Ce script lit directement api/index.ts et vérifie que les imports critiques
 * utilisent bien l'extension .js.
 * 
 * Usage: node scripts/verify-vercel-build.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const API_INDEX = join(process.cwd(), 'api/index.ts');

console.log('🔍 Vérification des imports dans api/index.ts...\n');

if (!existsSync(API_INDEX)) {
  console.error(`❌ Fichier manquant: ${API_INDEX}`);
  process.exit(1);
}

const content = readFileSync(API_INDEX, 'utf-8');

// Vérifier les imports critiques
const requiredImports = [
  { pattern: /from\s+['"]\.\.\/server\/publicApp\.js['"]/, name: '../server/publicApp.js' },
  { pattern: /from\s+['"]\.\.\/server\/index\.prod\.js['"]/, name: '../server/index.prod.js' },
];

// Vérifier les imports SANS .js (interdits)
const forbiddenImports = [
  { pattern: /from\s+['"]\.\.\/server\/publicApp['"]/, name: '../server/publicApp (sans .js)' },
  { pattern: /from\s+['"]\.\.\/server\/index\.prod['"]/, name: '../server/index.prod (sans .js)' },
];

let errors = 0;

console.log('✅ Imports requis:');
for (const req of requiredImports) {
  if (req.pattern.test(content)) {
    console.log(`   ✅ ${req.name}`);
  } else {
    console.error(`   ❌ ${req.name} - MANQUANT`);
    errors++;
  }
}

console.log('\n❌ Imports interdits (sans .js):');
for (const forbidden of forbiddenImports) {
  if (forbidden.pattern.test(content)) {
    console.error(`   ❌ ${forbidden.name} - TROUVÉ (INTERDIT)`);
    errors++;
  } else {
    console.log(`   ✅ ${forbidden.name} - Absent (correct)`);
  }
}

// Afficher les lignes d'imports pour debug
console.log('\n📄 Lignes d\'imports trouvées:');
const importLines = content.split('\n').filter((line, idx) => {
  if (line.includes('server/publicApp') || line.includes('server/index.prod')) {
    console.log(`   Ligne ${idx + 1}: ${line.trim()}`);
    return true;
  }
  return false;
});

console.log('');

if (errors === 0) {
  console.log('✅ Vérification réussie : Tous les imports sont corrects');
  console.log('💡 Si Vercel échoue encore, c\'est un problème de cache Vercel.');
  console.log('   Solution: Vercel Dashboard → Redeploy → "Redeploy without cache"');
  console.log('   Ou CLI: npx vercel --prod --force');
  process.exit(0);
} else {
  console.error(`❌ Vérification échouée : ${errors} erreur(s) trouvée(s)`);
  process.exit(1);
}

