# Fix : Stabilisation de l'authentification - Gestion des credentials

## 🎯 Problème identifié

Les requêtes vers les routes protégées renvoyaient parfois 401/400 car les cookies de session n'étaient pas envoyés systématiquement.

## ✅ Corrections apportées

### 1. Ajout de `credentials: 'include'` aux appels fetch manquants

#### Fichiers corrigés :

1. **`client/src/pages/book-client.tsx`**
   - Ligne 148 : Ajout de `credentials: 'include'` pour `/api/salons/${salonId}/services`

2. **`client/src/pages/calendar.tsx`**
   - Ligne 548 : Ajout de `credentials: 'include'` pour PUT `/api/appointments/${id}`

3. **`client/src/pages/hours.tsx`**
   - Ligne 371 : Ajout de `credentials: 'include'` pour PUT `/api/salons/${salon.id}/hours`
   - Ligne 417 : Ajout de `credentials: 'include'` pour PUT `/api/salons/${salon.id}/stylist-hours/${stylistId}`
   - Ligne 509 : Ajout de `credentials: 'include'` pour POST `/api/salons/${salon.id}/closed-dates`

4. **`client/src/pages/book.tsx`**
   - Ligne 119 : Ajout de `credentials: 'include'` pour `/api/salons/${salonId}/services`

### 2. Amélioration de la gestion des erreurs 401

#### `client/src/lib/apiClient.ts`
- Amélioration de la gestion des erreurs 401
- Ajout d'un événement `auth:unauthorized` pour invalider l'état auth dans tous les contextes
- Redirection automatique vers la page de login appropriée

#### `client/src/lib/queryClient.ts`
- Ajout de la gestion des erreurs 401 dans `apiRequest`
- Déclenchement de l'événement `auth:unauthorized` pour invalider la session

#### `client/src/contexts/AuthContext.tsx`
- Ajout d'un listener pour l'événement `auth:unauthorized`
- Invalidation automatique de la session lors d'une erreur 401

### 3. Création d'utilitaires pour garantir les credentials

#### `client/src/lib/ensureCredentials.ts` (nouveau fichier)
- Fonction `fetchWithCredentials` : wrapper autour de fetch qui garantit `credentials: 'include'`
- Fonction `smartFetch` : fetch intelligent qui ajoute automatiquement credentials pour les routes protégées
- Fonction `isProtectedRoute` : détecte si une route nécessite des credentials

## 📋 Routes protégées vérifiées

Toutes les routes suivantes ont maintenant `credentials: 'include'` :

- ✅ `/api/salon`
- ✅ `/api/clients`
- ✅ `/api/salons/:salonId/appointments`
- ✅ `/api/salons/:salonId/hours`
- ✅ `/api/salons/:salonId/stylistes`
- ✅ `/api/salons/:salonId/stylist-hours`
- ✅ `/api/salons/:salonId/closed-dates`
- ✅ `/api/auth/verify-salon`
- ✅ `/api/appointments/:id` (PUT)

## 🔍 Vérifications effectuées

- ✅ Tous les appels fetch vers les routes protégées ont `credentials: 'include'`
- ✅ Le client API centralisé (`apiClient`) garantit toujours les credentials
- ✅ La fonction `apiRequest` garantit toujours les credentials
- ✅ Gestion des erreurs 401 améliorée avec invalidation automatique de la session
- ✅ Événement `auth:unauthorized` pour synchroniser tous les contextes d'auth

## 🎯 Résultat attendu

- ✅ Plus d'erreurs 401 aléatoires sur les routes protégées
- ✅ Les cookies de session sont toujours envoyés
- ✅ Les erreurs 401 invalident automatiquement la session et redirigent vers login
- ✅ Tous les contextes d'auth sont synchronisés lors d'une erreur 401

## 📊 Stratégie choisie

1. **Client API centralisé** : `apiClient` et `apiRequest` garantissent toujours `credentials: 'include'`
2. **Gestion centralisée des 401** : Événement `auth:unauthorized` pour synchroniser tous les contextes
3. **Migration progressive** : Les appels fetch directs ont été corrigés, mais l'idéal serait de migrer vers `apiClient` ou `apiRequest`

## 🔄 Prochaines étapes recommandées

1. Migrer progressivement tous les appels fetch directs vers `apiClient` ou `apiRequest`
2. Utiliser `fetchWithCredentials` ou `smartFetch` pour les nouveaux appels
3. Vérifier que tous les hooks React Query utilisent bien `credentials: 'include'`

