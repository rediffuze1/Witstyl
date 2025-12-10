# Guide : Utiliser un Sender ID Alphanumérique (Nom) avec Twilio

Ce guide explique comment utiliser un nom (ex: "SalonPilot") au lieu d'un numéro de téléphone comme expéditeur SMS avec Twilio.

## 📝 Qu'est-ce qu'un Sender ID Alphanumérique ?

Un **Sender ID alphanumérique** permet d'envoyer des SMS avec un nom personnalisé (ex: "SalonPilot") au lieu d'un numéro de téléphone. Cela renforce la reconnaissance de votre marque.

**Exemple :**
- ❌ Avec numéro : `+14155238886`
- ✅ Avec Sender ID : `SalonPilot`

## ⚠️ Limitations Importantes

### 1. Disponibilité par pays

Les Sender ID alphanumériques **ne sont pas disponibles dans tous les pays**. 

**Pays supportés :**
- ✅ États-Unis (limité)
- ✅ Canada (limité)
- ✅ Certains pays européens (selon les opérateurs)
- ❌ **Pas disponible en Suisse** pour la plupart des opérateurs
- ❌ **Pas disponible en France** pour la plupart des opérateurs

**Vérifier la disponibilité :**
- [Liste des pays supportés par Twilio](https://www.twilio.com/docs/sms/services/alphanumeric-sender-id#supported-countries)

### 2. Pas de réponses possibles

- Les destinataires **ne peuvent pas répondre** directement aux SMS envoyés avec un Sender ID alphanumérique
- Si vous avez besoin de recevoir des réponses, incluez un numéro de contact dans le message

### 3. Enregistrement requis

- Certains pays exigent l'**enregistrement préalable** du Sender ID
- Le processus peut prendre plusieurs jours à plusieurs semaines
- Des frais peuvent s'appliquer

## 🔧 Configuration

### 1. Vérifier la disponibilité pour votre pays

Avant de configurer, vérifiez si les Sender ID sont supportés dans les pays où vous envoyez :

1. [Documentation Twilio - Sender ID](https://www.twilio.com/docs/sms/services/alphanumeric-sender-id)
2. Vérifiez la liste des pays supportés

### 2. Configurer dans `.env`

```bash
# Utiliser un Sender ID alphanumérique (nom)
TWILIO_SMS_FROM=SalonPilot

# OU utiliser un numéro Twilio (si Sender ID non disponible)
# TWILIO_SMS_FROM=+14155238886
```

**Règles pour le Sender ID :**
- Maximum **11 caractères**
- Lettres et chiffres uniquement (pas de caractères spéciaux)
- Doit contenir **au moins une lettre**
- Exemples valides : `SalonPilot`, `SalonPilot1`, `SALON123`

### 3. Enregistrer le Sender ID (si requis)

Pour certains pays, vous devez enregistrer le Sender ID :

1. Console Twilio → **Messaging** → **Settings** → **Sender IDs**
2. Cliquez sur **"Register Sender ID"**
3. Entrez votre Sender ID (ex: "SalonPilot")
4. Sélectionnez le pays
5. Suivez le processus d'enregistrement
6. Attendez l'approbation (peut prendre plusieurs jours)

## 🧪 Test

### 1. Configuration

```bash
TWILIO_SMS_FROM=SalonPilot
SMS_DRY_RUN=false
```

### 2. Tester l'envoi

```bash
npx tsx scripts/test-twilio-sms.ts +41791234567
```

### 3. Vérifier la réception

Le SMS devrait arriver avec "SalonPilot" comme expéditeur au lieu d'un numéro.

## 🆘 Erreurs Courantes

### Erreur : "21620 - Alphanumeric Sender ID not available"

**Cause :** Le Sender ID alphanumérique n'est pas disponible pour le pays du destinataire.

**Solutions :**
1. Utilisez un **numéro Twilio** à la place
2. Vérifiez les pays supportés
3. Envisagez d'utiliser un **Messaging Service** avec un numéro Twilio

### Erreur : "Sender ID not registered"

**Cause :** Le Sender ID n'est pas enregistré pour le pays cible.

**Solution :**
1. Enregistrez le Sender ID dans la console Twilio
2. Attendez l'approbation
3. Ou utilisez un numéro Twilio en attendant

## 💡 Recommandation

### Pour la Suisse et la France

Les Sender ID alphanumériques **ne sont généralement pas supportés** en Suisse et en France. 

**Recommandation :**
- Utilisez un **numéro Twilio** (`TWILIO_SMS_FROM=+14155238886`)
- Ou utilisez un **Messaging Service** avec un numéro Twilio

### Alternative : Messaging Service

Un **Messaging Service** permet de :
- Gérer plusieurs numéros
- Avoir une meilleure gestion des erreurs
- Utiliser un numéro Twilio avec une meilleure délivrabilité

**Configuration :**
```bash
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_SMS_FROM n'est pas nécessaire si vous utilisez Messaging Service
```

## 📊 Comparaison : Sender ID vs Numéro

| Fonctionnalité | Sender ID Alphanumérique | Numéro Twilio |
|----------------|-------------------------|---------------|
| **Format** | `SalonPilot` | `+14155238886` |
| **Disponibilité** | Limité par pays | Tous les pays |
| **Reconnaissance marque** | ✅ Excellente | ⚠️ Moins visible |
| **Réponses possibles** | ❌ Non | ✅ Oui |
| **Enregistrement requis** | Souvent oui | Non (achat direct) |
| **Suisse/France** | ❌ Généralement non | ✅ Oui |

## 🔄 Basculer entre Sender ID et Numéro

Pour basculer, changez simplement `TWILIO_SMS_FROM` :

```bash
# Sender ID alphanumérique
TWILIO_SMS_FROM=SalonPilot

# Numéro Twilio
TWILIO_SMS_FROM=+14155238886
```

Le système détecte automatiquement le type (nom ou numéro) et l'utilise correctement.

## 📚 Ressources

- [Documentation Twilio Sender ID](https://www.twilio.com/docs/sms/services/alphanumeric-sender-id)
- [Pays supportés](https://www.twilio.com/docs/sms/services/alphanumeric-sender-id#supported-countries)
- [Console Twilio](https://console.twilio.com/)


