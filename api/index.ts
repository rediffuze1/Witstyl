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
      
      console.log('[Vercel Handler] 🔄 Chargement de l\'app Express depuis server/index.prod.js...');
      console.log('[Vercel Handler] Environnement:', {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        __dirname: typeof __dirname !== 'undefined' ? __dirname : 'undefined',
      });
      
      // Utiliser le point d'entrée production dédié (index.prod.ts)
      // Ce fichier garantit qu'aucune dépendance à Vite n'est chargée
      // IMPORTANT: Utiliser l'extension .js car Vercel compile TS → JS
      const serverModule = await import('../server/index.prod.js');
      
      console.log('[Vercel Handler] Module chargé, clés disponibles:', Object.keys(serverModule));
      
      app = serverModule.default || serverModule.app;
      
      if (!app) {
        console.error('[Vercel Handler] ❌ App non trouvée dans le module. Exports disponibles:', Object.keys(serverModule));
        throw new Error('L\'app Express n\'a pas été exportée correctement depuis server/index.prod.js. Exports disponibles: ' + Object.keys(serverModule).join(', '));
      }
      
      console.log('[Vercel Handler] ✅ App Express chargée avec succès depuis server/index.prod.js');
      console.log('[Vercel Handler] Type de l\'app:', typeof app);
    } catch (error: any) {
      console.error('[Vercel Handler] ❌ Erreur lors du chargement de l\'app:', error.message);
      console.error('[Vercel Handler] Code:', error.code);
      console.error('[Vercel Handler] Nom:', error.name);
      if (error.stack) {
        console.error('[Vercel Handler] Stack:', error.stack.split('\n').slice(0, 15).join('\n'));
      }
      // Ne pas throw ici - on veut retourner une erreur 500 propre
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

