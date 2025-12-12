# Configuration Supabase Supavisor Pooler pour Vercel

## 🎯 Objectif

Utiliser le pooler Supavisor (Transaction Mode) au lieu de la connexion PostgreSQL directe pour éviter les erreurs DNS sur Vercel/serverless.

## ⚠️ Problème

La connexion PostgreSQL directe (`db.*.supabase.co`) peut échouer sur Vercel avec des erreurs DNS (`ENOTFOUND`). Cela bloque les routes protégées qui retournent 503.

## ✅ Solution

Utiliser le **Supavisor Transaction Mode** (port 6543) qui est optimisé pour les environnements serverless.

## 📋 Étapes de configuration

### 1. Obtenir l'URL du pooler depuis Supabase Dashboard

1. Ouvrez https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Settings > Database**
4. Cliquez sur le bouton **"Connect"** ou **"Connection string"**
5. Dans la section **"Connection pooling"**, sélectionnez:
   - ✅ **"Transaction mode"** (port 6543)
   - OU
   - ✅ **"Session Pooler / Transaction Mode"**
6. Copiez l'URI de connexion complète

### 2. Format attendu

```
postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Exemple concret:**
```
postgres://postgres.nmyulnvgngaepseiwcwb:VotreMotDePasse@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**⚠️ Points importants:**
- Le port doit être **6543** (Transaction Mode)
- L'URL doit contenir **`pooler.supabase.com`**
- Le paramètre **`pgbouncer=true`** est requis
- Le paramètre **`connection_limit=1`** est recommandé pour serverless

### 3. Configurer DATABASE_URL dans Vercel

1. Ouvrez **Vercel Dashboard > Votre projet > Settings > Environment Variables**
2. Trouvez la variable **DATABASE_URL**
3. Remplacez la valeur par l'URL du pooler copiée à l'étape 1
4. Assurez-vous que la variable est définie pour:
   - ✅ Production
   - ✅ Preview (si nécessaire)
5. Sauvegardez

### 4. Redéployer sur Vercel

Vercel redéploiera automatiquement après la sauvegarde, ou déclenchez manuellement un redeploy depuis le Dashboard.

### 5. Vérifier la connexion

**En local (après avoir mis à jour votre `.env`):**
```bash
npm run test:db
```

**Sur Vercel:**
- Vérifiez les logs Functions dans Vercel Dashboard
- Vous devriez voir: `[DB] ✅ Connexion à la base de données réussie`

## 💡 Pourquoi utiliser le pooler?

- ✅ Supporte IPv4 (la connexion directe nécessite IPv6)
- ✅ Optimisé pour les environnements serverless (Vercel)
- ✅ Gestion automatique des connexions
- ✅ Meilleure performance pour les fonctions serverless
- ✅ Évite les erreurs DNS avec `db.*.supabase.co`

## ❌ Problèmes courants

### Erreur DNS (ENOTFOUND db.*.supabase.co)
**Solution:** Utiliser le pooler au lieu de la connexion directe

### Port 5432 au lieu de 6543
**Solution:** Utiliser Transaction Mode (port 6543) pour serverless

### Paramètre pgbouncer=true manquant
**Solution:** Ajouter `?pgbouncer=true` à la fin de l'URL

## 🛠️ Scripts disponibles

### Afficher les instructions détaillées
```bash
npm run print:db-instructions
```

### Tester la connexion à la base de données
```bash
npm run test:db
```

## 📚 Références

- [Supabase: Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Connection pooling](https://supabase.com/docs/guides/database/connection-management)

