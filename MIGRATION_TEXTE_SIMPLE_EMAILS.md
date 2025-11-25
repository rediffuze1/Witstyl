# 📧 Migration : Texte Simple pour Emails (Sans HTML)

## 🎯 Objectif

Simplifier la configuration des emails de confirmation : le manager n'édite plus que du **texte simple avec placeholders**, le HTML est généré automatiquement côté backend.

## ✅ Modifications Effectuées

### 1. Migration SQL
- ✅ `sql/add_confirmation_email_text.sql` : Ajoute la colonne `confirmation_email_text`
- ✅ Migration des données existantes avec texte par défaut

### 2. Génération HTML Automatique
- ✅ `server/core/notifications/emailHtmlGenerator.ts` : Fonction `generateEmailHtmlFromText()`
- ✅ Convertit le texte simple en HTML stylisé automatiquement

### 3. Templates par Défaut
- ✅ `server/core/notifications/defaultTemplates.ts` : Ajout de `confirmationEmailText`

### 4. Repository
- ✅ `server/core/notifications/NotificationSettingsRepository.ts` : Interface mise à jour
- ⚠️ **À COMPLÉTER** : Gestion de `confirmationEmailText` dans `getSettings()` et `updateSettings()`

## 📋 Modifications Restantes

### 1. NotificationSettingsRepository.ts

**À modifier dans `getSettings()`** :
```typescript
// Lire confirmation_email_text depuis la DB
const confirmationEmailText = (data.confirmation_email_text && data.confirmation_email_text.trim())
  ? data.confirmation_email_text
  : DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailText;

// Générer le HTML depuis le texte
const { generateEmailHtmlFromText } = await import('./emailHtmlGenerator.js');
const confirmationEmailHtml = generateEmailHtmlFromText(confirmationEmailText);

const settings: NotificationSettings = {
  // ...
  confirmationEmailText,
  confirmationEmailHtml,
  // ...
};
```

**À modifier dans `updateSettings()`** :
```typescript
if (partial.confirmationEmailText !== undefined) {
  updateData.confirmation_email_text = partial.confirmationEmailText;
  // Générer automatiquement le HTML
  const { generateEmailHtmlFromText } = await import('./emailHtmlGenerator.js');
  updateData.confirmation_email_html = generateEmailHtmlFromText(partial.confirmationEmailText);
}
```

**À modifier dans `createDefaultSettings()` et `getDefaultSettings()`** :
- Ajouter `confirmationEmailText: DEFAULT_NOTIFICATION_TEMPLATES.confirmationEmailText`

### 2. NotificationService.ts

**À modifier dans `sendBookingConfirmation()` et `sendTestConfirmationEmail()`** :
- Utiliser `settings.confirmationEmailText` pour générer le HTML au moment de l'envoi
- OU utiliser `settings.confirmationEmailHtml` (déjà généré)

### 3. NotificationSettings.tsx (Frontend)

**À modifier** :
- Remplacer le textarea HTML par un textarea simple pour `confirmationEmailText`
- Changer le label de "Contenu de l'email (HTML)" à "Contenu de l'email"
- Supprimer l'affichage du HTML brut

### 4. Endpoints API (server/index.ts)

**À modifier** :
- Accepter `confirmationEmailText` au lieu de `confirmationEmailHtml` dans PUT `/api/owner/notification-settings`
- Générer le HTML côté serveur avant de sauvegarder

### 5. NotificationTemplateVersionsRepository.ts

**À modifier** :
- Ajouter `confirmationEmailText` dans les snapshots de versions

## 🧪 Tests à Effectuer

1. **Migration SQL** : Exécuter `sql/add_confirmation_email_text.sql`
2. **Interface** : Vérifier que le textarea affiche du texte simple
3. **Sauvegarde** : Vérifier que le HTML est généré automatiquement
4. **Envoi** : Vérifier que les emails sont bien envoyés avec le HTML généré
5. **Versioning** : Vérifier que les versions incluent `confirmationEmailText`

## 📝 Notes

- Le champ `confirmation_email_html` est conservé dans la DB pour compatibilité
- Le HTML est généré automatiquement à partir de `confirmation_email_text`
- Le manager ne voit plus jamais de HTML brut dans l'interface



