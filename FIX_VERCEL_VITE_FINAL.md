# Fix définitif : Erreur Cannot find module '/var/task/server/vite' sur Vercel

## 🎯 Résumé du problème

L'erreur `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/vite'` se produisait parce que :

1. **Vercel compile directement les fichiers TypeScript** dans `/var/task/server/`
2. Le fichier `server/vite.ts` (stub) doit être présent dans le bundle compilé
3. Si un import vers `./vite` existe quelque part dans le code, Vercel doit pouvoir le résoudre

## ✅ Solution mise en place

### Architecture DEV/PROD claire

#### Fichiers de développement (jamais utilisés par Vercel)
- **`server/devServer.ts`** : Point d'entrée développement avec Vite
  - Utilise `server/vite.dev.ts` (implémentation réelle de Vite)
  - Utilisé uniquement via `npm run dev`
  - Jamais importé par Vercel

- **`server/vite.dev.ts`** : Implémentation réelle de Vite
  - Utilisé uniquement par `devServer.ts`
  - Jamais importé en production

#### Fichiers de production (utilisés par Vercel)
- **`server/index.prod.ts`** (NOUVEAU) : Point d'entrée PRODUCTION PUR pour Vercel
  - Force `VERCEL=1` et `NODE_ENV=production` avant tout import
  - Importe `server/index.ts` qui n'a aucune dépendance à Vite
  - Utilisé par `api/index.ts` (handler Vercel)

- **`server/vite.ts`** : Stub pour la production
  - Exporte des fonctions vides (`setupVite`, `serveStatic`, `log`)
  - Présent dans le bundle pour éviter l'erreur `ERR_MODULE_NOT_FOUND`
  - Ne fait rien en production

- **`server/prod.ts`** : Réexporte `index.prod.ts` pour compatibilité

### Handler Vercel modifié

**`api/index.ts`** :
- Utilise maintenant `server/index.prod.js` au lieu de `server/prod.js`
- Force les variables d'environnement de production
- Gestion d'erreurs améliorée avec logs détaillés
- Vérifie que l'app est bien exportée

### Scripts de test créés

- **`scripts/test-prod-import.ts`** : Test simple d'import du module production
- **`scripts/test-api-prod.ts`** : Tests complets de tous les endpoints en mode production simulé
- **`scripts/test-vercel-prod.ts`** (NOUVEAU) : Test qui simule exactement le handler Vercel
- **`npm run test:api-prod`** : Commande pour lancer les tests API
- **`npm run test:vercel-prod`** (NOUVEAU) : Commande pour tester le handler Vercel

## 📋 Checklist de vérification

### Avant déploiement

- [x] `server/vite.ts` existe et exporte les fonctions stub
- [x] `server/index.prod.ts` existe et force les variables de production
- [x] `api/index.ts` utilise `server/index.prod.js`
- [x] Aucun import direct de `./vite` dans `server/index.ts`
- [x] `server/devServer.ts` utilise `vite.dev.ts` (pas `vite.ts`)

### Tests en local (mode production simulé)

```bash
# Test d'import du module production
NODE_ENV=production VERCEL=1 npx tsx scripts/test-prod-import.ts

# Tests complets de tous les endpoints
npm run test:api-prod

# Test du handler Vercel (simulation exacte)
npm run test:vercel-prod
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

# 4. Tester le handler Vercel (simulation exacte)
npm run test:vercel-prod
```

## 📊 Logs Vercel à vérifier après déploiement

### ✅ Logs attendus (succès)

```
[Vercel Handler] ✅ App Express chargée avec succès depuis server/index.prod.js
[SERVER] ✅ Application Express configurée pour Vercel serverless
```

### ❌ Logs à surveiller (erreurs)

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/vite'
→ Vérifier que server/vite.ts est bien présent dans le repo

[Vercel Handler] ❌ Erreur lors du chargement de l'app
→ Vérifier les logs détaillés dans la stack trace

FUNCTION_INVOCATION_FAILED
→ Vérifier que tous les imports sont corrects
```

## 🚀 Commandes pour le déploiement

```bash
# 1. Vérifier l'état du repo
git status

# 2. Build (optionnel, Vercel le fera automatiquement)
npm run build

# 3. Tester en local avant de déployer
npm run test:vercel-prod

# 4. Ajouter les fichiers modifiés
git add .

# 5. Commit
git commit -m "fix: Corriger définitivement l'erreur Cannot find module '/var/task/server/vite'

- Créer server/index.prod.ts comme point d'entrée production pur
- Modifier api/index.ts pour utiliser index.prod.js
- Ajouter script test:vercel-prod pour simuler Vercel
- S'assurer qu'aucun import de vite n'existe dans le code production"

# 6. Push
git push origin main
```

## 📝 Fichiers modifiés/créés

1. **`server/index.prod.ts`** (nouveau) : Point d'entrée production pur
2. **`api/index.ts`** : Utilise maintenant `server/index.prod.js`
3. **`server/prod.ts`** : Réexporte `index.prod.ts` pour compatibilité
4. **`server/vite.ts`** : Stub (déjà présent, vérifié)
5. **`server/vite.dev.ts`** : Implémentation réelle pour le dev (déjà présent)
6. **`server/devServer.ts`** : Utilise `vite.dev.ts` (déjà modifié)
7. **`scripts/test-vercel-prod.ts`** (nouveau) : Test du handler Vercel
8. **`package.json`** : Ajout script `test:vercel-prod`

## ✅ Résultat attendu

- ✅ Aucune erreur `ERR_MODULE_NOT_FOUND` sur Vercel
- ✅ Tous les endpoints API répondent (200, 401, 404, etc.) mais jamais 500
- ✅ Les fichiers statiques sont servis correctement
- ✅ Le développement local continue de fonctionner avec Vite

## 🔄 Itération et améliorations

Si des erreurs persistent après déploiement :

1. Vérifier les logs Vercel dans l'onglet "Functions" → "Logs"
2. Reproduire l'erreur en local avec `npm run test:vercel-prod`
3. Corriger le code
4. Re-tester avec `npm run test:vercel-prod`
5. Re-déployer

## 🎯 Pourquoi cette solution fonctionne

1. **Séparation claire DEV/PROD** : Le code de développement n'est jamais importé en production
2. **Point d'entrée production pur** : `server/index.prod.ts` garantit qu'aucune dépendance à Vite n'est chargée
3. **Stub présent** : `server/vite.ts` est présent dans le bundle pour éviter l'erreur si un import existe
4. **Handler Vercel optimisé** : `api/index.ts` utilise le point d'entrée production et gère les erreurs proprement
5. **Tests complets** : Les scripts de test permettent de valider en local avant le déploiement

