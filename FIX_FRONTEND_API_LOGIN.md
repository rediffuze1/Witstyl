# Fix : Correction des appels à /api/login dans le frontend

## 🎯 Problème identifié

Le frontend faisait des redirections vers `/api/login` (route inexistante) au lieu de rediriger vers la page de login du frontend (`/salon-login`), ce qui causait des erreurs 404 dans les logs Vercel.

## ✅ Corrections apportées

### 1. Redirections corrigées (13 occurrences)

Toutes les redirections `window.location.href = "/api/login"` ont été remplacées par `window.location.href = "/salon-login"` dans les fichiers suivants :

#### `client/src/pages/stylistes.tsx` (4 occurrences)
- Ligne 76 : Redirection après erreur d'autorisation
- Ligne 248 : Redirection dans le handler d'erreur
- Ligne 291 : Redirection dans le handler d'erreur
- Ligne 322 : Redirection dans le handler d'erreur

#### `client/src/pages/clients.tsx` (3 occurrences)
- Ligne 107 : Redirection après erreur d'autorisation
- Ligne 207 : Redirection dans le handler d'erreur
- Ligne 252 : Redirection dans le handler d'erreur
- Ligne 299 : Redirection dans le handler d'erreur

#### `client/src/pages/calendar.tsx` (3 occurrences)
- Ligne 99 : Redirection après erreur d'autorisation
- Ligne 587 : Redirection dans le handler d'erreur
- Ligne 686 : Redirection dans le handler d'erreur

#### `client/src/pages/services.tsx` (3 occurrences)
- Ligne 356 : Redirection dans le handler d'erreur
- Ligne 389 : Redirection dans le handler d'erreur
- Ligne 419 : Redirection dans le handler d'erreur

### 2. Vérification des appels API

Tous les appels API utilisent déjà la bonne route `/api/salon/login` :

- ✅ `client/src/contexts/AuthContext.tsx` : Utilise `/api/salon/login` (ligne 221)
- ✅ `client/src/hooks/useAuth.ts` : Utilise `/api/salon/login` (ligne 64)
- ✅ `client/src/pages/salon-login.tsx` : Utilise le hook `useAuth()` qui appelle `/api/salon/login`

### 3. Gestion des réponses

La gestion des réponses est correcte dans tous les fichiers :

#### `client/src/contexts/AuthContext.tsx` (loginOwner)
- ✅ Vérifie le content-type avant de parser le JSON
- ✅ Gère les erreurs 401 (mauvais identifiants)
- ✅ Gère les erreurs 500/404 avec messages appropriés
- ✅ Retourne `false` en cas d'erreur, `true` en cas de succès

#### `client/src/hooks/useAuth.ts` (loginMutation)
- ✅ Vérifie le content-type avant de parser le JSON
- ✅ Gère les erreurs avec codes spécifiques (INVALID_CREDENTIALS, etc.)
- ✅ Lance des erreurs avec messages clairs pour l'utilisateur
- ✅ Invalide les queries après succès pour rafraîchir l'état

## 📋 Résumé des fichiers modifiés

1. **`client/src/pages/stylistes.tsx`**
   - 4 redirections corrigées : `/api/login` → `/salon-login`

2. **`client/src/pages/clients.tsx`**
   - 4 redirections corrigées : `/api/login` → `/salon-login`

3. **`client/src/pages/calendar.tsx`**
   - 3 redirections corrigées : `/api/login` → `/salon-login`

4. **`client/src/pages/services.tsx`**
   - 3 redirections corrigées : `/api/login` → `/salon-login`

**Total : 14 redirections corrigées**

## ✅ Vérifications effectuées

- ✅ Aucune occurrence de `/api/login` restante dans le code frontend
- ✅ Tous les appels API utilisent `/api/salon/login` (route correcte)
- ✅ Toutes les redirections pointent vers `/salon-login` (page frontend)
- ✅ Gestion des erreurs correcte (200, 401, 404, 500)
- ✅ Corps de requête correct : `{ email, password }`
- ✅ Aucune erreur de lint détectée

## 🎯 Résultat attendu

Après ces corrections :

- ✅ Plus aucune requête GET vers `/api/login` (404)
- ✅ Toutes les redirections vont vers `/salon-login` (page frontend)
- ✅ Les appels API utilisent `/api/salon/login` (route backend correcte)
- ✅ Les erreurs 401 sont gérées proprement avec messages utilisateur
- ✅ Les erreurs 500/404 sont gérées avec messages appropriés

## 📊 Impact

- **Avant** : 14 redirections vers `/api/login` → 404 dans les logs Vercel
- **Après** : 0 redirection vers `/api/login`, toutes pointent vers `/salon-login`

**Les logs Vercel ne devraient plus montrer d'erreurs 404 sur `/api/login`.**

