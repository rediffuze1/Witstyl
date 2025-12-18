# Vérification Connexion sur Vercel

## Checklist de vérification

### 1. Variables d'environnement Vercel (OBLIGATOIRE)

**Cursor ne peut pas le faire automatiquement. Vérifier dans Vercel Dashboard :**

Vercel Dashboard → Projet `Witstyl` → Settings → Environment Variables

**Variables requises :**

- ✅ `SUPABASE_URL` - URL de votre projet Supabase
- ✅ `SUPABASE_ANON_KEY` - Clé anonyme Supabase
- ✅ `SUPABASE_SERVICE_KEY` - Clé service Supabase (pour les opérations admin)
- ✅ `SESSION_SECRET` - Secret pour signer les sessions (générer un UUID aléatoire)
- ✅ `DATABASE_URL` - URL de connexion Postgres (format: `postgresql://...`)
- ✅ `OPENAI_API_KEY` - Clé API OpenAI (pour le chatbot)

**Environnements :** Production, Preview, Development (tous les trois)

### 2. Configuration CORS

✅ **Corrigé dans le code** - La configuration CORS accepte maintenant :
- `https://witstyl.vercel.app` (production)
- Tous les previews Vercel (`*.vercel.app`)
- `localhost` pour le développement

### 3. Trust Proxy

✅ **Déjà configuré** - `app.set('trust proxy', 1)` est activé automatiquement sur Vercel

### 4. Routes API

✅ **Routes vérifiées :**
- `/api/salon/login` - Connexion propriétaire salon
- `/api/auth/user` - Vérification session utilisateur
- `/api/health` - Health check

## Tests à effectuer

### Test 1: Health Check

```bash
curl https://witstyl.vercel.app/api/health
```

**Résultat attendu :**
```json
{
  "status": "healthy",
  "timestamp": "2024-...",
  "service": "Witstyl API"
}
```

### Test 2: Connexion (depuis le navigateur)

1. Ouvrir https://witstyl.vercel.app/salon-login
2. Ouvrir la console (F12 → Console)
3. Entrer email et mot de passe
4. Cliquer sur "Se connecter"
5. Vérifier les logs console :
   - `[useAuth]` - Requête de login
   - `[AuthContext]` - Gestion de la session
   - Pas d'erreur CORS
   - Redirection vers `/dashboard` si succès

### Test 3: Vérification session après connexion

1. Après connexion réussie, ouvrir la console
2. Vérifier que les cookies sont présents :
   ```javascript
   document.cookie
   ```
   Devrait contenir `connect.sid=...`
3. Tester l'endpoint de vérification :
   ```bash
   curl -H "Cookie: connect.sid=..." https://witstyl.vercel.app/api/auth/user
   ```

### Test 4: Logs Vercel

Vercel Dashboard → Deployments → Latest → Logs

**Chercher :**
- `[Route] /api/salon/login start` - Route appelée
- `[salon/login] ✅ Session sauvegardée` - Session créée
- `[salon/login] ✅ Set-Cookie header présent` - Cookie envoyé
- Pas d'erreur `CONFIGURATION_ERROR` ou `SESSION_ERROR`

## Problèmes courants et solutions

### Problème 1: Erreur CORS

**Symptôme :** `Access-Control-Allow-Origin` manquant dans la réponse

**Solution :** 
- ✅ Déjà corrigé dans le code
- Vérifier que l'origine est bien `https://witstyl.vercel.app`
- Vérifier les logs Vercel pour voir quelle origine est reçue

### Problème 2: Session non sauvegardée

**Symptôme :** Connexion réussie mais redirection vers login

**Solution :**
- Vérifier que `SESSION_SECRET` est bien configuré
- Vérifier les logs : `[salon/login] ✅ Set-Cookie header présent`
- Vérifier que `trust proxy` est à `1` (déjà fait automatiquement)

### Problème 3: Timeout

**Symptôme :** "Le serveur met trop de temps à répondre"

**Solution :**
- Timeout client augmenté à 30 secondes (déjà fait)
- Vérifier les logs Vercel pour voir où ça bloque
- Vérifier que Supabase répond rapidement

### Problème 4: Variables d'environnement manquantes

**Symptôme :** `CONFIGURATION_ERROR` dans la réponse

**Solution :**
- Vérifier toutes les variables dans Vercel Dashboard
- S'assurer qu'elles sont définies pour Production, Preview ET Development

## Code déployé

✅ **CORS amélioré** - Accepte maintenant tous les previews Vercel
✅ **Trust proxy** - Configuré automatiquement
✅ **Timeout** - Augmenté à 30 secondes
✅ **Logs détaillés** - Pour diagnostic

## Prochaines étapes

1. ✅ Code commité et poussé
2. ⏳ Attendre le déploiement Vercel (2-5 minutes)
3. ⏳ Vérifier les variables d'environnement dans Vercel Dashboard
4. ⏳ Tester la connexion en production
5. ⏳ Vérifier les logs Vercel si problème

