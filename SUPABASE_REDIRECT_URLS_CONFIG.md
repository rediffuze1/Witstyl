# Configuration Supabase - Redirect URLs

## ⚠️ Problème courant : Redirection vers landing au lieu de /reset-password

Si le lien de reset password redirige vers la landing page au lieu de `/reset-password`, c'est **100% un problème de configuration Supabase**.

## ✅ Configuration requise dans Supabase Dashboard

### 1. Site URL
**Auth → URL Configuration → Site URL**
```
https://witstyl.vercel.app
```

### 2. Additional Redirect URLs (CRITIQUE)
**Auth → URL Configuration → Additional Redirect URLs**

Ajouter **exactement** ces URLs (une par ligne) :

```
https://witstyl.vercel.app/reset-password
https://witstyl.vercel.app/auth/confirm
```

**Optionnel (moins sécurisé mais plus simple)** :
```
https://witstyl.vercel.app/*
```

### 3. Pourquoi c'est important

- Si `/reset-password` n'est **pas** dans la liste, Supabase **ignore** le paramètre `redirectTo` de `resetPasswordForEmail()`
- Supabase redirige alors vers le **Site URL** (landing page) par défaut
- C'est un mécanisme de sécurité pour éviter les redirections malveillantes

## 🔍 Vérification

### Vérifier que VITE_APP_URL est défini en prod

Dans Vercel Dashboard :
1. Settings → Environment Variables
2. Vérifier que `VITE_APP_URL` = `https://witstyl.vercel.app`
3. Si absent, **ajouter** :
   - Key: `VITE_APP_URL`
   - Value: `https://witstyl.vercel.app`
   - Environment: Production, Preview, Development

### Tester le flow complet

1. Aller sur `/forgot-password`
2. Entrer un email existant
3. Recevoir l'email
4. **Vérifier l'URL du lien dans l'email** :
   - Doit contenir `redirect_to=https://witstyl.vercel.app/reset-password`
   - Doit contenir `type=recovery`
   - Doit contenir `code=...` (PKCE)
5. Cliquer sur le lien
6. **Vérifier l'URL finale dans le navigateur** :
   - Doit être : `https://witstyl.vercel.app/reset-password?code=...&type=recovery`
   - **NE DOIT PAS** rediriger vers `/` (landing)

## 🐛 Diagnostic

### Si ça redirige encore vers la landing :

1. **Vérifier Supabase Dashboard** :
   - Auth → URL Configuration
   - Vérifier que `/reset-password` est dans "Additional Redirect URLs"
   - **Sauvegarder** les changements

2. **Vérifier VITE_APP_URL en prod** :
   - Vercel Dashboard → Settings → Environment Variables
   - Vérifier que `VITE_APP_URL` = `https://witstyl.vercel.app`

3. **Vérifier les logs console** :
   - Ouvrir `/forgot-password`
   - Console (F12) → chercher `[ForgotPassword] redirectTo`
   - Doit afficher : `https://witstyl.vercel.app/reset-password`

4. **Vérifier l'URL du lien email** :
   - Ouvrir l'email reçu
   - Inspecter le lien (clic droit → Copier l'adresse)
   - Vérifier que `redirect_to=https://witstyl.vercel.app/reset-password`

## 📝 Notes

- Les changements dans Supabase Dashboard sont **immédiats** (pas besoin de redéployer)
- Si le problème persiste après avoir ajouté l'URL, **attendre 1-2 minutes** (cache Supabase)
- Pour les previews Vercel, ajouter aussi : `https://witstyl-*.vercel.app/reset-password` (wildcard)

