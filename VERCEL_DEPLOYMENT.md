# 🚀 Guide de déploiement Vercel - Witstyl

## Configuration requise

### 1. Variables d'environnement dans Vercel

Configurez toutes les variables d'environnement suivantes dans le dashboard Vercel (Settings > Environment Variables) :

#### Variables obligatoires

```bash
# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Environnement
NODE_ENV=production
```

#### Variables optionnelles (selon vos besoins)

```bash
# Sessions
SESSION_SECRET=your-random-secret-here

# Notifications SMS (SMSup)
SMSUP_API_TOKEN=your-smsup-token
SMSUP_SENDER=Witstyl
SMS_DRY_RUN=false

# Notifications Email (Resend)
RESEND_API_KEY=re_your-resend-key
RESEND_FROM=Witstyl <noreply@witstyl.ch>
EMAIL_DRY_RUN=false

# OpenAI (pour l'IA vocale)
OPENAI_API_KEY=sk-proj-...
VOICE_MODE=off

# Base de données (si vous utilisez PostgreSQL directement)
DATABASE_URL=postgresql://...
```

### 2. Configuration du build

Vercel détectera automatiquement :
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3. Structure des fichiers

Les fichiers suivants sont nécessaires pour Vercel :

- ✅ `vercel.json` - Configuration Vercel
- ✅ `api/index.ts` - Handler serverless pour Vercel
- ✅ `server/index.ts` - Application Express (exportée pour Vercel)
- ✅ `package.json` - Scripts de build

### 4. Déploiement automatique depuis GitHub

**📖 Guide complet :** Voir [GITHUB_VERCEL_SYNC.md](./GITHUB_VERCEL_SYNC.md) pour la configuration détaillée.

**Résumé rapide :**

1. **Connectez votre repository GitHub à Vercel**
   - Allez sur [vercel.com](https://vercel.com)
   - Importez votre repository
   - Vercel détectera automatiquement la configuration

2. **Configurez les variables d'environnement**
   - Dans le dashboard Vercel, allez dans Settings > Environment Variables
   - Ajoutez toutes les variables listées ci-dessus
   - Assurez-vous de les configurer pour "Production", "Preview" et "Development"

3. **Activez le déploiement automatique**
   - Settings > Git > Automatic deployments (activé par défaut)
   - Chaque push sur `main` déclenchera automatiquement un déploiement
   - Les autres branches créeront des preview deployments

3. **Déployez**
   - Vercel déploiera automatiquement à chaque push sur la branche principale
   - Les autres branches créeront des preview deployments

### 5. Vérification post-déploiement

Après le déploiement, vérifiez :

1. ✅ L'application charge correctement sur `https://witstyl.vercel.app`
2. ✅ Les routes API fonctionnent (`/api/health`)
3. ✅ La connexion Supabase fonctionne
4. ✅ Les fichiers statiques sont servis correctement
5. ✅ Les variables d'environnement sont bien chargées

### 6. Problèmes courants

#### Erreur : "Cannot find module"
- **Solution**: Vérifiez que toutes les dépendances sont dans `dependencies` et non `devDependencies`

#### Erreur : "Environment variables not found"
- **Solution**: Vérifiez que toutes les variables sont configurées dans Vercel Dashboard

#### Erreur : "Build failed"
- **Solution**: Vérifiez les logs de build dans Vercel Dashboard > Deployments

#### Erreur : "CORS error"
- **Solution**: Le domaine Vercel est déjà configuré dans `server/index.ts`. Si vous utilisez un domaine personnalisé, ajoutez-le dans la configuration CORS.

### 7. Domaines personnalisés

Pour utiliser un domaine personnalisé :

1. Allez dans Vercel Dashboard > Settings > Domains
2. Ajoutez votre domaine
3. Suivez les instructions pour configurer les DNS
4. Mettez à jour la configuration CORS dans `server/index.ts` si nécessaire

### 8. Monitoring

Vercel fournit automatiquement :
- ✅ Logs en temps réel
- ✅ Analytics de performance
- ✅ Monitoring des erreurs
- ✅ Métriques de déploiement

## Notes importantes

- ⚠️ Les fonctions serverless Vercel ont une limite de 30 secondes par défaut (configuré dans `vercel.json`)
- ⚠️ La mémoire est limitée à 1024 MB par défaut
- ⚠️ Les variables d'environnement avec le préfixe `VITE_` sont exposées côté client
- ⚠️ Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client

