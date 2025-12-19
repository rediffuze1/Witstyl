# 🔧 Fix: Erreur 404 "Not found" sur /api/public/salon/availability

## 📋 Cause racine identifiée

**En production sur Vercel, la route `/api/public/salon/availability` n'existait pas dans `publicIsolated.ts` qui est utilisé par `publicApp.ts` pour les routes publiques. Résultat: 404 "Not found".**

### Diagnostic détaillé

1. **Architecture Vercel** :
   - Routes publiques → `api/index.ts` → `publicApp.ts` → `publicIsolated.ts`
   - Routes protégées → `api/index.ts` → `index.prod.ts` → `server/index.ts` → `public.ts`

2. **Route manquante** :
   - `/api/public/salon/availability` existait dans `server/routes/public.ts` (routes protégées)
   - `/api/public/salon/availability` **N'EXISTAIT PAS** dans `server/routes/publicIsolated.ts` (routes publiques)
   - Résultat : 404 quand le frontend appelle cette route en production

3. **Preuve** :
   ```bash
   curl "https://witstyl.vercel.app/api/public/salon/availability?date=2025-01-29&serviceId=test"
   # Retournait: {"error":"Not found"}
   ```

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

### 3. Contrat API stable

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
- ✅ **`server/routes/publicIsolated.ts`** : Ajout de la route `/salon/availability` complète (456 lignes ajoutées)

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
   - Les erreurs affichent un message clair (pas "Not found")
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

1. ✅ **La route `/api/public/salon/availability` existe** et répond correctement (pas de 404)
2. ✅ **La page `/book` affiche les créneaux** à l'étape 3 si disponibles
3. ✅ **Les erreurs affichent des messages clairs** avec codes d'erreur (pas "Not found")
4. ✅ **Les logs permettent de diagnostiquer** les problèmes facilement

## 🔍 Diagnostic en cas de problème

### Erreur 404 persistante

1. **Vérifier** que la route est bien montée :
   ```bash
   curl "https://witstyl.vercel.app/api/public/salon/availability?date=2025-01-29&serviceId=test"
   ```

2. **Vérifier les logs Vercel** :
   - Chercher `[PUBLIC] [xxx] hit GET /api/public/salon/availability`
   - Si absent, la route n'est pas montée

3. **Vérifier le routing Vercel** :
   - `vercel.json` doit avoir `"source": "/api/(.*)", "destination": "/api/index"`
   - `api/index.ts` doit router vers `publicApp.ts` pour `/api/public/*`

### Erreur 500

1. **Vérifier les logs Vercel** :
   - Chercher `[PUBLIC] [xxx] Erreur`
   - Vérifier le message d'erreur exact

2. **Vérifier les variables d'environnement** :
   - `SUPABASE_URL` doit être défini
   - `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_ANON_KEY` doit être défini

## 📝 Notes importantes

- **Route ajoutée** : La route `/salon/availability` est maintenant disponible dans `publicIsolated.ts`
- **Contrat API stable** : Toutes les réponses suivent le format `{ success: boolean, ... }`
- **Logs détaillés** : Chaque requête a un `requestId` pour le tracking
- **Gestion d'erreur robuste** : Les erreurs sont capturées et retournées avec des codes stables

## 🚀 Déploiement

Le code est commité et poussé sur `main`. Vercel va automatiquement déployer les changements dans les 2-5 prochaines minutes.

**Commits** :
- `984b67a` fix: add missing /salon/availability route to publicIsolated.ts

