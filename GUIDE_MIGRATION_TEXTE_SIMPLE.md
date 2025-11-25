# 📧 Guide de Migration - Texte Simple pour Emails

## 🎯 Objectif

Simplifier la configuration des emails : le manager n'édite plus que du **texte simple avec placeholders**, le HTML est généré automatiquement.

## ✅ Modifications Complétées

### 1. Base de Données
- ✅ Migration SQL : `sql/add_confirmation_email_text.sql`
- ✅ Ajoute `confirmation_email_text` à `notification_settings` et `notification_template_versions`

### 2. Backend
- ✅ `emailHtmlGenerator.ts` : Fonction `generateEmailHtmlFromText()`
- ✅ `NotificationSettingsRepository.ts` : Gère `confirmationEmailText` et génère le HTML
- ✅ `NotificationTemplateVersionsRepository.ts` : Inclut `confirmationEmailText` dans les versions
- ✅ `defaultTemplates.ts` : Ajout de `confirmationEmailText`
- ✅ Endpoints API : Acceptent et retournent `confirmationEmailText`

### 3. Frontend
- ✅ `NotificationSettings.tsx` : Textarea texte simple au lieu de HTML
- ✅ Label changé de "Contenu de l'email (HTML)" à "Contenu de l'email"
- ✅ Détails de version affichent le texte simple

## 📋 Étapes de Migration

### Étape 1 : Exécuter la Migration SQL

1. **Ouvrir Supabase Dashboard** → SQL Editor
2. **Exécuter** le fichier `sql/add_confirmation_email_text.sql`
3. **Vérifier** que les colonnes ont été ajoutées :
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'notification_settings' 
   AND column_name = 'confirmation_email_text';
   ```

### Étape 2 : Redémarrer le Serveur

```bash
# Arrêter le serveur
pkill -f "tsx server/index.ts"

# Redémarrer
npm run dev
```

### Étape 3 : Tester l'Interface

1. **Aller sur** `http://localhost:5001/settings` → Notifications
2. **Vérifier** que le textarea affiche du texte simple (pas de HTML)
3. **Modifier** le texte et sauvegarder
4. **Vérifier** que la sauvegarde fonctionne

### Étape 4 : Tester l'Envoi d'Email

1. **Envoyer un email de test** depuis l'interface
2. **Vérifier** que l'email reçu contient le HTML généré
3. **Vérifier** les logs serveur pour confirmer la génération HTML

## 🧪 Format du Texte Simple

Le manager peut écrire du texte simple avec des placeholders :

```
Bonjour {{client_full_name}},

Votre rendez-vous a été confirmé avec succès !

Salon : {{salon_name}}
Service : {{service_name}}
Coiffeur·euse : {{stylist_name}}
Date et heure : {{appointment_date}} à {{appointment_time}}

Nous avons hâte de vous accueillir !

Si vous avez des questions, n'hésitez pas à nous contacter.
```

**Règles** :
- Les sauts de ligne créent des paragraphes
- Les lignes avec ":" et un placeholder sont détectées comme infos structurées
- Les infos structurées sont mises dans une info-box stylisée

## 📝 Notes Importantes

- Le champ `confirmation_email_html` est **conservé** dans la DB pour compatibilité
- Le HTML est **généré automatiquement** à partir du texte à chaque sauvegarde
- Le manager **ne voit plus jamais de HTML** dans l'interface
- Les anciens templates HTML existants continuent de fonctionner (fallback)

## ✅ Checklist de Vérification

- [ ] Migration SQL exécutée
- [ ] Serveur redémarré
- [ ] Interface affiche textarea texte simple
- [ ] Sauvegarde fonctionne
- [ ] Email de test envoyé avec succès
- [ ] HTML généré correctement (vérifier les logs)
- [ ] Versioning fonctionne (créer/modifier/restaurer)

## 🆘 En Cas de Problème

### Le textarea affiche toujours du HTML

→ Vérifier que le serveur a été redémarré après les modifications

### Erreur "confirmation_email_text does not exist"

→ La migration SQL n'a pas été exécutée

### Le HTML généré est incorrect

→ Vérifier les logs serveur pour voir le texte source
→ Vérifier la fonction `generateEmailHtmlFromText()` dans `emailHtmlGenerator.ts`



