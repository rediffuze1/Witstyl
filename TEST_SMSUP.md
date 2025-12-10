# Tests SMSup (Witstyl)

## 1. Préparation

```bash
# .env
SMSUP_API_TOKEN=your-token
SMSUP_SENDER=Witstyl-Test
SMS_DRY_RUN=false         # pour envoyer réellement
# SMSUP_API_URL=https://api.smsup.ch/send  # Optionnel

# Redémarrer le backend
npm run dev
```

Vérifiez dans les logs :
```
[Notifications] 📱 SMS: ✅ ENVOI RÉEL
[Notifications] 🔑 SMSUP_API_TOKEN: ✅ Défini (xxxx…)
[Notifications] 📱 SMSUP_SENDER: Witstyl-Test
```

## 2. Test direct (script CLI)

```bash
npx tsx scripts/test-sms-direct.ts +4179XXXXXXX
```

Résultat attendu :
- En dry-run (`SMS_DRY_RUN=true`) → `[SmsUp] [DRY RUN] ...`
- En réel (`SMS_DRY_RUN=false`) → `[SmsUp] Envoi SMS...` puis `✅ SMS envoyé avec succès`
- Le SMS apparaît dans le dashboard SMSup et sur le téléphone.

## 3. Test via interface (confirmation)

1. Se connecter comme client depuis l'app.
2. Prendre un rendez-vous avec un numéro réel.
3. Surveiller les logs backend :
   ```
   [POST /api/appointments] 📧 ...
   [SmsUp] Envoi SMS à +41...
   [SmsUp] Réponse HTTP 200: <response>...status>0</status>...</response>
   ```
4. Confirmer que le SMS de confirmation est reçu.

## 4. Test du rappel

1. Configurer `notification_settings.reminder_offset_hours` sur 12 ou 24.
2. Créer un rendez-vous dans la plage couverte.
3. Lancer manuellement l'endpoint de rappel :
   ```bash
   curl http://localhost:5001/api/notifications/send-reminders
   ```
4. Vérifier :
   - Logs `[SmsUp] Envoi SMS ...`
   - SMS de rappel reçu + présent dans SMSup.

## 5. Points de validation

- Logs `[SmsUp] [DRY RUN] ...` uniquement si `SMS_DRY_RUN=true`.
- En mode réel :
  - Pas de mot de passe affiché.
  - `status` dans la réponse XML >= 0.
  - SMS visible côté SMSup et sur le téléphone.

## 6. Diagnostic rapide

| Problème                              | Action |
|---------------------------------------|--------|
| `SMSUP_API_TOKEN missing`            | Vérifier `.env` et redémarrer |
| `status -1` ou `login/mot de passe`  | Token invalide / expiré |
| `[SmsUp] [DRY RUN]` en prod           | `SMS_DRY_RUN` encore à `true` |
| `SMS non envoyé: numéro manquant`     | Client sans numéro |


