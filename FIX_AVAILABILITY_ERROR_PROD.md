# 🔧 Fix: Erreur "Erreur lors du chargement des créneaux" à l'étape 3

## 📋 Cause racine identifiée

**En production sur Vercel, la route `/api/public/salon/availability` n'existe pas dans `publicIsolated.ts` qui est utilisé par `publicApp.ts` pour les routes publiques. Résultat: 404 ou erreur 500.**

### Diagnostic détaillé

1. **Architecture Vercel** :
   - Routes publiques → `api/index.ts` → `publicApp.ts` → `publicIsolated.ts`
   - Routes protégées → `api/index.ts` → `index.prod.ts` → `server/index.ts` → `public.ts`

2. **Route manquante** :
   - `/api/public/salon/availability` existe dans `server/routes/public.ts` (routes protégées)
   - `/api/public/salon/availability` **N'EXISTE PAS** dans `server/routes/publicIsolated.ts` (routes publiques)
   - Résultat : 404 ou erreur 500 quand le frontend appelle cette route

3. **Preuve** :
   - Le frontend appelle `/api/public/salon/availability`
   - En production, cette route passe par `publicApp.ts` → `publicIsolated.ts`
   - `publicIsolated.ts` n'a que `/salon` et `/salon/stylistes`, pas `/salon/availability`

## ✅ Solution appliquée

### 1. Ajout de la route `/salon/availability` dans `publicIsolated.ts`

**Fichier** : `server/routes/publicIsolated.ts`

**Route ajoutée** : Copie complète de la route depuis `public.ts` avec :
- Gestion d'erreur améliorée avec `requestId` pour le tracking
- Contrat API stable avec `success: true/false` et codes d'erreur
- Logs détaillés à chaque étape
- Fallback gracieux si certaines données ne peuvent pas être récupérées

### 2. Fonction `hasAppointmentConflict` ajoutée

**Fichier** : `server/routes/publicIsolated.ts`

**Fonction** : Vérifie les conflits de rendez-vous avec gestion d'erreur robuste

### 3. Logs de diagnostic améliorés côté frontend

**Fichier** : `client/src/pages/book.tsx`

**Améliorations** :
- Log de l'URL appelée
- Log du status code et statusText
- Log du body brut (preview)
- Log des erreurs détaillées
- Affichage du message d'erreur dans l'UI

### 4. Contrat API stable

**Format de réponse** :

```typescript
// Succès
{
  success: true,
  date: "2025-01-29",
  serviceId: "...",
  stylistId: "none",
  slotIntervalMinutes: 15,
  slots: [
    { time: "08:30", stylistIds: [...] },
    ...
  ]
}

// Erreur
{
  success: false,
  error: "BAD_REQUEST" | "SLOTS_FETCH_FAILED" | "FORBIDDEN",
  message: "Message utilisateur"
}
```

## 📦 Fichiers modifiés

### Backend
- ✅ **`server/routes/publicIsolated.ts`** : Ajout de la route `/salon/availability` complète
- ✅ **`server/routes/publicIsolated.ts`** : Ajout de la fonction `hasAppointmentConflict`

### Frontend
- ✅ **`client/src/pages/book.tsx`** : Logs de diagnostic améliorés
- ✅ **`client/src/pages/book.tsx`** : Affichage des erreurs amélioré

## 🧪 Tests de validation

### Test 1 : Vérifier que la route existe

```bash
# Tester l'API directement
curl "https://witstyl.vercel.app/api/public/salon/availability?date=2025-01-29&serviceId=<service-id>"

# Résultat attendu :
# {
#   "success": true,
#   "date": "2025-01-29",
#   "serviceId": "...",
#   "slots": [...]
# }
# OU
# {
#   "success": false,
#   "error": "BAD_REQUEST",
#   "message": "..."
# }
```

### Test 2 : Vérifier l'affichage dans l'UI

1. **Ouvrir** : https://witstyl.vercel.app/book
2. **Étape 1** : Sélectionner un service
3. **Étape 2** : Sélectionner un coiffeur (ou "Sans préférences")
4. **Étape 3** : Sélectionner une date
5. **Vérifier** :
   - Les créneaux s'affichent si disponibles
   - Les erreurs affichent un message clair
   - La console (F12) montre les logs détaillés

### Test 3 : Vérifier les logs Vercel

Dans les logs Vercel, chercher :
```
[PUBLIC] [xxx] hit GET /api/public/salon/availability
[PUBLIC] [xxx] Salon ID: ...
[PUBLIC] [xxx] Service trouvé: ...
[PUBLIC] [xxx] Horaires salon récupérés: X
[PUBLIC] [xxx] Horaires stylistes récupérés: X
[PUBLIC] [xxx] Résultat: X créneaux générés
```

## ✅ Résultat attendu

Après le déploiement Vercel (2-5 minutes) :

1. ✅ **La route `/api/public/salon/availability` existe** et répond correctement
2. ✅ **La page `/book` affiche les créneaux** à l'étape 3 si disponibles
3. ✅ **Les erreurs affichent des messages clairs** avec codes d'erreur
4. ✅ **Les logs permettent de diagnostiquer** les problèmes facilement

## 🔍 Diagnostic en cas de problème

### Erreur 404

1. **Vérifier** que la route est bien montée :
   ```bash
   curl "https://witstyl.vercel.app/api/public/salon/availability?date=2025-01-29&serviceId=test"
   ```

2. **Vérifier les logs Vercel** :
   - Chercher `[PUBLIC] hit GET /api/public/salon/availability`
   - Si absent, la route n'est pas montée

### Erreur 500

1. **Vérifier les logs Vercel** :
   - Chercher `[PUBLIC] [xxx] Erreur`
   - Vérifier le message d'erreur exact

2. **Vérifier les variables d'environnement** :
   - `SUPABASE_URL` doit être défini
   - `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_ANON_KEY` doit être défini

### Aucun créneau affiché

1. **Vérifier les logs** :
   - `[PUBLIC] [xxx] Horaires salon récupérés: X`
   - `[PUBLIC] [xxx] Horaires stylistes récupérés: X`
   - `[PUBLIC] [xxx] Résultat: X créneaux générés`

2. **Vérifier les données en base** :
   - Les horaires du salon existent pour le jour sélectionné
   - Les horaires des stylistes existent pour le jour sélectionné
   - Les stylistes sont actifs

## 📝 Notes importantes

- **Route ajoutée** : La route `/salon/availability` est maintenant disponible dans `publicIsolated.ts`
- **Contrat API stable** : Toutes les réponses suivent le format `{ success: boolean, ... }`
- **Logs détaillés** : Chaque requête a un `requestId` pour le tracking
- **Gestion d'erreur robuste** : Les erreurs sont capturées et retournées avec des codes stables

