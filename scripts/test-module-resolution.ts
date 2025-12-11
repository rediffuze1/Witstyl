// scripts/test-module-resolution.ts
// Script pour tester la résolution des modules comme Vercel

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

console.log('🔍 Test de résolution des modules (simulation Vercel)\n');

// Simuler le chemin Vercel
const vercelPaths = [
  '/var/task/server/supabaseService.js',
  '/var/task/server/index.prod.js',
  '/var/task/server/index.js',
  '/var/task/api/index.js',
];

// Chemins locaux correspondants
const localPaths = [
  resolve(rootDir, 'server/supabaseService.ts'),
  resolve(rootDir, 'server/index.prod.ts'),
  resolve(rootDir, 'server/index.ts'),
  resolve(rootDir, 'api/index.ts'),
];

console.log('Vérification des fichiers source:\n');
localPaths.forEach((path, i) => {
  const exists = existsSync(path);
  const vercelPath = vercelPaths[i];
  console.log(`${exists ? '✅' : '❌'} ${vercelPath}`);
  console.log(`   → ${path}`);
  if (!exists) {
    console.log(`   ⚠️  Fichier manquant !`);
  }
});

console.log('\n🔍 Vérification des imports dans server/index.ts:\n');
try {
  const indexContent = readFileSync(resolve(rootDir, 'server/index.ts'), 'utf8');
  const supabaseImports = indexContent.match(/import.*supabaseService[^'"]*['"]/g);
  if (supabaseImports) {
    supabaseImports.forEach(imp => {
      const hasJs = imp.includes('.js');
      console.log(`${hasJs ? '✅' : '❌'} ${imp.trim()}`);
      if (!hasJs) {
        console.log(`   ⚠️  Manque l'extension .js !`);
      }
    });
  }
} catch (e) {
  console.error('❌ Erreur lors de la lecture de server/index.ts:', e);
}

console.log('\n🔍 Vérification des imports dans server/index.prod.ts:\n');
try {
  const prodContent = readFileSync(resolve(rootDir, 'server/index.prod.ts'), 'utf8');
  const imports = prodContent.match(/import.*from.*['"][^'"]*['"]/g);
  if (imports) {
    imports.forEach(imp => {
      const hasJs = imp.includes('.js');
      const isRelative = imp.includes('./') || imp.includes('../');
      if (isRelative) {
        console.log(`${hasJs ? '✅' : '❌'} ${imp.trim()}`);
        if (!hasJs) {
          console.log(`   ⚠️  Manque l'extension .js !`);
        }
      }
    });
  }
} catch (e) {
  console.error('❌ Erreur lors de la lecture de server/index.prod.ts:', e);
}

console.log('\n✅ Vérification terminée');

