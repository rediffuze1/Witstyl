# Guide pour Tester les Rappels de Rendez-vous

Ce guide explique comment tester le système de rappels automatiques de Witstyl.

## 📋 Prérequis

1. **Un rendez-vous confirmé** dans la base de données
2. **Un client avec un numéro de téléphone** valide (format: `+4179XXXXXXX`)
3. **Configuration des notifications** dans `notification_settings`

## 🔧 Configuration

### 1. Vérifier les paramètres dans `.env`

```bash
# Pour tester SANS envoyer de vrais SMS (recommandé pour commencer)
SMS_DRY_RUN=true

# Pour envoyer de VRAIS SMS (une fois que tout fonctionne)
# SMS_DRY_RUN=false
# SMSUP_API_TOKEN=votre_token_ici
# SMSUP_SENDER=Witstyl
```

### 2. Configurer le délai de rappel

Dans la table `notification_settings` de votre salon, configurez `reminder_offset_hours` :

- **12 heures** : Rappel envoyé 12h avant le RDV
- **24 heures** : Rappel envoyé 24h avant le RDV (recommandé)
- **48 heures** : Rappel envoyé 48h avant le RDV

**Pour faciliter les tests**, vous pouvez mettre `reminder_offset_hours = 1` ou `2` (1-2 heures avant).

## 🧪 Méthode 1 : Test Rapide (Mode Dry Run)

### Étape 1 : Créer un rendez-vous de test

1. Créez un rendez-vous dans l'interface ou via l'API
2. **Important** : Le rendez-vous doit être :
   - `status = 'confirmed'`
   - Dans les **prochaines 48 heures**
   - Le client doit avoir un numéro de téléphone valide

### Étape 2 : Configurer un délai court

Dans votre base de données, modifiez temporairement `reminder_offset_hours` :

```sql
UPDATE notification_settings 
SET reminder_offset_hours = 1  -- 1 heure avant (pour test rapide)
WHERE salon_id = 'votre_salon_id';
```

### Étape 3 : Créer un rendez-vous imminent

Créez un rendez-vous qui commence dans **1-2 heures** :

```sql
-- Exemple : RDV dans 1h30
INSERT INTO appointments (salon_id, client_id, stylist_id, service_id, appointment_date, status)
VALUES (
  'votre_salon_id',
  'votre_client_id',
  'votre_stylist_id',
  'votre_service_id',
  NOW() + INTERVAL '1 hour 30 minutes',  -- Dans 1h30
  'confirmed'
);
```

### Étape 4 : Appeler l'endpoint de rappels

```bash
curl http://localhost:5001/api/notifications/send-reminders
```

### Étape 5 : Vérifier les logs

En mode **DRY RUN** (`SMS_DRY_RUN=true`), vous devriez voir :

```
[NotificationService] 📱 SMS de rappel:
  Template brut: ...
  Contexte: ...
[SmsUp] [DRY RUN] Envoi SMS vers +4179XXXXXXX
```

**Aucun SMS réel ne sera envoyé**, mais vous verrez exactement ce qui serait envoyé.

## 🚀 Méthode 2 : Test avec Envoi Réel

### Étape 1 : Activer l'envoi réel

Dans `.env` :

```bash
SMS_DRY_RUN=false
SMSUP_API_TOKEN=votre_token_api_smsup
SMSUP_SENDER=Witstyl
```

**Redémarrer le serveur** après modification :

```bash
npm run dev
```

Vérifiez les logs au démarrage :

```
[Notifications] 📱 SMS: ✅ ENVOI RÉEL
[Notifications] 🔑 SMSUP_API_TOKEN: ✅ Défini
```

### Étape 2 : Créer un rendez-vous de test

Créez un rendez-vous qui commence dans **1-2 heures** avec votre numéro de téléphone réel.

### Étape 3 : Appeler l'endpoint

```bash
curl http://localhost:5001/api/notifications/send-reminders
```

### Étape 4 : Vérifier la réception

- ✅ **SMS reçu** sur votre téléphone
- ✅ **Logs serveur** : `[SmsUp] ENVOI RÉEL → +41...`
- ✅ **Dashboard SMSup** : L'envoi apparaît dans l'historique

## 📊 Comprendre la Réponse de l'API

L'endpoint `/api/notifications/send-reminders` retourne :

```json
{
  "message": "Traitement terminé: 2 rappel(s) envoyé(s), 0 erreur(s)",
  "processed": 2,
  "sent": 2,
  "errors": 0,
  "details": [
    {
      "appointmentId": "abc-123",
      "status": "sent",
      "message": "Rappel envoyé avec succès"
    },
    {
      "appointmentId": "def-456",
      "status": "too_early",
      "error": "Rappel prévu dans 5h"
    }
  ]
}
```

### Statuts possibles :

- ✅ **`sent`** : Rappel envoyé avec succès
- ⏰ **`too_early`** : Trop tôt pour envoyer (le rappel est prévu plus tard)
- ⚠️ **`too_late`** : Le rappel aurait dû être envoyé mais est en retard (mais envoyé quand même)
- ❌ **`error`** : Erreur lors de l'envoi

## 🎯 Scénarios de Test Recommandés

### Scénario 1 : Test immédiat (1 heure)

1. `reminder_offset_hours = 1`
2. Créer un RDV dans **1h30**
3. Appeler `/send-reminders` → ✅ Rappel envoyé

### Scénario 2 : Test avec délai standard (24 heures)

1. `reminder_offset_hours = 24`
2. Créer un RDV **demain à la même heure**
3. Appeler `/send-reminders` → ✅ Rappel envoyé

### Scénario 3 : Test "trop tôt"

1. `reminder_offset_hours = 24`
2. Créer un RDV dans **30 heures**
3. Appeler `/send-reminders` → ⏰ Statut "too_early"

### Scénario 4 : Test "en retard"

1. `reminder_offset_hours = 24`
2. Créer un RDV dans **20 heures** (4h de retard)
3. Appeler `/send-reminders` → ⚠️ Statut "too_late" mais envoyé quand même

## 🔍 Dépannage

### Problème : Aucun rappel envoyé

**Vérifications :**

1. ✅ Le rendez-vous a `status = 'confirmed'` ?
2. ✅ Le rendez-vous est dans les prochaines 48h ?
3. ✅ Le client a un numéro de téléphone valide ?
4. ✅ `reminder_offset_hours` est configuré dans `notification_settings` ?
5. ✅ Le calcul du timing est correct (RDV - offset = maintenant ± 30 min) ?

### Problème : SMS non reçu (mode réel)

1. ✅ Vérifier `SMS_DRY_RUN=false` dans `.env`
2. ✅ Redémarrer le serveur après modification
3. ✅ Vérifier les crédits SMSup
4. ✅ Vérifier le format du numéro (`+41...`)
5. ✅ Vérifier les logs : `[SmsUp] ENVOI RÉEL` ou `[DRY RUN]` ?

### Problème : Erreur "status -8" (Modération)

Le SMS est en attente de validation dans SMSup :

1. Connectez-vous au **dashboard SMSup**
2. Allez dans **"Expéditeurs"** ou **"Senders"**
3. **Validez** l'expéditeur (ex: "Witstyl")
4. Le SMS partira automatiquement après validation

## 🔄 Automatisation (Production)

Pour automatiser les rappels en production, configurez un **cron job** qui appelle l'endpoint toutes les 30 minutes :

```bash
# Exemple avec cron (toutes les 30 minutes)
*/30 * * * * curl -s http://localhost:5001/api/notifications/send-reminders > /dev/null
```

Ou utilisez un service comme **cron-job.org** ou **EasyCron** pour appeler l'endpoint depuis l'extérieur.

## 📝 Notes Importantes

- ⚠️ L'endpoint vérifie les rendez-vous dans les **prochaines 48 heures uniquement**
- ⚠️ Le rappel est envoyé dans une **fenêtre de 30 minutes** autour de l'heure calculée
- ⚠️ Les rappels en retard de **plus de 2 heures** ne sont pas envoyés
- ✅ Les templates SMS sont personnalisables via `notification_settings.reminder_sms_text`

## 🎉 Résumé Rapide

```bash
# 1. Configurer le délai (1h pour test rapide)
UPDATE notification_settings SET reminder_offset_hours = 1 WHERE salon_id = 'xxx';

# 2. Créer un RDV dans 1h30
# (via l'interface ou l'API)

# 3. Appeler l'endpoint
curl http://localhost:5001/api/notifications/send-reminders

# 4. Vérifier les logs et/ou réception du SMS
```



