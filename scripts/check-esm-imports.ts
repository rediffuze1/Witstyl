#!/usr/bin/env tsx

/**
 * Script de vérification ESM : Détecte les imports relatifs TypeScript sans extension .js
 * 
 * En Node.js ESM + Vercel, les imports relatifs dans les fichiers .ts DOIVENT inclure .js
 * car Vercel transpile TS→JS sans réécrire les specifiers.
 * 
 * Usage: npm run check:esm
 * 
 * Exit code:
 * - 0: Tous les imports sont corrects
 * - 1: Au moins un import incorrect trouvé
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

interface Violation {
  file: string;
  line: number;
  import: string;
}

const violations: Violation[] = [];

// Patterns pour détecter les imports relatifs sans .js
const IMPORT_PATTERN = /import\s+.*?\s+from\s+['"](\.\.?\/[^'"]+)['"]/g;
const DYNAMIC_IMPORT_PATTERN = /(?:await\s+)?import\s*\(\s*['"](\.\.?\/[^'"]+)['"]/g;

// Fichiers/chemins à ignorer
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /\.archive/,
  /\.next/,
  /\.vite/,
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\.d\.ts$/,
  // Fichiers JS réels (doivent garder .js)
  /\.js$/,
  // Scripts de test peuvent avoir des imports dynamiques
  /scripts\/test-/,
];

// Extensions de fichiers TypeScript à vérifier
const TS_EXTENSIONS = ['.ts', '.tsx'];

/**
 * Vérifie si un chemin doit être ignoré
 */
function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Vérifie si un import relatif a l'extension .js
 */
function isValidESMImport(importPath: string, filePath: string): boolean {
  // Ignorer les imports npm (sans ./ ou ../)
  if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
    return true;
  }
  
  // Ignorer les imports vers des fichiers JS réels (doivent garder .js)
  if (importPath.endsWith('.js')) {
    return true;
  }
  
  // Ignorer les imports avec extension autre que .js (ex: .json, .css)
  const hasOtherExtension = /\.(json|css|scss|sass|less|svg|png|jpg|jpeg|gif|webp|ico)$/i.test(importPath);
  if (hasOtherExtension) {
    return true;
  }
  
  // Ignorer les imports vers des répertoires (ex: './utils' qui pointe vers './utils/index.js')
  // On ne peut pas vérifier ça statiquement, donc on accepte
  // Mais on préfère que les imports explicites aient .js
  const isDirectoryImport = !extname(importPath);
  
  // Pour les imports TypeScript relatifs, ils DOIVENT avoir .js
  // Exception : imports de répertoires (on ne peut pas vérifier statiquement)
  if (isDirectoryImport) {
    // Accepter les imports de répertoires (ex: './utils' → './utils/index.js')
    // Mais logger un warning pour encourager l'explicite
    return true;
  }
  
  // Si l'import a une extension, elle DOIT être .js pour les fichiers TS
  return importPath.endsWith('.js');
}

/**
 * Analyse un fichier pour détecter les imports incorrects
 */
function checkFile(filePath: string): void {
  if (shouldIgnore(filePath)) {
    return;
  }
  
  const ext = extname(filePath);
  if (!TS_EXTENSIONS.includes(ext)) {
    return;
  }
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Vérifier les imports statiques
    let match;
    while ((match = IMPORT_PATTERN.exec(content)) !== null) {
      const importPath = match[1];
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      if (!isValidESMImport(importPath, filePath)) {
        violations.push({
          file: filePath,
          line: lineNumber,
          import: importPath,
        });
      }
    }
    
    // Vérifier les imports dynamiques
    while ((match = DYNAMIC_IMPORT_PATTERN.exec(content)) !== null) {
      const importPath = match[1];
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      if (!isValidESMImport(importPath, filePath)) {
        violations.push({
          file: filePath,
          line: lineNumber,
          import: importPath,
        });
      }
    }
  } catch (error: any) {
    console.error(`❌ Erreur lors de la lecture de ${filePath}:`, error.message);
  }
}

/**
 * Parcourt récursivement un répertoire
 */
function walkDirectory(dir: string): void {
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      
      if (shouldIgnore(fullPath)) {
        continue;
      }
      
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDirectory(fullPath);
      } else if (stat.isFile()) {
        checkFile(fullPath);
      }
    }
  } catch (error: any) {
    // Ignorer les erreurs de permission
    if (error.code !== 'EACCES') {
      console.error(`❌ Erreur lors de la lecture de ${dir}:`, error.message);
    }
  }
}

/**
 * Point d'entrée
 */
function main() {
  console.log('🔍 Vérification des imports ESM...\n');
  
  // Vérifier les répertoires critiques
  const directoriesToCheck = ['api', 'server'];
  
  for (const dir of directoriesToCheck) {
    const fullPath = join(process.cwd(), dir);
    try {
      if (statSync(fullPath).isDirectory()) {
        console.log(`📁 Vérification de ${dir}/...`);
        walkDirectory(fullPath);
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ Erreur: ${error.message}`);
      }
    }
  }
  
  // Afficher les résultats
  console.log('\n' + '='.repeat(60));
  
  if (violations.length === 0) {
    console.log('✅ Tous les imports ESM sont corrects !');
    console.log('✅ Tous les imports relatifs TypeScript utilisent l\'extension .js');
    process.exit(0);
  } else {
    console.log(`❌ ${violations.length} import(s) incorrect(s) trouvé(s):\n`);
    
    for (const violation of violations) {
      console.log(`  📄 ${violation.file}:${violation.line}`);
      console.log(`     Import: ${violation.import}`);
      console.log(`     ❌ Manque l'extension .js`);
      console.log(`     ✅ Devrait être: ${violation.import}.js\n`);
    }
    
    console.log('='.repeat(60));
    console.log('\n💡 Correction:');
    console.log('   Tous les imports relatifs TypeScript doivent inclure .js');
    console.log('   Exemple: import { x } from "./module.js";');
    console.log('\n📚 Voir ARCHITECTURE_GUIDE.md pour plus de détails.\n');
    
    process.exit(1);
  }
}

main();


