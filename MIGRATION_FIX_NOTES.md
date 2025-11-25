# Correction de la migration notification_settings

## Problème identifié

Lors de l'exécution de `sql/create_notification_settings.sql`, une erreur de contrainte de clé étrangère était rencontrée :

```
ERROR: 42804: foreign key constraint "notification_settings_salon_id_fkey" cannot be implemented 
DETAIL: Key columns "salon_id" and "id" are of incompatible types: uuid and text.
```

## Cause

Le schéma existant de SalonPilot utilise `TEXT` pour les identifiants de salon, comme défini dans `sql/schema.sql` :

```sql
CREATE TABLE IF NOT EXISTS salons (
    id TEXT PRIMARY KEY,
    ...
);
```

Toutes les autres tables qui référencent `salons(id)` utilisent également `salon_id TEXT` :
- `services.salon_id TEXT`
- `stylistes.salon_id TEXT`
- `clients.salon_id TEXT`
- `appointments.salon_id TEXT`

La migration initiale utilisait incorrectement `salon_id UUID`, ce qui causait l'incompatibilité de types.

## Solution appliquée

La migration a été corrigée pour utiliser `TEXT` au lieu de `UUID` :

```sql
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    ...
);
```

## Vérifications effectuées

1. ✅ **Type de `salons.id`** : Confirmé comme `TEXT` dans `sql/schema.sql`
2. ✅ **Cohérence avec autres tables** : Toutes utilisent `salon_id TEXT`
3. ✅ **Code TypeScript** : Utilise déjà `string` pour `salonId`, donc compatible
4. ✅ **Repository** : `NotificationSettingsRepository` fonctionne avec `string` (salonId)

## Impact

- ✅ Aucun changement nécessaire dans le code TypeScript (déjà compatible avec `string`)
- ✅ La migration peut maintenant s'exécuter sans erreur
- ✅ La clé étrangère fonctionne correctement
- ✅ Le système de notifications continue de fonctionner normalement

## Notes importantes

- Le projet SalonPilot est **mono-salon** mais utilise quand même `salon_id` pour la flexibilité future
- Le type `TEXT` est utilisé pour les identifiants dans ce projet (pas `UUID`)
- La contrainte `UNIQUE(salon_id)` garantit qu'il n'y a qu'une seule ligne de settings par salon



