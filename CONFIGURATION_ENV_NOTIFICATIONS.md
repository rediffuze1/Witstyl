# 📋 Configuration .env pour les Notifications Intelligentes

## ✅ Variables déjà nécessaires (probablement déjà configurées)

### Supabase (obligatoire)
```bash
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre-anon-key
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key  # ⚠️ Important pour les cron jobs
```

### Resend (pour les emails)
```bash
RESEND_API_KEY=re_votre-cle-api
RESEND_FROM=SalonPilot <noreply@salonpilot.ch>
```

## 🔧 Variables SMS (à configurer selon votre provider)

### Option 1 : ClickSend (recommandé pour la Suisse)

```bash
# Provider SMS
SMS_PROVIDER=clicksend

# ClickSend credentials
CLICKSEND_USERNAME=votre-username-clicksend
CLICKSEND_API_KEY=votre-api-key-clicksend
CLICKSEND_SMS_FROM=SalonPilot  # Sender ID alphanumérique (max 11 chars) ou numéro (+41791234567)

# Mode dry-run (pour tester sans envoyer de vrais SMS)
SMS_DRY_RUN=true  # Mettez à false pour envoyer de vrais SMS
```

**Où trouver vos credentials ClickSend :**
1. Connectez-vous sur https://dashboard.clicksend.com
2. Allez dans **Settings** → **API**
3. Copiez votre **Username** et **API Key**

### Option 2 : Twilio SMS

```bash
# Provider SMS
SMS_PROVIDER=twilio-sms

# Twilio credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=votre-auth-token
TWILIO_SMS_FROM=+14155238886  # Votre numéro Twilio (format E.164)

# Optionnel : Messaging Service (si vous en utilisez un)
# TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Mode dry-run
SMS_DRY_RUN=true  # Mettez à false pour envoyer de vrais SMS
```

### Option 3 : Twilio WhatsApp

```bash
# Provider SMS
SMS_PROVIDER=twilio-whatsapp

# Twilio credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=votre-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  # Format: whatsapp:+numéro

# Mode dry-run
SMS_DRY_RUN=true  # Mettez à false pour envoyer de vrais SMS
```

### Option 4 : SMSup (legacy, Suisse)

```bash
# Provider SMS
SMS_PROVIDER=smsup

# SMSup credentials
SMSUP_API_TOKEN=votre-token-api
SMSUP_SENDER=SalonPilot

# Mode dry-run
SMS_DRY_RUN=true  # Mettez à false pour envoyer de vrais SMS
```

## ⚙️ Variables optionnelles

### Activer les cron jobs automatiques

```bash
# Active les cron jobs node-cron (toutes les heures)
ENABLE_CRON_JOBS=true
```

**Note :** Si vous n'activez pas cette variable, vous devrez :
- Soit configurer les cron jobs via Vercel Cron
- Soit les exécuter manuellement : `tsx server/cron/check-email-opened-and-send-sms.ts`

### Mode debug

```bash
# Active les logs détaillés pour les notifications
NOTIFICATIONS_DEBUG=true
```

## 📝 Exemple de .env complet

```bash
# =====================================================
# SUPABASE (obligatoire)
# =====================================================
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre-anon-key
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key

# =====================================================
# RESEND (pour les emails)
# =====================================================
RESEND_API_KEY=re_votre-cle-api
RESEND_FROM=SalonPilot <noreply@salonpilot.ch>

# =====================================================
# CLICKSEND (pour les SMS)
# =====================================================
SMS_PROVIDER=clicksend
CLICKSEND_USERNAME=votre-username
CLICKSEND_API_KEY=votre-api-key
CLICKSEND_SMS_FROM=SalonPilot

# =====================================================
# MODES DE TEST
# =====================================================
SMS_DRY_RUN=true          # true = SMS loggés uniquement, false = SMS réels
EMAIL_DRY_RUN=false       # true = Emails loggés uniquement, false = Emails réels

# =====================================================
# CRON JOBS (optionnel)
# =====================================================
ENABLE_CRON_JOBS=true     # Active les cron jobs automatiques

# =====================================================
# DEBUG (optionnel)
# =====================================================
NOTIFICATIONS_DEBUG=true  # Active les logs détaillés
```

## 🧪 Tester la configuration

### 1. Vérifier que tout est configuré

```bash
# Le serveur affichera les providers configurés au démarrage
npm run dev
```

Vous devriez voir :
```
[Notifications] ✅ Provider SMS: ClickSend
[Notifications] ✅ Provider Email: Resend
[Notifications] ✅ Mode dry-run SMS: true
[Notifications] ✅ Mode dry-run Email: false
```

### 2. Tester l'envoi d'un SMS

```bash
# Via l'API de test (nécessite d'être connecté en tant qu'owner)
curl -X POST http://localhost:5001/api/owner/notifications/send-test-sms \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your-session" \
  -d '{
    "to": "+41791234567",
    "message": "Test SMS depuis SalonPilot"
  }'
```

### 3. Tester la création d'un RDV

1. Créez un RDV via l'interface
2. Vérifiez les logs :
   ```
   [NotificationService] ✅ Événement email "sent" enregistré
   [EmailService] ✅ Email de confirmation envoyé
   ```
3. Vérifiez en base :
   ```sql
   SELECT email_sent_at, email_opened_at, sms_confirmation_sent
   FROM appointments
   WHERE id = 'votre-appointment-id';
   ```

## ⚠️ Important

### Mode dry-run

- **`SMS_DRY_RUN=true`** : Les SMS sont **loggés** mais **pas envoyés** (parfait pour tester)
- **`SMS_DRY_RUN=false`** : Les SMS sont **réellement envoyés** (coûts réels)

**Recommandation :**
- Développement : `SMS_DRY_RUN=true`
- Production : `SMS_DRY_RUN=false` (une fois que tout fonctionne)

### SUPABASE_SERVICE_ROLE_KEY

⚠️ **Obligatoire** pour :
- Les cron jobs (accès admin à la base)
- Le webhook Resend (mise à jour des appointments)
- Les services emailService et smsService

Sans cette clé, les cron jobs ne pourront pas fonctionner.

## 🔍 Vérifier que tout fonctionne

### Checklist

- [ ] `SUPABASE_URL` configuré
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configuré
- [ ] `RESEND_API_KEY` configuré
- [ ] `SMS_PROVIDER` configuré (`clicksend`, `twilio-sms`, etc.)
- [ ] Credentials du provider SMS configurés (CLICKSEND_* ou TWILIO_*)
- [ ] `SMS_DRY_RUN=true` pour tester (ou `false` pour production)
- [ ] `ENABLE_CRON_JOBS=true` si vous voulez les cron jobs automatiques

### Test rapide

```bash
# Vérifier que le serveur démarre sans erreur
npm run dev

# Vérifier les logs au démarrage
# Vous devriez voir :
# ✅ Provider SMS: [votre provider]
# ✅ Provider Email: Resend
# ✅ Cron jobs configurés (si ENABLE_CRON_JOBS=true)
```

## 🆘 Dépannage

### "Provider SMS non configuré"

Vérifiez que :
- `SMS_PROVIDER` est défini
- Les credentials du provider sont définis (CLICKSEND_* ou TWILIO_*)

### "SUPABASE_SERVICE_ROLE_KEY manquant"

Cette clé est nécessaire pour les cron jobs. Récupérez-la dans :
- Supabase Dashboard → Settings → API → `service_role` key

### "SMS non envoyé"

1. Vérifiez `SMS_DRY_RUN=false` (si vous voulez envoyer de vrais SMS)
2. Vérifiez les logs : `[ClickSendSms]` ou `[TwilioSms]`
3. Vérifiez que les credentials sont corrects


