# Instructions pour créer la table stylist_schedule

## ⚠️ IMPORTANT : Cette étape est OBLIGATOIRE

La table `stylist_schedule` doit être créée dans Supabase avant de pouvoir sauvegarder les horaires des stylistes.

## 📋 Étapes à suivre

### 1. Ouvrir Supabase Dashboard
- Allez sur https://supabase.com/dashboard
- Sélectionnez votre projet

### 2. Ouvrir SQL Editor
- Dans le menu de gauche, cliquez sur **"SQL Editor"**
- Cliquez sur **"New query"**

### 3. Exécuter le script SQL
- Ouvrez le fichier `supabase_create_stylist_schedule.sql` dans votre projet
- **Copiez TOUT le contenu** du fichier
- **Collez-le** dans l'éditeur SQL de Supabase
- Cliquez sur **"Run"** (ou appuyez sur `Ctrl+Enter` / `Cmd+Enter`)

### 4. Vérifier la création
- Vous devriez voir un message de succès
- La table `stylist_schedule` devrait maintenant exister

### 5. Tester dans l'application
- Rechargez la page `/hours` dans votre application
- Allez dans l'onglet **"Horaires des stylistes"**
- Configurez les horaires d'un styliste
- Cliquez sur **"Enregistrer pour [nom du styliste]"**
- ✅ Ça devrait fonctionner maintenant !

## 🔍 Vérification

Si vous voyez toujours l'erreur "Table stylist_schedule introuvable" :

1. Vérifiez que le script SQL a bien été exécuté (pas d'erreurs dans Supabase)
2. Vérifiez que vous êtes dans le bon projet Supabase
3. Vérifiez les logs du serveur : `tail -f /tmp/server_stylist_hours_final.log`
4. Vérifiez la console du navigateur (F12) pour les détails de l'erreur

## 📄 Fichier SQL

Le fichier `supabase_create_stylist_schedule.sql` contient :
- La création de la table `stylist_schedule`
- Les index pour améliorer les performances
- Les politiques RLS (Row Level Security) pour la sécurité

## ✅ Une fois la table créée

Vous pourrez :
- Définir des horaires personnalisés pour chaque styliste
- Les horaires seront automatiquement validés contre les horaires du salon
- Si le salon est fermé (ex: dimanche/lundi), les stylistes seront automatiquement marqués comme indisponibles






