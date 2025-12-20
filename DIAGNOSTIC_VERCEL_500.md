# 🔍 Diagnostic : Erreur 500 sur Vercel

## 📋 Checklist de vérification

### 1. Vérifier les logs Vercel

1. Allez sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet **Witstyl**
3. Allez dans **Deployments** > [Dernier déploiement]
4. Cliquez sur **Functions** > **View Function Logs**
5. Cherchez les erreurs pour `/api/salon/login`

**Ce qu'il faut chercher :**
- `[BOOT]` logs (chargement de l'app)
- `[REQ]` logs (requêtes)
- `[salon/login]` logs (login spécifique)
- Erreurs avec stack trace

### 2. Vérifier les variables d'environnement

1. Allez dans **Settings** > **Environment Variables**
2. Vérifiez que ces variables sont présentes :
   - ✅ `SUPABASE_URL`
   - ✅ `SUPABASE_ANON_KEY`
   - ✅ `VITE_SUPABASE_URL`
   - ✅ `VITE_SUPABASE_ANON_KEY`
   - ✅ `SUPABASE_SERVICE_ROLE_KEY`
   - ✅ `SESSION_SECRET`
   - ✅ `NODE_ENV=production`

3. Vérifiez que chaque variable est activée pour :
   - ✅ **Production**
   - ✅ **Preview**

### 3. Vérifier le build

1. Allez dans **Deployments** > [Dernier déploiement]
2. Vérifiez que le build a réussi (✅ Build Successful)
3. Si le build a échoué, consultez les logs de build

### 4. Tester l'endpoint directement

Ouvrez votre navigateur et testez :
```
https://witstyl.vercel.app/api/health
```

**Résultat attendu :** `{"status":"ok"}`

Si ça ne fonctionne pas, le problème est au niveau du routing Vercel.

### 5. Tester le login avec curl

```bash
curl -X POST https://witstyl.vercel.app/api/salon/login \
  -H "Content-Type: application/json" \
  -d '{"email":"votre@email.com","password":"votrepassword"}' \
  -v
```

**Ce qu'il faut vérifier :**
- Status code (200, 400, 500, etc.)
- Response body
- Headers (Set-Cookie, etc.)

## 🐛 Erreurs courantes et solutions

### Erreur : `FUNCTION_INVOCATION_FAILED`

**Cause :** L'app Express ne se charge pas correctement

**Solution :**
1. Vérifiez les logs Vercel pour voir l'erreur exacte
2. Vérifiez que `api/index.ts` est bien compilé
3. Vérifiez que les imports sont corrects (extensions `.js`)

### Erreur : `Cannot find module`

**Cause :** Import manquant ou chemin incorrect

**Solution :**
1. Vérifiez que tous les fichiers sont bien dans le repo
2. Vérifiez que les imports utilisent `.js` (pas `.ts`)
3. Vérifiez que `vercel.json` est correct

### Erreur : `500 Internal Server Error` sans détails

**Cause :** Erreur dans le code qui n'est pas catchée

**Solution :**
1. Vérifiez les logs Vercel pour voir l'erreur exacte
2. Ajoutez des `try/catch` dans le code
3. Vérifiez que les variables d'environnement sont correctes

### Erreur : `CONFIGURATION_ERROR`

**Cause :** Variables d'environnement Supabase manquantes

**Solution :**
1. Vérifiez que `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont configurées
2. Vérifiez que les valeurs sont correctes (pas de caractères invisibles)
3. Redéployez après avoir ajouté les variables

### Erreur : `SESSION_ERROR`

**Cause :** Problème avec la session Express

**Solution :**
1. Vérifiez que `SESSION_SECRET` est configuré
2. Vérifiez que `trust proxy` est activé (déjà fait dans le code)
3. Vérifiez les logs pour voir l'erreur exacte

## 🔧 Actions de dépannage

### 1. Forcer un redéploiement

1. Allez dans **Deployments**
2. Cliquez sur **"Redeploy"** sur le dernier déploiement
3. Attendez 2-5 minutes

### 2. Vérifier le code local

```bash
# Vérifier que le code compile
npm run build

# Vérifier que le serveur démarre localement
npm run dev
```

### 3. Tester localement avec les mêmes variables

1. Copiez les variables d'environnement Vercel
2. Créez un `.env.local` avec ces variables
3. Testez localement : `npm run dev`
4. Si ça fonctionne localement mais pas sur Vercel, le problème est dans la configuration Vercel

## 📞 Informations à fournir si le problème persiste

1. **Logs Vercel** :** Copiez les logs d'erreur complets
2. **URL testée** : Quelle URL avez-vous testée ?
3. **Erreur exacte** : Quel message d'erreur voyez-vous ?
4. **Variables d'environnement** : Liste des variables configurées (sans les valeurs)
5. **Build logs** : Y a-t-il des erreurs dans le build ?

## ✅ Vérification finale

Une fois que tout fonctionne, vous devriez voir dans les logs Vercel :

```
[BOOT] api/index.ts module loaded
[BOOT] Loading fullApp (with DB/session)...
[BOOT] ✅ SupabaseSessionStore initialisé
[BOOT] ✅ FullApp loaded
[REQ] start [xxx] POST /api/salon/login
[salon/login] ✅ Session sauvegardée
[REQ] end [xxx] POST /api/salon/login (XXXms) - protected
```

Si vous voyez ces logs, tout fonctionne correctement ! 🎉

