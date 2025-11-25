# Migration : Ajout de la colonne `stylist_id` à `salon_closed_dates`

## Objectif

Permettre de gérer les fermetures par styliste spécifique en ajoutant la colonne `stylist_id` à la table `salon_closed_dates`.

## Instructions

### Option 1 : Via Supabase Dashboard (Recommandé)

1. Allez sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **SQL Editor**
4. Copiez-collez le script SQL suivant :

```sql
ALTER TABLE salon_closed_dates 
ADD COLUMN IF NOT EXISTS stylist_id UUID REFERENCES stylistes(id) ON DELETE CASCADE;

COMMENT ON COLUMN salon_closed_dates.stylist_id IS 
'ID du styliste concerné par la fermeture. NULL = fermeture pour tout le salon';

CREATE INDEX IF NOT EXISTS idx_salon_closed_dates_stylist_id 
ON salon_closed_dates(stylist_id) 
WHERE stylist_id IS NOT NULL;
```

5. Cliquez sur **Run**
6. Vérifiez que la colonne a été ajoutée (vous devriez voir un message de succès)

### Option 2 : Via le fichier de migration

Le fichier `migrations/add_stylist_id_to_closed_dates.sql` contient le script complet avec des vérifications supplémentaires.

## Comportement après migration

- **Avant la migration** : Toutes les fermetures sont enregistrées pour tout le salon, même si un styliste spécifique est sélectionné.
- **Après la migration** : 
  - Les fermetures avec un styliste sélectionné seront enregistrées uniquement pour ce styliste
  - Les fermetures avec "Tous les stylistes" seront enregistrées pour tout le salon (stylist_id = NULL)

## Vérification

Après avoir exécuté la migration, testez en ajoutant une date de fermeture avec un styliste spécifique. Si la colonne est correctement ajoutée, la fermeture sera enregistrée uniquement pour ce styliste.

## Notes techniques

- La colonne `stylist_id` est **nullable** pour permettre les fermetures du salon entier
- Une contrainte de clé étrangère référence la table `stylistes(id)`
- Un index est créé pour améliorer les performances des requêtes filtrées par styliste
- Le code gère automatiquement l'absence de la colonne en réessayant sans `stylist_id` si nécessaire



