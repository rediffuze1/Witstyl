# Guide de Contribution - Witstyl

Ce guide vous aidera à configurer et démarrer le projet Witstyl en local.

## 📋 Prérequis

- Node.js 18+ et npm/pnpm/yarn
- Un compte Supabase (gratuit)
- Git

## 🚀 Installation

### 1. Cloner le repository

```bash
git clone https://github.com/rediffuze1/Witstyl.git
cd Witstyl
```

### 2. Installer les dépendances

```bash
npm install
# ou
pnpm install
# ou
yarn install
```

### 3. Configurer les variables d'environnement

Copiez le fichier `.env.example` vers `.env` :

```bash
cp .env.example .env
```

**Note :** Si `.env.example` n'existe pas, vous pouvez utiliser `config.env.example` comme alternative.

Éditez `.env` et remplissez les valeurs obligatoires :

```env
# Configuration Supabase (OBLIGATOIRE)
SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Configuration serveur
PORT=5001
NODE_ENV=development
SESSION_SECRET=your-session-secret-here
```

**Où trouver les clés Supabase :**
1. Allez sur [supabase.com](https://supabase.com)
2. Créez un projet ou sélectionnez un projet existant
3. Allez dans **Settings** > **API**
4. Copiez :
   - **Project URL** → `SUPABASE_URL` et `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY` et `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ NE JAMAIS exposer côté client)

**Générer un SESSION_SECRET :**
```bash
openssl rand -base64 32
```

### 4. Créer les tables Supabase

1. Dans votre projet Supabase, allez dans **SQL Editor**
2. Cliquez sur **New Query**
3. Copiez le contenu du fichier `supabase_complete_setup.sql`
4. Collez-le dans l'éditeur et cliquez sur **Run**

## 🏃 Démarrer l'application

### Mode développement

```bash
npm run dev
```

L'application sera accessible sur **http://localhost:5001/**

Le serveur démarre automatiquement et affiche :
- ✅ Les variables d'environnement configurées
- ⚠️ Les variables manquantes ou avec des valeurs d'exemple
- 📝 Le statut de chaque variable

### Mode production

```bash
npm run build
npm start
```

## 📜 Scripts disponibles

| Script | Description |
|--------|-------------|
| `npm run dev` | Démarre le serveur en mode développement (port 5001) |
| `npm run build` | Compile l'application pour la production |
| `npm start` | Démarre le serveur en mode production |
| `npm run check` | Vérifie les types TypeScript |
| `npm run db:generate` | Génère les migrations Drizzle |
| `npm run db:push` | Pousse les migrations vers la base de données |
| `npm run db:studio` | Ouvre Drizzle Studio |
| `npm run health` | Vérifie la connexion Supabase |

## 🔧 Configuration

### Port du serveur

Le port par défaut est **5001**. Pour le changer :

1. Modifiez `PORT` dans `.env`
2. Ou utilisez la variable d'environnement : `PORT=3000 npm run dev`

Le serveur écoute sur `0.0.0.0:PORT` pour accepter les connexions depuis n'importe quelle interface réseau.

### Variables d'environnement

#### Variables obligatoires

- `SUPABASE_URL` : URL de votre projet Supabase
- `VITE_SUPABASE_URL` : Même valeur que `SUPABASE_URL` (pour le client)
- `VITE_SUPABASE_ANON_KEY` : Clé anonyme Supabase (pour le client)
- `SUPABASE_ANON_KEY` : Même valeur que `VITE_SUPABASE_ANON_KEY` (pour le serveur)

#### Variables optionnelles

- `SUPABASE_SERVICE_ROLE_KEY` : Clé service role (pour opérations admin)
- `PORT` : Port du serveur (défaut: 5001)
- `NODE_ENV` : Environnement (development | production)
- `SESSION_SECRET` : Secret pour les sessions Express
- `OPENAI_API_KEY` : Clé API OpenAI (pour fonctionnalités vocales)
- `VOICE_MODE` : Mode vocal (off | browser | openai)
- `DATABASE_URL` : URL PostgreSQL (optionnel si Supabase uniquement)

## 🐛 Dépannage

### Erreur : Variables d'environnement manquantes

Si vous voyez des erreurs au démarrage :

1. Vérifiez que le fichier `.env` existe à la racine du projet
2. Vérifiez que toutes les variables obligatoires sont définies
3. Redémarrez le serveur après avoir modifié `.env`

### Erreur 401 Unauthorized

Si vous rencontrez des erreurs 401 :

1. Vérifiez que `VITE_SUPABASE_ANON_KEY` et `SUPABASE_ANON_KEY` sont identiques
2. Vérifiez que les clés sont correctes dans Supabase
3. Vérifiez que les politiques RLS (Row Level Security) sont configurées dans Supabase
4. Vérifiez que les cookies de session sont bien envoyés (credentials: 'include')

### Le serveur ne démarre pas

1. Vérifiez que le port 5001 n'est pas déjà utilisé :
   ```bash
   lsof -i :5001
   ```
2. Changez le port dans `.env` si nécessaire
3. Vérifiez les logs du serveur pour les erreurs

### Flicker lors des transitions de page

Le composant `PageTransition` a été optimisé pour éviter le flicker. Si vous voyez encore des problèmes :

1. Vérifiez que vous n'utilisez pas `display: none` ou `opacity: 0` sur les containers racine
2. Vérifiez que les animations utilisent `will-change` pour de meilleures performances
3. Vérifiez que les transitions sont rapides (< 300ms)

## 📁 Structure du projet

```
Witstyl/
├── client/              # Application React/Vite
│   ├── src/
│   │   ├── components/  # Composants réutilisables
│   │   ├── pages/       # Pages de l'application
│   │   ├── hooks/       # Hooks React personnalisés
│   │   └── lib/         # Utilitaires et clients API
│   └── public/          # Fichiers statiques
├── server/              # Serveur Express
│   ├── routes/          # Routes API
│   ├── db/              # Schéma de base de données
│   └── mcp/             # Intégration MCP
├── shared/              # Code partagé client/serveur
├── .env.example         # Exemple de configuration (variables d'environnement)
├── config.env.example    # Exemple de configuration (alternative)
└── package.json         # Dépendances et scripts
```

## 🔐 Sécurité

### Variables d'environnement

- ⚠️ **NE JAMAIS** commiter le fichier `.env` dans Git
- ⚠️ **NE JAMAIS** exposer `SUPABASE_SERVICE_ROLE_KEY` côté client
- ✅ Les clés `VITE_*` sont exposées côté client mais sécurisées par RLS
- ✅ Utilisez `SESSION_SECRET` fort en production

### Clés API

- Les clés `anon` sont publiques et sécurisées par RLS
- La clé `service_role` bypass RLS - gardez-la secrète
- Utilisez des secrets différents pour développement et production

## 📚 Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Documentation React Query](https://tanstack.com/query/latest)
- [Documentation Framer Motion](https://www.framer.com/motion/)
- [Documentation Vite](https://vitejs.dev/)

## 🤝 Contribution

1. Créez une branche pour votre fonctionnalité
2. Faites vos modifications
3. Testez localement
4. Créez une pull request

## 📝 Notes

- Le serveur vérifie automatiquement les variables d'environnement au démarrage
- Les erreurs 401 déclenchent automatiquement un refresh token
- Les transitions de page sont optimisées pour éviter le flicker
- Le port par défaut est 5001 mais peut être changé via `PORT` dans `.env`

