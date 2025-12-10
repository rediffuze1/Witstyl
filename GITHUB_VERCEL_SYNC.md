# 🔄 Synchronisation automatique GitHub ↔ Vercel

Ce guide vous permet de configurer la synchronisation automatique entre GitHub et Vercel, pour que chaque push sur GitHub déclenche automatiquement un déploiement sur Vercel.

## 🚀 Configuration en 3 étapes

### Étape 1 : Connecter GitHub à Vercel

1. **Allez sur [vercel.com](https://vercel.com)** et connectez-vous
2. **Cliquez sur "Add New Project"** ou allez dans votre projet existant
3. **Cliquez sur "Import Git Repository"**
4. **Autorisez Vercel à accéder à GitHub** si ce n'est pas déjà fait
5. **Sélectionnez votre repository** `Witstyl` (ou le nom de votre repo)
6. **Cliquez sur "Import"**

### Étape 2 : Configurer les variables d'environnement

Une fois le projet importé :

1. **Allez dans Settings > Environment Variables**
2. **Ajoutez toutes les variables nécessaires** :

```bash
# Variables obligatoires
SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NODE_ENV=production

# Variables optionnelles (selon vos besoins)
SESSION_SECRET=your-random-secret-here

# ClickSend (SMS - uniquement provider supporté)
SMS_PROVIDER=clicksend
CLICKSEND_USERNAME=your-clicksend-username
CLICKSEND_API_KEY=your-clicksend-api-key
CLICKSEND_SMS_FROM=Witstyl
SMS_DRY_RUN=false

# Resend (Email)
RESEND_API_KEY=re_your-resend-key
RESEND_FROM=Witstyl <noreply@witstyl.ch>
EMAIL_DRY_RUN=false
OPENAI_API_KEY=sk-proj-...
VOICE_MODE=off
```

3. **Sélectionnez les environnements** pour chaque variable :
   - ✅ **Production** (pour witstyl.vercel.app)
   - ✅ **Preview** (pour les branches de développement)
   - ✅ **Development** (optionnel)

4. **Cliquez sur "Save"**

### Étape 3 : Activer le déploiement automatique

1. **Allez dans Settings > Git**
2. **Vérifiez que "Production Branch"** est configuré sur `main` ou `master` (votre branche principale)
3. **Activez "Automatic deployments from Git"** (activé par défaut)
4. **Optionnel : Activez "Preview deployments"** pour les autres branches

## ✅ Résultat

Une fois configuré, voici ce qui se passe automatiquement :

### À chaque push sur la branche principale (`main`/`master`)
- ✅ Vercel détecte automatiquement le push
- ✅ Démarre un nouveau build
- ✅ Déploie automatiquement sur `https://witstyl.vercel.app`
- ✅ Vous recevez une notification par email (si activé)

### À chaque push sur une autre branche
- ✅ Vercel crée automatiquement un "Preview Deployment"
- ✅ Vous obtenez une URL unique (ex: `https://witstyl-git-feature-branch.vercel.app`)
- ✅ Parfait pour tester avant de merger

## 📋 Workflow recommandé

```bash
# 1. Faire vos modifications localement
git add .
git commit -m "Vos modifications"
git push origin main

# 2. Vercel déploie automatiquement !
# Pas besoin de faire quoi que ce soit d'autre
```

## 🔍 Vérification

### Vérifier que la synchronisation fonctionne

1. **Faites un petit changement** (ex: modifier un commentaire)
2. **Push sur GitHub** :
   ```bash
   git add .
   git commit -m "Test déploiement automatique"
   git push origin main
   ```
3. **Allez sur Vercel Dashboard** > Deployments
4. **Vous devriez voir un nouveau déploiement en cours** dans les 10-30 secondes

### Vérifier le statut du déploiement

- **Vercel Dashboard** : https://vercel.com/dashboard
- **Onglet "Deployments"** : Voir tous les déploiements
- **Clic sur un déploiement** : Voir les logs de build en temps réel

## 🛠️ Configuration avancée

### Déploiement uniquement sur certaines branches

Si vous voulez déployer uniquement sur `main` :

1. **Settings > Git > Production Branch** : `main`
2. **Settings > Git > Ignored Build Step** : 
   ```bash
   git diff HEAD^ HEAD --quiet ./
   ```
   (Déploie uniquement si des fichiers ont changé)

### Variables d'environnement par branche

Vous pouvez avoir des variables différentes selon la branche :

1. **Settings > Environment Variables**
2. **Ajoutez une variable**
3. **Sélectionnez les environnements** (Production, Preview, Development)
4. **Les variables Preview** seront utilisées pour les branches autres que `main`

### Webhooks GitHub (optionnel)

Pour des notifications personnalisées :

1. **Settings > Git > GitHub**
2. **Configurez les webhooks** si nécessaire
3. Vercel gère automatiquement les webhooks GitHub

## 🐛 Dépannage

### Le déploiement ne se déclenche pas automatiquement

1. **Vérifiez que Vercel est connecté à GitHub** :
   - Settings > Git > Connected Git Repository
   - Doit afficher votre repository

2. **Vérifiez les permissions GitHub** :
   - Vercel doit avoir accès au repository
   - Allez dans GitHub > Settings > Applications > Vercel
   - Vérifiez les permissions

3. **Vérifiez les logs** :
   - Vercel Dashboard > Deployments
   - Regardez les logs de build pour voir les erreurs

### Erreur : "Build failed"

1. **Vérifiez les logs de build** dans Vercel Dashboard
2. **Vérifiez que toutes les variables d'environnement sont configurées**
3. **Vérifiez que `npm run build` fonctionne localement** :
   ```bash
   npm run build
   ```

### Erreur : "Environment variables not found"

1. **Vérifiez que toutes les variables sont dans Vercel Dashboard**
2. **Vérifiez que les variables sont activées pour "Production"**
3. **Redéployez manuellement** depuis Vercel Dashboard

## 📝 Notes importantes

- ⚠️ **Ne commitez jamais** les fichiers `.env` dans GitHub
- ✅ **Toutes les variables sensibles** doivent être dans Vercel Dashboard
- ✅ **Les variables avec préfixe `VITE_`** sont exposées côté client
- ⚠️ **Ne jamais exposer** `SUPABASE_SERVICE_ROLE_KEY` côté client
- ✅ **Le fichier `.vercelignore`** est déjà configuré pour ignorer les fichiers sensibles

## 🎯 Checklist de configuration

- [ ] Repository GitHub connecté à Vercel
- [ ] Toutes les variables d'environnement configurées dans Vercel
- [ ] Production Branch configurée (main/master)
- [ ] Automatic deployments activé
- [ ] Test de déploiement automatique réussi
- [ ] Application accessible sur https://witstyl.vercel.app

Une fois cette checklist complétée, vous n'avez plus qu'à faire `git push` et Vercel déploiera automatiquement ! 🚀

