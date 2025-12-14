# 📘 Guide d'Architecture et de Développement - Witstyl

**Document de référence pour ChatGPT, Cursor AI et développeurs**

Ce document explique l'architecture complète du projet Witstyl, les conventions de code, et les procédures à suivre pour les améliorations, changements et ajouts.

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture générale](#architecture-générale)
3. [Structure du projet](#structure-du-projet)
4. [Stack technique](#stack-technique)
5. [Architecture backend](#architecture-backend)
6. [Architecture frontend](#architecture-frontend)
7. [Déploiement Vercel](#déploiement-vercel)
8. [Conventions de code](#conventions-de-code)
9. [Procédures de développement](#procédures-de-développement)
10. [Bonnes pratiques](#bonnes-pratiques)

---

## 🎯 Vue d'ensemble

**Witstyl** est une application web de gestion de rendez-vous pour salons de coiffure, déployée sur **Vercel** (serverless) avec :

- **Frontend** : React 18 + TypeScript + Vite + TailwindCSS
- **Backend** : Express.js + TypeScript (ESM)
- **Base de données** : Supabase (PostgreSQL) + Supabase REST API
- **Authentification** : Sessions Express (cookies) + Supabase Auth
- **Déploiement** : Vercel Serverless Functions

### Caractéristiques principales

- ✅ **Monorepo** : Frontend et backend dans le même repository
- ✅ **ESM (ES Modules)** : `"type": "module"` dans `package.json`
- ✅ **Serverless-first** : Optimisé pour Vercel (cold starts, timeouts)
- ✅ **Routes publiques isolées** : DB-free pour performance
- ✅ **Lazy loading** : Chargement à la demande pour routes protégées

---

## 🏗️ Architecture générale

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Frontend (React) - dist/                            │  │
│  │  - SPA avec routing client-side (wouter)            │  │
│  │  - API calls via fetch() avec credentials: include  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Backend (Express) - api/index.ts                    │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  Routes Publiques (publicApp.ts)               │  │  │
│  │  │  - DB-free, Supabase REST uniquement          │  │  │
│  │  │  - Ultra rapide (< 200ms)                     │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  Routes Protégées (index.prod.ts)           │  │  │
│  │  │  - Lazy init (chargé uniquement si besoin)   │  │  │
│  │  │  - DB PostgreSQL + Sessions                 │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE                                  │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  PostgreSQL      │  │  REST API        │                │
│  │  (Pooler 6543)   │  │  (Auth + Data)   │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### Flux de requête

1. **Requête arrive sur Vercel**
   - Si `/api/*` → Routée vers `api/index.ts` (handler serverless)
   - Sinon → Servie comme fichier statique depuis `dist/`

2. **Handler Vercel (`api/index.ts`)**
   - Guard : Rejette immédiatement les requêtes non-API (404)
   - Route publique ? → `getPublicApp()` (DB-free, rapide)
   - Route protégée ? → `getFullApp()` (lazy init, DB + session)

3. **Routes publiques (`publicApp.ts`)**
   - Utilise uniquement Supabase REST API
   - Aucune connexion PostgreSQL
   - Aucune session
   - Répond en < 200ms

4. **Routes protégées (`index.prod.ts` → `index.ts`)**
   - Lazy init : Chargé uniquement si nécessaire
   - Connexion PostgreSQL (pooler Supabase)
   - Session store (PostgreSQL ou fallback MemoryStore)
   - Middleware d'authentification

---

## 📁 Structure du projet

```
SalonPilot/
├── api/
│   └── index.ts                    # Handler Vercel serverless
│
├── client/                          # Frontend React
│   └── src/
│       ├── App.tsx                 # Point d'entrée + Router
│       ├── pages/                  # Pages de l'application
│       ├── components/             # Composants React
│       ├── contexts/               # React Contexts (AuthContext)
│       ├── hooks/                  # Custom hooks
│       ├── lib/                    # Utilitaires (apiClient, supabaseClient)
│       └── utils/                  # Fonctions utilitaires
│
├── server/                          # Backend Express
│   ├── index.ts                    # App Express principale
│   ├── index.prod.ts               # Point d'entrée production (lazy init)
│   ├── publicApp.ts                # App Express pour routes publiques
│   ├── routes/                     # Routes Express
│   │   ├── publicIsolated.ts      # Routes publiques (DB-free)
│   │   ├── public.ts               # Routes publiques (legacy)
│   │   ├── health.ts               # Health checks
│   │   └── salons.ts               # Routes salon
│   ├── core/                       # Logique métier
│   │   ├── appointments/           # Gestion des rendez-vous
│   │   └── notifications/          # Système de notifications
│   ├── infrastructure/             # Providers externes
│   │   ├── email/                  # Providers email (Resend)
│   │   └── sms/                    # Providers SMS (ClickSend, Twilio)
│   ├── db/                         # Configuration PostgreSQL
│   │   └── client.ts              # Client PG optimisé Vercel
│   ├── sessionStore.ts            # Gestion lazy des sessions
│   ├── supabaseSessionStore.ts    # Store session PostgreSQL
│   ├── supabaseService.ts         # Service Supabase
│   └── utils/                     # Utilitaires backend
│
├── shared/                         # Code partagé frontend/backend
│
├── scripts/                        # Scripts utilitaires
│   ├── test-vercel-prod.ts        # Tests simulation Vercel
│   └── test-db-connection.ts      # Tests connexion DB
│
├── dist/                           # Build frontend (Vite)
│
├── vercel.json                     # Configuration Vercel
├── vite.config.ts                 # Configuration Vite
├── tsconfig.json                   # Configuration TypeScript
└── package.json                    # Dépendances + scripts
```

---

## 🛠️ Stack technique

### Frontend

- **React 18.3** : Framework UI
- **TypeScript 5.6** : Typage statique
- **Vite 5.4** : Build tool + dev server
- **TailwindCSS 3.4** : Styling
- **Radix UI** : Composants accessibles
- **Wouter** : Routing client-side
- **React Query (TanStack)** : Gestion des données + cache
- **React Hook Form** : Gestion des formulaires
- **Zod** : Validation de schémas

### Backend

- **Express 4.21** : Framework web
- **TypeScript 5.6** : Typage statique
- **ESM (ES Modules)** : `"type": "module"` dans `package.json`
- **PostgreSQL (pg 8.16)** : Client PostgreSQL
- **express-session** : Gestion des sessions
- **Supabase JS** : Client Supabase REST API
- **node-cron** : Tâches planifiées

### Infrastructure

- **Vercel** : Hosting + Serverless Functions
- **Supabase** : PostgreSQL + Auth + REST API
- **Supavisor Pooler** : Connection pooling (port 6543)

---

## 🔧 Architecture backend

### Point d'entrée Vercel : `api/index.ts`

```typescript
// Handler serverless pour Vercel
export default async function handler(req: any, res: any) {
  // Guard : Rejette les requêtes non-API
  if (!path.startsWith('/api/')) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }
  
  // Routes publiques : publicApp (DB-free)
  if (isPublicRoute(path)) {
    const publicApp = await getPublicApp();
    return publicApp(req, res);
  }
  
  // Routes protégées : fullApp (lazy init)
  const fullApp = await getFullApp();
  return fullApp(req, res);
}
```

**Points clés :**
- ✅ Imports statiques (pas de `await import()` au top-level)
- ✅ Guard non-API (404 immédiat)
- ✅ Séparation public/protected
- ✅ Lazy init pour routes protégées

### Routes publiques : `server/publicApp.ts`

```typescript
export async function getPublicApp(): Promise<Express> {
  // Cache : Créé une seule fois
  if (_publicApp) return _publicApp;
  
  _publicApp = createPublicApp();
  return _publicApp;
}
```

**Caractéristiques :**
- ✅ **DB-free** : Aucune connexion PostgreSQL
- ✅ **Session-free** : Aucune session
- ✅ **Supabase REST uniquement** : Utilise `createClient()` de `@supabase/supabase-js`
- ✅ **Ultra rapide** : Répond en < 200ms
- ✅ **Safe à importer** : Pas d'init DB au top-level

**Routes publiques :**
- `GET /api/public/salon` : Infos salon
- `GET /api/public/salon/stylistes` : Liste stylistes
- `GET /api/public/salon/appointments` : Disponibilités
- `GET /api/reviews/google` : Stub reviews Google

### Routes protégées : `server/index.prod.ts`

```typescript
export async function getFullApp(): Promise<Express> {
  // Cache : Chargé une seule fois
  if (_fullApp) return _fullApp;
  
  // Lazy init : Import dynamique de index.ts
  const mod = await import('./index.js');
  _fullApp = mod.default || mod.app;
  return _fullApp;
}
```

**Caractéristiques :**
- ✅ **Lazy init** : Chargé uniquement si nécessaire
- ✅ **Cache** : Chargé une seule fois par invocation
- ✅ **DB + Session** : Connexion PostgreSQL + Session store
- ✅ **Import dynamique** : OK car dans fonction async

### App principale : `server/index.ts`

**Structure :**
1. **Handlers globaux** : `unhandledRejection`, `uncaughtException`
2. **Health checks** : PostgreSQL + Supabase REST
3. **Session store** : Lazy init avec fallback MemoryStore
4. **Middleware** : CORS, JSON, sessions, auth
5. **Routes** : `/api/auth/*`, `/api/salon/*`, `/api/salons/*`, etc.
6. **Export** : `export default app` pour Vercel

**Points clés :**
- ✅ Ne démarre pas de serveur HTTP sur Vercel
- ✅ Skip `printEnvStatus()` sur Vercel
- ✅ Configuration SSL PostgreSQL pour Supabase pooler
- ✅ Timeouts stricts (3s connection, 3s query)

### Configuration PostgreSQL : `server/db/client.ts`

```typescript
export function createPgClientConfig(connectionString?: string): ClientConfig {
  // Détection Supabase pooler
  const isPooler = DATABASE_URL.includes('pooler.supabase.com');
  const isSupabase = DATABASE_URL.includes('supabase.com');
  
  // SSL : rejectUnauthorized: false pour Supabase
  const sslConfig = (isPooler || isSupabase)
    ? { rejectUnauthorized: false }
    : false;
  
  // Timeouts stricts pour Vercel
  const timeouts = (isVercel || isProduction) ? {
    connectionTimeoutMillis: 3000,
    query_timeout: 3000,
    idleTimeoutMillis: 10000,
  } : {};
  
  return {
    connectionString: cleanConnectionString,
    ssl: sslConfig,
    keepAlive: true,
    max: 1, // Serverless : 1 connexion max
    ...timeouts,
  };
}
```

**Points clés :**
- ✅ SSL configuré pour Supabase pooler
- ✅ Timeouts stricts (évite FUNCTION_INVOCATION_TIMEOUT)
- ✅ `max: 1` pour serverless
- ✅ `keepAlive: true` pour pgbouncer

### Session Store : `server/sessionStore.ts`

```typescript
export function getSessionStoreSync(): session.Store {
  // Retourne MemoryStore immédiatement (non bloquant)
  // Init PG store en background
  if (sessionStoreInstance) return sessionStoreInstance;
  
  const fallbackStore = new MemoryStore();
  
  // Init PG store en background (non bloquant)
  initSessionStoreWithTimeout(3000).then(store => {
    sessionStoreInstance = store;
  });
  
  return fallbackStore;
}
```

**Stratégie :**
- ✅ **Lazy init** : Pas d'init au top-level
- ✅ **Timeout strict** : 3s max
- ✅ **Fallback automatique** : MemoryStore si PG indisponible
- ✅ **Non bloquant** : Ne bloque jamais le boot

---

## 🎨 Architecture frontend

### Point d'entrée : `client/src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Router : `client/src/App.tsx`

```typescript
function Router() {
  return (
    <Router>
      <Route path="/" component={LandingPage} />
      <Route path="/salon-login" component={SalonLogin} />
      <Route path="/dashboard" component={Dashboard} />
      {/* ... */}
    </Router>
  );
}
```

**Routing :**
- **Wouter** : Router léger (pas React Router)
- **Client-side** : Toutes les routes sont gérées côté client
- **Guards** : `SalonRouteGuard`, `ClientRouteGuard` pour protection

### Authentification : `client/src/contexts/AuthContext.tsx`

```typescript
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Vérifie l'état de session au mount
  useEffect(() => {
    checkAuth();
  }, []);
  
  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Points clés :**
- ✅ **Context API** : État global d'authentification
- ✅ **Auto-check** : Vérifie `/api/auth/user` au mount
- ✅ **Persistance** : Cookies HTTP-only (gérés par backend)

### API Client : `client/src/lib/apiClient.ts`

```typescript
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include', // IMPORTANT : Envoie les cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  // Gestion des erreurs
  if (!response.ok) {
    // 401 → Déconnexion
    if (response.status === 401) {
      // Rediriger vers login
    }
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
}
```

**Points clés :**
- ✅ **`credentials: 'include'`** : Obligatoire pour cookies
- ✅ **Gestion 401** : Déconnexion automatique
- ✅ **Type-safe** : Générique TypeScript

### React Query : `client/src/lib/queryClient.ts`

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});
```

**Usage :**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['salon', salonId],
  queryFn: () => apiRequest<Salon>(`/api/salons/${salonId}`),
});
```

---

## 🚀 Déploiement Vercel

### Configuration : `vercel.json`

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "functions": {
    "api/index.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

**Points clés :**
- ✅ **Rewrites** : `/api/*` → `api/index.ts`
- ✅ **SPA routing** : `/*` → `/index.html`
- ✅ **Timeout** : 30s max (éviter avec timeouts stricts)

### Variables d'environnement Vercel

**Obligatoires :**
- `SUPABASE_URL` : URL projet Supabase
- `SUPABASE_ANON_KEY` : Clé anonyme Supabase
- `SUPABASE_SERVICE_ROLE_KEY` : Clé service role (privée)
- `VITE_SUPABASE_URL` : URL pour client (identique à SUPABASE_URL)
- `VITE_SUPABASE_ANON_KEY` : Clé anonyme pour client
- `SESSION_SECRET` : Secret pour sessions Express
- `NODE_ENV` : `production`
- `DATABASE_URL` : URL PostgreSQL pooler Supabase (port 6543)

**Format DATABASE_URL (Supabase Pooler) :**
```
postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&connection_limit=1
```

**Optionnelles :**
- `RESEND_API_KEY` : Clé API Resend (emails)
- `CLICKSEND_USERNAME` : Username ClickSend (SMS)
- `CLICKSEND_API_KEY` : Clé API ClickSend
- `OPENAI_API_KEY` : Clé API OpenAI (IA vocale)

### Build process

1. **Vercel détecte** : `package.json` avec `"type": "module"`
2. **Build command** : `npm run build` (Vite build frontend)
3. **Output** : `dist/` (frontend statique)
4. **Functions** : `api/index.ts` compilé en serverless function

---

## 📝 Conventions de code

### Imports ESM (CRITIQUE pour Vercel)

**✅ CORRECT :**
```typescript
// Imports relatifs TypeScript : TOUJOURS avec .js
import { getPublicApp } from '../server/publicApp.js';
import { createPgClient } from './db/client.js';
import publicRouter from './routes/publicIsolated.js';
```

**❌ INCORRECT :**
```typescript
// Sans .js → ERR_MODULE_NOT_FOUND sur Vercel
import { getPublicApp } from '../server/publicApp';
import { createPgClient } from './db/client';
```

**Règle :**
- **Imports relatifs TypeScript** : Toujours `.js` (même si fichier source est `.ts`)
- **Imports npm** : Pas d'extension
- **Fichiers JS réels** : Garder `.js` (ex: `voice-agent.js`)

### Naming conventions

- **Fichiers** : `kebab-case.ts` (ex: `public-app.ts`)
- **Composants React** : `PascalCase.tsx` (ex: `Dashboard.tsx`)
- **Fonctions** : `camelCase` (ex: `getPublicApp()`)
- **Constantes** : `UPPER_SNAKE_CASE` (ex: `PUBLIC_ROUTES`)
- **Types/Interfaces** : `PascalCase` (ex: `User`, `Appointment`)

### Structure des fichiers

**Backend route :**
```typescript
// 1. Imports
import express from 'express';
import { createClient } from '@supabase/supabase-js';

// 2. Configuration
const router = express.Router();

// 3. Routes
router.get('/endpoint', async (req, res) => {
  // ...
});

// 4. Export
export default router;
```

**Frontend component :**
```typescript
// 1. Imports
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Types
interface Props {
  // ...
}

// 3. Component
export function Component({ ...props }: Props) {
  // ...
}

// 4. Export
export default Component;
```

### Logs

**Backend :**
```typescript
// Format : [CATEGORY] message
console.log('[BOOT] Application démarrée');
console.error('[DB] Erreur connexion PostgreSQL');
console.warn('[SESSION] Fallback vers MemoryStore');
```

**Frontend :**
```typescript
// Utiliser logger.ts (dev uniquement)
import { logger } from '@/lib/logger';
logger.debug('Component mounted');
logger.error('API error', error);
```

---

## 🔄 Procédures de développement

### 1. Ajouter une nouvelle route API

#### Route publique (DB-free)

**Étape 1 :** Ajouter dans `server/routes/publicIsolated.ts`
```typescript
publicRouter.get('/new-endpoint', async (req, res) => {
  // Utiliser uniquement Supabase REST
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await supabase.from('table').select('*');
  res.json(data);
});
```

**Étape 2 :** Ajouter dans `api/index.ts` (si nécessaire)
```typescript
const PUBLIC_ROUTES = [
  '/api/public/',
  '/api/reviews/google',
  '/api/public/new-endpoint', // Nouvelle route
];
```

**Points clés :**
- ✅ Aucune connexion PostgreSQL
- ✅ Aucune session
- ✅ Supabase REST uniquement
- ✅ Répond en < 200ms

#### Route protégée (DB + Session)

**Étape 1 :** Créer route dans `server/routes/` ou ajouter dans route existante
```typescript
// server/routes/salons.ts
router.get('/:salonId/new-endpoint', requireAuth, async (req, res) => {
  // Accès à req.user (via requireAuth middleware)
  // Accès à PostgreSQL via createPgClient()
  // ...
});
```

**Étape 2 :** Monter la route dans `server/index.ts`
```typescript
app.use('/api/salons', salonsRouter);
```

**Points clés :**
- ✅ Middleware `requireAuth` pour protection
- ✅ Accès à `req.user` (session)
- ✅ Accès à PostgreSQL si nécessaire
- ✅ Lazy init (chargé uniquement si besoin)

### 2. Ajouter un nouveau composant frontend

**Étape 1 :** Créer le composant
```typescript
// client/src/components/NewComponent.tsx
import React from 'react';

interface Props {
  // ...
}

export function NewComponent({ ...props }: Props) {
  return (
    <div>
      {/* ... */}
    </div>
  );
}

export default NewComponent;
```

**Étape 2 :** Utiliser dans une page
```typescript
// client/src/pages/dashboard.tsx
import NewComponent from '@/components/NewComponent';

export function Dashboard() {
  return (
    <div>
      <NewComponent />
    </div>
  );
}
```

**Points clés :**
- ✅ Utiliser `@/` alias pour imports
- ✅ TypeScript strict
- ✅ Composants fonctionnels (pas de classes)

### 3. Ajouter une nouvelle page

**Étape 1 :** Créer la page
```typescript
// client/src/pages/new-page.tsx
import { Route } from 'wouter';

export function NewPage() {
  return (
    <div>
      {/* ... */}
    </div>
  );
}
```

**Étape 2 :** Ajouter la route dans `client/src/App.tsx`
```typescript
<Route path="/new-page" component={NewPage} />
```

**Étape 3 :** Ajouter le guard si nécessaire
```typescript
<Route path="/new-page">
  <SalonRouteGuard>
    <NewPage />
  </SalonRouteGuard>
</Route>
```

### 4. Modifier la base de données

**Étape 1 :** Créer migration SQL
```sql
-- migrations/add_new_column.sql
ALTER TABLE appointments ADD COLUMN new_column TEXT;
```

**Étape 2 :** Appliquer via script
```typescript
// scripts/apply-migration.ts
import { createPgClient } from '../server/db/client.js';
// ...
```

**Étape 3 :** Tester localement
```bash
npm run test:db
```

**Étape 4 :** Appliquer sur Supabase
- Via Supabase Dashboard > SQL Editor
- Ou via script automatisé

### 5. Ajouter une variable d'environnement

**Étape 1 :** Ajouter dans `.env.example`
```bash
NEW_VAR=value
```

**Étape 2 :** Utiliser dans le code
```typescript
const newVar = process.env.NEW_VAR;
if (!newVar) {
  throw new Error('NEW_VAR is required');
}
```

**Étape 3 :** Configurer sur Vercel
- Vercel Dashboard > Settings > Environment Variables
- Ajouter pour Production, Preview, Development

**Points clés :**
- ✅ Variables `VITE_*` : Accessibles côté client
- ✅ Autres variables : Backend uniquement
- ✅ Ne jamais commiter `.env` (déjà dans `.gitignore`)

### 6. Tester avant de déployer

**Tests locaux :**
```bash
# Build
npm run build

# Test simulation Vercel
npm run test:vercel-prod

# Test DB
npm run test:db
```

**Vérifications :**
- ✅ Build réussit sans erreur
- ✅ Tests passent
- ✅ Aucune erreur `ERR_MODULE_NOT_FOUND`
- ✅ Routes publiques répondent en < 200ms
- ✅ Routes protégées fonctionnent

---

## ✅ Bonnes pratiques

### Backend

1. **Imports ESM** : Toujours `.js` sur imports relatifs TS
2. **Timeouts** : Toujours time-boxer les opérations DB (3s max)
3. **Error handling** : Toujours try/catch avec logs clairs
4. **Routes publiques** : DB-free, Supabase REST uniquement
5. **Routes protégées** : Lazy init, cache
6. **Sessions** : Fallback MemoryStore si PG indisponible
7. **Logs** : Format `[CATEGORY] message`

### Frontend

1. **API calls** : Toujours `credentials: 'include'`
2. **Error handling** : Gérer 401 (déconnexion), 500 (erreur serveur)
3. **Loading states** : Toujours afficher un état de chargement
4. **Type safety** : Utiliser TypeScript strict
5. **React Query** : Utiliser pour cache et synchronisation
6. **Composants** : Fonctionnels, pas de classes

### Vercel

1. **Cold starts** : Minimiser les imports au top-level
2. **Timeouts** : Time-boxer toutes les opérations (3s max)
3. **Routes publiques** : Isolées, DB-free
4. **Routes protégées** : Lazy init
5. **Variables d'env** : Configurer sur Vercel Dashboard
6. **DATABASE_URL** : Utiliser pooler Supabase (port 6543)

### Git

1. **Commits** : Messages clairs et descriptifs
2. **Branches** : `feature/`, `fix/`, `refactor/`
3. **PR** : Tester avant de merger
4. **`.env`** : Jamais commiter (déjà ignoré)

---

## 🚨 Points d'attention

### ⚠️ ERR_MODULE_NOT_FOUND

**Cause :** Imports relatifs TypeScript sans `.js`

**Solution :** Toujours ajouter `.js` sur imports relatifs TS
```typescript
// ❌ INCORRECT
import { func } from './module';

// ✅ CORRECT
import { func } from './module.js';
```

### ⚠️ FUNCTION_INVOCATION_TIMEOUT (30s)

**Cause :** Opérations DB trop longues

**Solution :** Timeouts stricts (3s connection, 3s query)
```typescript
const client = createPgClient();
// Timeout automatique via createPgClientConfig()
```

### ⚠️ SELF_SIGNED_CERT_IN_CHAIN

**Cause :** SSL PostgreSQL mal configuré

**Solution :** `ssl: { rejectUnauthorized: false }` pour Supabase
```typescript
// Déjà configuré dans server/db/client.ts
```

### ⚠️ Session cookie non envoyé

**Cause :** `credentials: 'include'` manquant

**Solution :** Toujours inclure dans fetch
```typescript
fetch('/api/endpoint', {
  credentials: 'include', // OBLIGATOIRE
});
```

### ⚠️ Routes publiques lentes

**Cause :** Import de modules DB/session

**Solution :** Utiliser uniquement `publicIsolated.ts` (DB-free)

---

## 📚 Ressources

### Documentation

- **Vercel** : https://vercel.com/docs
- **Supabase** : https://supabase.com/docs
- **Express** : https://expressjs.com/
- **React** : https://react.dev/
- **TypeScript** : https://www.typescriptlang.org/

### Scripts utiles

```bash
# Développement
npm run dev              # Démarre serveur dev
npm run build            # Build production
npm run check            # Vérification TypeScript

# Tests
npm run test:vercel-prod # Test simulation Vercel
npm run test:db          # Test connexion DB

# DB
npm run db:generate      # Génère migrations Drizzle
npm run db:push          # Push migrations
npm run db:studio        # Drizzle Studio
```

---

## 🎯 Checklist avant déploiement

- [ ] Build réussit : `npm run build`
- [ ] Tests passent : `npm run test:vercel-prod`
- [ ] Aucune erreur `ERR_MODULE_NOT_FOUND`
- [ ] Imports ESM corrects (`.js` sur relatifs TS)
- [ ] Variables d'environnement configurées sur Vercel
- [ ] `DATABASE_URL` utilise pooler Supabase (port 6543)
- [ ] Routes publiques DB-free
- [ ] Routes protégées avec lazy init
- [ ] Timeouts stricts (3s max)
- [ ] Logs clairs et formatés
- [ ] Code commenté si nécessaire

---

**Dernière mise à jour :** 2025-12-13  
**Version :** 1.0.0

