# 🔧 Guide rapide pour résoudre l'erreur owner_notes

## ⚡ Solution rapide (5 minutes)

### Option 1 : Exécution manuelle dans Supabase (RECOMMANDÉ - 2 minutes)

1. **Ouvrez Supabase** : https://supabase.com/dashboard
2. **Sélectionnez votre projet**
3. **Cliquez sur "SQL Editor"** dans le menu de gauche
4. **Cliquez sur "New query"**
5. **Copiez et collez ce script** :

```sql
ALTER TABLE "clients"
ADD COLUMN IF NOT EXISTS "owner_notes" text;

COMMENT ON COLUMN "clients"."owner_notes" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';
```

6. **Cliquez sur "Run"** (ou appuyez sur `Cmd/Ctrl + Enter`)
7. **Vérifiez** que le message "Success. No rows returned" s'affiche
8. **Testez** la réservation sur http://localhost:5001/book

✅ **C'est tout !** Le problème devrait être résolu.

---

### Option 2 : Script automatique (si DATABASE_URL est configuré)

Si vous avez configuré `DATABASE_URL` dans votre fichier `.env`, vous pouvez exécuter :

```bash
npx tsx scripts/fix-owner-notes.ts
```

**Pour obtenir DATABASE_URL :**
1. Allez dans Supabase > **Settings** > **Database**
2. Cliquez sur **Connection string** > **URI**
3. Copiez l'URL (format : `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`)
4. Ajoutez-la dans votre fichier `.env` :
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require
   ```
5. Remplacez `[PASSWORD]` par votre mot de passe de base de données
6. Exécutez le script : `npx tsx scripts/fix-owner-notes.ts`

**Note :** Si vous rencontrez une erreur de certificat SSL, vous pouvez temporairement exécuter :
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/fix-owner-notes.ts
```

⚠️ **Ne faites cela qu'en développement, jamais en production !**

---

## 🔍 Vérification

Pour vérifier que la colonne a été ajoutée :

1. Dans Supabase, allez dans **Database** > **Tables**
2. Cliquez sur la table **clients**
3. Vérifiez que la colonne **owner_notes** apparaît dans la liste des colonnes

---

## ❓ Problèmes courants

### Erreur : "Could not find the 'owner_notes' column"
- **Solution :** La colonne n'a pas été ajoutée. Réessayez l'Option 1 ci-dessus.

### Erreur : "self-signed certificate in certificate chain"
- **Solution :** Utilisez l'Option 1 (manuelle) ou configurez `DATABASE_URL` correctement.

### Erreur : "DATABASE_URL non défini"
- **Solution :** Utilisez l'Option 1 (manuelle) ou ajoutez `DATABASE_URL` dans `.env`.

---

## 📞 Besoin d'aide ?

Si le problème persiste après avoir suivi ces instructions, vérifiez :
1. Que vous êtes connecté au bon projet Supabase
2. Que vous avez les permissions nécessaires (owner/admin)
3. Que la table `clients` existe bien dans votre base de données








