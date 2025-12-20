# ⚡ Démarrage rapide - Déploiement automatique

## 🎯 Objectif

Configurer la synchronisation automatique GitHub → Vercel pour que chaque `git push` déclenche automatiquement un déploiement.

## 🚀 Configuration en 5 minutes

### 1. Connecter GitHub à Vercel (2 min)

1. Allez sur https://vercel.com
2. Cliquez sur **"Add New Project"**
3. Cliquez sur **"Import Git Repository"**
4. Autorisez Vercel à accéder à GitHub
5. Sélectionnez votre repository **Witstyl**
6. Cliquez sur **"Import"**

### 2. Configurer les variables d'environnement (2 min)

Dans Vercel Dashboard > Settings > Environment Variables, ajoutez :

**Minimum requis :**
```
SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=production
```

**Important :** Cochez ✅ **Production**, ✅ **Preview**, ✅ **Development** pour chaque variable.

### 3. Premier déploiement (1 min)

Vercel va automatiquement :
- ✅ Détecter votre configuration
- ✅ Lancer un build
- ✅ Déployer sur https://witstyl.vercel.app

## ✅ C'est tout !

Maintenant, à chaque fois que vous faites :

```bash
git add .
git commit -m "Vos modifications"
git push origin main
```

**Vercel déploie automatiquement !** 🎉

## 🔍 Vérification

1. **Faites un petit changement** (ex: ajouter un commentaire)
2. **Push sur GitHub**
3. **Allez sur Vercel Dashboard** > Deployments
4. **Vous devriez voir un nouveau déploiement** dans les 10-30 secondes

## 📚 Documentation complète

- **[GITHUB_VERCEL_SYNC.md](./GITHUB_VERCEL_SYNC.md)** - Guide détaillé
- **[VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)** - Configuration avancée

## 🆘 Problème ?

### Le déploiement ne se déclenche pas

1. Vérifiez que Vercel est connecté à GitHub (Settings > Git)
2. Vérifiez que vous push sur la bonne branche (main/master)
3. Vérifiez les logs dans Vercel Dashboard > Deployments

### Erreur de build

1. Vérifiez les logs de build dans Vercel Dashboard
2. Testez localement : `npm run build`
3. Vérifiez que toutes les variables d'environnement sont configurées

---

**Une fois configuré, vous n'avez plus qu'à faire `git push` !** 🚀



