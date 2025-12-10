# Guide : Ajouter la colonne `stylist_id` pour les fermetures par styliste

## Problème

Vous avez sélectionné un styliste spécifique lors de l'ajout d'une date de fermeture, mais le badge affiche toujours "Salon entier" au lieu du nom du styliste.

**Cause** : La colonne `stylist_id` n'existe pas encore dans votre table `salon_closed_dates` de Supabase.

## Solution : Ajouter la colonne `stylist_id`

### Étape 1 : Accéder à Supabase

1. Allez sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Connectez-vous à votre compte
3. Sélectionnez votre projet Witstyl

### Étape 2 : Ouvrir le SQL Editor

1. Dans le menu de gauche, cliquez sur **"SQL Editor"**
2. Cliquez sur **"New query"** (Nouvelle requête)

### Étape 3 : Exécuter le script SQL

Copiez-collez ce script dans l'éditeur :

```sql
ALTER TABLE salon_closed_dates 
ADD COLUMN IF NOT EXISTS stylist_id UUID REFERENCES stylistes(id) ON DELETE CASCADE;

COMMENT ON COLUMN salon_closed_dates.stylist_id IS 
'ID du styliste concerné par la fermeture. NULL = fermeture pour tout le salon';

CREATE INDEX IF NOT EXISTS idx_salon_closed_dates_stylist_id 
ON salon_closed_dates(stylist_id) 
WHERE stylist_id IS NOT NULL;
```

### Étape 4 : Exécuter le script

1. Cliquez sur le bouton **"Run"** (ou appuyez sur `Ctrl+Enter` / `Cmd+Enter`)
2. Vous devriez voir un message de succès : "Success. No rows returned"

### Étape 5 : Vérifier

1. Retournez dans votre application Witstyl
2. Rechargez la page des horaires (F5)
3. Ajoutez une nouvelle date de fermeture avec un styliste spécifique
4. Le badge devrait maintenant afficher "Styliste: [Nom du styliste]" au lieu de "Salon entier"

## Notes importantes

- **Les fermetures existantes** : Les dates de fermeture déjà créées avant l'ajout de la colonne resteront marquées comme "Salon entier" car elles n'ont pas de `stylist_id` associé.
- **Nouvelles fermetures** : Après l'ajout de la colonne, toutes les nouvelles fermetures avec un styliste sélectionné seront correctement enregistrées et affichées.

## Alternative : Via l'interface Table Editor

Si vous préférez utiliser l'interface graphique :

1. Allez dans **"Table Editor"** dans Supabase
2. Sélectionnez la table **`salon_closed_dates`**
3. Cliquez sur **"Add Column"** (Ajouter une colonne)
4. Remplissez les champs :
   - **Name** : `stylist_id`
   - **Type** : `uuid`
   - **Is Nullable** : ✅ Oui (cochez cette case)
   - **Foreign Key** : `stylistes(id)` (sélectionnez dans la liste)
5. Cliquez sur **"Save"**

## Besoin d'aide ?

Si vous rencontrez des problèmes, vérifiez :
- Que vous êtes bien connecté à Supabase
- Que vous avez les droits d'administration sur le projet
- Que la table `salon_closed_dates` existe bien
- Que la table `stylistes` existe bien



