# Guide : Tester le Webhook Resend en Local (Sans ngrok)

## 🎯 Option 1 : Route de Simulation (Recommandé pour le développement)

Pour tester sans webhook public, utilisez la route de simulation :

```bash
curl -X POST http://localhost:5001/api/dev/simulate-email-opened \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": "votre-appointment-id-ici"}'
```

Cette route :
- ✅ Marque l'email comme ouvert (`emailOpenedAt`)
- ✅ Crée un événement dans `email_events`
- ✅ Permet de tester la logique "SMS après 3h si email non ouvert"

### Exemple avec un vrai appointmentId :

1. Créer un RDV via l'interface
2. Récupérer l'ID du RDV depuis les logs ou la base de données
3. Simuler l'ouverture :

```bash
curl -X POST http://localhost:5001/api/dev/simulate-email-opened \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": "1e7ba62a-2c30-4474-918f-f7b9107672c5"}'
```

## 🎯 Option 2 : Configurer ngrok (Pour tester le vrai webhook)

Si vous voulez tester le vrai webhook Resend :

### 1. Créer un compte ngrok (gratuit)
- Aller sur https://dashboard.ngrok.com/signup
- Créer un compte gratuit

### 2. Installer l'authtoken
```bash
ngrok config add-authtoken VOTRE_AUTHTOKEN_ICI
```

### 3. Démarrer ngrok
```bash
ngrok http 5001
```

### 4. Utiliser l'URL ngrok dans Resend
- Copier l'URL HTTPS fournie par ngrok (ex: `https://abc123.ngrok.io`)
- Dans Resend Dashboard → Webhooks, mettre :
  ```
  https://abc123.ngrok.io/api/notifications/resend/webhook
  ```

⚠️ **Note** : L'URL ngrok change à chaque redémarrage (sauf avec un plan payant).

## 🎯 Option 3 : Attendre la Production

Si vous n'avez pas encore de domaine, vous pouvez :
- Tester avec la route de simulation pour le développement
- Configurer le webhook Resend une fois en production avec votre vrai domaine

## ✅ Vérification

Pour vérifier qu'un email a été marqué comme ouvert :

```sql
SELECT 
  id,
  email_sent_at,
  email_opened_at,
  sms_confirmation_sent
FROM appointments
WHERE id = 'votre-appointment-id';
```


