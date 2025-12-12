/**
 * Application Express légère pour les routes publiques
 * Ne fait AUCUNE init DB/session - répond uniquement via Supabase REST
 */

import 'dotenv/config';
import express from 'express';
// IMPORTANT: Utiliser publicIsolated qui n'importe AUCUN module DB/session
import publicRouter from './routes/publicIsolated';

console.log('[BOOT] publicApp module loaded');

export function createPublicApp() {
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
  
  // Route stub pour /api/reviews/google
  app.get('/api/reviews/google', (req, res) => {
    res.json({
      reviews: [],
      averageRating: 0,
      totalReviews: 0,
    });
  });
  
  // Routes publiques
  app.use('/api/public', publicRouter);
  
  // 404 handler pour routes publiques
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  
  console.log('[BOOT] createPublicApp end - routes mounted');
  
  return app;
}

