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
      const serverModule = await import('../server/index.js');
      app = serverModule.default;
    } catch (error: any) {
      console.error('[Vercel Handler] Erreur lors du chargement de l\'app:', error);
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

