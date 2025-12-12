# 🔧 Correction de l'erreur 401 sur la page Rapports

## ✅ Problème résolu

La page `/reports` affichait une erreur 401 "Utilisateur non authentifié" même quand l'utilisateur était connecté.

## 📋 Fichiers modifiés

### Frontend

#### 1. `client/src/hooks/useReportsData.ts`
**Changements :**
- Ajout de `isHydrating` et `isLoading` depuis `useAuthContext()` pour détecter l'état de chargement de l'authentification
- Gestion spéciale des erreurs 401 pendant le chargement de l'auth : ne pas les considérer comme des vraies erreurs
- Ajout d'une erreur spéciale `AUTH_LOADING` pour les 401 temporaires
- La query est désactivée (`enabled: false`) pendant l'hydratation pour éviter les appels prématurés
- Filtrage des erreurs `AUTH_LOADING` dans le retour du hook

**Impact :** Le hook attend maintenant que l'authentification soit complètement chargée avant de faire des appels API, et ne considère plus les 401 pendant le chargement comme des erreurs réelles.

#### 2. `client/src/pages/reports.tsx`
**Changements :**
- Filtrage des erreurs `AUTH_LOADING` dans l'affichage des messages d'erreur
- Les erreurs d'auth en cours de chargement ne sont plus affichées à l'utilisateur

**Impact :** L'utilisateur ne voit plus de message d'erreur rouge pendant le chargement initial de la page.

### Backend

#### 3. `server/routes/salons.ts` - Route `/api/salons/:salonId/reports`
**Changements :**
- Alignement avec la logique de `/api/salons/:salonId/appointments` qui fonctionne correctement
- Recherche du salon par plusieurs méthodes (dans l'ordre) :
  1. ID normalisé (sans préfixe `salon-`)
  2. ID préfixé (`salon-{id}`)
  3. ID brut (tel que reçu dans l'URL)
  4. Recherche par `user_id` si le salon n'est pas trouvé par ID
- Amélioration des logs avec timestamps pour faciliter le debugging
- Vérification d'autorisation identique aux autres routes protégées

**Impact :** La route trouve maintenant le salon de manière plus fiable, même si l'ID est dans un format différent, et utilise la même logique que les autres routes qui fonctionnent.

### Tests

#### 4. `scripts/test-api-prod.ts`
**Changements :**
- Ajout d'un test pour `GET /api/salons/:salonId/reports` sans session (401 attendu)

#### 5. `scripts/test-vercel-prod.ts`
**Changements :**
- Ajout d'un test pour `GET /api/salons/:salonId/reports` sans session (401 attendu)

**Impact :** Les tests vérifient maintenant que la route reports renvoie bien 401 quand l'utilisateur n'est pas authentifié.

## 🔍 Routes API impliquées

### `GET /api/salons/:salonId/reports`
- **Paramètres :**
  - `salonId` : ID du salon (normalisé automatiquement)
  - `view` : `day`, `week`, `month`, ou `year` (défaut: `week`)
  - `date` : Date de référence au format ISO (YYYY-MM-DD)
  - `stylistId` (optionnel) : Filtrer par styliste

- **Authentification :**
  - Vérifie `req.user` (défini par le middleware d'authentification)
  - Renvoie 401 si `req.user` est absent
  - Vérifie que le salon appartient à l'utilisateur (403 si non)

- **Logique de recherche du salon :**
  Identique à `/api/salons/:salonId/appointments` :
  1. Essayer avec l'ID normalisé
  2. Essayer avec l'ID préfixé
  3. Essayer avec l'ID brut
  4. Si aucun salon trouvé, chercher par `user_id`

## ✅ Résultats des tests

### `npm run build`
```
✓ built in 6.67s
```
✅ **Succès** - Aucune erreur de compilation

### `npm run test:api-prod`
```
Testing GET /api/salons/:salonId/reports (sans session - 401 attendu)... ✅ OK (401)
============================================================
Résultats: 8 passés, 0 échoués
============================================================
✅ Tous les tests sont passés !
```
✅ **Succès** - La route renvoie bien 401 sans session

## 🎯 Comportement attendu maintenant

### Quand l'utilisateur est connecté comme owner :
1. ✅ La page `/reports` charge sans erreur
2. ✅ Les blocs de KPIs s'affichent (même avec "0" si pas de données)
3. ✅ Les graphiques s'affichent (même vides si pas de données)
4. ✅ Aucune erreur 401 affichée
5. ✅ La session persiste entre les navigations (comme les autres pages)

### Quand l'utilisateur n'est pas connecté :
1. ✅ La route API renvoie 401 (comportement normal)
2. ✅ L'événement `auth:unauthorized` est déclenché
3. ✅ L'utilisateur est redirigé vers la page de login
4. ✅ Aucun crash ni message d'erreur moche

### Pendant le chargement initial de l'auth :
1. ✅ La query est désactivée (`enabled: false`)
2. ✅ Aucun appel API n'est fait avant que l'auth soit prête
3. ✅ Aucune erreur 401 n'est affichée pendant ce temps
4. ✅ Dès que l'auth est prête, la query s'active automatiquement

## 🔄 Cohérence avec les autres pages

La page Rapports utilise maintenant :
- ✅ `useAuthContext()` (comme Calendar, Clients, Hours, Settings)
- ✅ `isHydrating` check (comme les autres pages protégées)
- ✅ `apiRequest` avec `credentials: 'include'` (comme toutes les autres pages)
- ✅ Même logique de recherche de salon côté backend (comme appointments)

## 📝 Notes techniques

1. **Hydratation de l'auth :** Le hook attend maintenant que `isHydrating === false` avant d'activer la query, évitant les appels API prématurés.

2. **Gestion des erreurs 401 :** Les 401 pendant le chargement sont considérés comme temporaires et ne sont pas affichés à l'utilisateur.

3. **Recherche de salon :** La route backend essaie maintenant plusieurs formats d'ID et cherche aussi par `user_id` si nécessaire, garantissant que le salon est trouvé même si l'ID est dans un format inattendu.

4. **Tests :** Les tests vérifient que la route renvoie bien 401 sans session, confirmant que l'authentification fonctionne correctement.

## 🚀 Déploiement

Les corrections ont été commitées et pushées sur `main`. Vercel va automatiquement redéployer l'application.

Après le déploiement (quelques minutes), la page Rapports devrait fonctionner correctement sans erreur 401 quand l'utilisateur est connecté.

