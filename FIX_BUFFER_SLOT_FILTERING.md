# 🔧 Fix: Buffer et arrondi des créneaux - Filtrage trop agressif

## 📋 Cause racine identifiée

**Le système appliquait un buffer de seulement 5 minutes sans arrondi au prochain pas de 15 minutes, ce qui pouvait exclure des créneaux valides et créer des gaps inutiles.**

### Diagnostic détaillé

1. **Buffer insuffisant** :
   - Buffer de 5 minutes seulement (devrait être 10-15 min pour un lead time réaliste)
   - Pas d'arrondi au prochain pas de 15 minutes

2. **Problème de logique** :
   - Comparaison directe `slot.start <= minSlotTime` sans arrondi
   - À 09:42 avec buffer 5min → minSlotTime = 09:47
   - Les slots 09:45, 10:00, 10:15, 10:30 sont générés
   - Mais 09:45 est filtré car < 09:47, et 10:00 peut être filtré selon la génération

3. **Résultat** :
   - À 09:42, le premier créneau proposé était 10:45 au lieu de 10:00 ou 10:15
   - Gaps inutiles dans les créneaux disponibles

## ✅ Solution appliquée

### 1. Buffer augmenté à 15 minutes

**Fichier** : `server/routes/publicIsolated.ts`

**Changement** :
- Buffer passé de 5 minutes à 15 minutes (lead time réaliste pour préparer un rendez-vous)
- Buffer également mis à jour côté frontend pour cohérence

### 2. Arrondi au prochain pas de 15 minutes

**Fichier** : `server/routes/publicIsolated.ts`

**Fonction ajoutée** :
```typescript
const ceilToNextStep = (date: Date, stepMinutes: number): Date => {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  const roundedMinutes = Math.ceil(totalMinutes / stepMinutes) * stepMinutes;
  const roundedDate = new Date(date);
  roundedDate.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);
  return roundedDate;
};
```

**Logique** :
- `minStart = now + bufferMinutes` (15 min)
- `minSlotTime = ceilToNextStep(minStart, stepMinutes)` (arrondi au prochain pas de 15 min)
- Filtrer : `slot.start < minSlotTime` (strictement inférieur)

### 3. Logs détaillés pour diagnostic

**Backend** :
```typescript
console.log(`[PUBLIC] [${requestId}] ⏰ now:`, now.toISOString());
console.log(`[PUBLIC] [${requestId}] ⏱️ bufferMinutes:`, BUFFER_MINUTES);
console.log(`[PUBLIC] [${requestId}] 📏 stepMinutes:`, slotStepMinutes);
console.log(`[PUBLIC] [${requestId}] ⏳ serviceDuration:`, serviceDuration, '(NON utilisé pour minStart)');
console.log(`[PUBLIC] [${requestId}] ✅ minStart (now + buffer):`, minStartWithBuffer.toISOString());
console.log(`[PUBLIC] [${requestId}] ✅ minSlotTime (arrondi):`, minSlotTime.toISOString());
console.log(`[PUBLIC] [${requestId}] 🔍 Premier slot avant filtrage:`, firstSlotBeforeFilter?.label);
console.log(`[PUBLIC] [${requestId}] ✅ Premier slot après filtrage:`, firstSlotAfterFilter);
```

**Frontend** :
```typescript
console.log(`[Book] ⏰ now:`, now.toISOString());
console.log(`[Book] ⏱️ bufferMinutes:`, bufferMinutes);
console.log(`[Book] 📏 stepMinutes:`, stepMinutes);
console.log(`[Book] ✅ minTime (arrondi):`, minTime.toISOString());
console.log(`[Book] ✅ Premier slot après filtrage:`, filteredSlots[0]);
```

### 4. Confirmation : serviceDuration non utilisé pour minStart

**Important** : `serviceDuration` n'est **PAS** utilisé pour calculer `minStart`. Il sert uniquement à :
- Vérifier que `slotStart + serviceDuration <= endOfWorkingHours`
- Générer les slots avec la bonne durée

## 📦 Fichiers modifiés

### Backend
- ✅ **`server/routes/publicIsolated.ts`** :
  - Buffer augmenté à 15 minutes
  - Fonction `ceilToNextStep` ajoutée
  - Arrondi au prochain pas de 15 minutes
  - Logs détaillés pour diagnostic

### Frontend
- ✅ **`client/src/pages/book.tsx`** :
  - Buffer augmenté à 15 minutes
  - Arrondi au prochain pas de 15 minutes
  - Logs détaillés pour diagnostic

## 🧪 Tests de validation

### Test 1 : À 09:42, sélectionner aujourd'hui

**Résultat attendu** :
- Buffer : 15 minutes → minStart = 09:57
- Arrondi au pas de 15 min → minSlotTime = 10:00
- Premier slot proposé : **10:00** ou **10:15** (selon les horaires)

**Vérification** :
1. Ouvrir https://witstyl.vercel.app/book
2. Étape 1 : Sélectionner un service
3. Étape 2 : Sélectionner un coiffeur
4. Étape 3 : Sélectionner aujourd'hui
5. Vérifier que le premier créneau est 10:00 ou 10:15 (pas 10:45)

### Test 2 : À 09:50, sélectionner aujourd'hui

**Résultat attendu** :
- Buffer : 15 minutes → minStart = 10:05
- Arrondi au pas de 15 min → minSlotTime = 10:15
- Premier slot proposé : **10:15**

### Test 3 : Date future

**Résultat attendu** :
- Tous les slots doivent être affichés (pas de filtrage temporel)

### Test 4 : Date passée

**Résultat attendu** :
- Aucun slot ne doit être affiché

### Test 5 : Vérifier les logs

**Backend (Vercel logs)** :
```
[PUBLIC] [xxx] ⏰ now: 2025-01-27T09:42:00.000Z
[PUBLIC] [xxx] ⏱️ bufferMinutes: 15
[PUBLIC] [xxx] 📏 stepMinutes: 15
[PUBLIC] [xxx] ⏳ serviceDuration: 30 (NON utilisé pour minStart)
[PUBLIC] [xxx] ✅ minStart (now + buffer): 2025-01-27T09:57:00.000Z
[PUBLIC] [xxx] ✅ minSlotTime (arrondi): 2025-01-27T10:00:00.000Z
[PUBLIC] [xxx] ✅ Premier slot après filtrage: 10:00
```

**Frontend (Console navigateur)** :
```
[Book] ⏰ now: 2025-01-27T09:42:00.000Z
[Book] ⏱️ bufferMinutes: 15
[Book] 📏 stepMinutes: 15
[Book] ✅ minTime (arrondi): 2025-01-27T10:00:00.000Z
[Book] ✅ Premier slot après filtrage: 10:00
```

## ✅ Résultat attendu

Après le déploiement Vercel (2-5 minutes) :

1. ✅ **Buffer de 15 minutes** appliqué (lead time réaliste)
2. ✅ **Arrondi au prochain pas de 15 minutes** pour éviter les gaps
3. ✅ **Premier créneau logique** : À 09:42 → premier slot 10:00 ou 10:15
4. ✅ **serviceDuration non utilisé** pour calculer minStart (uniquement pour validation)
5. ✅ **Logs détaillés** pour diagnostiquer les problèmes facilement

## 🔍 Notes importantes

- **Buffer de 15 minutes** : Lead time réaliste pour préparer un rendez-vous
- **Arrondi au pas de 15 minutes** : Évite les gaps et propose des créneaux cohérents
- **serviceDuration non utilisé** : La durée sert uniquement à valider que le slot rentre dans les horaires
- **Double filtrage** : Backend + Frontend pour sécurité maximale
- **Logs détaillés** : Permettent de diagnostiquer les problèmes facilement

## 🚀 Déploiement

Le code est commité et poussé sur `main`. Vercel va automatiquement déployer les changements dans les 2-5 prochaines minutes.

**Commits** :
- `bb78ab5` fix: improve buffer logic with 15min buffer and round to next 15min step
- `[commit]` fix: add detailed logging for slot filtering diagnostics

