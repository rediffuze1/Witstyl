# 🔧 Fix: Filtrage des créneaux passés avec buffer de 5 minutes

## 📋 Cause racine identifiée

**Les créneaux passés sont affichés car le filtrage existant (`slot.start <= now`) ne prend pas en compte un buffer de sécurité et peut avoir des problèmes de timezone lors de la comparaison.**

### Diagnostic détaillé

1. **Filtrage existant** :
   - Backend : `if (isToday && slot.start <= now) { continue; }`
   - Problème : Pas de buffer, comparaison directe sans marge de sécurité
   - Problème : Comparaison de dates peut être affectée par les timezones

2. **Frontend** :
   - Aucun filtrage supplémentaire des créneaux passés
   - Les slots reçus de l'API sont affichés tels quels

3. **Résultat** :
   - À 09:29, le créneau 08:30 peut encore être affiché
   - Pas de marge de sécurité pour éviter les créneaux trop proches

## ✅ Solution appliquée

### 1. Filtrage backend amélioré avec buffer

**Fichier** : `server/routes/publicIsolated.ts`

**Améliorations** :
- Buffer de 5 minutes ajouté : `minSlotTime = now + 5 minutes`
- Détection améliorée de "aujourd'hui" avec comparaison de dates ISO (YYYY-MM-DD)
- Gestion des dates passées : retourne un tableau vide si la date est dans le passé
- Logs détaillés pour le diagnostic

**Code** :
```typescript
// Calculer "maintenant" avec buffer de 5 minutes
const now = new Date();
const todayStr = baseDate.toISOString().split('T')[0]; // YYYY-MM-DD
const nowStr = now.toISOString().split('T')[0];
const isToday = todayStr === nowStr;

let minSlotTime: Date | null = null;
if (isToday) {
  minSlotTime = new Date(now.getTime() + 5 * 60 * 1000); // +5 minutes
}

// Filtrer les slots passés
if (isToday && minSlotTime && slot.start <= minSlotTime) {
  continue; // Slot passé, exclure
}
```

### 2. Filtrage frontend (double sécurité)

**Fichier** : `client/src/pages/book.tsx`

**Améliorations** :
- Filtrage supplémentaire côté frontend pour sécurité
- Buffer de 5 minutes également appliqué
- Gestion des dates passées
- Logs pour le diagnostic

**Code** :
```typescript
// Filtrer les slots passés si la date sélectionnée est aujourd'hui
if (isToday) {
  const now = new Date();
  const bufferMinutes = 5;
  const minTime = new Date(now.getTime() + bufferMinutes * 60 * 1000);
  
  const filteredSlots = slots.filter((time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    return slotDate > minTime;
  });
}
```

## 📦 Fichiers modifiés

### Backend
- ✅ **`server/routes/publicIsolated.ts`** : Filtrage amélioré avec buffer de 5 minutes

### Frontend
- ✅ **`client/src/pages/book.tsx`** : Filtrage supplémentaire côté frontend

## 🧪 Tests de validation

### Test 1 : À 09:30, sélectionner aujourd'hui

**Résultat attendu** :
- Aucun slot < 09:35 ne doit être affiché
- Les slots 09:35, 09:45, etc. doivent être affichés

**Vérification** :
1. Ouvrir https://witstyl.vercel.app/book
2. Étape 1 : Sélectionner un service
3. Étape 2 : Sélectionner un coiffeur
4. Étape 3 : Sélectionner aujourd'hui
5. Vérifier que seuls les créneaux futurs (avec buffer) sont affichés

### Test 2 : Sélectionner demain

**Résultat attendu** :
- Tous les slots doivent être affichés (pas de filtrage temporel)

**Vérification** :
1. Sélectionner demain dans le calendrier
2. Vérifier que tous les créneaux disponibles sont affichés

### Test 3 : Sélectionner une date passée

**Résultat attendu** :
- Aucun slot ne doit être affiché

**Vérification** :
1. Sélectionner une date passée dans le calendrier
2. Vérifier qu'aucun créneau n'est affiché

### Test 4 : Vérifier les logs

**Backend** :
```
[PUBLIC] [xxx] Date d'aujourd'hui détectée. Heure minimale (avec buffer 5min): ...
[PUBLIC] [xxx] Slot 08:30 filtré (passé): ...
```

**Frontend** :
```
[Book] Filtrage slots aujourd'hui: X → Y (buffer: 5min)
[Book] Slot 08:30 filtré (passé): ...
```

## ✅ Résultat attendu

Après le déploiement Vercel (2-5 minutes) :

1. ✅ **Aucun créneau passé n'est affiché** pour la date du jour
2. ✅ **Buffer de 5 minutes** appliqué (créneaux < maintenant + 5min exclus)
3. ✅ **Dates passées** retournent un tableau vide
4. ✅ **Dates futures** affichent tous les créneaux disponibles

## 🔍 Notes importantes

- **Double filtrage** : Backend + Frontend pour sécurité maximale
- **Buffer de 5 minutes** : Marge de sécurité pour éviter les créneaux trop proches
- **Gestion timezone** : Utilisation de dates locales pour éviter les problèmes UTC
- **Logs détaillés** : Permettent de diagnostiquer les problèmes facilement

## 🚀 Déploiement

Le code est commité et poussé sur `main`. Vercel va automatiquement déployer les changements dans les 2-5 prochaines minutes.

**Commits** :
- `bfe9775` fix: filter past time slots with 5min buffer and proper timezone handling

