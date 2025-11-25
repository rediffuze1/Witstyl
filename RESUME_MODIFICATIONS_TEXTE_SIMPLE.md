# 📧 Résumé des Modifications - Texte Simple pour Emails

## ✅ Modifications Complétées

1. ✅ **Migration SQL** : `sql/add_confirmation_email_text.sql`
   - Ajoute la colonne `confirmation_email_text` à `notification_settings`
   - Ajoute la colonne à `notification_template_versions`
   - Migration des données existantes

2. ✅ **Générateur HTML** : `server/core/notifications/emailHtmlGenerator.ts`
   - Fonction `generateEmailHtmlFromText()` qui convertit texte → HTML
   - Détection automatique des lignes structurées (ex: "Salon : {{salon_name}}")
   - Génération d'un HTML stylisé avec info-box

3. ✅ **Templates par Défaut** : `server/core/notifications/defaultTemplates.ts`
   - Ajout de `confirmationEmailText` (texte simple)

4. ✅ **Repository** : `server/core/notifications/NotificationSettingsRepository.ts`
   - Interface `NotificationSettings` mise à jour avec `confirmationEmailText`
   - `getSettings()` : Lit `confirmation_email_text` et génère le HTML
   - `updateSettings()` : Accepte `confirmationEmailText` et génère le HTML automatiquement
   - `createDefaultSettings()` et `getDefaultSettings()` : Utilisent le texte simple

## ⚠️ Modifications Restantes

### 1. NotificationService.ts
- ✅ Utilise déjà `settings.confirmationEmailHtml` (qui est maintenant généré depuis le texte)
- ⚠️ **Vérifier** que le HTML est bien généré avant utilisation

### 2. NotificationSettings.tsx (Frontend)
- ❌ **À MODIFIER** : Remplacer le textarea HTML par un textarea simple
- ❌ Changer le label de "Contenu de l'email (HTML)" à "Contenu de l'email"
- ❌ Utiliser `confirmationEmailText` au lieu de `confirmationEmailHtml`

### 3. Endpoints API (server/index.ts)
- ❌ **À MODIFIER** : Accepter `confirmationEmailText` dans PUT `/api/owner/notification-settings`
- ❌ Retourner `confirmationEmailText` dans GET `/api/owner/notification-settings`

### 4. NotificationTemplateVersionsRepository.ts
- ❌ **À MODIFIER** : Ajouter `confirmationEmailText` dans les snapshots de versions

## 🧪 Prochaines Étapes

1. Exécuter la migration SQL
2. Modifier le frontend pour utiliser `confirmationEmailText`
3. Modifier les endpoints API
4. Tester l'envoi d'emails
5. Vérifier que le HTML est bien généré



