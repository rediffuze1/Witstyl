/**
 * Module de gestion lazy du session store
 * Initialisation time-boxed avec fallback automatique vers MemoryStore
 * Ne bloque jamais le chargement du module
 */

import session from 'express-session';
// IMPORTANT: En ESM, les imports relatifs doivent inclure l'extension .js
import SupabaseSessionStore from './supabaseSessionStore.js';

let sessionStoreInstance: session.Store | null = null;
let sessionStoreStatus: 'unknown' | 'ok' | 'failed' | 'fallback' = 'unknown';
let sessionStoreError: string | null = null;
let initPromise: Promise<session.Store> | null = null;

/**
 * Initialise le session store avec timeout strict
 * En production Vercel: utilise SupabaseSessionStore (pas de fallback vers MemoryStore)
 * En dev local: utilise MemoryStore
 */
async function initSessionStoreWithTimeout(timeoutMs: number = 3000): Promise<session.Store> {
  const isVercel = !!process.env.VERCEL;
  const isProduction = process.env.NODE_ENV === 'production';
  const useFallbackStore = process.env.SESSION_STORE_FALLBACK === 'true';

  // Si flag fallback activé, utiliser MemoryStore directement
  if (useFallbackStore) {
    console.warn('[SESSION] ⚠️  Flag SESSION_STORE_FALLBACK=true, utilisation de MemoryStore');
    const MemoryStore = session.MemoryStore;
    sessionStoreInstance = new MemoryStore();
    sessionStoreStatus = 'fallback';
    return sessionStoreInstance;
  }

  // En dev local, utiliser MemoryStore
  if (!isVercel && !isProduction) {
    console.log('[SESSION] Utilisation de MemoryStore pour le développement local');
    const MemoryStore = session.MemoryStore;
    sessionStoreInstance = new MemoryStore();
    sessionStoreStatus = 'ok';
    return sessionStoreInstance;
  }

  // En prod/Vercel, OBLIGATOIRE d'utiliser SupabaseSessionStore (pas de fallback)
  console.log('[SESSION] Production/Vercel: initialisation SupabaseSessionStore (obligatoire)...');
  
  // Vérifier que DATABASE_URL est présent
  if (!process.env.DATABASE_URL) {
    const error = new Error('DATABASE_URL est requis en production Vercel pour SupabaseSessionStore');
    console.error('[SESSION] ❌', error.message);
    throw error;
  }
  
  const initPromise = (async () => {
    try {
      const store = new SupabaseSessionStore();
      console.log('[SESSION] ✅ SupabaseSessionStore créé avec succès');
      sessionStoreStatus = 'ok';
      sessionStoreError = null;
      return store;
    } catch (error: any) {
      sessionStoreStatus = 'failed';
      sessionStoreError = error.message || String(error);
      throw error;
    }
  })();

  const timeoutPromise = new Promise<session.Store>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`SessionStore init timeout (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  try {
    const store = await Promise.race([initPromise, timeoutPromise]);
    sessionStoreInstance = store;
    return store;
  } catch (error: any) {
    const isTimeout = error.message?.includes('timeout');
    const errorMsg = error.message || 'Unknown error';
    
    if (isTimeout) {
      console.error(`[SESSION] ⏱️  TIMEOUT lors de l'initialisation (${timeoutMs}ms)`);
      console.error('[SESSION]    Cause probable: DATABASE_URL invalide ou PG pooler indisponible');
      sessionStoreError = `Timeout (${timeoutMs}ms) - DB non disponible`;
    } else {
      console.error('[SESSION] ❌ Erreur lors de la création du SupabaseSessionStore:', errorMsg);
      sessionStoreError = errorMsg;
    }
    
    // En production Vercel, NE PAS faire de fallback vers MemoryStore
    // L'application doit échouer proprement si le store ne peut pas être initialisé
    throw new Error(`[SESSION] Impossible d'initialiser SupabaseSessionStore en production: ${errorMsg}`);
  }
}

/**
 * Récupère le session store (lazy init)
 * Si pas encore initialisé, lance l'init avec timeout
 */
export async function getSessionStore(): Promise<session.Store> {
  // Si déjà initialisé, retourner directement
  if (sessionStoreInstance) {
    return sessionStoreInstance;
  }

  // Si init en cours, attendre
  if (initPromise) {
    return initPromise;
  }

  // Lancer l'init
  initPromise = initSessionStoreWithTimeout(3000);
  sessionStoreInstance = await initPromise;
  return sessionStoreInstance;
}

/**
 * Récupère le session store de manière synchrone
 * En production Vercel: attend l'initialisation de SupabaseSessionStore (bloquant)
 * En dev local: retourne MemoryStore immédiatement
 */
export function getSessionStoreSync(): session.Store {
  const isVercel = !!process.env.VERCEL;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Si déjà initialisé, retourner directement
  if (sessionStoreInstance) {
    return sessionStoreInstance;
  }

  // En dev local, retourner MemoryStore immédiatement
  if (!isVercel && !isProduction) {
    const MemoryStore = session.MemoryStore;
    const fallbackStore = new MemoryStore();
    sessionStoreInstance = fallbackStore;
    sessionStoreStatus = 'ok';
    return fallbackStore;
  }

  // En production Vercel, on ne peut pas retourner un store synchrone
  // car SupabaseSessionStore nécessite une init async
  // Cette fonction ne devrait pas être appelée en prod, mais si c'est le cas,
  // on lance l'init et on attend (bloquant)
  console.warn('[SESSION] ⚠️  getSessionStoreSync() appelé en production - initialisation bloquante...');
  
  // Lancer l'init et attendre (bloquant en prod, mais nécessaire)
  if (!initPromise) {
    initPromise = initSessionStoreWithTimeout(5000); // 5s en prod
  }
  
  // En prod, on doit attendre (bloquant)
  // Note: Cette fonction ne devrait idéalement pas être utilisée en prod
  // mais si elle l'est, on attend l'init
  throw new Error('[SESSION] getSessionStoreSync() ne peut pas être utilisé en production Vercel. Utilisez getSessionStore() à la place.');
}

/**
 * Statut du session store
 */
export function getSessionStoreStatus(): { status: typeof sessionStoreStatus; error: string | null } {
  return { status: sessionStoreStatus, error: sessionStoreError };
}

