# Guide : Utiliser Twilio SMS (au lieu de WhatsApp)

Ce guide explique comment configurer Twilio pour envoyer des **SMS classiques** plutôt que des messages WhatsApp.

## 🔧 Configuration

### 1. Variables d'environnement dans `.env`

```bash
# Choisir Twilio SMS comme provider
SMS_PROVIDER=twilio-sms

# Configuration Twilio (partagée avec WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# Numéro Twilio pour SMS (sans préfixe whatsapp:)
TWILIO_SMS_FROM=+14155238886  # Votre numéro Twilio

# Optionnel : Utiliser un Messaging Service SID (recommandé pour la production)
# TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Mode dry-run (pour tester sans envoyer de vrais SMS)
SMS_DRY_RUN=true  # Mettre à false pour envoyer de vrais SMS
```

### 2. Différences importantes

| Configuration | WhatsApp | SMS |
|---------------|----------|-----|
| `SMS_PROVIDER` | `twilio-whatsapp` | `twilio-sms` |
| Variable FROM | `TWILIO_WHATSAPP_FROM` | `TWILIO_SMS_FROM` |
| Format numéro | `whatsapp:+14155238886` | `+14155238886` |
| Préfixe | Oui (`whatsapp:`) | Non |

## 📋 Prérequis

### 1. Obtenir un numéro Twilio

1. Connectez-vous à la [Console Twilio](https://console.twilio.com/)
2. Allez dans **Phone Numbers** → **Manage** → **Buy a number**
3. Choisissez un numéro avec capacité **SMS**
4. Achetez le numéro (gratuit pour les comptes d'essai)

**Note :** Les comptes d'essai Twilio ont des numéros de test pré-configurés que vous pouvez utiliser.

### 2. Vérifier les capacités du numéro

1. Dans **Phone Numbers** → **Manage** → **Active numbers**
2. Cliquez sur votre numéro
3. Vérifiez que **SMS** est activé dans les capacités

## 🧪 Test en Mode Dry Run

### 1. Configuration

```bash
SMS_PROVIDER=twilio-sms
SMS_DRY_RUN=true
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_SMS_FROM=+14155238886
```

### 2. Redémarrer le serveur

```bash
npm run dev
```

### 3. Vérifier les logs

Vous devriez voir :

```
[Notifications] 📱 SMS Provider: TWILIO-SMS
[Notifications] 📱 SMS: ⚠️  DRY RUN (log uniquement)
[Notifications] 🔑 TWILIO_ACCOUNT_SID: ✅ Défini
[Notifications] 🔑 TWILIO_AUTH_TOKEN: ✅ Défini
[Notifications] 📱 TWILIO_SMS_FROM: ✅ Défini
```

### 4. Tester l'envoi

Créez un rendez-vous et vérifiez les logs :

```
[TwilioSms] [DRY RUN] Envoi SMS vers +4179XXXXXXX
[TwilioSms] [DRY RUN] Message: ...
```

## 🚀 Activation en Production

### 1. Désactiver le dry-run

```bash
SMS_DRY_RUN=false
SMS_PROVIDER=twilio-sms
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_SMS_FROM=+14155238886
```

### 2. Redémarrer le serveur

```bash
npm run dev
```

### 3. Vérifier les logs

Vous devriez voir :

```
[Notifications] 📱 SMS Provider: TWILIO-SMS
[Notifications] 📱 SMS: ✅ ENVOI RÉEL
[TwilioSms] 📱 Envoi SMS vers +4179XXXXXXX
[TwilioSms] ✅ SMS envoyé avec succès
[TwilioSms] 📋 SID: SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🔄 Comparaison : SMS vs WhatsApp

| Fonctionnalité | SMS | WhatsApp |
|----------------|-----|----------|
| **Provider** | `twilio-sms` | `twilio-whatsapp` |
| **Variable FROM** | `TWILIO_SMS_FROM` | `TWILIO_WHATSAPP_FROM` |
| **Format numéro** | `+14155238886` | `whatsapp:+14155238886` |
| **Templates requis** | Non | Oui (pour messages initiaux) |
| **Limite caractères** | 160 (SMS simple) | 4096 |
| **Rich media** | Non | Oui |
| **Coût** | [Voir tarifs](https://www.twilio.com/sms/pricing) | [Voir tarifs](https://www.twilio.com/whatsapp/pricing) |
| **Configuration Twilio** | Plus simple | Plus complexe (templates, approbation) |

## ⚠️ Points Importants

### 1. Format du numéro

- **SMS** : `+14155238886` (sans préfixe)
- **WhatsApp** : `whatsapp:+14155238886` (avec préfixe)

### 2. Pas de templates nécessaires

Contrairement à WhatsApp, les SMS **n'ont pas besoin de templates pré-approuvés**. Vous pouvez envoyer n'importe quel message texte directement.

### 3. Numéros de test (comptes d'essai)

Les comptes Twilio d'essai peuvent envoyer des SMS uniquement vers des numéros **vérifiés** dans votre compte Twilio.

Pour vérifier un numéro :
1. Console Twilio → **Phone Numbers** → **Verified Caller IDs**
2. Ajoutez le numéro de test
3. Vérifiez-le via SMS ou appel

### 4. Limites des comptes d'essai

- SMS uniquement vers numéros vérifiés
- Crédits limités
- Pour la production, passez à un compte payant

## 🆘 Dépannage

### Erreur : "21408 - Numéro non autorisé"

**Cause :** Le numéro Twilio n'est pas autorisé pour envoyer des SMS.

**Solution :**
1. Vérifiez que le numéro a la capacité SMS activée
2. Vérifiez que vous utilisez un compte payant (pas d'essai) pour la production
3. Vérifiez les crédits Twilio

### Erreur : "21211 - Numéro invalide"

**Cause :** Le format du numéro destinataire est incorrect.

**Solution :**
1. Vérifiez que le numéro est au format international : `+41791234567`
2. Vérifiez que le numéro n'a pas le préfixe `whatsapp:` (c'est pour WhatsApp, pas SMS)

### Erreur : "20003 - Authentification échouée"

**Cause :** Account SID ou Auth Token incorrect.

**Solution :**
1. Vérifiez `TWILIO_ACCOUNT_SID` et `TWILIO_AUTH_TOKEN` dans `.env`
2. Vérifiez qu'ils sont corrects dans la console Twilio
3. Redémarrez le serveur après modification

### Messages non reçus (compte d'essai)

**Cause :** Les comptes d'essai ne peuvent envoyer qu'aux numéros vérifiés.

**Solution :**
1. Vérifiez le numéro destinataire dans **Phone Numbers** → **Verified Caller IDs**
2. Ajoutez et vérifiez le numéro si nécessaire
3. Ou passez à un compte payant pour la production

## 📝 Checklist

- [ ] Installer le package Twilio : `npm install twilio` (déjà fait)
- [ ] Obtenir un numéro Twilio avec capacité SMS
- [ ] Configurer `.env` avec `SMS_PROVIDER=twilio-sms`
- [ ] Configurer `TWILIO_SMS_FROM` (sans préfixe `whatsapp:`)
- [ ] Tester en mode dry-run (`SMS_DRY_RUN=true`)
- [ ] Vérifier les logs au démarrage
- [ ] Tester l'envoi d'un SMS de test
- [ ] Vérifier le numéro destinataire (compte d'essai : doit être vérifié)
- [ ] Désactiver le dry-run (`SMS_DRY_RUN=false`)
- [ ] Tester l'envoi réel
- [ ] Vérifier la réception du SMS

## 🔄 Changer entre SMS et WhatsApp

Pour basculer entre SMS et WhatsApp, changez simplement `SMS_PROVIDER` :

```bash
# Pour SMS
SMS_PROVIDER=twilio-sms
TWILIO_SMS_FROM=+14155238886

# Pour WhatsApp
SMS_PROVIDER=twilio-whatsapp
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

**Aucune autre modification nécessaire !** Le système détecte automatiquement le provider à utiliser.

## 📚 Ressources

- [Documentation Twilio SMS](https://www.twilio.com/docs/sms)
- [Console Twilio](https://console.twilio.com/)
- [Tarification SMS](https://www.twilio.com/sms/pricing)
- [Guide de démarrage SMS](https://www.twilio.com/docs/sms/quickstart)


