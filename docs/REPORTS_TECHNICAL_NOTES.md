# Notes Techniques - Page Rapports

## Cause Racine des Problèmes

Les problèmes identifiés en mode "Jour" et "Semaine" étaient dus à :

1. **Clés de cache incomplètes** : La clé de cache React Query n'incluait que `granularity` et `referenceDate`, mais pas `startDate` et `endDate`. Cela causait des collisions de cache lorsque la même date de référence était utilisée avec des granularités différentes.

2. **Calcul de semaine incohérent** : Le serveur calculait la semaine manuellement avec `getDay()`, tandis que le client utilisait `date-fns` avec `startOfWeek`. Bien que les calculs soient mathématiquement équivalents, il y avait un risque d'incohérence due aux fuseaux horaires.

3. **Bornes non normalisées** : Les dates de fin n'étaient pas toujours normalisées à `23:59:59.999`, ce qui pouvait causer des problèmes d'inclusion/exclusion aux limites.

## Solutions Implémentées

### 1. Hook `useReportRange`

**Fichier** : `client/src/hooks/useReportRange.ts`

**Responsabilités** :
- Gère l'état de période (granularité, date de référence)
- Calcule `startDate` et `endDate` selon la granularité
- Fournit les méthodes de navigation (Précédent/Suivant/Aujourd'hui)

**Règles de calcul** :
- **Day** : `[startOfDay, endOfDay]` - Jour complet (00:00:00.000 à 23:59:59.999)
- **Week** : `[startOfISOWeek (lundi), endOfISOWeek (dimanche)]` - Semaine ISO (lundi à dimanche)
- **Month** : `[startOfMonth, endOfMonth]` - Mois complet

**Fuseau horaire** : Les dates sont calculées dans le fuseau local du navigateur, puis converties en ISO (UTC) pour l'API.

**Bornes** : Inclusives/inclusives `[startDate, endDate]`
- `startDate` : 00:00:00.000 (inclus)
- `endDate` : 23:59:59.999 (inclus)

### 2. Hook `useReportsData`

**Fichier** : `client/src/hooks/useReportsData.ts`

**Responsabilités** :
- Charge les données depuis l'API
- Unifie la source de données pour KPIs et graphiques
- Gère le cache React Query

**Clé de cache** : `['reports', salonId, granularity, startDateISO, endDateISO, stylistId?]`
- Inclut `startDate` et `endDate` pour éviter les collisions
- Inclut `stylistId` si filtré par styliste

**Fuseau horaire** :
- Les dates sont converties en ISO string (UTC) pour l'API
- L'API interprète ces dates en UTC et les compare avec les timestamps en UTC de la DB

### 3. Utilitaires `computeKpis`

**Fichier** : `client/src/utils/computeKpis.ts`

**Responsabilités** :
- Fonctions pures pour calculer les KPIs
- Calcul des tendances (comparaison avec période précédente)
- Testables unitairement

**Fonctions** :
- `computeKpis()` : Calcule les KPIs pour une période donnée
- `computeTrends()` : Calcule les tendances en comparant avec la période précédente
- `computeKpisWithTrends()` : Combine les deux

### 4. Serveur - Calcul de Période

**Fichier** : `server/routes/salons.ts`

**Calcul de semaine** :
```javascript
const dayOfWeek = periodStart.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
periodStart.setDate(referenceDate.getDate() - daysFromMonday);
periodStart.setHours(0, 0, 0, 0);
periodEnd = new Date(periodStart);
periodEnd.setDate(periodStart.getDate() + 6);
periodEnd.setHours(23, 59, 59, 999);
```

**Cohérence avec le client** :
- Le serveur utilise la même logique que `date-fns startOfWeek` avec `weekStartsOn: 1`
- Les bornes sont normalisées à `23:59:59.999` pour inclusion complète

## Choix Techniques

### Fuseau Horaire

**Choix** : UTC pour la base de données, fuseau local pour l'affichage

**Justification** :
- Les timestamps en base de données sont stockés en UTC (standard)
- Les dates sont converties en ISO string (UTC) pour l'API
- L'API compare les dates en UTC avec les timestamps en UTC de la DB
- Le client affiche les dates dans le fuseau local du navigateur

### Bornes Inclusives/Inclusives

**Choix** : `[startDate, endDate]` avec `startDate = 00:00:00.000` et `endDate = 23:59:59.999`

**Justification** :
- Plus intuitif pour les utilisateurs (un rendez-vous le dimanche 23:30 appartient à la semaine)
- Évite les problèmes de double comptage
- Cohérent avec les requêtes SQL `gte` et `lte`

**Alternative considérée** : Half-open `[startDate, endDate)` avec `endDate = 00:00:00.000` du jour suivant
- Rejetée car moins intuitive et nécessite des ajustements dans les requêtes SQL

### Semaine ISO

**Choix** : Semaine ISO (lundi à dimanche)

**Justification** :
- Standard international (ISO 8601)
- Cohérent avec `date-fns` qui utilise `weekStartsOn: 1` par défaut
- Plus intuitif pour les utilisateurs français/européens

## Tests

### Tests Unitaires

**Fichiers** :
- `client/src/__tests__/reports/ranges.test.ts` : Tests pour `useReportRange`
- `client/src/__tests__/reports/computeKpis.test.ts` : Tests pour `computeKpis`

**Cas testés** :
1. **Day** : Un RDV à 09:00 → totalBookings=1, revenue conforme, charts 1 point
2. **Week** : RDVs lun-dim ; vérifie total= somme des 7j, séries 7 points ; delta vs semaine-1
3. **Month** : Contrôle de régression (déjà correct)
4. **Zones de bord** : RDV dimanche 23:30 → doit appartenir à la bonne semaine ISO

### Tests Manuels

**Scénarios à vérifier** :
1. En **Semaine 17–23 nov 2025** : KPIs & charts affichent des valeurs non nulles si des données existent
2. En **Semaine 24–30** : Ils changent de façon cohérente
3. Le bouton **Mois** reste inchangé (régression zéro)
4. Les **deltas "vs semaine dernière"** utilisent la VRAIE semaine précédente (ISO-week)
5. Aucune divergence entre KPIs et charts pour une période donnée (mêmes totaux)
6. Pas d'erreur console ni de clignotement à la navigation

## Observabilité

### Logs de Debug

Les logs sont gated par `LOGGER_LEVEL=debug` ou `NODE_ENV=development` :

**Client** :
- `[useReportsData] 🔄 Chargement données:` : Paramètres de la requête
- `[useReportsData] ✅ Données reçues:` : Données reçues de l'API
- `[Reports] 📊 État de la période:` : État de la période dans le composant

**Serveur** :
- `[GET /api/salons/:salonId/reports] Calcul statistiques pour période:` : Périodes calculées
- `[GET /api/salons/:salonId/reports] Données calculées:` : KPIs calculés

## Améliorations Futures

1. **Filtre par styliste** : Support d'un filtre "Tous les stylistes / 1 styliste" appliqué partout (charts + KPIs)
2. **Export PDF/CSV** : Implémentation de l'export de rapports
3. **Cache intelligent** : Utiliser un cache avec TTL au lieu de `staleTime: 0` pour améliorer les performances
4. **Tests E2E** : Ajouter des tests end-to-end pour vérifier le comportement complet




