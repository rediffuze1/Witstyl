// Handler serverless pour Vercel
// Ce fichier exporte l'application Express pour Vercel
// Vercel utilisera ce fichier comme point d'entrée pour les fonctions serverless

// Import dynamique pour éviter les erreurs au top-level
let app: any = null;

async function getApp() {
  if (!app) {
    try {
      // S'assurer que VERCEL est défini pour éviter les initialisations inutiles
      process.env.VERCEL = '1';
      process.env.NODE_ENV = 'production';
      
      // Utiliser le point d'entrée production dédié (index.prod.ts)
      // Ce fichier garantit qu'aucune dépendance à Vite n'est chargée
      const serverModule = await import('../server/index.prod.js');
      app = serverModule.default;
      
      if (!app) {
        throw new Error('L\'app Express n\'a pas été exportée correctement depuis server/index.prod.js');
      }
      
      console.log('[Vercel Handler] ✅ App Express chargée avec succès depuis server/index.prod.js');
    } catch (error: any) {
      console.error('[Vercel Handler] ❌ Erreur lors du chargement de l\'app:', error.message);
      console.error('[Vercel Handler] Code:', error.code);
      if (error.stack) {
        console.error('[Vercel Handler] Stack:', error.stack.split('\n').slice(0, 10).join('\n'));
      }
      throw error;
    }
  }
  return app;
}

// Handler pour Vercel serverless functions
export default async function handler(req: any, res: any) {
  try {
    const expressApp = await getApp();
    return expressApp(req, res);
  } catch (error: any) {
    console.error('[Vercel Handler] Erreur lors du traitement de la requête:', error);
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

