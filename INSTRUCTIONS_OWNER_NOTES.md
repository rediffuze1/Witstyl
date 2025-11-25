# Instructions pour résoudre l'erreur "owner_notes"

## ⚠️ PROBLÈME CRITIQUE

Lors de la création d'un client lors d'une réservation, l'erreur suivante se produit :
```
Could not find the 'owner_notes' column of 'clients' in the schema cache
```

**Cette erreur empêche la confirmation des réservations.**

## 🔍 Cause

La colonne `owner_notes` n'existe pas dans la table `clients` de votre base de données Supabase. PostgREST (l'API REST de Supabase) valide le schéma avant d'exécuter les requêtes et rejette toute opération si une colonne référencée n'existe pas.

## ✅ Solution (OBLIGATOIRE)

### Étape 1 : Ouvrir Supabase SQL Editor

1. Allez dans votre projet Supabase : **https://supabase.com/dashboard**
2. Sélectionnez votre projet
3. Dans le menu de gauche, cliquez sur **SQL Editor** (ou **SQL**)

### Étape 2 : Exécuter le script SQL

1. Cliquez sur **New query** (ou **Nouvelle requête**)
2. **Copiez et collez EXACTEMENT** le script SQL suivant dans l'éditeur :

```sql
ALTER TABLE "clients" 
ADD COLUMN IF NOT EXISTS "owner_notes" text;

COMMENT ON COLUMN "clients"."owner_notes" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';
```

3. Cliquez sur **Run** (ou appuyez sur **Cmd/Ctrl + Enter**)
4. Vérifiez que le message de succès s'affiche (généralement "Success. No rows returned")

### Étape 3 : Vérifier que la colonne existe

1. Dans Supabase, allez dans **Database** > **Tables**
2. Cliquez sur la table **clients**
3. Vérifiez que la colonne **owner_notes** apparaît dans la liste des colonnes

### Étape 4 : Tester la réservation

1. Retournez sur votre site : **http://localhost:5001/book**
2. Essayez de créer une réservation complète
3. La confirmation devrait maintenant fonctionner sans erreur

### Option 2 : Créer une fonction RPC (pour ajout automatique futur)

Si vous souhaitez que le système ajoute automatiquement la colonne lors de la première création de client, exécutez d'abord ce script dans Supabase SQL Editor :

```sql
-- Fonction SQL pour ajouter la colonne owner_notes si elle n'existe pas
CREATE OR REPLACE FUNCTION add_owner_notes_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Vérifier si la colonne existe déjà
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'clients' 
        AND column_name = 'owner_notes'
    ) THEN
        -- Ajouter la colonne
        ALTER TABLE "clients" 
        ADD COLUMN "owner_notes" text;
        
        -- Ajouter le commentaire
        COMMENT ON COLUMN "clients"."owner_notes" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';
        
        RAISE NOTICE 'Colonne owner_notes ajoutée avec succès';
    ELSE
        RAISE NOTICE 'La colonne owner_notes existe déjà';
    END IF;
END;
$$;
```

Le code tentera automatiquement d'appeler cette fonction lors de la création d'un client si la colonne n'existe pas.

### Option 3 : Utiliser DATABASE_URL (si configuré)

Si vous avez configuré `DATABASE_URL` dans votre fichier `.env`, le système tentera automatiquement d'ajouter la colonne via une connexion Postgres directe. Cependant, cela nécessite que :

1. `DATABASE_URL` soit défini dans `.env`
2. La connexion SSL soit configurée correctement (les certificats auto-signés de Supabase sont gérés automatiquement)

## Vérification

Après avoir ajouté la colonne, testez la création d'un client :

```bash
curl -X POST "http://localhost:5001/api/clients" \
  -H "Content-Type: application/json" \
  -d '{
    "salonId": "salon-c152118c-478b-497b-98db-db37a4c58898",
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "phone": "0123456789"
  }'
```

Vous devriez recevoir une réponse avec l'ID du client créé, sans erreur.

## Fichiers créés/modifiés

- `sql/add_owner_notes_column.sql` - Script SQL simple pour ajouter la colonne
- `sql/create_add_owner_notes_function.sql` - Script pour créer une fonction RPC
- `scripts/add-owner-notes-via-api.ts` - Script pour vérifier et ajouter la colonne automatiquement
- `server/index.ts` - Code amélioré avec gestion d'erreur et tentative d'ajout automatique

## Notes

- La colonne `owner_notes` est optionnelle et peut être `NULL`
- Elle est utilisée pour stocker des notes privées visibles uniquement par le propriétaire du salon
- Si vous n'avez pas besoin de cette fonctionnalité, vous pouvez simplement ajouter la colonne vide pour que le système fonctionne

