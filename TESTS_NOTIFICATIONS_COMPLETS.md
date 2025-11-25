# Tests Complets du Système de Notifications

Ce document décrit tous les tests à effectuer pour valider que le système de notifications fonctionne parfaitement.

## 🔧 Configuration Préalable

### Variables d'environnement

```bash
# Mode DEBUG (logs détaillés)
NOTIFICATIONS_DEBUG=true

# Dry-run pour SMS (recommandé pour les tests)
SMS_DRY_RUN=true

# Dry-run pour Email (désactiver pour tester les vrais envois)
EMAIL_DRY_RUN=false
```

## 📋 Suite de Tests

### Test 1: Vérification de la Base de Données

#### 1.1. Table notification_settings

```sql
-- Vérifier que la table existe
SELECT * FROM information_schema.tables 
WHERE table_name = 'notification_settings';

-- Vérifier les colonnes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'notification_settings' 
ORDER BY ordinal_position;

-- Vérifier les contraintes
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'notification_settings';

-- Vérifier les données
SELECT * FROM notification_settings WHERE salon_id = 'salon-<votre-salon-id>';
```

**Résultat attendu** :
- ✅ Table existe
- ✅ Toutes les colonnes présentes avec types corrects
- ✅ FK vers salons.id valide
- ✅ CHECK constraint sur reminder_offset_hours (12, 24, 48)
- ✅ Valeurs par défaut présentes

#### 1.2. Table notification_template_versions

```sql
-- Vérifier que la table existe
SELECT * FROM information_schema.tables 
WHERE table_name = 'notification_template_versions';

-- Vérifier les colonnes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'notification_template_versions' 
ORDER BY ordinal_position;

-- Vérifier les index
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'notification_template_versions';
```

**Résultat attendu** :
- ✅ Table existe
- ✅ Toutes les colonnes présentes
- ✅ Index sur salon_id et created_at présents
- ✅ RLS activé

### Test 2: Templates et Placeholders

#### 2.1. Test de rendu des placeholders

**Action** :
1. Modifier le sujet email dans `/settings` : `"Test {{client_first_name}} - {{salon_name}}"`
2. Sauvegarder
3. Envoyer un email de test

**Vérifications** :
- ✅ Le sujet rendu contient "Test TestClient - [Nom du salon]"
- ✅ Tous les placeholders sont remplacés
- ✅ Aucun placeholder `{{...}}` ne reste dans le résultat

#### 2.2. Test des placeholders inconnus

**Action** :
1. Modifier le sujet email : `"Test {{placeholder_inconnu}} - {{salon_name}}"`
2. Sauvegarder
3. Envoyer un email de test

**Vérifications** :
- ✅ Warning dans les logs : `Placeholder inconnu: {{placeholder_inconnu}}`
- ✅ Le placeholder inconnu reste tel quel dans le résultat
- ✅ `{{salon_name}}` est correctement remplacé

#### 2.3. Test de template vide

**Action** :
1. Vider le champ "Sujet de l'email" dans `/settings`
2. Sauvegarder
3. Créer un rendez-vous

**Vérifications** :
- ✅ Le template par défaut est utilisé (fallback)
- ✅ Log DEBUG indique : `⚠️ Fallback utilisé pour confirmationEmailSubject`
- ✅ L'email est envoyé avec le sujet par défaut

### Test 3: Création de Rendez-vous

#### 3.1. Test complet E2E

**Préparation** :
1. Modifier les templates dans `/settings` :
   - Sujet : `"[PERSO] Confirmation pour {{client_first_name}}"`
   - SMS : `"[PERSO] Bonjour {{client_first_name}}, votre RDV {{service_name}} est confirmé"`
2. Sauvegarder

**Action** :
1. Créer un rendez-vous via l'interface client
2. Vérifier les logs du serveur

**Vérifications dans les logs** :
```
[NotificationService] 📧 Email de confirmation:
  Template brut (sujet): [PERSO] Confirmation pour {{client_first_name}}
  Contexte: { "clientFirstName": "Jean", "salonName": "...", ... }
  Sujet rendu: [PERSO] Confirmation pour Jean

[NotificationService] 📱 SMS de confirmation:
  Template brut: [PERSO] Bonjour {{client_first_name}}, votre RDV {{service_name}} est confirmé
  SMS rendu: [PERSO] Bonjour Jean, votre RDV Coupe est confirmé
```

**Vérifications dans l'email reçu** :
- ✅ Sujet : `[PERSO] Confirmation pour Jean`
- ✅ Contenu HTML utilise les templates personnalisés
- ✅ Tous les placeholders remplacés

**Vérifications dans les logs SMS (dry-run)** :
- ✅ Message : `[PERSO] Bonjour Jean, votre RDV Coupe est confirmé`
- ✅ Tag `[SmsUp] [DRY RUN]` présent

### Test 4: Rappels Automatiques

#### 4.1. Test du calcul du reminder_offset_hours

**Préparation** :
1. Modifier `reminder_offset_hours` à 12 heures dans `/settings`
2. Sauvegarder

**Action** :
1. Créer un rendez-vous confirmé pour demain à 14h00
2. Appeler `/api/notifications/send-reminders` maintenant (si maintenant = demain 2h00)

**Vérifications** :
- ✅ Le système calcule : rendez-vous à 14h00 - 12h = 2h00
- ✅ Si maintenant est entre 2h00 et 2h30, le rappel est envoyé
- ✅ Le SMS utilise le template personnalisé `reminder_sms_text`

#### 4.2. Test avec différents offsets

**Actions** :
1. Tester avec `reminder_offset_hours = 12`
2. Tester avec `reminder_offset_hours = 24`
3. Tester avec `reminder_offset_hours = 48`

**Vérifications** :
- ✅ Chaque offset fonctionne correctement
- ✅ Le calcul est précis (fenêtre de 30 minutes)

### Test 5: Versioning

#### 5.1. Test de création automatique de versions

**Actions** :
1. Aller dans `/settings > Notifications`
2. Modifier le sujet email : `"[V1] Confirmation"`
3. Sauvegarder
4. Modifier le sujet email : `"[V2] Confirmation"`
5. Sauvegarder
6. Modifier le sujet email : `"[V3] Confirmation"`
7. Sauvegarder

**Vérifications en DB** :
```sql
SELECT id, created_at, confirmation_email_subject 
FROM notification_template_versions 
WHERE salon_id = 'salon-<id>'
ORDER BY created_at DESC 
LIMIT 3;
```

**Résultat attendu** :
- ✅ 3 versions créées
- ✅ V1 contient `"[V1] Confirmation"`
- ✅ V2 contient `"[V2] Confirmation"`
- ✅ V3 contient `"[V3] Confirmation"`
- ✅ Dates croissantes

#### 5.2. Test de restauration

**Actions** :
1. Dans l'historique, cliquer sur "Restaurer" pour la version V1
2. Confirmer
3. Vérifier les templates actuels

**Vérifications** :
- ✅ Les templates actuels affichent `"[V1] Confirmation"`
- ✅ Une nouvelle version (snapshot avant rollback) existe dans l'historique
- ✅ L'historique contient maintenant 4 versions

#### 5.3. Test après restauration

**Actions** :
1. Après restauration de V1, créer un rendez-vous
2. Vérifier les logs

**Vérifications** :
- ✅ Le sujet email utilise `"[V1] Confirmation"`
- ✅ Les templates restaurés sont bien utilisés

### Test 6: Email de Test

#### 6.1. Test basique

**Actions** :
1. Modifier le sujet email : `"[TEST EMAIL] Confirmation {{client_first_name}}"`
2. Sauvegarder
3. Saisir votre email dans le champ "Email de test"
4. Cliquer "Envoyer"

**Vérifications** :
- ✅ Toast de succès affiché
- ✅ Email reçu avec sujet : `[TEST] [TEST EMAIL] Confirmation TestClient`
- ✅ Contenu HTML utilise les templates personnalisés
- ✅ Tous les placeholders remplacés par des valeurs de test

#### 6.2. Test sans email fourni

**Actions** :
1. Vider le champ "Email de test"
2. Cliquer "Envoyer"

**Vérifications** :
- ✅ Le système utilise l'email du salon ou de l'owner
- ✅ Email envoyé avec succès

### Test 7: Mode DEBUG

#### 7.1. Activation du mode DEBUG

**Configuration** :
```bash
NOTIFICATIONS_DEBUG=true
```

**Actions** :
1. Créer un rendez-vous
2. Vérifier les logs

**Vérifications** :
- ✅ Logs DEBUG présents :
  - `[NotificationService DEBUG] 📧 Email de confirmation - Détails complets:`
  - `[TemplateRenderer DEBUG] Rendu du template:`
  - `[TemplateRenderer DEBUG] Placeholder {{...}} → "..."`
  - `[NotificationSettings DEBUG] ⚠️ Fallback utilisé pour ...` (si applicable)

#### 7.2. Désactivation du mode DEBUG

**Configuration** :
```bash
NOTIFICATIONS_DEBUG=false
# ou ne pas définir la variable
```

**Vérifications** :
- ✅ Logs DEBUG absents
- ✅ Logs normaux toujours présents

### Test 8: Validation des Fallbacks

#### 8.1. Template vide dans un champ

**Actions** :
1. Vider uniquement le champ "Sujet de l'email"
2. Sauvegarder
3. Créer un rendez-vous

**Vérifications** :
- ✅ Le sujet par défaut est utilisé
- ✅ Les autres templates personnalisés sont utilisés
- ✅ Log DEBUG : `⚠️ Fallback utilisé pour confirmationEmailSubject`

#### 8.2. Tous les templates vides

**Actions** :
1. Vider tous les champs de templates
2. Sauvegarder
3. Créer un rendez-vous

**Vérifications** :
- ✅ Tous les templates par défaut sont utilisés
- ✅ Le système fonctionne normalement

### Test 9: Sécurité et Authentification

#### 9.1. Test d'accès non autorisé

**Actions** :
1. Se déconnecter
2. Essayer d'accéder à `/api/owner/notification-settings`

**Vérifications** :
- ✅ Erreur 401 : "Non autorisé. Connexion owner requise."

#### 9.2. Test d'isolation par salon

**Actions** :
1. Se connecter avec un compte owner
2. Vérifier que seules les versions de son salon sont visibles

**Vérifications** :
- ✅ GET `/api/owner/notification-templates/versions` ne retourne que les versions du salon de l'owner
- ✅ Impossible de restaurer une version d'un autre salon

### Test 10: Performance et Cache

#### 10.1. Test du cache

**Actions** :
1. Modifier un template
2. Sauvegarder
3. Créer immédiatement un rendez-vous (dans les 5 minutes)

**Vérifications** :
- ✅ Le cache est invalidé après sauvegarde
- ✅ Les nouveaux templates sont utilisés immédiatement

#### 10.2. Test de la TTL du cache

**Actions** :
1. Modifier un template
2. Sauvegarder
3. Attendre 6 minutes
4. Créer un rendez-vous

**Vérifications** :
- ✅ Le cache est rechargé depuis la DB
- ✅ Les templates à jour sont utilisés

## 📊 Checklist de Validation Finale

### Base de données
- [ ] Table `notification_settings` existe et correcte
- [ ] Table `notification_template_versions` existe et correcte
- [ ] Contraintes FK valides
- [ ] RLS activé et fonctionnel

### Templates
- [ ] Tous les placeholders fonctionnent
- [ ] Mapping camelCase → snake_case correct
- [ ] Placeholders inconnus gérés (warning + conservation)
- [ ] Templates vides → fallback par défaut

### NotificationService
- [ ] `sendBookingConfirmation()` utilise 100% templates DB
- [ ] `sendBookingReminder()` utilise 100% templates DB
- [ ] `sendTestConfirmationEmail()` fonctionne
- [ ] Logs détaillés présents
- [ ] Mode DEBUG fonctionne

### Endpoints API
- [ ] GET `/api/owner/notification-settings` fonctionne
- [ ] PUT `/api/owner/notification-settings` fonctionne + crée snapshot
- [ ] POST `/api/owner/notifications/send-test-email` fonctionne
- [ ] GET `/api/owner/notification-templates/versions` fonctionne
- [ ] GET `/api/owner/notification-templates/versions/:id` fonctionne
- [ ] POST `/api/owner/notification-templates/versions/:id/restore` fonctionne
- [ ] GET `/api/notifications/send-reminders` fonctionne
- [ ] Sécurité : authentification vérifiée

### UI Frontend
- [ ] Chargement des settings fonctionne
- [ ] Sauvegarde fonctionne
- [ ] Bouton email de test fonctionne
- [ ] Historique des versions charge et affiche
- [ ] Détails d'une version fonctionnent
- [ ] Restauration fonctionne avec confirmation

### Intégration
- [ ] Création rendez-vous → notifications envoyées
- [ ] Rappels automatiques fonctionnent
- [ ] Templates personnalisés utilisés partout
- [ ] Aucun template codé en dur (sauf cancellation/modification)

## 🐛 Bugs Potentiels à Surveiller

1. **Cache non invalidé** : Si les templates ne se mettent pas à jour après modification
2. **Placeholders non remplacés** : Vérifier les logs pour les warnings
3. **Fallback non utilisé** : Si un template vide cause une erreur
4. **Versioning** : Si les snapshots ne sont pas créés
5. **Sécurité** : Si un owner peut voir/restaurer les versions d'un autre salon

## ✅ Critères de Succès

Le système est validé si :
- ✅ Tous les tests ci-dessus passent
- ✅ Les templates personnalisés sont utilisés à 100%
- ✅ Aucun template codé en dur n'est utilisé (sauf cancellation/modification)
- ✅ Le versioning fonctionne parfaitement
- ✅ Les logs sont clairs et détaillés
- ✅ La sécurité est respectée



