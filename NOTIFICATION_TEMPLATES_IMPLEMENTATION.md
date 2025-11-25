# Implémentation des Templates de Notifications Configurables

## ✅ Résumé de l'implémentation

Tous les éléments demandés ont été implémentés avec succès :

### 1. ✅ Modèle de données
- **Fichier** : `sql/create_notification_settings.sql`
- **Table** : `notification_settings` avec toutes les colonnes nécessaires
- **Type de salon_id** : `TEXT` (aligné avec `salons.id` qui est de type `TEXT` dans `sql/schema.sql`)
- **Contraintes** : `reminder_offset_hours` limité à 12, 24 ou 48 heures
- **RLS** : Activé avec politique pour le service role
- **Note** : La clé étrangère `salon_id` référence `salons(id)` qui est de type `TEXT` dans le schéma existant

### 2. ✅ Repository et Service
- **Fichier** : `server/core/notifications/NotificationSettingsRepository.ts`
- **Fonctionnalités** :
  - `getSettings(salonId)` : Récupère les settings avec fallback automatique vers les valeurs par défaut
  - `updateSettings(salonId, partial)` : Met à jour les settings
  - Cache in-memory avec TTL de 5 minutes
  - Création automatique des settings par défaut si inexistants

### 3. ✅ Templates par défaut
- **Fichier** : `server/core/notifications/defaultTemplates.ts`
- **Contenu** : Templates HTML et SMS complets avec placeholders

### 4. ✅ Template Renderer
- **Fichier** : `server/core/notifications/templateRenderer.ts`
- **Fonctionnalités** :
  - `renderTemplate(template, context)` : Remplace les placeholders
  - `validateTemplate(template)` : Valide les placeholders
  - `getAvailablePlaceholders()` : Liste les placeholders disponibles

### 5. ✅ NotificationService modifié
- **Fichier** : `server/core/notifications/NotificationService.ts`
- **Modifications** :
  - Injection du repository via factory
  - `sendBookingConfirmation()` : Utilise les templates dynamiques
  - `sendBookingReminder()` : Utilise les templates dynamiques
  - `testNotification()` : Utilise les templates dynamiques
  - `getReminderOffsetHours()` : Nouvelle méthode pour récupérer le délai

### 6. ✅ Endpoints API
- **Fichiers** : `server/index.ts`
- **Endpoints** :
  - `GET /api/owner/notification-settings` : Récupère les settings
  - `PUT /api/owner/notification-settings` : Met à jour les settings
  - `GET /api/notifications/send-reminders` : Endpoint pour cron job (utilise `reminder_offset_hours`)

### 7. ✅ Interface Frontend
- **Fichier** : `client/src/components/NotificationSettings.tsx`
- **Intégration** : Ajouté dans `client/src/pages/settings.tsx`
- **Fonctionnalités** :
  - Édition des templates email (sujet + HTML)
  - Édition des templates SMS (confirmation + rappel)
  - Sélecteur pour le délai de rappel (12h/24h/48h)
  - Boutons pour insérer les placeholders
  - Liste des placeholders disponibles

### 8. ✅ Logique de rappel
- **Fichier** : `server/index.ts` (endpoint `/api/notifications/send-reminders`)
- **Fonctionnalités** :
  - Utilise `reminder_offset_hours` depuis les settings
  - Calcule la date d'envoi avec `subHours(appointmentDate, offsetHours)`
  - Envoie les rappels dans une fenêtre de 30 minutes

## Placeholders disponibles

- `{{client_first_name}}` : Prénom du client
- `{{client_full_name}}` : Nom complet du client
- `{{appointment_date}}` : Date formatée (ex: "mardi 25 novembre 2025 à 14:00")
- `{{appointment_time}}` : Heure formatée (ex: "14:00")
- `{{service_name}}` : Nom du service
- `{{salon_name}}` : Nom du salon
- `{{stylist_name}}` : Nom du coiffeur/coiffeuse (ou "un·e coiffeur·euse" si non défini)

## Structure des fichiers créés/modifiés

### Nouveaux fichiers
1. `sql/create_notification_settings.sql` - Migration SQL
2. `server/core/notifications/defaultTemplates.ts` - Templates par défaut
3. `server/core/notifications/templateRenderer.ts` - Utilitaire de rendu
4. `server/core/notifications/NotificationSettingsRepository.ts` - Repository
5. `client/src/components/NotificationSettings.tsx` - Composant React
6. `NOTIFICATION_TEMPLATES_IMPLEMENTATION.md` - Cette documentation

### Fichiers modifiés
1. `server/core/notifications/types.ts` - Ajout de `salonId` dans `BookingNotificationContext`
2. `server/core/notifications/utils.ts` - Ajout de `salonId` dans le contexte retourné
3. `server/core/notifications/NotificationService.ts` - Utilisation des templates dynamiques
4. `server/core/notifications/index.ts` - Injection du repository factory
5. `server/index.ts` - Endpoints API + endpoint de rappels
6. `client/src/pages/settings.tsx` - Intégration du composant NotificationSettings

## Tests à effectuer

### 1. Migration de la base de données
```sql
-- Exécuter le fichier sql/create_notification_settings.sql dans Supabase
```

### 2. Test de l'interface manager
1. Se connecter en tant qu'owner
2. Aller sur `/settings`
3. Vérifier que la section "Notifications" est visible
4. Modifier un template et sauvegarder
5. Rafraîchir la page et vérifier que les modifications sont persistées

### 3. Test de création de rendez-vous
1. Créer un rendez-vous via l'interface
2. Vérifier dans les logs que les templates personnalisés sont utilisés
3. Vérifier que les placeholders sont correctement remplacés

### 4. Test de l'endpoint de rappels
```bash
# Appeler l'endpoint (peut être fait via cron)
curl http://localhost:5001/api/notifications/send-reminders
```

### 5. Test de fallback
1. Vider un champ de template dans l'interface
2. Créer un rendez-vous
3. Vérifier que le template par défaut est utilisé

## Configuration du cron job

Pour automatiser l'envoi des rappels, configurer un cron job qui appelle :

```
GET /api/notifications/send-reminders
```

**Recommandation** : Appeler toutes les 30 minutes pour couvrir la fenêtre d'envoi.

## Nouvelles fonctionnalités

### 📧 Envoi d'email de test

Depuis l'interface `/settings > Notifications`, vous pouvez maintenant envoyer un email de test pour valider visuellement vos templates.

**Endpoint :** `POST /api/owner/notifications/send-test-email`

**Body :**
```json
{
  "testEmail": "votre-email@exemple.com"
}
```

Si `testEmail` n'est pas fourni, le système utilise l'email du salon ou de l'owner.

**Réponse :**
```json
{
  "ok": true,
  "to": "votre-email@exemple.com",
  "templates": {
    "subjectTemplate": "...",
    "htmlTemplate": "..."
  },
  "rendered": {
    "subject": "[TEST] ...",
    "htmlPreviewFirst200": "..."
  },
  "emailResult": {
    "success": true
  }
}
```

### 🔄 Versioning des templates

Le système crée automatiquement un snapshot de vos templates à chaque modification.

**Table :** `notification_template_versions`

**Endpoints :**
- `GET /api/owner/notification-templates/versions` : Liste les versions
- `GET /api/owner/notification-templates/versions/:id` : Détails d'une version
- `POST /api/owner/notification-templates/versions/:id/restore` : Restaure une version

**Fonctionnement :**
- À chaque `PUT /api/owner/notification-settings`, un snapshot est créé automatiquement
- L'historique est visible dans l'interface `/settings > Notifications`
- Possibilité de restaurer une version précédente (l'état actuel est sauvegardé avant)

Voir `NOTIFICATION_VERSIONING_GUIDE.md` pour plus de détails.

Exemple avec cron :
```bash
# Toutes les 30 minutes
*/30 * * * * curl http://localhost:5001/api/notifications/send-reminders
```

## Notes importantes

1. **Sécurité** : Les endpoints `/api/owner/notification-settings` sont protégés et accessibles uniquement aux owners authentifiés
2. **Cache** : Le repository utilise un cache in-memory (TTL 5 min) pour améliorer les performances
3. **Fallback** : Si aucun template n'est configuré, les templates par défaut sont utilisés automatiquement
4. **Validation** : Les templates sont validés côté backend (longueur max, valeurs autorisées pour `reminder_offset_hours`)
5. **Rétrocompatibilité** : Les méthodes d'annulation et modification utilisent encore les templates statiques (non demandés dans les requirements)
6. **Édition simplifiée** : `confirmation_email_text` est désormais la source de vérité éditée par le manager. Le HTML final (`confirmation_email_html`) est généré automatiquement côté backend et conservé comme cache interne/legacy.
7. **Flow client** : Toute réservation effectuée depuis `/book-client` met à jour les informations du client (nom, email, téléphone) et déclenche immédiatement `sendBookingConfirmation()` avec ces données. Les emails envoyés correspondent exactement au texte configuré dans `/settings`.

