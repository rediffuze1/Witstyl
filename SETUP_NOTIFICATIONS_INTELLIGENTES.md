# 🚀 Setup Automatique : Notifications Intelligentes

Ce document explique comment tout a été configuré automatiquement pour que le système fonctionne sans intervention.

## ✅ Ce qui a été fait automatiquement

### 1. Migration de la base de données ✅

La migration SQL a été **appliquée automatiquement** via l'API Supabase MCP.

**Colonnes ajoutées à `appointments` :**
- ✅ `email_sent_at` - Date d'envoi de l'email
- ✅ `email_opened_at` - Date d'ouverture de l'email
- ✅ `sms_confirmation_sent` - SMS de confirmation envoyé
- ✅ `sms_reminder_sent` - SMS de rappel envoyé
- ✅ `sms_confirmation_type` - Type de SMS envoyé

**Table créée :**
- ✅ `email_events` - Événements email (delivered, opened, etc.)

**Index créés :**
- ✅ Tous les index nécessaires pour les performances

### 2. Code créé ✅

**Services :**
- ✅ `server/core/notifications/emailService.ts` - Gestion des emails
- ✅ `server/core/notifications/smsService.ts` - Gestion des SMS conditionnels

**Routes :**
- ✅ `server/routes/resend-webhook.ts` - Webhook Resend
- ✅ Routes de test dans `server/index.ts` :
  - `POST /api/owner/notifications/test-confirmation-sms`
  - `POST /api/owner/notifications/test-reminder-sms`

**Cron jobs :**
- ✅ `server/cron/check-email-opened-and-send-sms.ts` - Option B
- ✅ `server/cron/send-reminder-sms.ts` - Option C

**Schéma :**
- ✅ `server/db/schema.ts` - Colonnes et table ajoutées

### 3. Intégration ✅

- ✅ `NotificationService` modifié pour utiliser le nouveau système
- ✅ Route webhook intégrée dans `server/index.ts`
- ✅ Cron jobs configurés (optionnel, via `ENABLE_CRON_JOBS=true`)

## 🔧 Configuration requise

### Variables d'environnement

Aucune nouvelle variable requise ! Le système utilise les variables existantes :
- `SUPABASE_URL` ✅ (déjà configuré)
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (déjà configuré)
- `RESEND_API_KEY` ✅ (déjà configuré pour les emails)
- `SMS_PROVIDER` ✅ (déjà configuré : `clicksend`, `twilio-sms`, etc.)
- `CLICKSEND_USERNAME`, `CLICKSEND_API_KEY`, `CLICKSEND_SMS_FROM` ✅ (si ClickSend)
- `SMS_DRY_RUN` ✅ (déjà configuré)

**Optionnel :**
- `ENABLE_CRON_JOBS=true` - Active les cron jobs automatiques (si node-cron installé)

### Webhook Resend

**⚠️ ACTION REQUISE :** Configurez le webhook Resend manuellement :

1. Allez dans [Resend Dashboard](https://resend.com/webhooks)
2. Créez un nouveau webhook
3. URL : `https://votre-domaine.com/api/notifications/resend/webhook`
4. Événements : `email.delivered`, `email.opened`

**Note :** Pour le développement local, utilisez un service comme [ngrok](https://ngrok.com/) pour exposer votre serveur local.

### Cron Jobs

**Option 1 : Via node-cron (automatique)**

Ajoutez dans `.env` :
```bash
ENABLE_CRON_JOBS=true
```

Les cron jobs s'exécuteront automatiquement toutes les heures.

**Option 2 : Via Vercel Cron**

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

**Option 3 : Via cron système**

```bash
# Toutes les heures
0 * * * * cd /path/to/project && tsx server/cron/check-email-opened-and-send-sms.ts
0 * * * * cd /path/to/project && tsx server/cron/send-reminder-sms.ts
```

## 🧪 Test

### 1. Tester la création d'un RDV

Créez un RDV via l'interface :
- ✅ Email de confirmation envoyé immédiatement
- ✅ `email_sent_at` mis à jour en base
- ✅ SMS **non envoyé** immédiatement (Option B)

### 2. Tester le webhook Resend

Ouvrez l'email de confirmation :
- ✅ Webhook Resend reçu
- ✅ `email_opened_at` mis à jour
- ✅ Événement créé dans `email_events`

### 3. Tester le cron job Option B

```bash
# Exécuter manuellement
tsx server/cron/check-email-opened-and-send-sms.ts
```

Résultat attendu :
- Si email non ouvert après 12h → SMS envoyé
- Si email ouvert → Pas de SMS

### 4. Tester le cron job Option C

```bash
# Exécuter manuellement
tsx server/cron/send-reminder-sms.ts
```

Résultat attendu :
- Si RDV dans 24-36h et fenêtre 6h-20h → SMS envoyé
- Sinon → Pas de SMS ou reporté

### 5. Tester les routes API

```bash
# Test SMS confirmation
curl -X POST http://localhost:5001/api/owner/notifications/test-confirmation-sms \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your-session" \
  -d '{"appointmentId": "uuid-du-rdv"}'

# Test SMS rappel
curl -X POST http://localhost:5001/api/owner/notifications/test-reminder-sms \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your-session" \
  -d '{"appointmentId": "uuid-du-rdv"}'
```

## 📊 Vérification

### Vérifier la migration

```sql
-- Vérifier les colonnes
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name IN ('email_sent_at', 'email_opened_at', 'sms_confirmation_sent', 'sms_reminder_sent');

-- Vérifier la table
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'email_events';
```

### Vérifier les logs

Après création d'un RDV, vérifiez les logs :
```
[NotificationService] ✅ Événement email "sent" enregistré pour {appointmentId}
[EmailService] ✅ Email de confirmation envoyé
```

## 🎯 Résultat

Le système est **100% fonctionnel** :

1. ✅ Migration appliquée
2. ✅ Code intégré
3. ✅ Routes créées
4. ✅ Cron jobs prêts

**Il ne reste qu'à :**
- Configurer le webhook Resend (5 minutes)
- Optionnel : Activer les cron jobs (`ENABLE_CRON_JOBS=true`)

## 📚 Documentation

- `GUIDE_NOTIFICATIONS_INTELLIGENTES.md` - Guide complet
- `sql/add_notification_tracking.sql` - Migration SQL
- `server/cron/*.ts` - Cron jobs
- `server/core/notifications/*.ts` - Services

## 🆘 Dépannage

### Le webhook ne fonctionne pas

1. Vérifiez l'URL dans Resend
2. Vérifiez les logs : `[ResendWebhook] 📨 Webhook reçu`
3. Testez avec ngrok en local

### Les cron jobs ne s'exécutent pas

1. Vérifiez `ENABLE_CRON_JOBS=true` dans `.env`
2. Vérifiez que `node-cron` est installé : `npm list node-cron`
3. Testez manuellement : `tsx server/cron/check-email-opened-and-send-sms.ts`

### Les SMS ne sont pas envoyés

1. Vérifiez `SMS_DRY_RUN=false` dans `.env`
2. Vérifiez les logs du cron job
3. Testez avec les routes API de test


