// server/index.prod.ts
// Point d'entrée PRODUCTION PUR pour Vercel
// Ce fichier garantit qu'aucune dépendance à Vite n'est chargée
// Il réexporte uniquement l'app Express sans aucune référence à Vite

// ⚠️ SÉCURITÉ: Ne jamais désactiver TLS en production
// NODE_TLS_REJECT_UNAUTHORIZED doit rester à sa valeur par défaut (1) en production
// Seulement autorisé en développement local si nécessaire
if (process.env.VERCEL && process.env.NODE_ENV === 'production') {
  // En production Vercel, ne jamais désactiver TLS
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    console.warn('[BOOT] ⚠️ SÉCURITÉ: NODE_TLS_REJECT_UNAUTHORIZED=0 détecté en production - IGNORÉ');
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; // Utiliser la valeur par défaut (1)
  }
}

// Forcer l'environnement de production AVANT tout import
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

import type { Express } from 'express';

// Cache pour l'app complète (lazy init)
let _fullApp: Express | null = null;
let _loading: Promise<Express> | null = null;

/**
 * Récupère l'app Express complète avec lazy init et cache
 * L'import de ./index est fait de manière lazy pour éviter les problèmes de bundling Vercel
 */
export async function getFullApp(): Promise<Express> {
  if (_fullApp) {
    return _fullApp;
  }
  
  if (_loading) {
    return _loading;
  }
  
  // Import lazy ici (ok) : Vercel bundle index.prod.ts statiquement,
  // et ce module sera tracé correctement.
  _loading = (async () => {
    try {
      console.log('[BOOT] Loading fullApp (with DB/session)...');
      console.log('[BOOT] Environment:', {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
      });
      
      // En production, on doit initialiser SupabaseSessionStore AVANT d'importer index.ts
      // car index.ts utilise le store dans session()
      console.log('[BOOT] Initialisation SupabaseSessionStore avant import de index.ts...');
      const { getSessionStore } = await import('./sessionStore.js');
      await getSessionStore(); // Attendre que le store soit initialisé
      console.log('[BOOT] ✅ SupabaseSessionStore initialisé, import de index.ts...');
      
      // Import dynamique de index.ts (ok ici car dans une fonction async)
      // IMPORTANT: En ESM, les imports relatifs doivent inclure l'extension .js
      const mod = await import('./index.js');
      
      // Extraire l'app depuis les exports (default ou app)
      // En production, l'app est créée avec SupabaseSessionStore lors de l'import
      const app: Express = (mod as any).default ?? (mod as any).app ?? mod;
      
      if (!app) {
        console.error('[BOOT] ❌ FullApp not found. Available exports:', Object.keys(mod));
        throw new Error('FullApp not exported correctly. Available: ' + Object.keys(mod).join(', '));
      }
      
      _fullApp = app;
      console.log('[BOOT] ✅ FullApp loaded');
      return app;
    } catch (error: any) {
      console.error('[BOOT] ❌ Error loading fullApp:', error.message);
      console.error('[BOOT] Code:', error.code);
      console.error('[BOOT] Name:', error.name);
      if (error.stack) {
        console.error('[BOOT] Stack:', error.stack.split('\n').slice(0, 15).join('\n'));
      }
      throw error;
    }
  })();
  
  return _loading;
}

// Export par défaut pour compatibilité (mais préférer getFullApp())
// ⚠️ Ne pas exporter un default app créé au top-level pour éviter les problèmes de bundling
export default getFullApp;
