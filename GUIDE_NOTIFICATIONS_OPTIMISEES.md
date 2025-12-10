# Guide : Notifications Optimisées Email + SMS

Ce guide explique la logique de notifications optimisées pour les rendez-vous Witstyl.

## 🎯 Règles Métier

### 1. Email de Confirmation
- **Toujours envoyé** lors de la création d'un RDV
- Contient `metadata.appointmentId` pour le webhook Resend
- Enregistre `emailSentAt` en base

### 2. SMS de Confirmation

#### CAS B1 : RDV pris **moins de 24h** avant l'heure du RDV
- **SMS envoyé immédiatement** en même temps que l'email
- `skipReminderSms = true` (pas de rappel)
- `smsConfirmationSent = true`
- `smsConfirmationType = 'immediate_less_24h'`

#### CAS B2 : RDV pris **≥ 24h** avant l'heure du RDV
- **Pas de SMS immédiat**
- Email envoyé immédiatement
- **Après 3h**, si l'email n'a pas été ouvert :
  - SMS de confirmation envoyé automatiquement
  - `smsConfirmationSent = true`
  - `smsConfirmationType = 'confirmation_missing_email_open'`

### 3. SMS de Rappel
- **Envoyé exactement 24h avant** l'heure du RDV
- Conditions :
  - `skipReminderSms = false` (RDV pris ≥ 24h avant)
  - `smsReminderSent = false`
  - Statut = `scheduled` ou `confirmed`
  - RDV dans la fenêtre 24h à 24h15min avant

## 📊 Schéma Base de Données

### Table `appointments`
- `email_sent_at` : Date d'envoi de l'email
- `email_opened_at` : Date d'ouverture de l'email (via webhook)
- `sms_confirmation_sent` : SMS de confirmation envoyé
- `sms_reminder_sent` : SMS de rappel envoyé
- `sms_confirmation_type` : Type de SMS (`immediate_less_24h`, `confirmation_missing_email_open`)
- `skip_reminder_sms` : `true` si RDV pris < 24h avant (pas de rappel)

### Table `email_events`
- Track les événements email (sent, delivered, opened, failed)
- Utilisé pour le debugging et l'analyse

## ⚙️ Services

### `optimizedNotificationService.ts`
Service principal qui gère la logique de création de RDV :
- Calcule le lead time (délai entre création et RDV)
- Décide si SMS immédiat ou différé
- Met à jour `skipReminderSms` en conséquence

### `emailService.ts`
- `sendConfirmationEmail()` : Envoie l'email avec metadata
- `markEmailAsOpened()` : Marque l'email comme ouvert (via webhook)

### `smsService.ts`
- `sendSmsConfirmationIfNeeded()` : Envoie SMS après 3h si email non ouvert (CAS B2)
- `sendSmsReminderIfNeeded()` : Envoie SMS de rappel 24h avant

## ⏰ Cron Jobs

### `check-email-opened-and-send-sms.ts`
- **Fréquence** : Toutes les 10-15 minutes
- **Fenêtre** : Emails envoyés il y a 3-6 heures
- **Filtres** :
  - Email envoyé mais non ouvert
  - SMS de confirmation pas encore envoyé
  - RDV pris ≥ 24h avant (lead time ≥ 24h)

### `send-reminder-sms.ts`
- **Fréquence** : Toutes les 10-15 minutes
- **Fenêtre** : RDV dans 24h à 24h15min
- **Filtres** :
  - `skipReminderSms = false`
  - `smsReminderSent = false`
  - Statut actif

## 🌐 Webhook Resend

### Route : `/api/notifications/resend/webhook`
- Reçoit les événements `email.opened` et `email.delivered`
- Extrait `appointmentId` depuis les tags Resend
- Met à jour `emailOpenedAt` en base
- Crée un événement dans `email_events`

### Configuration Resend
1. Aller dans Resend Dashboard → Webhooks
2. Ajouter un webhook pointant vers : `https://votre-domaine.com/api/notifications/resend/webhook`
3. Sélectionner les événements : `email.opened`, `email.delivered`

## 🧪 Routes de Test

### `POST /api/owner/notifications/test-confirmation-sms`
- Teste l'envoi d'un SMS de confirmation
- Body : `{ appointmentId: "..." }`
- Nécessite authentification owner

### `POST /api/owner/notifications/test-reminder-sms`
- Teste l'envoi d'un SMS de rappel
- Body : `{ appointmentId: "..." }`
- Nécessite authentification owner

## 📝 Migration SQL

Exécuter la migration pour ajouter `skip_reminder_sms` :

```bash
# Via Supabase SQL Editor ou psql
psql $DATABASE_URL -f sql/add_skip_reminder_sms.sql
```

Ou via le script :

```bash
npm run db:migrate:notifications
```

## 🔍 Debugging

### Vérifier les logs
- Les logs sont très détaillés avec des séparateurs `═══════`
- Chercher `[OptimizedNotificationService]`, `[SmsService]`, `[EmailService]`

### Vérifier un RDV spécifique
```sql
SELECT 
  id,
  appointment_date,
  created_at,
  email_sent_at,
  email_opened_at,
  sms_confirmation_sent,
  sms_reminder_sent,
  skip_reminder_sms,
  sms_confirmation_type
FROM appointments
WHERE id = '...';
```

### Vérifier les événements email
```sql
SELECT * FROM email_events
WHERE appointment_id = '...'
ORDER BY timestamp DESC;
```

## ✅ Checklist de Déploiement

- [ ] Migration SQL appliquée (`skip_reminder_sms`)
- [ ] Webhook Resend configuré et testé
- [ ] Cron jobs activés (`ENABLE_CRON_JOBS=true`)
- [ ] Variables d'environnement configurées (ClickSend, Resend)
- [ ] Tests effectués avec RDV < 24h et ≥ 24h
- [ ] Vérification des logs pour chaque scénario


