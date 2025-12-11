# Fix définitif : Erreur Cannot find module '/var/task/server/vite' sur Vercel

## 🎯 Problème identifié

L'erreur `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/vite'` se produisait parce que :

1. **Vercel compile directement les fichiers TypeScript** dans `/var/task/server/`
2. Le fichier `server/vite.ts` (stub) doit être présent dans le bundle compilé
3. Si un import vers `./vite` existe quelque part dans le code, Vercel doit pouvoir le résoudre

## ✅ Solution mise en place

### 1. Structure DEV/PROD claire

- **`server/devServer.ts`** : Point d'entrée développement avec Vite
  - Utilise `server/vite.dev.ts` (implémentation réelle de Vite)
  - Utilisé uniquement via `npm run dev`
  - Jamais importé par Vercel

- **`server/prod.ts`** : Point d'entrée PRODUCTION pour Vercel
  - Force `VERCEL=1` et `NODE_ENV=production` avant tout import
  - Importe `server/index.ts` qui ne dépend pas de Vite
  - Utilisé par `api/index.ts` (handler Vercel)

- **`server/vite.ts`** : Stub pour la production
  - Exporte des fonctions vides (`setupVite`, `serveStatic`, `log`)
  - Présent dans le bundle pour éviter l'erreur `ERR_MODULE_NOT_FOUND`
  - Ne fait rien en production

- **`server/vite.dev.ts`** : Implémentation réelle de Vite
  - Utilisé uniquement par `devServer.ts`
  - Jamais importé en production

### 2. Handler Vercel modifié

**`api/index.ts`** :
- Utilise maintenant `server/prod.js` au lieu de `server/index.js`
- Force les variables d'environnement de production
- Gestion d'erreurs améliorée avec logs détaillés

### 3. Scripts de test

- **`scripts/test-prod-import.ts`** : Test simple d'import du module production
- **`scripts/test-api-prod.ts`** : Tests complets de tous les endpoints en mode production simulé
- **`npm run test:api-prod`** : Commande pour lancer les tests

## 📋 Checklist de vérification

### Avant déploiement

- [x] `server/vite.ts` existe et exporte les fonctions stub
- [x] `server/prod.ts` existe et force les variables de production
- [x] `api/index.ts` utilise `server/prod.js`
- [x] Aucun import direct de `./vite` dans `server/index.ts`
- [x] `server/devServer.ts` utilise `vite.dev.ts` (pas `vite.ts`)

### Tests en local (mode production simulé)

```bash
# Test d'import du module production
npm run test:api-prod

# Ou test manuel
NODE_ENV=production VERCEL=1 npx tsx scripts/test-prod-import.ts
```

### Endpoints à tester

1. ✅ `GET /api/auth/user` (non authentifié → 200 OK)
2. ✅ `POST /api/salon/login` (avec payload test → 401 OK si credentials invalides)
3. ✅ `GET /api/public/salon` (→ 200 ou 400, pas 500)
4. ✅ `GET /api/public/salon/stylistes` (→ 200 ou 400, pas 500)
5. ✅ `GET /api/reviews/google` (→ 200 ou 404, pas 500)
6. ✅ `GET /team/emma.jpg` (fichier statique → 200 ou 404, pas 500)
7. ✅ `GET /salon1.jpg` (fichier statique → 200 ou 404, pas 500)

## 🔍 Comment reproduire en local un environnement "comme Vercel"

```bash
# 1. Build du frontend
npm run build

# 2. Tester l'import du module production
NODE_ENV=production VERCEL=1 npx tsx scripts/test-prod-import.ts

# 3. Tester tous les endpoints
npm run test:api-prod
```

## 📊 Logs Vercel à vérifier après déploiement

### ✅ Logs attendus (succès)

```
[Vercel Handler] Chargement de l'app...
[SERVER] ✅ Application Express configurée pour Vercel serverless
[Vercel Handler] App chargée avec succès
```

### ❌ Logs à surveiller (erreurs)

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/vite'
→ Vérifier que server/vite.ts est bien présent dans le repo

[Vercel Handler] Erreur lors du chargement de l'app
→ Vérifier les logs détaillés dans la stack trace

FUNCTION_INVOCATION_FAILED
→ Vérifier que tous les imports sont corrects
```

## 🚀 Commandes utilisées

```bash
# Build
npm run build

# Test d'import
npm run test:api-prod

# Vérification TypeScript
npm run check
```

## 📝 Fichiers modifiés

1. **`server/prod.ts`** (nouveau) : Point d'entrée production
2. **`api/index.ts`** : Utilise maintenant `server/prod.js`
3. **`server/vite.ts`** : Stub pour éviter l'erreur module not found
4. **`server/vite.dev.ts`** : Implémentation réelle pour le dev
5. **`server/devServer.ts`** : Utilise `vite.dev.ts`
6. **`scripts/test-api-prod.ts`** (nouveau) : Script de test
7. **`scripts/test-prod-import.ts`** (nouveau) : Test d'import simple
8. **`package.json`** : Ajout script `test:api-prod`

## ✅ Résultat attendu

- ✅ Aucune erreur `ERR_MODULE_NOT_FOUND` sur Vercel
- ✅ Tous les endpoints API répondent (200, 401, 404, etc.) mais jamais 500
- ✅ Les fichiers statiques sont servis correctement
- ✅ Le développement local continue de fonctionner avec Vite

## 🔄 Itération et améliorations

Si des erreurs persistent après déploiement :

1. Vérifier les logs Vercel dans l'onglet "Functions" → "Logs"
2. Reproduire l'erreur en local avec `NODE_ENV=production VERCEL=1`
3. Corriger le code
4. Re-tester avec `npm run test:api-prod`
5. Re-déployer

