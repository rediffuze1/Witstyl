# Guide de Migration : SMSup → Twilio WhatsApp

Ce guide explique comment migrer de SMSup vers Twilio WhatsApp pour les notifications SMS.

## 📋 Prérequis

1. **Compte Twilio** avec accès à WhatsApp Business API
2. **Numéro WhatsApp Business** approuvé par Twilio
3. **Account SID et Auth Token** Twilio

## 🔧 Installation

### 1. Installer le package Twilio

```bash
npm install twilio
```

### 2. Configurer les variables d'environnement

Dans votre fichier `.env`, remplacez ou ajoutez :

```bash
# Choisir le provider SMS (twilio ou smsup)
SMS_PROVIDER=twilio

# Configuration Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  # Votre numéro WhatsApp Business Twilio

# Optionnel : Utiliser un Messaging Service SID (recommandé pour la production)
# TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Mode dry-run (pour tester sans envoyer de vrais messages)
SMS_DRY_RUN=true  # Mettre à false pour envoyer de vrais messages

# Anciennes variables SMSup (peuvent être supprimées si vous n'utilisez plus SMSup)
# SMSUP_API_TOKEN=...
# SMSUP_SENDER=...
```

### 3. Format du numéro WhatsApp

Le numéro doit être au format :
- `whatsapp:+14155238886` (numéro Twilio Sandbox pour les tests)
- `whatsapp:+41791234567` (votre numéro WhatsApp Business en production)

**Important** : Le préfixe `whatsapp:` est obligatoire.

## 🧪 Test en Mode Dry Run

### 1. Activer le mode dry-run

```bash
SMS_DRY_RUN=true
SMS_PROVIDER=twilio
```

### 2. Redémarrer le serveur

```bash
npm run dev
```

### 3. Vérifier les logs

Vous devriez voir :

```
[Notifications] 📱 SMS Provider: TWILIO
[Notifications] 📱 SMS: ⚠️  DRY RUN (log uniquement)
[Notifications] 🔑 TWILIO_ACCOUNT_SID: ✅ Défini
[Notifications] 🔑 TWILIO_AUTH_TOKEN: ✅ Défini
[Notifications] 📱 TWILIO_WHATSAPP_FROM: ✅ Défini
```

### 4. Tester l'envoi

Créez un rendez-vous et vérifiez les logs :

```
[TwilioWhatsApp] [DRY RUN] Envoi WhatsApp vers whatsapp:+4179XXXXXXX
[TwilioWhatsApp] [DRY RUN] Message: ...
```

## 🚀 Activation en Production

### 1. Obtenir un numéro WhatsApp Business

1. Connectez-vous à votre [Console Twilio](https://console.twilio.com/)
2. Allez dans **Messaging** → **Try it out** → **Send a WhatsApp message**
3. Pour les tests, utilisez le **Sandbox** (numéro: `+14155238886`)
4. Pour la production, demandez un **numéro WhatsApp Business** approuvé

### 2. Configurer le numéro WhatsApp

**Option A : Utiliser un numéro direct**

```bash
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  # Sandbox (test)
# ou
TWILIO_WHATSAPP_FROM=whatsapp:+41791234567  # Production
```

**Option B : Utiliser un Messaging Service (recommandé)**

1. Créez un **Messaging Service** dans la console Twilio
2. Ajoutez votre numéro WhatsApp au service
3. Utilisez le **Messaging Service SID** :

```bash
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_WHATSAPP_FROM n'est pas nécessaire si vous utilisez Messaging Service
```

### 3. Désactiver le dry-run

```bash
SMS_DRY_RUN=false
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### 4. Redémarrer le serveur

```bash
npm run dev
```

### 5. Vérifier les logs

Vous devriez voir :

```
[Notifications] 📱 SMS Provider: TWILIO
[Notifications] 📱 SMS: ✅ ENVOI RÉEL
[TwilioWhatsApp] 📱 Envoi WhatsApp vers whatsapp:+4179XXXXXXX
[TwilioWhatsApp] ✅ WhatsApp envoyé avec succès
[TwilioWhatsApp] 📋 SID: SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🔄 Retour à SMSup (si nécessaire)

Si vous devez revenir à SMSup temporairement :

```bash
SMS_PROVIDER=smsup
SMSUP_API_TOKEN=your_token
SMSUP_SENDER=SalonPilot
```

## ⚠️ Points Importants

### 1. Numéros autorisés (Sandbox uniquement)

En mode **Sandbox**, vous devez d'abord autoriser les numéros destinataires :

1. Envoyez un message WhatsApp au numéro Sandbox : `join <code>`
2. Le code est affiché dans la console Twilio
3. Une fois autorisé, vous pouvez recevoir des messages

### 2. Format des numéros

- **Entrant** : Le système normalise automatiquement les numéros au format `whatsapp:+4179XXXXXXX`
- **Sortant** : Utilisez toujours le format `whatsapp:+...`

### 3. Limites Twilio

- **Sandbox** : Limité aux numéros autorisés
- **Production** : Nécessite un numéro WhatsApp Business approuvé
- **Coûts** : Consultez la [tarification Twilio WhatsApp](https://www.twilio.com/whatsapp/pricing)

### 4. Codes d'erreur courants

| Code | Signification | Solution |
|------|---------------|----------|
| 21211 | Numéro invalide | Vérifier le format du numéro |
| 21608 | Numéro non autorisé | Autoriser le numéro dans le Sandbox |
| 21614 | Numéro WhatsApp invalide | Vérifier que le numéro supporte WhatsApp |
| 20003 | Authentification échouée | Vérifier Account SID et Auth Token |
| 20001 | Compte suspendu | Vérifier l'état du compte Twilio |

## 📊 Comparaison SMSup vs Twilio

| Fonctionnalité | SMSup | Twilio WhatsApp |
|----------------|-------|-----------------|
| Type | SMS classique | WhatsApp Business |
| Coût | Variable | [Voir tarifs](https://www.twilio.com/whatsapp/pricing) |
| Format | SMS texte | Messages WhatsApp |
| Limite de caractères | 160 (SMS simple) | 4096 caractères |
| Rich media | Non | Oui (images, documents) |
| Statut de livraison | Basique | Avancé (read receipts) |
| Sandbox | Non | Oui (pour tests) |

## 🧪 Script de Test

Créez un fichier `scripts/test-twilio-whatsapp.ts` :

```typescript
import { TwilioWhatsAppProvider } from '../server/infrastructure/sms/TwilioWhatsAppProvider';

const provider = new TwilioWhatsAppProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  whatsappFrom: process.env.TWILIO_WHATSAPP_FROM!,
  dryRun: process.env.SMS_DRY_RUN === 'true',
});

const result = await provider.sendSms({
  to: '+4179XXXXXXX', // Votre numéro de test
  message: 'Test WhatsApp depuis SalonPilot',
});

console.log('Résultat:', result);
```

Exécutez :

```bash
SMS_DRY_RUN=true npx tsx scripts/test-twilio-whatsapp.ts
```

## 📝 Checklist de Migration

- [ ] Installer le package Twilio : `npm install twilio`
- [ ] Créer un compte Twilio et obtenir Account SID + Auth Token
- [ ] Configurer le numéro WhatsApp (Sandbox ou Business)
- [ ] Mettre à jour `.env` avec les variables Twilio
- [ ] Tester en mode dry-run (`SMS_DRY_RUN=true`)
- [ ] Vérifier les logs au démarrage
- [ ] Tester l'envoi d'un message de test
- [ ] Désactiver le dry-run (`SMS_DRY_RUN=false`)
- [ ] Tester l'envoi réel
- [ ] Vérifier la réception des messages
- [ ] Configurer un cron job pour les rappels automatiques

## 🆘 Dépannage

### Problème : "Package Twilio non installé"

```bash
npm install twilio
```

### Problème : "Numéro WhatsApp non autorisé" (Sandbox)

1. Envoyez `join <code>` au numéro Sandbox
2. Le code est dans la console Twilio
3. Attendez la confirmation

### Problème : "Authentification échouée"

1. Vérifiez `TWILIO_ACCOUNT_SID` et `TWILIO_AUTH_TOKEN`
2. Vérifiez qu'ils sont corrects dans la console Twilio
3. Redémarrez le serveur après modification

### Problème : Messages non reçus

1. Vérifiez que `SMS_DRY_RUN=false`
2. Vérifiez les logs pour les erreurs
3. Vérifiez les crédits Twilio
4. Vérifiez que le numéro destinataire supporte WhatsApp

## 📚 Ressources

- [Documentation Twilio WhatsApp](https://www.twilio.com/docs/whatsapp)
- [Console Twilio](https://console.twilio.com/)
- [Tarification WhatsApp](https://www.twilio.com/whatsapp/pricing)
- [Guide de démarrage WhatsApp](https://www.twilio.com/docs/whatsapp/quickstart)


