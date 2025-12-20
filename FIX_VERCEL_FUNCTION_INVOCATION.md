# 🔧 Fix : FUNCTION_INVOCATION_FAILED sur Vercel

## 🐛 Problème

L'erreur `FUNCTION_INVOCATION_FAILED` sur Vercel indique que la fonction serverless échoue au démarrage ou lors de l'exécution.

## ✅ Corrections apportées

### 1. Désactivation de `printEnvStatus()` sur Vercel

**Problème :** `printEnvStatus()` s'exécute au top-level et peut échouer si des variables sont manquantes.

**Solution :** Skip cette vérification sur Vercel.

```typescript
// Avant
printEnvStatus();

// Après
if (!process.env.VERCEL) {
  printEnvStatus();
}
```

### 2. Gestion du serveur HTTP sur Vercel

**Problème :** `createServer(app)` est créé même sur Vercel où il n'est pas nécessaire.

**Solution :** Ne créer le serveur HTTP que si on n'est pas sur Vercel.

```typescript
// Avant
const server = createServer(app);

// Après
const server = process.env.VERCEL ? null : createServer(app);
```

### 3. Configuration des fichiers statiques sur Vercel

**Problème :** `serveStatic(app)` peut échouer si le dossier `dist` n'existe pas ou n'est pas accessible.

**Solution :** Skip la configuration des fichiers statiques sur Vercel.

```typescript
if (process.env.VERCEL) {
  // Sur Vercel, on ne fait rien ici - Vercel gère le routing
  console.log('[SERVER] ✅ Application Express configurée pour Vercel serverless');
} else if (process.env.NODE_ENV === 'production') {
  serveStatic(app);
}
```

### 4. Handler Vercel amélioré avec gestion d'erreurs

**Problème :** L'import direct peut échouer si le code s'exécute au top-level.

**Solution :** Import dynamique avec gestion d'erreurs.

```typescript
// api/index.ts
let app: any = null;

async function getApp() {
  if (!app) {
    try {
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
      });
    }
  }
}
```

## 📋 Fichiers modifiés

1. **`server/index.ts`**
   - Skip `printEnvStatus()` sur Vercel
   - Création conditionnelle du serveur HTTP
   - Configuration conditionnelle des fichiers statiques

2. **`api/index.ts`**
   - Import dynamique de l'app Express
   - Gestion d'erreurs améliorée
   - Wrapper pour éviter les erreurs au top-level

## 🧪 Tests à effectuer

### Après déploiement :

1. **Tester le login** sur `https://witstyl.vercel.app/salon-login`
2. **Vérifier les logs Vercel** :
   - Vercel Dashboard > Deployments > [Dernier déploiement] > Functions
   - Chercher les logs pour `/api/salon/login`
3. **Vérifier que l'erreur `FUNCTION_INVOCATION_FAILED` n'apparaît plus**

## 🔍 Debug supplémentaire

Si le problème persiste :

1. **Vérifier les variables d'environnement** dans Vercel Dashboard
2. **Vérifier les logs Vercel** pour voir l'erreur exacte
3. **Vérifier que `vercel.json` est correct**
4. **Vérifier que `api/index.ts` est bien compilé**

## 📝 Notes

- ✅ Le code ne s'exécute plus au top-level de manière bloquante sur Vercel
- ✅ Les imports sont maintenant dynamiques pour éviter les erreurs au démarrage
- ✅ La gestion d'erreurs est améliorée avec des messages informatifs
- ✅ Le serveur HTTP n'est plus créé sur Vercel (inutile)



