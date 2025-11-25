# Procédure de validation des notifications

Ce document décrit comment valider que le système de notifications utilise bien les templates configurés dans l'interface `/settings` et non des templates codés en dur.

## ✅ Vérifications effectuées

### 1. Audit du code

- ✅ **`sendBookingConfirmation()`** : Utilise `settings.confirmationEmailSubject`, `settings.confirmationEmailHtml`, `settings.confirmationSmsText` depuis `notification_settings`
- ✅ **`sendBookingReminder()`** : Utilise `settings.reminderSmsText` depuis `notification_settings`
- ✅ **`testNotification()`** : Utilise les templates depuis `notification_settings` et retourne les détails
- ⚠️ **`sendBookingCancellation()`** : Utilise encore des templates codés en dur (non configurable via UI)
- ⚠️ **`sendBookingModification()`** : Utilise encore des templates codés en dur (non configurable via UI)

### 2. Logs détaillés ajoutés

Toutes les méthodes de notification loggent maintenant :
- Le template brut (depuis la DB ou defaults)
- Le contexte de rendu (valeurs des placeholders)
- Le résultat final (template rendu)

### 3. Endpoint de test amélioré

L'endpoint `/api/dev/send-test-notification` retourne maintenant :
- Les templates bruts utilisés
- Le contexte de rendu
- Les templates rendus (avant envoi)
- Les résultats d'envoi

## 📋 Procédure de validation

### Étape 1 : Modifier un template dans l'interface

1. Se connecter en tant qu'owner/manager
2. Aller sur `/settings`
3. Dans la section "Notifications", modifier un template :
   - Par exemple, changer le sujet de l'email en : `"[TEST] Confirmation de votre rendez-vous chez {{salon_name}}"`
   - Ou modifier le SMS de confirmation en : `"[TEST] Bonjour {{client_first_name}}, votre rendez-vous est confirmé"`
4. Cliquer sur "Enregistrer les paramètres"
5. Vérifier qu'un message de succès s'affiche

### Étape 2 : Vérifier dans la base de données

```sql
SELECT 
  confirmation_email_subject,
  confirmation_sms_text,
  reminder_sms_text
FROM notification_settings
WHERE salon_id = 'salon-<votre-salon-id>';
```

Vérifier que les valeurs modifiées sont bien présentes dans la base.

### Étape 3 : Tester via l'endpoint de test

```bash
curl -X POST http://localhost:5001/api/dev/send-test-notification \
  -H "Content-Type: application/json" \
  -d '{
    "salonId": "salon-<votre-salon-id>",
    "customerName": "Jean Dupont",
    "customerEmail": "test@example.com",
    "customerPhone": "+41791234567",
    "salonName": "Mon Salon",
    "serviceName": "Coupe",
    "stylistName": "Marie Martin"
  }'
```

**Vérifications dans la réponse JSON :**

1. **`templates.confirmationEmailSubject`** : Doit contenir le texte modifié dans l'UI (ex: `"[TEST] Confirmation..."`)
2. **`templates.confirmationSmsText`** : Doit contenir le texte modifié dans l'UI (ex: `"[TEST] Bonjour..."`)
3. **`results.sms.rendered`** : Doit contenir le SMS rendu avec les placeholders remplacés ET le préfixe `[TEST]`
4. **`results.email.subjectRendered`** : Doit contenir le sujet rendu avec les placeholders remplacés ET le préfixe `[TEST]`

**Vérifications dans les logs du serveur :**

Les logs doivent afficher :
```
[NotificationService] 📧 Email de confirmation:
  Template brut (sujet): [TEST] Confirmation de votre rendez-vous chez {{salon_name}}
  Contexte: { "clientFirstName": "Jean", "salonName": "Mon Salon", ... }
  Sujet rendu: [TEST] Confirmation de votre rendez-vous chez Mon Salon

[NotificationService] 📱 SMS de confirmation:
  Template brut: [TEST] Bonjour {{client_first_name}}, votre rendez-vous est confirmé
  SMS rendu: [TEST] Bonjour Jean, votre rendez-vous est confirmé
```

### Étape 4 : Tester avec un vrai rendez-vous

1. Créer un rendez-vous via l'interface
2. Vérifier dans les logs du serveur que :
   - Les templates utilisés sont ceux modifiés dans l'UI (pas les defaults)
   - Les placeholders sont correctement remplacés
   - Les messages envoyés contiennent les valeurs modifiées

### Étape 5 : Vérifier le cache

Le système utilise un cache de 5 minutes. Pour forcer le rechargement :

1. Modifier un template dans l'UI
2. Attendre 5 minutes OU redémarrer le serveur
3. Tester à nouveau

**Note** : Le cache est automatiquement invalidé lors d'une mise à jour via l'API `/api/owner/notification-settings`.

## 🔍 Points de contrôle

### ✅ Ce qui DOIT fonctionner

- [x] Modification d'un template dans `/settings` → sauvegarde en DB
- [x] Création d'un rendez-vous → utilise le template modifié (pas le default)
- [x] Envoi de rappel → utilise le template de rappel modifié
- [x] Endpoint de test → retourne les templates utilisés
- [x] Logs détaillés → montrent template brut, contexte, résultat

### ⚠️ Limitations actuelles

- Les templates d'annulation (`sendBookingCancellation`) ne sont pas configurables via l'UI
- Les templates de modification (`sendBookingModification`) ne sont pas configurables via l'UI
- Le cache a une TTL de 5 minutes (normal, mais à prendre en compte)

## 🐛 Dépannage

### Le template modifié n'est pas utilisé

1. Vérifier que `salonId` est correct dans la requête (doit être `salon-<uuid>`, pas juste `<uuid>`)
2. Vérifier dans la DB que les modifications sont bien sauvegardées
3. Vérifier les logs pour voir quel template est réellement utilisé
4. Redémarrer le serveur pour forcer le rechargement du cache

### Les placeholders ne sont pas remplacés

1. Vérifier que les placeholders utilisent la syntaxe `{{nom_du_placeholder}}` (avec underscores)
2. Vérifier dans les logs le contexte de rendu pour voir quelles valeurs sont disponibles
3. Vérifier que `renderTemplate()` est bien appelé (présent dans les logs)

### Erreur 404 sur `/api/owner/notification-settings`

1. Vérifier que le serveur est bien démarré
2. Vérifier que l'utilisateur est bien authentifié en tant qu'owner
3. Vérifier que `req.user.salonId` est bien défini

## 📝 Exemple de test complet

```bash
# 1. Modifier le template dans l'UI (via navigateur)
# Sujet email: "🎉 Confirmation - {{salon_name}}"
# SMS: "Salut {{client_first_name}} ! Rendez-vous confirmé le {{appointment_date}}"

# 2. Tester via l'endpoint
curl -X POST http://localhost:5001/api/dev/send-test-notification \
  -H "Content-Type: application/json" \
  -d '{
    "salonId": "salon-c152118c-478b-497b-98db-db37a4c58898",
    "customerName": "Pierre Martin",
    "customerEmail": "pierre@example.com",
    "customerPhone": "+41791234567",
    "salonName": "Le coiffeur pour chauve",
    "serviceName": "Coupe + Brushing",
    "stylistName": "Sophie"
  }'

# 3. Vérifier la réponse JSON
# - templates.confirmationEmailSubject doit être "🎉 Confirmation - {{salon_name}}"
# - results.email.subjectRendered doit être "🎉 Confirmation - Le coiffeur pour chauve"
# - results.sms.rendered doit contenir "Salut Pierre ! Rendez-vous confirmé le..."
```

## ✅ Validation réussie

Si toutes les étapes ci-dessus fonctionnent, le système utilise bien les templates configurés dans l'interface et non des templates codés en dur.

## 🔍 Mode DEBUG

Pour activer les logs détaillés, ajouter dans `.env` :

```bash
NOTIFICATIONS_DEBUG=true
```

Les logs DEBUG afficheront :
- Templates bruts complets
- Contexte de rendu détaillé
- Chaque placeholder remplacé individuellement
- Fallbacks utilisés
- Template rendu final

## 📋 Checklist de Validation Rapide

- [ ] Table `notification_settings` existe en DB
- [ ] Table `notification_template_versions` existe en DB
- [ ] Modifier un template dans `/settings` → sauvegarde OK
- [ ] Créer un rendez-vous → email/SMS utilisent le template modifié
- [ ] Envoyer un email de test → email reçu avec template modifié
- [ ] Modifier 3 fois → 3 versions dans l'historique
- [ ] Restaurer une version → templates restaurés correctement
- [ ] Vider un champ → fallback par défaut utilisé
- [ ] Logs serveur montrent templates bruts, contexte, résultat

## 🔧 Correction des Erreurs 404

### Problème
Les endpoints suivants retournaient 404 :
- `POST /api/owner/notifications/send-test-email`
- `GET /api/owner/notification-templates/versions`
- `POST /api/owner/notification-templates/versions/:id/restore`

### Solution
✅ **Toutes les routes sont bien définies** dans `server/index.ts` :
- `POST /api/owner/notifications/send-test-email` (ligne 5174)
- `GET /api/owner/notification-templates/versions` (ligne 5294)
- `GET /api/owner/notification-templates/versions/:versionId` (ligne 5356)
- `POST /api/owner/notification-templates/versions/:versionId/restore` (ligne 5425)

✅ **Logs de debug ajoutés** au début de chaque route

✅ **Messages d'erreur améliorés** dans le middleware 404

### ⚠️ Action Requise : Redémarrer le Serveur

**IMPORTANT** : Le serveur DOIT être redémarré pour que les routes soient prises en compte.

```bash
# Arrêter le serveur (Ctrl+C)
# Puis redémarrer
npm run dev
```

Après redémarrage, vérifier dans les logs de démarrage :
```
[SERVER] ✅ POST /api/owner/notifications/send-test-email (ligne 5174)
[SERVER] ✅ GET /api/owner/notification-templates/versions (ligne 5294)
[SERVER] ✅ GET /api/owner/notification-templates/versions/:id (ligne 5356)
[SERVER] ✅ POST /api/owner/notification-templates/versions/:id/restore (ligne 5425)
```

Voir `FIX_404_NOTIFICATIONS.md` et `DIAGNOSTIC_404_NOTIFICATIONS.md` pour plus de détails.

## 🔧 Correction des Erreurs 404 - Routes de Notifications

### Problème
Les endpoints suivants retournaient 404 :
- `POST /api/owner/notifications/send-test-email`
- `GET /api/owner/notification-templates/versions`

### Solution Appliquée

✅ **Routes confirmées dans le code** :
- `POST /api/owner/notifications/send-test-email` (ligne 5174)
- `GET /api/owner/notification-templates/versions` (ligne 5294)
- `GET /api/owner/notification-templates/versions/:versionId` (ligne 5356)
- `POST /api/owner/notification-templates/versions/:versionId/restore` (ligne 5425)

✅ **Chemins frontend alignés** : Les appels frontend utilisent exactement les mêmes chemins

✅ **Logs de debug ajoutés** : Chaque route logge maintenant son appel

### ⚠️ Action Requise : Redémarrer le Serveur

**IMPORTANT** : Le serveur DOIT être redémarré pour que les routes soient prises en compte.

```bash
# Arrêter le serveur (Ctrl+C dans le terminal)
# Puis redémarrer
npm run dev
```

### Vérification Après Redémarrage

1. **Vérifier les logs de démarrage** :
   ```
   [SERVER] ✅ POST /api/owner/notifications/send-test-email (ligne 5174)
   [SERVER] ✅ GET /api/owner/notification-templates/versions (ligne 5294)
   ```

2. **Tester avec curl** (sans auth, devrait retourner 401, PAS 404) :
   ```bash
   curl http://localhost:5001/api/owner/notification-templates/versions
   # Résultat attendu: 401 (Non autorisé) - PAS 404
   ```

3. **Tester depuis l'interface** :
   - Aller sur `/settings > Notifications`
   - L'historique doit se charger sans 404
   - Le bouton "Envoyer un email de test" doit fonctionner

### Script de Test

Un script de test est disponible :
```bash
./test-routes-notifications.sh
```

Ce script vérifie que les routes sont bien enregistrées.

### Documentation

- `DIAGNOSTIC_404_NOTIFICATIONS.md` : Diagnostic détaillé
- `FIX_404_NOTIFICATIONS.md` : Guide de correction

## 📧 Test d'email depuis l'interface

### Nouvelle fonctionnalité : Envoyer un email de test

Depuis la page `/settings > Notifications`, vous pouvez maintenant envoyer un email de test pour valider visuellement vos templates.

**Procédure :**

1. Modifier un template (ex: ajouter "[TEST]" au sujet)
2. Cliquer sur "Enregistrer les paramètres" (important : sauvegarder d'abord)
3. Dans la section "Envoyer un email de test" :
   - Saisir votre adresse email
   - Cliquer sur "Envoyer"
4. Vérifier votre boîte email :
   - Le sujet doit contenir "[TEST]" + votre template rendu
   - Le contenu HTML doit utiliser vos templates modifiés
   - Les placeholders doivent être remplacés par des valeurs de test

**Valeurs de test utilisées :**
- Client : "TestClient" / "Test Client"
- Date : Demain à 15h00
- Service : "Coupe Test"
- Salon : Nom du salon (depuis la base)
- Coiffeur·euse : "Coiffeur·euse Test"

## 🔄 Versioning et rollback

### Nouvelle fonctionnalité : Historique des versions

Le système crée automatiquement un snapshot de vos templates à chaque modification.

**Fonctionnalités :**

1. **Historique automatique** :
   - À chaque sauvegarde, l'ancienne version est sauvegardée
   - Visible dans la section "Historique des versions"

2. **Consulter une version** :
   - Cliquer sur "Détails" pour voir le contenu complet d'une version
   - Affiche tous les templates (email sujet, HTML, SMS confirmation, SMS rappel, délai)

3. **Restaurer une version** :
   - Cliquer sur "Restaurer" sur une version
   - Confirmer dans la boîte de dialogue
   - L'état actuel est sauvegardé avant restauration (chaîne complète préservée)
   - Les templates sont remplacés par ceux de la version restaurée

**Procédure de test :**

1. Modifier les templates plusieurs fois avec des variations visibles :
   - Version 1 : "[V1] Confirmation..."
   - Version 2 : "[V2] Confirmation..."
   - Version 3 : "[V3] Confirmation..."
2. Vérifier l'historique :
   - Les 3 versions doivent apparaître avec date et auteur
3. Restaurer la version 1 :
   - Cliquer sur "Restaurer" sur la version 1
   - Confirmer
   - Vérifier que les champs affichent maintenant "[V1] Confirmation..."
   - Vérifier qu'une nouvelle version (snapshot avant rollback) apparaît dans l'historique
4. Envoyer un email de test :
   - Vérifier que le sujet contient "[V1] Confirmation..."

