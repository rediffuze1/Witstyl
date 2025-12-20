# Guide : Tester Twilio SMS sur votre numéro

Ce guide explique comment tester l'envoi de SMS Twilio sur votre propre numéro de téléphone.

## 🚀 Méthode 1 : Script de test direct (Recommandé)

### 1. Vérifier votre configuration `.env`

Assurez-vous d'avoir :

```bash
SMS_PROVIDER=twilio-sms
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_SMS_FROM=+14155238886  # Votre numéro Twilio
SMS_DRY_RUN=false  # Pour envoyer un vrai SMS
```

### 2. Exécuter le script de test

```bash
npx tsx scripts/test-twilio-sms.ts +41791234567
```

Remplacez `+41791234567` par votre numéro de téléphone au format international.

**Exemple :**
```bash
npx tsx scripts/test-twilio-sms.ts +41791234567
```

### 3. Vérifier les résultats

**En mode DRY RUN (`SMS_DRY_RUN=true`) :**
```
✅ Simulation terminée. Aucune requête réseau n'a été effectuée.
💡 Pour envoyer un vrai SMS, mettez SMS_DRY_RUN=false dans votre .env
```

**En mode réel (`SMS_DRY_RUN=false`) :**
```
✅ SMS envoyé avec succès !
   Vérifiez votre téléphone dans quelques secondes
   
   Détails:
   - SID: SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   - Statut: queued
   - Vers: +41791234567
   - Depuis: +14155238886
```

### 4. Vérifier la réception

- ✅ **Vérifiez votre téléphone** : Le SMS devrait arriver dans quelques secondes
- ✅ **Vérifiez la console Twilio** : [Logs SMS](https://console.twilio.com/us1/monitor/logs/sms)

## 🧪 Méthode 2 : Via l'endpoint de test

### 1. Démarrer le serveur

```bash
npm run dev
```

### 2. Appeler l'endpoint de test

```bash
curl -X POST http://localhost:5001/api/dev/send-test-notification \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "+41791234567",
    "customerName": "Votre Nom",
    "customerEmail": "votre@email.com",
    "salonName": "Salon Test",
    "serviceName": "Coupe",
    "stylistName": "Marie"
  }'
```

Remplacez `+41791234567` par votre numéro.

### 3. Vérifier les logs serveur

Vous devriez voir :

```
[TwilioSms] 📱 Envoi SMS vers +41791234567
[TwilioSms] ✅ SMS envoyé avec succès
[TwilioSms] 📋 SID: SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🧪 Méthode 3 : Créer un rendez-vous de test

### 1. Créer un rendez-vous via l'interface

1. Connectez-vous à l'application
2. Créez un rendez-vous avec votre numéro de téléphone
3. Le SMS de confirmation sera envoyé automatiquement

### 2. Vérifier les logs

Les logs serveur afficheront l'envoi du SMS de confirmation.

## ✅ Checklist de test

- [ ] `.env` configuré avec `SMS_PROVIDER=twilio-sms`
- [ ] `TWILIO_ACCOUNT_SID` et `TWILIO_AUTH_TOKEN` définis
- [ ] `TWILIO_SMS_FROM` configuré avec votre numéro Twilio
- [ ] `SMS_DRY_RUN=false` pour envoyer de vrais SMS
- [ ] Serveur redémarré après modification du `.env`
- [ ] Script de test exécuté avec votre numéro
- [ ] SMS reçu sur votre téléphone
- [ ] SMS visible dans la console Twilio

## 🆘 Dépannage

### Problème : "Numéro invalide"

**Vérifications :**
1. Le numéro est au format international : `+41791234567`
2. Le numéro n'a pas le préfixe `whatsapp:` (c'est pour WhatsApp, pas SMS)
3. Le numéro commence bien par `+`

### Problème : "21408 - Numéro non autorisé"

**Cause :** Le numéro Twilio n'est pas autorisé pour envoyer des SMS.

**Solution :**
1. Vérifiez dans la console Twilio → **Phone Numbers** → votre numéro
2. Vérifiez que **SMS** est activé dans les capacités
3. Vérifiez que vous utilisez un compte payant (pas d'essai)

### Problème : SMS non reçu

**Vérifications :**
1. ✅ `SMS_DRY_RUN=false` dans `.env`
2. ✅ Serveur redémarré après modification
3. ✅ Vérifiez les logs pour les erreurs
4. ✅ Vérifiez les crédits Twilio (Console → Billing)
5. ✅ Vérifiez le statut du message dans la console Twilio
6. ✅ Vérifiez que votre téléphone peut recevoir des SMS internationaux

### Problème : "20003 - Authentification échouée"

**Solution :**
1. Vérifiez `TWILIO_ACCOUNT_SID` et `TWILIO_AUTH_TOKEN` dans `.env`
2. Vérifiez qu'ils sont corrects dans la console Twilio
3. Redémarrez le serveur après modification

## 📊 Vérifier dans la console Twilio

1. Connectez-vous à [Console Twilio](https://console.twilio.com/)
2. Allez dans **Monitor** → **Logs** → **SMS**
3. Vous verrez tous les SMS envoyés avec :
   - Statut (queued, sent, delivered, failed)
   - Numéro destinataire
   - Message
   - Coût

## 💡 Astuce : Tester en mode dry-run d'abord

Avant d'envoyer de vrais SMS, testez en mode dry-run :

```bash
# Dans .env
SMS_DRY_RUN=true

# Exécuter le script
npx tsx scripts/test-twilio-sms.ts +41791234567
```

Cela vous permettra de vérifier la configuration sans consommer de crédits.

## 🎯 Résumé rapide

```bash
# 1. Configurer .env
SMS_PROVIDER=twilio-sms
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_SMS_FROM=+14155238886
SMS_DRY_RUN=false

# 2. Redémarrer le serveur
npm run dev

# 3. Tester
npx tsx scripts/test-twilio-sms.ts +41791234567

# 4. Vérifier votre téléphone !
```




