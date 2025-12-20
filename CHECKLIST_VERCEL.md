# ✅ Checklist : Configuration Vercel pour Witstyl

## 📋 Variables d'environnement configurées

Vérifiez que toutes ces variables sont bien configurées dans **Vercel Dashboard > Settings > Environment Variables** :

### ✅ Obligatoires

- [x] `SUPABASE_URL` - URL de votre projet Supabase
- [x] `SUPABASE_ANON_KEY` - Clé anonyme Supabase (serveur)
- [x] `VITE_SUPABASE_URL` - URL Supabase pour le client (identique à SUPABASE_URL)
- [x] `VITE_SUPABASE_ANON_KEY` - Clé anonyme Supabase pour le client (identique à SUPABASE_ANON_KEY)
- [x] `SUPABASE_SERVICE_ROLE_KEY` - Clé service role Supabase (PRIVÉE)
- [x] `SESSION_SECRET` - Secret pour les sessions Express
- [x] `NODE_ENV` - Environnement (`production`)

### ✅ Optionnelles (selon vos besoins)

- [ ] `RESEND_API_KEY` - Clé API Resend pour les emails
- [ ] `RESEND_FROM` - Adresse email de l'expéditeur (ex: `Witstyl <noreply@witstyl.ch>`)
- [ ] `CLICKSEND_USERNAME` - Username ClickSend pour SMS
- [ ] `CLICKSEND_API_KEY` - Clé API ClickSend
- [ ] `CLICKSEND_SMS_FROM` - Sender ID SMS (ex: `Witstyl`)
- [ ] `SMS_PROVIDER` - Provider SMS (défaut: `clicksend`)
- [ ] `SMS_DRY_RUN` - Mode test SMS (`false` pour production)
- [ ] `EMAIL_DRY_RUN` - Mode test Email (`false` pour production)

## ⚠️ Important

Pour chaque variable, sélectionnez les environnements :
- ✅ **Production** (pour witstyl.vercel.app)
- ✅ **Preview** (pour les branches de développement)
- ✅ **Development** (optionnel)

## 🧪 Tests après déploiement

Une fois les variables configurées et le code déployé :

1. **Tester le login** :
   - Aller sur `https://witstyl.vercel.app/salon-login`
   - Tester avec de bonnes credentials
   - ✅ Doit rediriger vers `/dashboard`

2. **Tester les erreurs** :
   - Tester avec de mauvaises credentials
   - ✅ Doit afficher : "Email ou mot de passe incorrect."

3. **Vérifier les logs Vercel** :
   - Vercel Dashboard > Deployments > [Dernier déploiement] > Functions
   - Chercher les logs pour `/api/salon/login`
   - ✅ Ne doit plus y avoir d'erreur `FUNCTION_INVOCATION_FAILED`

## 📝 Notes

- ✅ Toutes les variables sont configurées dans Vercel
- ✅ Le code a été commité et pushé
- ✅ Vercel va déployer automatiquement (si configuré selon `GITHUB_VERCEL_SYNC.md`)

## 🚀 Prochaines étapes

1. Attendre le déploiement Vercel (2-5 minutes)
2. Tester le login sur `https://witstyl.vercel.app/salon-login`
3. Vérifier les logs si nécessaire



