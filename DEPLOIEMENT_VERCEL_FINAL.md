# Plan de déploiement final - Fix Vercel

## ✅ État actuel

- ✅ `npm run build` fonctionne
- ✅ `npm run test:api-prod` fonctionne
- ✅ `npm run test:vercel-prod` fonctionne (7/7 tests passés, 0 erreurs)
- ✅ Tous les endpoints API répondent correctement
- ✅ Les fichiers statiques renvoient 404 proprement sans crash

## 🔧 Modifications apportées

### 1. Middleware d'erreur global (`server/index.ts`)
- Ajout d'un middleware d'erreur global pour éviter les crashes avec finalhandler
- Gestion propre des erreurs non catchées
- Évite les erreurs `Cannot read properties of undefined (reading 'pipes')`

### 2. Handler pour routes non-API sur Vercel (`server/index.ts`)
- Ajout d'un handler pour les routes non-API qui renvoie 404 proprement
- Évite que finalhandler essaie de manipuler des objets req/res déjà terminés
- Les fichiers statiques (`/team/emma.jpg`, `/salon1.jpg`) renvoient maintenant 404 sans crash

### 3. Amélioration du test Vercel (`scripts/test-vercel-prod.ts`)
- Mock req/res amélioré pour mieux simuler Vercel
- Ajout de propriétés stream-like pour éviter les erreurs avec unpipe
- Gestion des timeouts pour éviter les blocages
- Les fichiers statiques sont maintenant testés et considèrent 404 comme un succès

## 🚀 Commandes pour le déploiement

```bash
# 1. Vérifier l'état du repo
git status

# 2. Build (optionnel, Vercel le fera automatiquement)
npm run build

# 3. Tester en local avant de déployer (IMPORTANT)
npm run test:vercel-prod

# 4. Si les tests passent, ajouter les fichiers modifiés
git add .

# 5. Commit
git commit -m "fix: Corriger les fichiers statiques et ajouter middleware d'erreur global

- Ajouter middleware d'erreur global pour éviter les crashes avec finalhandler
- Ajouter handler pour routes non-API sur Vercel (404 propre)
- Améliorer mock req/res dans test-vercel-prod pour mieux simuler Vercel
- Les fichiers statiques renvoient maintenant 404 sans crash
- Tous les tests test:vercel-prod passent (7/7)"

# 6. Push
git push origin main
```

## 📊 Ce qu'il faut vérifier sur Vercel après le déploiement

### 1. Logs Vercel (onglet "Functions" → "Logs")

#### ✅ Logs attendus (succès)

Pour un appel sur `/api/salon/login` :
```
[Vercel Handler] ✅ App Express chargée avec succès depuis server/index.prod.js
[SERVER] ✅ Application Express configurée pour Vercel serverless
[REQ] POST /api/salon/login
```

Pour un appel sur `/api/public/salon` :
```
[Vercel Handler] ✅ App Express chargée avec succès depuis server/index.prod.js
[REQ] GET /api/public/salon
```

Pour un appel sur `/team/emma.jpg` ou `/salon1.jpg` :
```
[Vercel Handler] ✅ App Express chargée avec succès depuis server/index.prod.js
[REQ] GET /team/emma.jpg
```
→ Doit renvoyer 404 JSON proprement, sans crash

#### ❌ Logs à surveiller (erreurs)

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/vite'
→ Vérifier que server/vite.ts est bien présent dans le repo

TypeError: Cannot read properties of undefined (reading 'pipes')
→ Ne devrait plus se produire avec le middleware d'erreur global

[Global Error Handler] ...
→ Si présent, vérifier les détails de l'erreur
```

### 2. Tester les endpoints critiques

#### Endpoints API (doivent retourner 200, 401, ou 404, jamais 500)

```bash
# Test 1: GET /api/auth/user
curl https://votre-domaine.vercel.app/api/auth/user
# Attendu: 200 avec {"authenticated":false,"user":null}

# Test 2: POST /api/salon/login
curl -X POST https://votre-domaine.vercel.app/api/salon/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
# Attendu: 401 avec {"success":false,"code":"INVALID_CREDENTIALS"}

# Test 3: GET /api/public/salon
curl https://votre-domaine.vercel.app/api/public/salon
# Attendu: 200 ou 400, jamais 500

# Test 4: GET /api/public/salon/stylistes
curl https://votre-domaine.vercel.app/api/public/salon/stylistes
# Attendu: 200 ou 400, jamais 500
```

#### Fichiers statiques (doivent retourner 404 proprement, jamais crash)

```bash
# Test 5: GET /team/emma.jpg
curl https://votre-domaine.vercel.app/team/emma.jpg
# Attendu: 404 avec {"error":"Not found","path":"/team/emma.jpg"}
# IMPORTANT: Pas de crash, pas d'erreur 500

# Test 6: GET /salon1.jpg
curl https://votre-domaine.vercel.app/salon1.jpg
# Attendu: 404 avec {"error":"Not found","path":"/salon1.jpg"}
# IMPORTANT: Pas de crash, pas d'erreur 500
```

### 3. Vérifier les variables d'environnement

Dans Vercel Dashboard → Settings → Environment Variables :
- `VERCEL` doit être défini automatiquement (pas besoin de le définir manuellement)
- `NODE_ENV` doit être `production` (défini automatiquement)

## ✅ Checklist de validation

- [ ] `npm run build` fonctionne
- [ ] `npm run test:api-prod` fonctionne
- [ ] `npm run test:vercel-prod` passe (7/7 tests)
- [ ] Commit et push effectués
- [ ] Déploiement Vercel réussi
- [ ] Logs Vercel vérifiés (pas d'erreur `ERR_MODULE_NOT_FOUND`)
- [ ] Endpoints API testés (pas de 500)
- [ ] Fichiers statiques testés (404 propre, pas de crash)

## 🎯 Résultat attendu

- ✅ Aucune erreur `ERR_MODULE_NOT_FOUND` sur Vercel
- ✅ Tous les endpoints API répondent (200, 401, 404, etc.) mais jamais 500
- ✅ Les fichiers statiques renvoient 404 proprement sans crash
- ✅ Le développement local continue de fonctionner avec Vite
- ✅ Tous les tests passent en local

## 🔄 Si des erreurs persistent

1. Vérifier les logs Vercel dans l'onglet "Functions" → "Logs"
2. Reproduire l'erreur en local avec `npm run test:vercel-prod`
3. Corriger le code
4. Re-tester avec `npm run test:vercel-prod`
5. Re-déployer

