// Handler serverless pour Vercel
// Ce fichier exporte l'application Express pour Vercel
// Vercel utilisera ce fichier comme point d'entrée pour les fonctions serverless

console.log('[BOOT] api/index.ts module loaded');

// Imports statiques pour éviter ERR_MODULE_NOT_FOUND sur Vercel
// Les fonctions getPublicApp() et getFullApp() gèrent le lazy init avec cache
// IMPORTANT: En ESM, les imports relatifs doivent inclure l'extension .js
import { getPublicApp } from '../server/publicApp.js';
import { getFullApp } from '../server/index.prod.js';

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

// Handler pour Vercel serverless functions
export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  const path = req.url || req.path || '/';
  
  // Guard: rejeter immédiatement les requêtes non-API (fichiers statiques, etc.)
  // Sur Vercel, les fichiers statiques sont servis par Vercel directement, pas par notre handler
  if (!path.startsWith('/api/')) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not Found');
    return;
  }
  
  console.log(`[REQ] start [${requestId}] ${req.method} ${path}`);
  
  try {
    // Fast path pour routes publiques (bypass DB/session)
    if (isPublicRoute(path)) {
      console.log(`[REQ] [${requestId}] Public route - using publicApp`);
      const publicApp = await getPublicApp(); // fast, DB-free
      
      // Wrapper pour attendre que Express termine la réponse
      // Utiliser res.on('finish') pour détecter quand la réponse est envoyée
      return new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          res.removeListener('finish', onFinish);
          res.removeListener('close', onClose);
          res.removeListener('error', onError);
        };
        
        const onFinish = () => {
          cleanup();
          const duration = Date.now() - startTime;
          console.log(`[REQ] end [${requestId}] ${req.method} ${path} (${duration}ms) - public`);
          resolve();
        };
        
        const onClose = () => {
          cleanup();
          const duration = Date.now() - startTime;
          console.log(`[REQ] close [${requestId}] ${req.method} ${path} (${duration}ms) - public`);
          resolve();
        };
        
        const onError = (err: any) => {
          cleanup();
          const duration = Date.now() - startTime;
          console.error(`[REQ] error [${requestId}] ${req.method} ${path} after ${duration}ms:`, err);
          reject(err);
        };
        
        res.once('finish', onFinish);
        res.once('close', onClose);
        res.once('error', onError);
        
        // Appeler Express app
        publicApp(req, res, (err?: any) => {
          if (err) {
            cleanup();
            onError(err);
          }
        });
      });
    }
    
    // Full app pour routes protégées (lazy, only when needed)
    console.log(`[REQ] [${requestId}] Protected route - using fullApp`);
    const fullApp = await getFullApp(); // lazy, only when needed
    
    // Wrapper pour attendre que Express termine la réponse
    // Utiliser res.on('finish') pour détecter quand la réponse est envoyée
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        res.removeListener('finish', onFinish);
        res.removeListener('close', onClose);
        res.removeListener('error', onError);
      };
      
      const onFinish = () => {
        cleanup();
        const duration = Date.now() - startTime;
        console.log(`[REQ] end [${requestId}] ${req.method} ${path} (${duration}ms) - protected`);
        resolve();
      };
      
      const onClose = () => {
        cleanup();
        const duration = Date.now() - startTime;
        console.log(`[REQ] close [${requestId}] ${req.method} ${path} (${duration}ms) - protected`);
        resolve();
      };
      
      const onError = (err: any) => {
        cleanup();
        const duration = Date.now() - startTime;
        console.error(`[REQ] error [${requestId}] ${req.method} ${path} after ${duration}ms:`, err);
        reject(err);
      };
      
      res.once('finish', onFinish);
      res.once('close', onClose);
      res.once('error', onError);
      
      // Appeler Express app
      fullApp(req, res, (err?: any) => {
        if (err) {
          cleanup();
          onError(err);
        }
      });
    });
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

