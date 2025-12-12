// Handler serverless pour Vercel
// Ce fichier exporte l'application Express pour Vercel
// Vercel utilisera ce fichier comme point d'entrée pour les fonctions serverless

console.log('[BOOT] api/index.ts module loaded');

// Import dynamique pour éviter les erreurs au top-level
let publicApp: any = null;
let fullApp: any = null;

/**
 * Routes publiques qui ne nécessitent pas DB/session
 */
const PUBLIC_ROUTES = [
  '/api/public/',
  '/api/reviews/google',
];

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => path.startsWith(route) || path === route);
}

async function getPublicApp() {
  if (!publicApp) {
    try {
      console.log('[BOOT] Loading publicApp (no DB/session)...');
      const { createPublicApp } = await import('../server/publicApp');
      publicApp = createPublicApp();
      console.log('[BOOT] publicApp loaded');
    } catch (error: any) {
      console.error('[BOOT] ❌ Error loading publicApp:', error.message);
      throw error;
    }
  }
  return publicApp;
}

async function getFullApp() {
  if (!fullApp) {
    try {
      // S'assurer que VERCEL est défini pour éviter les initialisations inutiles
      process.env.VERCEL = '1';
      process.env.NODE_ENV = 'production';
      
      console.log('[BOOT] Loading fullApp (with DB/session)...');
      console.log('[BOOT] Environment:', {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
      });
      
      // Utiliser le point d'entrée production dédié (index.prod.ts)
      // IMPORTANT: Import sans extension pour que Vercel résolve correctement
      const serverModule = await import('../server/index.prod');
      
      console.log('[BOOT] FullApp module loaded, keys:', Object.keys(serverModule));
      
      fullApp = serverModule.default || serverModule.app;
      
      if (!fullApp) {
        console.error('[BOOT] ❌ FullApp not found. Available exports:', Object.keys(serverModule));
        throw new Error('FullApp not exported correctly. Available: ' + Object.keys(serverModule).join(', '));
      }
      
      console.log('[BOOT] ✅ FullApp loaded');
    } catch (error: any) {
      console.error('[BOOT] ❌ Error loading fullApp:', error.message);
      console.error('[BOOT] Code:', error.code);
      console.error('[BOOT] Name:', error.name);
      if (error.stack) {
        console.error('[BOOT] Stack:', error.stack.split('\n').slice(0, 15).join('\n'));
      }
      throw error;
    }
  }
  return fullApp;
}

// Handler pour Vercel serverless functions
export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  const path = req.url || req.path || '/';
  
  console.log(`[REQ] start [${requestId}] ${req.method} ${path}`);
  
  try {
    // Fast path pour routes publiques (bypass DB/session)
    if (isPublicRoute(path)) {
      console.log(`[REQ] [${requestId}] Public route - using publicApp`);
      const app = await getPublicApp();
      const result = await app(req, res);
      const duration = Date.now() - startTime;
      console.log(`[REQ] end [${requestId}] ${req.method} ${path} (${duration}ms) - public`);
      return result;
    }
    
    // Full app pour routes protégées
    console.log(`[REQ] [${requestId}] Protected route - using fullApp`);
    const app = await getFullApp();
    const result = await app(req, res);
    const duration = Date.now() - startTime;
    console.log(`[REQ] end [${requestId}] ${req.method} ${path} (${duration}ms) - protected`);
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[REQ] error [${requestId}] ${req.method} ${path} after ${duration}ms:`, error.message);
    if (error.stack) {
      console.error(`[REQ] stack [${requestId}]:`, error.stack.split('\n').slice(0, 10).join('\n'));
    }
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'FUNCTION_INVOCATION_FAILED',
        message: error.message || 'Erreur serveur lors du traitement de la requête',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }
}

