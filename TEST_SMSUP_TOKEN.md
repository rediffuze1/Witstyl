# TEST SMSup – Authentification par token

Ce guide décrit la procédure complète pour vérifier un envoi SMS réel après la migration vers `SMSUP_API_TOKEN`.

## 1. Préparer l'environnement

Dans `.env` :

```bash
SMSUP_API_TOKEN=xxxxxxxxxxxxxxxxxxxx
SMSUP_SENDER=Witstyl-Test        # 11 caractères max
SMS_DRY_RUN=false                   # mettre à false pour un envoi réel
# SMSUP_API_URL=https://api.smsup.ch/send  # optionnel
```

> ⚠️ Les anciennes variables `SMSUP_LOGIN` / `SMSUP_PASSWORD` ne servent plus qu'au logging. Le token est obligatoire pour un envoi réel.

Redémarrer le backend :

```bash
npm run dev
```

Au démarrage, la console doit afficher :

```
[Notifications] 📱 SMS: ✅ ENVOI RÉEL
[Notifications] 🔑 SMSUP_API_TOKEN: ✅ Défini (xxxx…)
[Notifications] 📱 SMSUP_SENDER: <votre sender>
```

## 2. Test direct via le script

1. Désactivez `SMS_DRY_RUN` (mettre `false`), lancez :
   ```bash
   npx tsx scripts/test-sms-direct.ts +4179XXXXXXX
   ```
2. Attendus :
   - Logs `"[SmsUp] ENVOI RÉEL → +41..."` puis `status: 1` **ou** `status: -8` (modération).
   - Si `status: -8`, nous loggons un avertissement mais l’envoi est considéré comme réussi (SMS reçu + visible).

3. Repassez `SMS_DRY_RUN=true`, relancez la commande :
   - La console doit indiquer `"[SmsUp] [DRY RUN] ..."` et **aucun SMS** n’est comptabilisé côté SMSup.

## 3. Test depuis l'interface (confirmation)

1. Configurez `SMS_DRY_RUN=false`.
2. Depuis l’interface client, créez un rendez-vous réel avec un numéro test.
3. Vérifiez les logs serveur :
   ```
   [POST /api/appointments] … 📧 ENVOI DES NOTIFICATIONS DE CONFIRMATION
   [SmsUp] ENVOI RÉEL → +41…
   [SmsUp] Réponse HTTP 200: {"status":1,"ticket":...}
   ```
4. Le client doit recevoir le SMS, et l’envoi apparaît dans SMSup.

## 4. Test du rappel

1. Dans `notification_settings`, positionner `reminder_offset_hours` à 1 ou 2 pour faciliter le test.
2. Créer un rendez-vous imminent.
3. Lancer l’endpoint de rappel :
   ```bash
   curl -s http://localhost:5001/api/notifications/send-reminders
   ```
4. Vérifier que le SMS de rappel est déclenché :
   - Log `[SmsUp] ENVOI RÉEL → ...`
   - Réception du SMS / trace dans SMSup.

## 5. Ce qu’il faut observer

| Étape                           | Logs attendus                                            | Résultat externe                     |
|---------------------------------|---------------------------------------------------------|--------------------------------------|
| Script en mode réel             | `[SmsUp] ENVOI RÉEL`, `status: 1`, `ticket` non nul     | SMS reçu + visible dans SMSup        |
| Script en dry-run               | `[SmsUp] [DRY RUN]` uniquement                          | Aucun SMS envoyé                     |
| Confirmation de rendez-vous     | `[POST /api/appointments] … [SmsUp] ENVOI RÉEL …`       | SMS de confirmation reçu             |
| Rappel automatique              | `[SmsUp] ENVOI RÉEL` lors de l’appel `/send-reminders`  | SMS de rappel reçu + log SMSup       |

## 6. Dépannage rapide

- `SMSUP_API_TOKEN missing` : vérifier `.env`, relancer `npm run dev`.
- `status -1` : token invalide ou expiré (régénérer dans l’onglet **Tokens API** de SMSup).
- **`status -8` (MODÉRATION EN ATTENTE)** : ⚠️ **C'est votre cas actuel !**
  - **Problème** : L'expéditeur (valeur de `SMSUP_SENDER`) n'est pas encore validé dans SMSup.
  - **Symptômes** : Le SMS est accepté par SMSup (ticket créé, crédit débité) mais **bloqué** jusqu'à validation.
  - **Solution** :
    1. Connectez-vous au **dashboard SMSup**
    2. Allez dans l'onglet **"Expéditeurs"** ou **"Senders"**
    3. **Validez/Approuvez** l'expéditeur (ex: "Witstyl")
    4. Vérifiez le ticket dans l'historique
  - **Après validation** :
    - Le SMS en attente partira automatiquement (5-15 min)
    - Les prochains SMS partiront directement avec `status: 1`
- Pas de SMS malgré `status:1` : vérifier le champ `sender`, le format du numéro (`+41...`), et la présence de crédits.
- Pour toute erreur API, consulter la réponse brute loggée (`[SmsUp] Réponse HTTP ...`) et comparer avec les codes de la [doc officielle](https://doc.smsup.ch/fr/api/sms/envoi/message-unitaire).

