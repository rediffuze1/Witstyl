#!/usr/bin/env node
/**
 * Script pour ajouter automatiquement l'extension .js aux imports relatifs
 * Compatible avec ESM et Vercel
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Pattern pour trouver les imports relatifs sans extension .js
const importPattern = /from\s+['"](\.\.?\/[^'"]*?)(?<!\.js)['"]/g;

// Pattern pour exclure les imports avec alias (@/, node:, etc.)
const excludePattern = /from\s+['"](@\/|node:|http|https|\.\/\.\.\/vite\.config)/;

function fixImportsInFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let modified = false;
    let match;

    // Trouver tous les imports relatifs sans extension
    const matches = [];
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1];
      
      // Exclure les imports avec alias ou déjà avec extension
      if (excludePattern.test(match[0]) || importPath.endsWith('.js')) {
        continue;
      }
      
      // Exclure les imports de types uniquement (type imports)
      const beforeMatch = content.substring(Math.max(0, match.index - 20), match.index);
      if (beforeMatch.includes('import type') || beforeMatch.includes('import { type')) {
        // Pour les type imports, on peut aussi ajouter .js
        matches.push({
          index: match.index,
          length: match[0].length,
          original: match[0],
          path: importPath,
          replacement: match[0].replace(importPath, importPath + '.js')
        });
        modified = true;
      } else {
        matches.push({
          index: match.index,
          length: match[0].length,
          original: match[0],
          path: importPath,
          replacement: match[0].replace(importPath, importPath + '.js')
        });
        modified = true;
      }
    }

    // Appliquer les remplacements en ordre inverse pour préserver les indices
    if (matches.length > 0) {
      matches.reverse().forEach(({ index, original, replacement }) => {
        content = content.substring(0, index) + replacement + content.substring(index + original.length);
      });
      
      writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed ${matches.length} import(s) in ${filePath.replace(rootDir + '/', '')}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Searching for files with relative imports...\n');
  
  // Trouver tous les fichiers TypeScript/JavaScript dans server/ et api/
  const files = await glob('{server,api}/**/*.{ts,js}', {
    cwd: rootDir,
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/__tests__/**']
  });

  console.log(`Found ${files.length} files to check\n`);
  
  let totalFixed = 0;
  let filesModified = 0;

  for (const file of files) {
    const filePath = join(rootDir, file);
    const fixed = fixImportsInFile(filePath);
    if (fixed) {
      filesModified++;
      // Compter les imports corrigés
      const content = readFileSync(filePath, 'utf8');
      const matches = content.match(/from\s+['"]\.\.?\/[^'"]*\.js['"]/g);
      if (matches) {
        totalFixed += matches.length;
      }
    }
  }

  console.log(`\n✅ Done! Fixed imports in ${filesModified} files`);
  console.log(`📊 Total imports fixed: ${totalFixed}`);
}

main().catch(console.error);

