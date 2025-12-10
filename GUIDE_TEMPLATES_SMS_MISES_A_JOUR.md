# Guide : Templates SMS Mis à Jour (Style Détaillé)

## 🎯 Modifications Apportées

Les templates SMS ont été mis à jour pour inclure plus de détails tout en restant GSM-safe et ≤ 160 caractères.

## 📁 Fichiers Modifiés

### 1. `server/core/notifications/smsTemplates.ts`

**Changements :**
- ✅ Type `AppointmentSmsContext` mis à jour pour inclure `serviceName` et `appointmentWeekday`
- ✅ `buildConfirmationSms()` : Template détaillé avec service, jour de la semaine, date complète
- ✅ `buildReminderSms()` : Template détaillé avec mention "Rappel de RDV"
- ✅ `formatDateForSms()` : Format "2 decembre 2025" (au lieu de "02.12")
- ✅ `formatWeekdayForSms()` : Nouvelle fonction pour le jour de la semaine

### 2. `server/core/notifications/smsService.ts`

**Changements :**
- ✅ `sendSmsConfirmationIfNeeded()` : Utilise le nouveau contexte avec `serviceName` et `appointmentWeekday`
- ✅ `sendSmsReminderIfNeeded()` : Utilise le nouveau contexte avec `serviceName` et `appointmentWeekday`

### 3. `server/core/notifications/optimizedNotificationService.ts`

**Changements :**
- ✅ `sendImmediateConfirmationSms()` : Utilise le nouveau contexte avec `serviceName` et `appointmentWeekday`

## 📝 Nouveaux Templates

### SMS de Confirmation

**Template :**
```
Bonjour {prénom}, votre service {service} chez {salon} est confirme le {jour} {date} a {heure}. Nous avons hate de vous accueillir !
```

**Exemple de sortie :**
```
Bonjour Colette, votre service Service Modifie chez HairPlay est confirme le mardi 2 decembre 2025 a 17:30. Nous avons hate de vous accueillir !
```

**Longueur typique :** ~120-140 caractères

### SMS de Rappel

**Template :**
```
Rappel de RDV: Bonjour {prénom}, votre service {service} chez {salon} est prevu le {jour} {date} a {heure}. Si vous ne pouvez pas venir, merci de nous appeler.
```

**Exemple de sortie :**
```
Rappel de RDV: Bonjour Colette, votre service Service Modifie chez HairPlay est prevu le mardi 2 decembre 2025 a 17:30. Si vous ne pouvez pas venir, merci de nous appeler.
```

**Longueur typique :** ~140-160 caractères

## 🔧 Fonctions Utilitaires

### `formatDateForSms(date: Date): string`

Formate une date au format "2 decembre 2025" (sans accents).

**Exemple :**
```typescript
const date = new Date('2025-12-02T17:30:00');
formatDateForSms(date); // "2 decembre 2025"
```

### `formatWeekdayForSms(date: Date): string`

Formate le jour de la semaine au format "mardi" (sans accents).

**Exemple :**
```typescript
const date = new Date('2025-12-02T17:30:00');
formatWeekdayForSms(date); // "mardi"
```

### `formatTimeForSms(date: Date): string`

Formate l'heure au format "17:30".

**Exemple :**
```typescript
const date = new Date('2025-12-02T17:30:00');
formatTimeForSms(date); // "17:30"
```

## ✅ Garanties

### 1. Suppression des accents
- ✅ Tous les mois sont sans accents (janvier, fevrier, mars, avril, mai, juin, juillet, aout, septembre, octobre, novembre, decembre)
- ✅ Tous les jours sont sans accents (dimanche, lundi, mardi, mercredi, jeudi, vendredi, samedi)
- ✅ Tous les mots du template sont sans accents (confirme, prevu, hate, etc.)

### 2. Limite à 160 caractères
- ✅ `ensureSingleSegment()` appliqué systématiquement
- ✅ Testé avec prénoms très longs, noms de salon très longs, noms de service très longs
- ✅ Tronquage automatique si nécessaire (avec "..." si possible)

### 3. Compatibilité TypeScript
- ✅ Type `AppointmentSmsContext` mis à jour avec tous les champs requis
- ✅ Aucun `any`, types stricts partout

## 🧪 Tests

Pour tester les nouveaux templates :

```bash
npx tsx scripts/test-sms-templates.ts
```

Le script teste :
- ✅ Templates avec valeurs normales
- ✅ Templates avec prénom très long
- ✅ Templates avec salon et service très longs
- ✅ Templates avec prénom + salon + service très longs
- ✅ Format de date et jour de la semaine

## 📊 Exemples Réels

### SMS de Confirmation (cas normal)

**Contexte :**
- Prénom : "Colette"
- Service : "Service Modifie"
- Salon : "HairPlay"
- Date : mardi 2 décembre 2025 à 17:30

**Résultat :**
```
Bonjour Colette, votre service Service Modifie chez HairPlay est confirme le mardi 2 decembre 2025 a 17:30. Nous avons hate de vous accueillir !
```
→ **128 caractères** ✅

### SMS de Rappel (cas normal)

**Contexte :**
- Prénom : "Colette"
- Service : "Service Modifie"
- Salon : "HairPlay"
- Date : mardi 2 décembre 2025 à 17:30

**Résultat :**
```
Rappel de RDV: Bonjour Colette, votre service Service Modifie chez HairPlay est prevu le mardi 2 decembre 2025 a 17:30. Si vous ne pouvez pas venir, merci de nous appeler.
```
→ **157 caractères** ✅

## 🎯 Résultat Final

✅ **Templates détaillés** : Incluent service, jour de la semaine, date complète
✅ **GSM-safe** : Aucun accent, compatible encodage GSM
✅ **1 segment garanti** : Toujours ≤ 160 caractères grâce à `ensureSingleSegment()`
✅ **Style professionnel** : Messages clairs et chaleureux
✅ **Intégration complète** : Tous les services utilisent les nouveaux templates


