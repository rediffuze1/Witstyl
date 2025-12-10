# Guide du versioning des templates de notifications

Ce document décrit le système de versioning des templates de notifications dans Witstyl.

## 📋 Vue d'ensemble

Le système de versioning permet de :
- **Conserver un historique** de toutes les modifications des templates
- **Restaurer une version précédente** si nécessaire
- **Préserver la chaîne complète** : chaque restauration crée aussi un snapshot

## 🗄️ Modèle de données

### Table `notification_template_versions`

Cette table stocke l'historique des versions :

```sql
CREATE TABLE notification_template_versions (
    id BIGSERIAL PRIMARY KEY,
    salon_id TEXT NOT NULL REFERENCES salons(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT NULL, -- Email ou ID du manager
    label TEXT NULL, -- Label optionnel
    
    -- Copie des champs de notification_settings
    confirmation_email_subject TEXT NOT NULL,
    confirmation_email_html TEXT NOT NULL,
    confirmation_sms_text TEXT NOT NULL,
    reminder_sms_text TEXT NOT NULL,
    reminder_offset_hours INTEGER NOT NULL
);
```

## 🔄 Fonctionnement

### Création automatique de versions

À chaque modification des templates via `PUT /api/owner/notification-settings` :

1. **Avant la mise à jour** : Un snapshot de l'état actuel est créé
2. **Insertion dans `notification_template_versions`** avec :
   - Les valeurs actuelles de tous les templates
   - `created_at` = maintenant
   - `created_by` = email/ID du manager (si disponible)
3. **Mise à jour** de `notification_settings` avec les nouvelles valeurs

### Restauration d'une version

Lors de la restauration via `POST /api/owner/notification-templates/versions/:id/restore` :

1. **Snapshot de l'état actuel** : Création d'une version avec l'état avant restauration
2. **Application de la version restaurée** : Les templates de la version sont copiés dans `notification_settings`
3. **Invalidation du cache** : Le cache des settings est invalidé pour forcer le rechargement

## 📡 API Endpoints

### GET `/api/owner/notification-templates/versions`

Liste les versions historiques pour le salon de l'owner.

**Réponse :**
```json
{
  "versions": [
    {
      "id": 1,
      "createdAt": "2025-11-25T10:30:00Z",
      "createdBy": "owner@example.com",
      "label": null,
      "summary": {
        "subjectPreview": "Confirmation de votre rendez-vous...",
        "smsPreview": "Bonjour {{client_first_name}}..."
      }
    }
  ]
}
```

**Paramètres de requête :**
- `limit` (optionnel, défaut: 20) : Nombre maximum de versions à retourner

### GET `/api/owner/notification-templates/versions/:versionId`

Récupère les détails complets d'une version spécifique.

**Réponse :**
```json
{
  "id": 1,
  "createdAt": "2025-11-25T10:30:00Z",
  "createdBy": "owner@example.com",
  "label": null,
  "confirmationEmailSubject": "...",
  "confirmationEmailHtml": "...",
  "confirmationSmsText": "...",
  "reminderSmsText": "...",
  "reminderOffsetHours": 24
}
```

### POST `/api/owner/notification-templates/versions/:versionId/restore`

Restaure une version précédente.

**Réponse :**
```json
{
  "ok": true,
  "message": "Version restaurée avec succès",
  "versionId": 1
}
```

## 🎨 Interface utilisateur

### Section "Historique des versions"

Dans `/settings > Notifications`, une nouvelle section affiche :

1. **Liste des versions** :
   - Date et heure de création
   - Auteur (si disponible)
   - Label (si défini)
   - Aperçu du sujet et du SMS

2. **Bouton "Détails"** :
   - Ouvre une modale avec le contenu complet de la version
   - Affiche tous les templates (email sujet, HTML, SMS, délai)

3. **Bouton "Restaurer"** :
   - Ouvre une boîte de confirmation
   - Après confirmation, restaure la version
   - Affiche un toast de succès

## 🔒 Sécurité

- **Authentification requise** : Tous les endpoints nécessitent une connexion owner
- **Isolation par salon** : Un owner ne peut voir/restaurer que les versions de son salon
- **RLS activé** : Row Level Security sur la table `notification_template_versions`

## 💡 Bonnes pratiques

1. **Sauvegarder avant de tester** : Toujours enregistrer les templates avant d'envoyer un email de test
2. **Utiliser des labels** : Si vous prévoyez de restaurer souvent, ajoutez des labels explicites (via migration future)
3. **Vérifier après restauration** : Envoyer un email de test après restauration pour valider
4. **Nettoyage périodique** : Considérer un nettoyage des anciennes versions (> 6 mois) si nécessaire

## 🐛 Dépannage

### Aucune version n'apparaît

- Vérifier que vous avez bien sauvegardé au moins une fois
- Vérifier que la table `notification_template_versions` existe
- Vérifier les logs du serveur lors de la sauvegarde

### La restauration ne fonctionne pas

- Vérifier que l'ID de version existe et appartient à votre salon
- Vérifier les logs du serveur pour les erreurs
- Vérifier que le cache a bien été invalidé (redémarrer le serveur si nécessaire)

### Les versions ne sont pas créées automatiquement

- Vérifier que l'endpoint `PUT /api/owner/notification-settings` crée bien un snapshot
- Vérifier les logs du serveur pour les erreurs lors de la création de snapshot
- Si c'est la première création (pas de settings existants), c'est normal qu'aucun snapshot ne soit créé



