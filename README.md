# Witstyl

Application web de prise de rendez-vous pour salons de coiffure.

## 🚀 Démarrage rapide

```bash
# Installation
npm install

# Configuration
cp .env.example .env
# Éditer .env avec vos clés Supabase

# Démarrage
npm run dev
```

L'application sera accessible sur http://localhost:5001/

## 📚 Documentation

- `CONTRIBUTING.md` - Guide de contribution et configuration
- `.env.example` - Exemple de configuration

## 🛠️ Scripts

- `npm run dev` - Démarrage en mode développement
- `npm run build` - Build de production
- `npm start` - Démarrage en mode production
- `npm run check` - Vérification TypeScript

## 📁 Structure

```
Witstyl/
├── client/          # Application React/Vite
├── server/          # Serveur Express
├── shared/          # Code partagé
└── sql/             # Scripts SQL
```

## 🔐 Configuration

Voir `CONTRIBUTING.md` pour la configuration complète.

### ⚠️ Configuration Vercel + Supabase

**IMPORTANT:** Pour les déploiements sur Vercel, vous **DEVEZ** utiliser le pooler Supavisor (Transaction Mode) au lieu de la connexion PostgreSQL directe.

**Pourquoi?**
- La connexion directe (`db.*.supabase.co`) peut échouer avec des erreurs DNS sur Vercel
- Le pooler est optimisé pour les environnements serverless
- Supporte IPv4 (la connexion directe nécessite IPv6)

**Comment configurer:**
1. Exécutez `npm run print:db-instructions` pour afficher les instructions détaillées
2. Obtenez l'URL du pooler depuis Supabase Dashboard > Settings > Database > Connect > Transaction Mode
3. Configurez `DATABASE_URL` dans Vercel avec cette URL (format: `postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`)
4. Testez avec `npm run test:db`

Voir `FIX_VERCEL_POOLER.md` pour plus de détails.

## 📅 Calendrier interne

Le calendrier interne permet de gérer les rendez-vous directement dans l'application, sans dépendance externe.

### Fonctionnalités

- **Vues disponibles** : Semaine et Jour (vue Mois à venir)
- **Gestion des événements** : Création, modification, suppression
- **Prévention de chevauchement** : Les événements qui se chevauchent sont automatiquement détectés et refusés
- **Paramètres configurables** :
  - Heures d'ouverture/fermeture
  - Durée des créneaux (par défaut 15 minutes)
  - Marge entre rendez-vous (optionnel)
  - Premier jour de la semaine (Lundi/Dimanche)
- **Fuseau horaire** : Europe/Zurich
- **Formats** : Français (Intl)

### Persistance

Actuellement, les données sont stockées dans le `localStorage` du navigateur (clé: `witstyl.calendar.v1`).

### Migration vers Supabase

Le calendrier utilise un pattern repository (`CalendarRepo`) qui facilite la migration vers Supabase. Pour migrer :

1. Créer `client/src/calendar/repo.supabase.ts` qui implémente l'interface `CalendarRepo`
2. Remplacer `localCalendarRepo` par `supabaseCalendarRepo` dans `store.tsx`
3. Les événements seront alors synchronisés avec Supabase

Exemple de structure pour `repo.supabase.ts` :

```typescript
import { createClient } from '@supabase/supabase-js';
import type { CalendarRepo, CalendarEvent, CalendarSettings } from './types';

export class SupabaseCalendarRepo implements CalendarRepo {
  private supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async list(): Promise<CalendarEvent[]> {
    const { data } = await this.supabase
      .from('calendar_events')
      .select('*');
    return data || [];
  }
  
  // ... autres méthodes
}
```

### Limites du MVP

- Pas de synchronisation multi-appareils (localStorage uniquement)
- Pas de notifications/rappel
- Vue Mois non implémentée
- Pas de drag & drop pour repositionner les événements

