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
 * Retourne MemoryStore immédiatement si PG store échoue
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

  // En prod/Vercel, essayer SupabaseSessionStore avec timeout
  console.log('[SESSION] Tentative d\'initialisation SupabaseSessionStore...');
  
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
    
    // Fallback automatique vers MemoryStore
    console.warn('[SESSION] ⚠️  Fallback automatique vers MemoryStore');
    console.warn('[SESSION]    Note: MemoryStore ne persiste pas entre les invocations serverless');
    const MemoryStore = session.MemoryStore;
    sessionStoreInstance = new MemoryStore();
    sessionStoreStatus = 'fallback';
    return sessionStoreInstance;
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
 * Récupère le session store de manière synchrone (retourne MemoryStore si PG pas prêt)
 * Utilisé pour ne pas bloquer le boot
 */
export function getSessionStoreSync(): session.Store {
  if (sessionStoreInstance) {
    return sessionStoreInstance;
  }

  // Retourner MemoryStore par défaut (sera remplacé par PG store si dispo)
  const MemoryStore = session.MemoryStore;
  const fallbackStore = new MemoryStore();
  
  // Init PG store en background (non bloquant)
  initSessionStoreWithTimeout(3000).then(store => {
    if (sessionStoreStatus === 'ok') {
      console.log('[SESSION] ✅ PG store initialisé en background, sera utilisé pour les prochaines requêtes');
      sessionStoreInstance = store;
    }
  }).catch(() => {
    // Erreur déjà loggée dans initSessionStoreWithTimeout
  });

  return fallbackStore;
}

/**
 * Statut du session store
 */
export function getSessionStoreStatus(): { status: typeof sessionStoreStatus; error: string | null } {
  return { status: sessionStoreStatus, error: sessionStoreError };
}

