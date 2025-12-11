# Fix : Erreur Cannot find module '/var/task/server/supabaseService' sur Vercel

## 🎯 Problème identifié

L'erreur `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/supabaseService'` se produisait parce que :

1. **Vercel compile directement les fichiers TypeScript** en ESM (ES Modules)
2. Avec `"type": "module"` dans `package.json`, Node.js en ESM **nécessite les extensions `.js`** dans les imports, même pour les fichiers TypeScript
3. Les imports sans extension `.js` fonctionnent en local avec `tsx` mais échouent sur Vercel avec le runtime Node.js ESM

## ✅ Solution mise en place

### Corrections apportées

#### 1. `server/index.ts` - Ligne 58 et 71
- **Avant** : `import { hasOpenAI } from "./config-direct";`
- **Après** : `import { hasOpenAI } from "./config-direct.js";`

- **Avant** : `import { SalonAuthService, ClientAuthService, supabaseAdmin } from "./supabaseService";`
- **Après** : `import { SalonAuthService, ClientAuthService, supabaseAdmin } from "./supabaseService.js";`

#### 2. `server/clientAuth.ts` - Ligne 2
- **Avant** : `import { supabaseAdmin } from "./supabaseService";`
- **Après** : `import { supabaseAdmin } from "./supabaseService.js";`

#### 3. `server/core/notifications/index.ts` - Lignes 90-95
- **Avant** : Imports sans extension `.js`
- **Après** : Tous les imports relatifs ont maintenant l'extension `.js`
  - `./NotificationService` → `./NotificationService.js`
  - `../../infrastructure/sms/ClickSendSmsProvider` → `../../infrastructure/sms/ClickSendSmsProvider.js`
  - `../../infrastructure/email/ResendEmailProvider` → `../../infrastructure/email/ResendEmailProvider.js`
  - `./types` → `./types.js`
  - `./NotificationSettingsRepository` → `./NotificationSettingsRepository.js`

#### 4. `server/core/appointments/AppointmentService.ts` - Lignes 2-3
- **Avant** : Imports sans extension `.js`
- **Après** : Tous les imports relatifs ont maintenant l'extension `.js`
  - `../notifications/NotificationService` → `../notifications/NotificationService.js`
  - `../notifications/utils` → `../notifications/utils.js`

## 📋 Architecture finale

### Point d'entrée Vercel
```
api/index.ts
  └─> import('../server/index.prod.js')
      └─> server/index.prod.ts
          └─> import('./index.js')
              └─> server/index.ts
                  ├─> import('./supabaseService.js') ✅
                  ├─> import('./clientAuth.js') ✅
                  ├─> import('./config-direct.js') ✅
                  └─> import('./core/notifications/index.js') ✅
                      └─> Tous les imports avec .js ✅
```

### Mode de module
- **package.json** : `"type": "module"` → ESM
- **Tous les imports relatifs** : Extension `.js` requise pour ESM
- **Vercel** : Compile TypeScript → JavaScript ESM, nécessite les extensions `.js`

## ✅ Tests validés

- ✅ `npm run build` → Succès
- ✅ `npm run test:api-prod` → 7/7 tests passés
- ✅ `npm run test:vercel-prod` → 7/7 tests passés
- ✅ Import du module production → Succès
- ✅ Tous les endpoints API répondent correctement
- ✅ Fichiers statiques renvoient 404 proprement sans crash

## 🚀 Commandes pour le déploiement

```bash
# 1. Vérifier l'état du repo
git status

# 2. Ajouter les fichiers modifiés
git add server/index.ts server/clientAuth.ts server/core/notifications/index.ts server/core/appointments/AppointmentService.ts

# 3. Commit
git commit -m "fix: stabilize server imports for Vercel (supabaseService, prod entrypoint)

- Ajouter extension .js aux imports relatifs pour compatibilité ESM Vercel
- Corriger import supabaseService dans server/index.ts et server/clientAuth.ts
- Corriger imports dans server/core/notifications/index.ts
- Corriger imports dans server/core/appointments/AppointmentService.ts
- Tous les imports relatifs ont maintenant l'extension .js requise par ESM
- Tous les tests passent (test:api-prod et test:vercel-prod)"

# 4. Push
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

#### ❌ Logs à surveiller (erreurs)

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/supabaseService'
→ Ne devrait plus se produire avec les extensions .js

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/vite'
→ Ne devrait plus se produire (déjà corrigé précédemment)

[Vercel Handler] ❌ Erreur lors du chargement de l'app
→ Vérifier les logs détaillés dans la stack trace
```

### 2. Tester les endpoints critiques

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

## ✅ Résultat attendu

- ✅ Aucune erreur `ERR_MODULE_NOT_FOUND` sur Vercel
- ✅ Tous les endpoints API répondent (200, 401, 404, etc.) mais jamais 500
- ✅ Les fichiers statiques renvoient 404 proprement sans crash
- ✅ Le développement local continue de fonctionner avec Vite
- ✅ Tous les tests passent en local

## 🔍 Pourquoi cette solution fonctionne

1. **Compatibilité ESM** : Avec `"type": "module"`, Node.js en ESM nécessite les extensions `.js` dans les imports
2. **Vercel compile TypeScript** : Vercel compile `.ts` → `.js`, donc les imports doivent pointer vers `.js`
3. **tsx en local** : `tsx` résout automatiquement les imports sans extension, mais Vercel utilise Node.js natif qui nécessite les extensions
4. **Tous les imports critiques corrigés** : Les fichiers chargés au démarrage ont tous leurs imports avec extension `.js`

