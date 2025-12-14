# 🍪 Stratégie Sessions/Cookies - Dev vs Prod vs Tests

## 📋 Problème identifié

Les tests échouent car la configuration cookie n'est pas adaptée aux différents environnements :

- **Local dev (HTTP)** : `secure: false`, `sameSite: 'lax'`
- **Tests (simulation Vercel)** : `secure: true`, `sameSite: 'lax'` (mais peut nécessiter `'none'`)
- **Vercel prod (HTTPS + proxy)** : `secure: true`, `sameSite: 'lax'` (même domaine) ou `'none'` (cross-domain)

## 🎯 Stratégie proposée

### 1. Détection d'environnement robuste

```typescript
// server/index.ts
const isVercel = !!process.env.VERCEL;
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.VERCEL === '1'; // Tests simulent Vercel
const isHTTPS = isVercel || (isProduction && !process.env.FORCE_HTTP);

// Détection du protocole réel depuis les headers (plus fiable)
const detectProtocol = (req: Request): 'http' | 'https' => {
  // Sur Vercel, X-Forwarded-Proto est toujours 'https'
  if (isVercel) return 'https';
  
  // En dev local, toujours HTTP
  if (!isProduction) return 'http';
  
  // En prod, vérifier le header (si trust proxy est activé)
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (forwardedProto === 'https') return 'https';
  
  return 'http';
};
```

### 2. Configuration cookie adaptative

```typescript
// server/index.ts
function getCookieConfig(req: Request) {
  const protocol = detectProtocol(req);
  const isSecure = protocol === 'https';
  
  // SameSite strategy
  let sameSite: 'lax' | 'none' | 'strict' = 'lax';
  
  // Cross-domain : nécessite 'none' + secure
  if (isVercel && process.env.FRONTEND_DOMAIN && 
      process.env.FRONTEND_DOMAIN !== req.headers.host) {
    sameSite = 'none';
  }
  
  // Tests : utiliser 'lax' si même domaine simulé
  if (isTest && !process.env.FRONTEND_DOMAIN) {
    sameSite = 'lax';
  }
  
  return {
    secure: isSecure,
    sameSite,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
    domain: undefined,
  };
}
```

### 3. Trust proxy conditionnel

```typescript
// server/index.ts
// Trust proxy : OBLIGATOIRE sur Vercel, optionnel en dev si proxy local
if (isVercel || isProduction) {
  app.set('trust proxy', 1);
} else {
  // Dev local : pas de proxy
  app.set('trust proxy', 0);
}
```

### 4. Sauvegarde de session explicite

```typescript
// server/index.ts - Route /api/salon/login
// Après authentification réussie
req.session.user = { ... };

// Sauvegarder explicitement AVANT de répondre
await new Promise<void>((resolve, reject) => {
  req.session.save((err) => {
    if (err) {
      console.error('[salon/login] Erreur sauvegarde session:', err);
      reject(err);
    } else {
      resolve();
    }
  });
});

// Vérifier que Set-Cookie est présent
const setCookie = res.getHeader('Set-Cookie');
if (!setCookie) {
  console.error('[salon/login] ⚠️  Set-Cookie absent après save()');
  // Ne pas échouer, mais logger
}
```

## 🔧 Corrections à apporter

### Fichier 1: `server/index.ts`

**Problème actuel :**
- `isHTTPS` basé uniquement sur `isVercel || isProduction`
- Pas de détection du protocole réel depuis les headers
- `cookieSameSite` calculé une seule fois au boot (pas adaptatif)

**Solution :**
- Détecter le protocole depuis `X-Forwarded-Proto` (si trust proxy activé)
- Calculer `sameSite` de manière adaptative selon l'environnement
- Forcer `secure: false` en dev local même si `NODE_ENV=production` pour tests

### Fichier 2: `scripts/test-vercel-prod.ts`

**Problème actuel :**
- Simule Vercel avec `VERCEL=1` et `NODE_ENV=production`
- Mais les cookies peuvent ne pas être émis car `secure: true` sur HTTP local

**Solution :**
- Ajouter header `X-Forwarded-Proto: https` dans les tests
- Ou forcer `secure: false` en mode test via variable d'environnement

## 📝 Plan d'action

1. ✅ **Script `check:esm` créé** - Vérifie les imports ESM
2. ⏳ **Corriger config cookie** - Adapter selon environnement
3. ⏳ **Corriger tests** - Simuler correctement Vercel (headers HTTPS)
4. ⏳ **Valider** - Tests passent en local, dev, prod

---

**Prochaine étape :** Me fournir les logs exacts des 2 tests qui échouent pour identifier la cause précise.


