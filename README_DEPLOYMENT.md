# 🚀 Déploiement automatique - Witstyl

## Workflow simplifié

Une fois configuré, le workflow est ultra-simple :

```bash
# 1. Faire vos modifications
git add .
git commit -m "Vos modifications"
git push origin main

# 2. C'est tout ! Vercel déploie automatiquement
```

**C'est aussi simple que ça !** 🎉

## 📋 Configuration initiale (une seule fois)

### Option 1 : Via Vercel Dashboard (Recommandé)

1. **Allez sur [vercel.com](https://vercel.com)**
2. **Cliquez sur "Add New Project"**
3. **Importez votre repository GitHub**
4. **Configurez les variables d'environnement** (voir [GITHUB_VERCEL_SYNC.md](./GITHUB_VERCEL_SYNC.md))
5. **C'est tout !** Vercel déploie automatiquement

### Option 2 : Via Vercel CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Lier le projet
vercel link

# Déployer
vercel --prod
```

## 🔄 Synchronisation automatique

Une fois configuré, Vercel :

- ✅ **Détecte automatiquement** chaque push sur GitHub
- ✅ **Démarre un build** automatiquement
- ✅ **Déploie** sur https://witstyl.vercel.app
- ✅ **Envoie une notification** (si activé)

### Branches

- **`main`/`master`** → Déploiement sur **Production** (witstyl.vercel.app)
- **Autres branches** → **Preview Deployment** (URL unique)

## 📚 Documentation complète

- **[GITHUB_VERCEL_SYNC.md](./GITHUB_VERCEL_SYNC.md)** - Guide complet de synchronisation GitHub ↔ Vercel
- **[VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)** - Guide de déploiement Vercel détaillé

## ✅ Checklist rapide

- [ ] Repository GitHub connecté à Vercel
- [ ] Variables d'environnement configurées
- [ ] Premier déploiement réussi
- [ ] Test de push automatique réussi

**Une fois cette checklist complétée, vous n'avez plus qu'à faire `git push` !** 🚀

