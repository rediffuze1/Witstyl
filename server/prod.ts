// server/prod.ts
// Point d'entrée PRODUCTION pour Vercel (déprécié, utiliser index.prod.ts)
// Ce fichier garantit qu'aucune dépendance à Vite n'est chargée

// Forcer l'environnement de production avant tout import
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

// Réexporter depuis index.prod.ts pour compatibilité
export { default } from './index.prod.js';

