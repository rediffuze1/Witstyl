# 🔧 Fix : FUNCTION_INVOCATION_FAILED sur Vercel - Login Production

## 🐛 Problème identifié

L'erreur `FUNCTION_INVOCATION_FAILED` sur Vercel lors du login était causée par :

1. **Throw au top-level dans `server/supabaseService.ts`** : Le fichier lançait une exception lors de l'import si les variables d'environnement n'étaient pas définies, ce qui faisait échouer l'import du module sur Vercel.

2. **Initialisation immédiate des clients Supabase** : Les clients Supabase étaient créés au top-level, ce qui pouvait échouer si les variables d'env n'étaient pas disponibles.

3. **Gestion d'erreurs incomplète** : Les erreurs n'étaient pas toujours catchées et ne renvoyaient pas toujours du JSON avec des codes d'erreur clairs.

## ✅ Corrections apportées

### 1. Initialisation lazy de Supabase (`server/supabaseService.ts`)

**Avant :**
```typescript
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL et SUPABASE_ANON_KEY doivent être configurés'); // ❌ Échoue au top-level
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {...});
```

**Après :**
```typescript
// Lazy initialization avec Proxy
function ensureSupabaseConfig() {
  // Vérification au moment de l'utilisation, pas au top-level
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variables d\'environnement Supabase manquantes...');
  }
  return { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient];
  },
});
```

**Bénéfices :**
- ✅ L'import du module ne peut plus échouer au top-level
- ✅ Les erreurs sont détectées au moment de l'utilisation, avec des messages clairs
- ✅ Compatible avec Vercel serverless functions

### 2. Amélioration de la route `/api/salon/login` (`server/index.ts`)

**Modifications :**
- ✅ Vérification explicite des variables d'environnement au début de la route
- ✅ Gestion d'erreurs avec codes spécifiques :
  - `INVALID_CREDENTIALS` : Email/mot de passe incorrect
  - `EMAIL_NOT_CONFIRMED` : Email non confirmé
  - `CONFIGURATION_ERROR` : Variables d'env manquantes
  - `SESSION_ERROR` : Problème de session
  - `SERVER_ERROR` : Erreur interne
- ✅ Toutes les réponses sont en JSON avec `Content-Type: application/json`
- ✅ Messages d'erreur clairs et en français

**Format de réponse d'erreur :**
```typescript
{
  success: false,
  code: "INVALID_CREDENTIALS",
  message: "Email ou mot de passe incorrect."
}
```

### 3. Amélioration de la gestion d'erreurs côté frontend (`client/src/hooks/useAuth.ts`)

**Modifications :**
- ✅ Utilisation des codes d'erreur du serveur
- ✅ Messages d'erreur plus informatifs
- ✅ Gestion gracieuse des erreurs de parsing JSON

### 4. Messages d'erreur améliorés dans `SalonAuthService.loginOwner`

**Modifications :**
- ✅ Messages d'erreur spécifiques selon le type d'erreur Supabase
- ✅ Utilisation de `maybeSingle()` au lieu de `single()` pour éviter les erreurs si aucun salon
- ✅ Gestion des erreurs PGRST116 (no rows returned) qui est normal

## 📋 Fichiers modifiés

1. **`server/supabaseService.ts`** (réécrit)
   - Initialisation lazy des clients Supabase
   - Vérification des variables d'env au moment de l'utilisation
   - Messages d'erreur améliorés

2. **`server/index.ts`** (route `/api/salon/login`)
   - Vérification explicite des variables d'env
   - Gestion d'erreurs avec codes spécifiques
   - Toutes les réponses en JSON

3. **`client/src/hooks/useAuth.ts`**
   - Utilisation des codes d'erreur du serveur
   - Messages d'erreur améliorés

## 🔧 Variables d'environnement requises sur Vercel

**Obligatoires :**

| Variable | Description | Exemple |
|----------|-------------|---------|
| `SUPABASE_URL` | URL de votre projet Supabase | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Clé anonyme Supabase (serveur) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `VITE_SUPABASE_URL` | URL Supabase pour le client (identique à SUPABASE_URL) | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clé anonyme Supabase pour le client (identique à SUPABASE_ANON_KEY) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role Supabase (PRIVÉE - serveur uniquement) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SESSION_SECRET` | Secret pour les sessions Express | Générer avec `openssl rand -base64 32` |
| `NODE_ENV` | Environnement | `production` |

**Optionnelles (selon vos besoins) :**

| Variable | Description | Exemple |
|----------|-------------|---------|
| `RESEND_API_KEY` | Clé API Resend pour les emails | `re_xxxxx` |
| `RESEND_FROM` | Adresse email de l'expéditeur | `Witstyl <noreply@witstyl.ch>` |
| `CLICKSEND_USERNAME` | Username ClickSend pour SMS | `your-username` |
| `CLICKSEND_API_KEY` | Clé API ClickSend | `xxxxx` |
| `CLICKSEND_SMS_FROM` | Sender ID SMS | `Witstyl` |
| `SMS_PROVIDER` | Provider SMS (défaut: clicksend) | `clicksend` |
| `SMS_DRY_RUN` | Mode test SMS | `false` |
| `EMAIL_DRY_RUN` | Mode test Email | `false` |

## 📝 Instructions pour configurer Vercel

### Étape 1 : Ajouter les variables d'environnement

1. Allez sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet **Witstyl**
3. Allez dans **Settings** > **Environment Variables**
4. Ajoutez toutes les variables listées ci-dessus
5. **Important** : Sélectionnez les environnements :
   - ✅ **Production** (pour witstyl.vercel.app)
   - ✅ **Preview** (pour les branches de développement)
   - ✅ **Development** (optionnel)

### Étape 2 : Où trouver les valeurs Supabase

1. Allez sur [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **Settings** > **API**
4. Copiez :
   - **Project URL** → `SUPABASE_URL` et `VITE_SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY` et `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **NE JAMAIS exposer côté client**

### Étape 3 : Générer SESSION_SECRET

```bash
openssl rand -base64 32
```

Copiez la valeur générée dans `SESSION_SECRET` sur Vercel.

### Étape 4 : Redéployer

Après avoir ajouté toutes les variables :
1. Allez dans **Deployments**
2. Cliquez sur **Redeploy** sur le dernier déploiement
3. Ou faites un nouveau commit et push (déploiement automatique)

## 🧪 Tests à effectuer

### Après déploiement :

1. **Tester le login avec de bonnes credentials** :
   - Aller sur `https://witstyl.vercel.app/salon-login`
   - Entrer email et mot de passe valides
   - ✅ Doit rediriger vers `/dashboard`

2. **Tester le login avec de mauvaises credentials** :
   - Entrer un email/mot de passe invalide
   - ✅ Doit afficher : "Email ou mot de passe incorrect."

3. **Vérifier les logs Vercel** :
   - Vercel Dashboard > Deployments > [Dernier déploiement] > Functions
   - Chercher les logs pour `/api/salon/login`
   - ✅ Ne doit plus y avoir d'erreur `FUNCTION_INVOCATION_FAILED`

## 🔍 Debug supplémentaire

Si le problème persiste :

1. **Vérifier les logs Vercel** :
   - Chercher `[salon/login]` ou `[SalonAuthService]` dans les logs
   - Vérifier les messages d'erreur spécifiques

2. **Vérifier les variables d'environnement** :
   - S'assurer que toutes les variables sont bien définies
   - Vérifier qu'elles sont activées pour "Production"

3. **Tester la connexion Supabase** :
   - Vérifier que `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont corrects
   - Tester la connexion depuis Supabase Dashboard

## 📝 Notes importantes

- ✅ **L'initialisation lazy** évite les erreurs au top-level sur Vercel
- ✅ **Toutes les réponses sont en JSON** avec des codes d'erreur clairs
- ✅ **Les messages d'erreur sont en français** et informatifs
- ✅ **Les variables d'env sont vérifiées** au moment de l'utilisation avec des messages clairs

## 🚀 Déploiement

Après ces modifications :

```bash
git add server/supabaseService.ts server/index.ts client/src/hooks/useAuth.ts docs/FIX_LOGIN_PROD.md
git commit -m "Fix: FUNCTION_INVOCATION_FAILED - Initialisation lazy Supabase et gestion d'erreurs améliorée"
git push origin main
```

Vercel déploiera automatiquement (si configuré selon `GITHUB_VERCEL_SYNC.md`).

## ⚠️ Migrations DB

**Aucune migration DB n'est nécessaire** pour ce fix. Les modifications sont uniquement dans le code serveur et la gestion d'erreurs.

## 🔐 Configuration Supabase

**Aucune configuration supplémentaire dans Supabase n'est nécessaire.** Les tables et policies existantes fonctionnent avec ce fix.

