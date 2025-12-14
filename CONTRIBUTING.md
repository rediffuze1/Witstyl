# 🤝 Guide de Contribution - Witstyl

**Règles non négociables pour les contributions**

Ce document liste les règles strictes à respecter pour toute modification du code.

---

## ⚠️ Règles ABSOLUES (non négociables)

### 1. ESM Strict - Imports relatifs avec `.js`

**❌ INTERDIT :**
```typescript
import { x } from './module';
import { y } from '../utils/helper';
```

**✅ OBLIGATOIRE :**
```typescript
import { x } from './module.js';
import { y } from '../utils/helper.js';
```

**Pourquoi ?** Vercel transpile TS→JS sans réécrire les specifiers. Node.js ESM exige `.js` pour les imports relatifs.

**Vérification :**
```bash
npm run check:esm
```

---

### 2. Architecture Vercel Serverless

#### ❌ INTERDIT dans `api/index.ts` :
- `await import()` au top-level
- Initialisation DB/session au chargement du module
- Imports dynamiques non nécessaires

#### ✅ OBLIGATOIRE :
- Imports statiques uniquement
- Guard non-API : `if (!path.startsWith('/api/')) return 404;`
- Routes publiques via `getPublicApp()` (DB-free)
- Routes protégées via `getFullApp()` (lazy init)

#### ❌ INTERDIT ailleurs :
- Lazy init (`await import()`) ailleurs que dans `server/index.prod.ts`
- Routes publiques qui importent DB/session

---

### 3. Routes Publiques DB-Free

**Routes publiques** (`/api/public/*`, `/api/reviews/google`) :
- ✅ Utilisent `publicApp` (via `server/publicApp.ts`)
- ✅ Utilisent `publicIsolated.ts` (router isolé)
- ✅ Utilisent uniquement Supabase REST API
- ❌ N'importent JAMAIS : `db/client`, `sessionStore`, `index.prod`

**Vérification :**
```bash
# Vérifier qu'aucune route publique n'importe DB
grep -r "from.*db/client" server/routes/publicIsolated.ts
# Devrait retourner vide
```

---

### 4. Configuration Cookie/Session

**Obligatoire en production (Vercel) :**
```typescript
app.set('trust proxy', 1); // AVANT session()
```

**Cookie config :**
- `secure`: Détecté via `isRequestSecure(req)` (req.secure + x-forwarded-proto)
- `sameSite`: 'lax' par défaut, 'none' si cross-domain
- ❌ Ne JAMAIS forcer `https` par défaut (utiliser `isRequestSecure()`)

**Middleware unique :**
- Config cookie modifiée UNIQUEMENT dans un middleware après `session()`
- ❌ Ne PAS modifier `req.session.cookie.*` dans les routes

---

### 5. Timeouts PostgreSQL

**Obligatoire pour toutes les opérations DB :**
```typescript
connectionTimeoutMillis: 3000  // 3s max
query_timeout: 3000            // 3s max
idleTimeoutMillis: 10000        // 10s max
```

**SSL pour Supabase pooler :**
```typescript
ssl: { rejectUnauthorized: false }  // Obligatoire pour Supabase
```

**Time-boxed operations :**
- Toute opération DB doit être dans `Promise.race()` avec timeout
- Si DB KO : répondre 503 en < 1s (pas 30s)

---

## ✅ Checklist avant PR

Avant de créer une Pull Request, exécutez :

```bash
# 1. Vérifier les imports ESM
npm run check:esm

# 2. Build
npm run build

# 3. Smoke test post-build
npm run smoke:dist

# 4. Tests Vercel (simulation production)
npm run test:vercel-prod

# 5. TypeScript check
npm run check
```

**Tous doivent passer ✅**

---

## 📋 Checklist de Code Review

### Backend (`server/`, `api/`)

- [ ] Tous les imports relatifs utilisent `.js`
- [ ] Aucun `await import()` dans `api/index.ts`
- [ ] Routes publiques n'importent pas DB/session
- [ ] `trust proxy` configuré en prod
- [ ] Opérations DB time-boxées (3s max)
- [ ] SSL configuré pour Supabase pooler
- [ ] Session cookie configurée via middleware unique

### Frontend (`client/`)

- [ ] `credentials: "include"` sur toutes les requêtes API
- [ ] Gestion d'erreurs 401 → redirect login
- [ ] Timeout client-side (10s max) pour requêtes longues

### Tests

- [ ] Tests utilisent vrai serveur HTTP (pas de mocks `res`)
- [ ] Tests simulent HTTPS via `X-Forwarded-Proto: https`
- [ ] Tous les tests passent (7/7)

---

## 🚫 Ce qu'il ne faut JAMAIS faire

1. ❌ Enlever `.js` des imports relatifs TypeScript
2. ❌ Ajouter `await import()` dans `api/index.ts`
3. ❌ Importer DB/session dans routes publiques
4. ❌ Forcer `https` par défaut (utiliser `isRequestSecure()`)
5. ❌ Modifier cookie config à plusieurs endroits
6. ❌ Opérations DB sans timeout
7. ❌ CommonJS (`require`, `module.exports`)

---

## 📚 Ressources

- **Architecture complète** : `ARCHITECTURE_GUIDE.md`
- **Scripts de test** : `scripts/test-vercel-prod.ts`
- **Vérification ESM** : `scripts/check-esm-imports.ts`

---

## 🐛 En cas de problème

1. **ERR_MODULE_NOT_FOUND** : Vérifier avec `npm run check:esm`
2. **Timeout 30s** : Vérifier timeouts DB (3s max)
3. **Cookie non émis** : Vérifier `trust proxy` + `isRequestSecure()`
4. **Tests échouent** : Vérifier que tests utilisent vrai serveur HTTP

---

**Dernière mise à jour** : Après correction des red flags ESM/cookies (7/7 tests ✅)
