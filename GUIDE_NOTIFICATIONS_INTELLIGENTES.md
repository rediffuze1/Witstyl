# Guide : Notifications Intelligentes Email + SMS

Ce guide explique le système de notifications intelligentes mis en place pour réduire les coûts SMS tout en gardant une excellente fiabilité.

## 📋 Vue d'ensemble

Le système implémente deux options :

### 🟦 Option B — SMS seulement si email non ouvert

**Workflow :**
1. Lorsqu'un client crée un RDV → email de confirmation envoyé immédiatement
2. Resend envoie un webhook quand l'email est ouvert
3. Si **12 heures après l'envoi**, l'email n'a PAS été ouvert → SMS de confirmation envoyé
4. Un seul SMS par confirmation (pas de doublon)

**Résultat :** ~70% d'emails ouverts = 0 SMS, ~30% reçoivent 1 SMS après 12h

### 🟧 Option C — SMS rappel uniquement pour RDV du lendemain entre 6h-20h

**Workflow :**
1. Rappel SMS envoyé 24h avant le RDV
2. **Uniquement si :**
   - RDV dans les 24-36h
   - Fenêtre horaire 6h-20h
   - SMS de rappel pas déjà envoyé
3. Si hors fenêtre horaire → reporté à 6h du matin

**Résultat :** Réduction de 30-40% des SMS de rappel inutiles

## 🗄️ Structure de la base de données

### Table `appointments` (colonnes ajoutées)

```sql
email_sent_at TIMESTAMP           -- Date d'envoi de l'email de confirmation
email_opened_at TIMESTAMP         -- Date d'ouverture de l'email (via webhook Resend)
sms_confirmation_sent BOOLEAN     -- SMS de confirmation envoyé (Option B)
sms_reminder_sent BOOLEAN         -- SMS de rappel envoyé (Option C)
sms_confirmation_type TEXT        -- Type de SMS: "confirmation_missing_email_open"
```

### Table `email_events` (nouvelle table)

```sql
id UUID PRIMARY KEY
appointment_id UUID REFERENCES appointments(id)
type TEXT NOT NULL                -- 'delivered', 'opened', 'bounced', etc.
timestamp TIMESTAMP NOT NULL
provider TEXT DEFAULT 'Resend'
provider_event_id TEXT            -- ID de l'événement côté provider
metadata JSONB                    -- Métadonnées supplémentaires
created_at TIMESTAMP NOT NULL
```

## 🔧 Migration de la base de données

Exécutez la migration SQL :

```bash
# Via Supabase SQL Editor ou psql
psql $DATABASE_URL -f sql/add_notification_tracking.sql

# Ou via le script de migration
npm run db:migrate
```

## 📡 Configuration du webhook Resend

1. **Dans le dashboard Resend :**
   - Allez dans **Settings** → **Webhooks**
   - Créez un nouveau webhook
   - URL : `https://votre-domaine.com/api/notifications/resend/webhook`
   - Événements à écouter : `email.delivered`, `email.opened`

2. **Optionnel :** Ajoutez des tags/metadata dans les emails pour faciliter le matching :
   ```typescript
   await emailProvider.sendEmail({
     to: clientEmail,
     subject: emailSubject,
     html: emailHtml,
     tags: { appointmentId: appointment.id }, // Pour le webhook
   });
   ```

## ⚙️ Services créés

### `emailService.ts`

- `sendConfirmationEmail(appointmentId)` : Envoie l'email et enregistre l'événement
- `storeEmailSentEvent(appointmentId, supabase)` : Enregistre l'événement "sent"
- `markEmailAsOpened(appointmentId, supabase)` : Marque l'email comme ouvert

### `smsService.ts`

- `sendSmsConfirmationIfNeeded(appointmentId)` : Envoie SMS si email non ouvert après 12h (Option B)
- `sendSmsReminderIfNeeded(appointmentId)` : Envoie SMS de rappel si conditions remplies (Option C)

## 🔄 Cron Jobs

### 1. `check-email-opened-and-send-sms.ts` (Option B)

**Fréquence :** Toutes les heures

**Logique :**
- Récupère les RDV avec email envoyé il y a 12-18h
- Filtre : email non ouvert + SMS pas encore envoyé
- Envoie le SMS de confirmation

**Exécution :**
```bash
# Manuel
tsx server/cron/check-email-opened-and-send-sms.ts

# Via cron système (toutes les heures)
0 * * * * cd /path/to/project && tsx server/cron/check-email-opened-and-send-sms.ts
```

### 2. `send-reminder-sms.ts` (Option C)

**Fréquence :** Toutes les heures (ou toutes les 30 minutes)

**Logique :**
- Récupère les RDV dans 24-36h
- Vérifie la fenêtre horaire (6h-20h)
- Envoie le SMS de rappel

**Exécution :**
```bash
# Manuel
tsx server/cron/send-reminder-sms.ts

# Via cron système (toutes les heures)
0 * * * * cd /path/to/project && tsx server/cron/send-reminder-sms.ts
```

## 🧪 Routes API de test

### POST `/api/owner/notifications/test-confirmation-sms`

Teste l'envoi d'un SMS de confirmation (Option B).

**Body :**
```json
{
  "appointmentId": "uuid-du-rdv"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "SMS de confirmation envoyé avec succès",
  "metadata": {
    "appointmentId": "...",
    "smsSentTo": "+41791234567",
    "hoursSinceEmailSent": "12.5"
  }
}
```

### POST `/api/owner/notifications/test-reminder-sms`

Teste l'envoi d'un SMS de rappel (Option C).

**Body :**
```json
{
  "appointmentId": "uuid-du-rdv"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "SMS de rappel envoyé avec succès",
  "metadata": {
    "appointmentId": "...",
    "smsSentTo": "+41791234567",
    "hoursUntilAppointment": "25.3"
  }
}
```

## 📊 Monitoring et logs

### Logs à surveiller

**Option B (SMS confirmation) :**
```
[CronEmailOpened] ✅ SMS envoyé pour {appointmentId}
[EmailService] ✅ Email marqué comme ouvert pour {appointmentId}
[ResendWebhook] ✅ Événement "opened" enregistré
```

**Option C (SMS rappel) :**
```
[CronReminderSms] ✅ SMS envoyé pour {appointmentId}
[CronReminderSms] ⏭️  Hors fenêtre horaire (sera retenté)
```

### Requêtes SQL utiles

**Voir les appointments avec email non ouvert après 12h :**
```sql
SELECT id, email_sent_at, email_opened_at, sms_confirmation_sent
FROM appointments
WHERE email_sent_at IS NOT NULL
  AND email_opened_at IS NULL
  AND sms_confirmation_sent = false
  AND email_sent_at < NOW() - INTERVAL '12 hours';
```

**Voir les appointments éligibles pour SMS rappel :**
```sql
SELECT id, appointment_date, sms_reminder_sent
FROM appointments
WHERE sms_reminder_sent = false
  AND status IN ('scheduled', 'confirmed')
  AND appointment_date BETWEEN NOW() + INTERVAL '24 hours' AND NOW() + INTERVAL '36 hours';
```

## 🚀 Déploiement

### Vercel Cron

Ajoutez dans `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/check-email-opened",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/send-reminder",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Node-cron (serveur dédié)

Dans `server/index.ts` :

```typescript
import cron from 'node-cron';

// Toutes les heures
cron.schedule('0 * * * *', async () => {
  await import('./cron/check-email-opened-and-send-sms.js');
});

cron.schedule('0 * * * *', async () => {
  await import('./cron/send-reminder-sms.js');
});
```

## 📈 Résultats attendus

### Option B (SMS confirmation)

- **Avant :** 100% des clients reçoivent un SMS → 100% des coûts SMS
- **Après :** ~70% des clients ouvrent l'email → 0 SMS, ~30% reçoivent 1 SMS
- **Économie :** ~70% de réduction des coûts SMS de confirmation

### Option C (SMS rappel)

- **Avant :** Tous les rappels envoyés, même pour RDV le jour même ou très tardifs
- **Après :** Seulement les rappels dans la fenêtre 24-36h et 6h-20h
- **Économie :** ~30-40% de réduction des SMS de rappel

## 🔍 Dépannage

### Le webhook Resend ne fonctionne pas

1. Vérifiez l'URL du webhook dans Resend
2. Vérifiez les logs : `[ResendWebhook] 📨 Webhook reçu`
3. Vérifiez que l'appointmentId est bien dans les tags/metadata

### Les SMS ne sont pas envoyés

1. Vérifiez les logs du cron job
2. Vérifiez que les conditions sont remplies (12h pour Option B, fenêtre horaire pour Option C)
3. Testez manuellement avec les routes API de test

### Les emails ne sont pas trackés

1. Vérifiez que `email_sent_at` est bien mis à jour lors de l'envoi
2. Vérifiez que le webhook Resend est bien configuré
3. Vérifiez la table `email_events` pour voir les événements reçus

## 📚 Fichiers créés/modifiés

### Fichiers créés

1. `server/core/notifications/emailService.ts` - Service de gestion des emails
2. `server/core/notifications/smsService.ts` - Service de gestion des SMS conditionnels
3. `server/routes/resend-webhook.ts` - Route webhook Resend
4. `server/cron/check-email-opened-and-send-sms.ts` - Cron job Option B
5. `server/cron/send-reminder-sms.ts` - Cron job Option C
6. `sql/add_notification_tracking.sql` - Migration SQL

### Fichiers modifiés

1. `server/db/schema.ts` - Ajout des colonnes de tracking
2. `server/core/notifications/NotificationService.ts` - Modification pour utiliser emailService
3. `server/index.ts` - Ajout des routes webhook et de test

## ✅ Checklist de déploiement

- [ ] Exécuter la migration SQL
- [ ] Configurer le webhook Resend
- [ ] Configurer les cron jobs (Vercel, node-cron, ou cron système)
- [ ] Tester les routes API de test
- [ ] Vérifier les logs après création d'un RDV
- [ ] Vérifier que les webhooks Resend sont bien reçus
- [ ] Vérifier que les cron jobs s'exécutent correctement


