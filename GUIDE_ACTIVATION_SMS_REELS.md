# Guide d'Activation des SMS Réels (SMSup)

## ✅ Checklist de vérification

### 1. Variables d'environnement

Assurez-vous que `.env` contient :

```bash
# SMSup
SMSUP_API_TOKEN=votre-token-api
SMSUP_SENDER=Witstyl-Pierre   # 11 caractères maximum
# SMSUP_API_URL=https://api.smsup.ch/send   # Optionnel

# Mode réel
SMS_DRY_RUN=false   # true = logs uniquement / false = envoi réel
```

> 💡 Après chaque modification de `.env`, redémarrez `npm run dev`.

### 2. Logs de démarrage attendus

```
═══════════════════════════════════════════════════════════════
[Notifications] ⚙️  CONFIGURATION DES NOTIFICATIONS
═══════════════════════════════════════════════════════════════
[Notifications] 📱 SMS: ✅ ENVOI RÉEL
[Notifications] 🔑 SMSUP_API_TOKEN: ✅ Défini (xxxx…)
[Notifications] 📱 SMSUP_SENDER: Witstyl-Pierre
[Notifications] 🔧 SMS_DRY_RUN: false
═══════════════════════════════════════════════════════════════
```

Si vous voyez `⚠️  DRY RUN`, c’est que `SMS_DRY_RUN` vaut encore `true` → redémarrez / corrigez `.env`.

### 3. Clients avec numéros valides

Les SMS ne partent que si le client possède un numéro.

```sql
SELECT id, first_name, last_name, phone
FROM clients
WHERE phone IS NULL OR phone = '';
```

Formats acceptés : `+41791234567`, `0791234567`, `079 123 45 67`

### 4. Templates et settings

`notification_settings` doit contenir vos templates.

```sql
SELECT salon_id,
       confirmation_sms_text,
       reminder_sms_text,
       reminder_offset_hours
FROM notification_settings
WHERE salon_id = 'votre-salon-id';
```

### 5. Tests d’envoi

**Via rendez-vous**

1. Créez un rendez-vous.
2. Dans les logs :
   ```
   [SmsUp] Envoi SMS à +41...
   [SmsUp] Réponse HTTP 200: <response>...status>0</status>...</response>
   ```
3. Vérifiez le SMS reçu + dashboard SMSup.

**Via script**

```bash
SMS_DRY_RUN=false npx tsx scripts/test-sms-direct.ts +4179XXXXXXX
```

Le script utilise `SmsUpProvider` : il doit afficher `SMS envoyé avec succès !`.

### 6. Erreurs fréquentes

| Message                                       | Solution |
|-----------------------------------------------|----------|
| `SMSUP_API_TOKEN missing`                     | Ajoutez le token API dans `.env` |
| `[SmsUp] [DRY RUN]` même en prod              | Redémarrez le serveur / vérifiez `SMS_DRY_RUN=false` |
| `status -1 / login et mot de passe...`        | Login/mot de passe incorrects sur SMSup |
| `SMS non envoyé: numéro manquant`             | Renseignez `phone` côté client |
| `HTTP 400`                                    | Numéro invalide / format incorrect |

### 7. Résumé rapide

1. `SMS_DRY_RUN=false`
2. `SMSUP_API_TOKEN` défini
3. Serveur redémarré
4. Clients avec numéros corrects
5. Templates présents
6. Logs `[SmsUp]` montrent un envoi réel
7. SMS visible sur le téléphone et sur le dashboard SMSup

🎉 Quand tous ces points sont vérifiés, les SMS partent réellement.
