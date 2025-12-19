/**
 * Application Express légère pour les routes publiques
 * Ne fait AUCUNE init DB/session - répond uniquement via Supabase REST
 */

import 'dotenv/config';
import type { Express } from 'express';
import express from 'express';
// IMPORTANT: Utiliser publicIsolated qui n'importe AUCUN module DB/session
// IMPORTANT: En ESM, les imports relatifs doivent inclure l'extension .js
import publicRouter from './routes/publicIsolated.js';
import googleReviewsRouter from './routes/google-reviews.js';

console.log('[BOOT] publicApp module loaded');

// Cache pour l'app publique (safe à importer, pas d'init DB/session au top-level)
let _publicApp: Express | null = null;

/**
 * Crée l'app Express publique (DB-free, session-free)
 * Safe à appeler au top-level car n'importe rien de DB/session
 */
export function createPublicApp(): Express {
  console.log('[BOOT] createPublicApp start');
  
  const app = express();
  
  // Middleware basique uniquement
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  // CORS simple pour routes publiques
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
  
  // Route Google Reviews (publique, pas besoin de DB/session)
  app.use('/api/reviews/google', googleReviewsRouter);
  
  // Routes publiques
  app.use('/api/public', publicRouter);
  
  // 404 handler pour routes publiques
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  
  console.log('[BOOT] createPublicApp end - routes mounted');
  
  return app;
}

/**
 * Récupère l'app publique avec cache (lazy init)
 * Safe à importer statiquement car createPublicApp() n'importe rien de DB/session
 */
export async function getPublicApp(): Promise<Express> {
  if (_publicApp) {
    return _publicApp;
  }
  
  _publicApp = createPublicApp();
  return _publicApp;
}

