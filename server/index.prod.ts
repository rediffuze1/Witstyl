// server/index.prod.ts
// Point d'entrée PRODUCTION PUR pour Vercel
// Ce fichier garantit qu'aucune dépendance à Vite n'est chargée
// Il réexporte uniquement l'app Express sans aucune référence à Vite

// Forcer l'environnement de production AVANT tout import
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

// Import direct de l'app Express depuis index.ts
// index.ts n'importe pas Vite directement, mais on veut être absolument sûr
// que même si un import dynamique existe quelque part, il ne sera pas résolu
// 
// IMPORTANT: Import sans extension pour que Vercel résolve correctement
// Le bundler Vercel gère automatiquement la résolution TypeScript → JavaScript
import app from './index';

// Export de l'app Express pour Vercel
export default app;

// Export nommé pour compatibilité
export { app };
