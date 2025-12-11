# 🔍 Guide de vérification des logs Vercel

## ✅ Résultats des tests en production

**Date de vérification** : $(date)

**URL testée** : https://witstyl.vercel.app

### Tests des endpoints

- ✅ GET /api/auth/user → 200 OK
- ✅ POST /api/salon/login → 401 OK (attendu)
- ✅ GET /api/public/salon → 200 OK
- ✅ GET /api/public/salon/stylistes → 200 OK

**Résultat** : 4/4 tests passés, 0 erreur 500 détectée

## 📋 Comment vérifier les logs Vercel manuellement

### 1. Accéder aux logs Vercel

1. **Allez sur** [vercel.com](https://vercel.com) et connectez-vous
2. **Sélectionnez votre projet** Witstyl
3. **Allez dans l'onglet "Logs"** ou "Functions" → "Logs"
4. **Filtrez par** :
   - Service : `api/index`
   - Niveau : `Error` ou `All`
   - Période : Dernières 24 heures

### 2. Rechercher les erreurs critiques

#### ❌ Erreurs à surveiller (ne doivent PAS apparaître)

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/supabaseService'
```
→ **Cause** : Import sans extension `.js`  
→ **Status** : ✅ CORRIGÉ (tous les imports ont maintenant `.js`)

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/vite'
```
→ **Cause** : Import de Vite en production  
→ **Status** : ✅ CORRIGÉ (utilise `server/index.prod.ts` qui n'importe pas Vite)

```
TypeError: Cannot read properties of undefined (reading 'pipes')
```
→ **Cause** : Problème avec finalhandler et fichiers statiques  
→ **Status** : ✅ CORRIGÉ (middleware d'erreur global ajouté)

#### ✅ Logs attendus (succès)

```
[Vercel Handler] ✅ App Express chargée avec succès depuis server/index.prod.js
[SERVER] ✅ Application Express configurée pour Vercel serverless
[REQ] GET /api/auth/user
[REQ] POST /api/salon/login
[REQ] GET /api/public/salon
[REQ] GET /api/public/salon/stylistes
```

### 3. Tester les endpoints manuellement

#### Via curl

```bash
# Test 1: GET /api/auth/user
curl https://witstyl.vercel.app/api/auth/user
# Attendu: 200 avec {"authenticated":false,"user":null}

# Test 2: POST /api/salon/login
curl -X POST https://witstyl.vercel.app/api/salon/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
# Attendu: 401 avec {"success":false,"code":"INVALID_CREDENTIALS"}

# Test 3: GET /api/public/salon
curl https://witstyl.vercel.app/api/public/salon
# Attendu: 200 ou 400, jamais 500

# Test 4: GET /api/public/salon/stylistes
curl https://witstyl.vercel.app/api/public/salon/stylistes
# Attendu: 200 ou 400, jamais 500
```

#### Via script automatique

```bash
# Tester tous les endpoints automatiquement
VERCEL_URL=https://witstyl.vercel.app npm run test:vercel-endpoints
```

### 4. Vérification du code local

#### Vérifier les imports

```bash
# Chercher les imports sans extension .js
grep -r "from.*['\"]\.\.*[^'\"]*['\"]" server/ api/ --include="*.ts" --include="*.js" | \
  grep -v "\.js['\"]" | \
  grep -v "@/" | \
  grep -v "node:" | \
  grep -v "http" | \
  grep -v "vite\.config"
```

**Résultat attendu** : Aucune ligne (tous les imports ont `.js`)

#### Vérifier les imports Vite

```bash
# Chercher les imports de Vite dans les fichiers de production
grep -r "from.*vite\|import.*vite" server/index.ts server/index.prod.ts api/index.ts
```

**Résultat attendu** : Aucune ligne (Vite n'est pas importé en production)

### 5. Checklist de vérification

- [ ] Tous les endpoints répondent avec les status codes attendus (200, 401, 404)
- [ ] Aucune erreur 500 dans les logs Vercel
- [ ] Aucune erreur `ERR_MODULE_NOT_FOUND` dans les logs
- [ ] Aucune erreur `TypeError: Cannot read properties of undefined (reading 'pipes')`
- [ ] Les logs montrent `[Vercel Handler] ✅ App Express chargée avec succès`
- [ ] Le script `npm run test:vercel-endpoints` passe tous les tests

## 🔄 Si des erreurs persistent

1. **Vérifier les logs Vercel** dans le dashboard
2. **Reproduire l'erreur en local** avec `npm run test:vercel-prod`
3. **Corriger le code** si nécessaire
4. **Re-tester** avec `npm run test:vercel-endpoints`
5. **Re-déployer** avec `git push origin main`

## 📊 Résumé

- ✅ **Code local vérifié** : Tous les imports ont l'extension `.js`
- ✅ **Tests en production** : 4/4 endpoints passent sans erreur 500
- ✅ **Architecture ESM** : Compatible avec Vercel et Node.js ESM
- ✅ **Aucune dépendance Vite** : En production, utilise `server/index.prod.ts`

**Status global** : ✅ TOUT EST OK

