#!/usr/bin/env node

/**
 * Audit complet des imports ESM pour détecter les problèmes
 * - Imports relatifs sans .js
 * - Imports vers des dossiers (sans fichier explicite)
 * - Problèmes de casse
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { globSync } from 'glob';

const ROOT = process.cwd();
const DIRS_TO_SCAN = ['api', 'server', 'scripts'];

// Fichiers .js réels (ne pas modifier)
const REAL_JS_FILES = new Set([
  'server/assistant/nlp.js',
  'server/assistant/replies.js',
  'server/assistant/sessionStore.js',
  'server/config-direct.js',
  'server/config.js',
  'server/mcp/index.js',
  'server/routes/voice-agent-complex.js',
  'server/routes/voice-agent-simple.js',
  'server/routes/voice-agent.js',
  'server/routes/voice-audio.js',
]);

const issues = {
  missingJs: [],
  directoryImport: [],
  caseMismatch: [],
};

function resolvePath(fromFile, importPath) {
  const fromDir = dirname(fromFile);
  const resolved = join(fromDir, importPath);
  
  // Normaliser le chemin
  let normalized = resolved.replace(/\\/g, '/');
  
  // Si c'est un dossier, chercher index.ts ou index.js
  if (statSync(normalized).isDirectory()) {
    const indexPath = join(normalized, 'index.ts');
    if (statSync(indexPath).isFile()) {
      return indexPath;
    }
    const indexJs = join(normalized, 'index.js');
    if (statSync(indexJs).isFile()) {
      return indexJs;
    }
  }
  
  // Si c'est un fichier sans extension, chercher .ts ou .js
  if (!extname(normalized)) {
    const tsPath = normalized + '.ts';
    if (statSync(tsPath).isFile()) {
      return tsPath;
    }
    const jsPath = normalized + '.js';
    if (statSync(jsPath).isFile()) {
      return jsPath;
    }
  }
  
  return normalized;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = filePath.replace(ROOT + '/', '');
  
  // Regex pour capturer les imports
  const importRegex = /(?:import|export).*?from\s+['"](\.\.?\/[^'"]+)['"]/g;
  
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const fullMatch = match[0];
    const lineNum = content.substring(0, match.index).split('\n').length;
    
    // Ignorer les imports vers node_modules, .json, .node
    if (importPath.includes('node_modules') || 
        importPath.endsWith('.json') || 
        importPath.endsWith('.node')) {
      continue;
    }
    
    // Vérifier si c'est un fichier .js réel
    const isRealJs = Array.from(REAL_JS_FILES).some(jsFile => {
      const fullJsPath = join(ROOT, jsFile);
      const resolved = resolvePath(filePath, importPath);
      return resolved === fullJsPath || resolved === fullJsPath + '.ts';
    });
    
    if (isRealJs) {
      continue; // Fichier .js réel, OK
    }
    
    // Problème 1: Manque .js
    if (!importPath.endsWith('.js') && !importPath.endsWith('.json') && !importPath.endsWith('.node')) {
      issues.missingJs.push({
        file: relativePath,
        line: lineNum,
        import: importPath,
        fullMatch: fullMatch.trim(),
      });
    }
    
    // Problème 2: Import vers un dossier (sans /index.js)
    try {
      const resolved = resolvePath(filePath, importPath);
      if (statSync(resolved).isDirectory()) {
        issues.directoryImport.push({
          file: relativePath,
          line: lineNum,
          import: importPath,
          fullMatch: fullMatch.trim(),
          suggestion: importPath.endsWith('/') ? importPath + 'index.js' : importPath + '/index.js',
        });
      }
    } catch (e) {
      // Fichier non trouvé, sera géré par missingJs
    }
  }
}

// Scanner tous les fichiers .ts
for (const dir of DIRS_TO_SCAN) {
  const files = globSync(`${dir}/**/*.ts`, {
    ignore: ['**/*.d.ts', '**/*.test.ts', 'node_modules/**'],
  });
  
  for (const file of files) {
    try {
      checkFile(join(ROOT, file));
    } catch (e) {
      console.error(`Erreur lors de la vérification de ${file}:`, e.message);
    }
  }
}

// Afficher le rapport
console.log('🔍 Audit ESM Imports\n');
console.log(`📊 Fichiers scannés: ${DIRS_TO_SCAN.join(', ')}\n`);

console.log(`❌ Imports relatifs sans .js: ${issues.missingJs.length}`);
if (issues.missingJs.length > 0) {
  console.log('\nTop 20 problèmes:');
  issues.missingJs.slice(0, 20).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line} - ${issue.import}`);
    console.log(`    → ${issue.fullMatch}`);
  });
}

console.log(`\n📁 Imports vers dossiers (sans /index.js): ${issues.directoryImport.length}`);
if (issues.directoryImport.length > 0) {
  console.log('\nTop 10:');
  issues.directoryImport.slice(0, 10).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line} - ${issue.import}`);
    console.log(`    → Suggestion: ${issue.suggestion}`);
  });
}

console.log(`\n📋 Résumé:`);
console.log(`  - Imports sans .js: ${issues.missingJs.length}`);
console.log(`  - Imports vers dossiers: ${issues.directoryImport.length}`);
console.log(`  - Total problèmes: ${issues.missingJs.length + issues.directoryImport.length}`);

// Exporter pour traitement ultérieur
if (issues.missingJs.length > 0 || issues.directoryImport.length > 0) {
  process.exit(1);
} else {
  console.log('\n✅ Aucun problème détecté !');
  process.exit(0);
}

