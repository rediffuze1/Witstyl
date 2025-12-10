# Résolution des Erreurs Twilio SMS

Ce guide explique comment résoudre les erreurs courantes lors de l'envoi de SMS via Twilio.

## ❌ Erreur 1 : "To' and 'From' number cannot be the same"

**Code d'erreur :** `21266`

**Cause :** Vous essayez d'envoyer un SMS à votre propre numéro (le même que `TWILIO_SMS_FROM`).

**Solution :**
- Utilisez un **autre numéro de téléphone** pour le test
- Le numéro destinataire doit être différent du numéro expéditeur

**Exemple :**
```bash
# ❌ Ne fonctionne pas (même numéro)
TWILIO_SMS_FROM=+41791338240
npx tsx scripts/test-twilio-sms.ts +41791338240

# ✅ Fonctionne (numéros différents)
TWILIO_SMS_FROM=+41791338240
npx tsx scripts/test-twilio-sms.ts +41791234567  # Un autre numéro
```

## ❌ Erreur 2 : "Permission to send an SMS has not been enabled for the region"

**Code d'erreur :** `21408`

**Cause :** Votre compte Twilio n'a pas les permissions pour envoyer des SMS vers cette région/pays.

**Solutions :**

### Option 1 : Activer les permissions géographiques (Recommandé)

1. Connectez-vous à la [Console Twilio](https://console.twilio.com/)
2. Allez dans **Settings** → **General** → **Geo Permissions**
3. Activez les permissions pour les régions où vous voulez envoyer des SMS
   - Par exemple : **Europe** (pour la France +33, la Suisse +41, etc.)
4. Attendez quelques minutes pour que les changements prennent effet

### Option 2 : Utiliser un numéro d'une région autorisée

Si votre compte n'a pas encore les permissions pour certaines régions, testez avec un numéro d'une région déjà autorisée.

**Régions généralement autorisées par défaut :**
- États-Unis (+1)
- Canada (+1)
- Certains pays européens selon votre compte

### Option 3 : Vérifier les restrictions de votre compte

1. Console Twilio → **Settings** → **General**
2. Vérifiez les **Geo Permissions** et **Messaging Settings**
3. Certains comptes ont des restrictions par défaut

## 🔍 Comment vérifier les permissions géographiques

1. **Console Twilio** → **Settings** → **General**
2. Section **Geo Permissions**
3. Vérifiez les régions activées :
   - ✅ **Enabled** : Vous pouvez envoyer vers cette région
   - ❌ **Disabled** : Vous ne pouvez pas envoyer vers cette région

## 💡 Solutions de contournement pour les tests

### Solution 1 : Utiliser un numéro de test différent

Si vous testez avec votre propre numéro et que c'est le même que `TWILIO_SMS_FROM` :

1. Utilisez le numéro d'un **ami ou collègue** pour le test
2. Ou utilisez un **service de numéro de test** (ex: numéros temporaires)

### Solution 2 : Vérifier les numéros vérifiés (comptes d'essai)

Si vous utilisez un **compte Twilio d'essai** :

1. Console Twilio → **Phone Numbers** → **Verified Caller IDs**
2. Ajoutez et vérifiez le numéro destinataire
3. Les comptes d'essai ne peuvent envoyer qu'aux numéros vérifiés

### Solution 3 : Activer les permissions pour votre région

Pour envoyer vers la **France (+33)** ou la **Suisse (+41)** :

1. Console Twilio → **Settings** → **General** → **Geo Permissions**
2. Activez **Europe** ou les pays spécifiques
3. Attendez la confirmation (peut prendre quelques minutes)

## ❌ Erreur 3 : "'From' number is not a Twilio phone number" (Code 21659)

**Cause :** Le numéro dans `TWILIO_SMS_FROM` n'est **pas un numéro Twilio**. Vous utilisez probablement votre numéro personnel au lieu d'un numéro Twilio.

**Solution :** Vous devez **acheter un numéro Twilio** dans la console Twilio.

### Étapes pour obtenir un numéro Twilio :

1. **Connectez-vous à la [Console Twilio](https://console.twilio.com/)**
2. Allez dans **Phone Numbers** → **Manage** → **Buy a number**
3. **Sélectionnez un pays** (ex: Suisse, États-Unis, etc.)
4. **Choisissez les capacités** : Cochez **SMS** (et Voice si nécessaire)
5. **Achetez le numéro** (gratuit pour les comptes d'essai, payant pour les comptes production)
6. **Copiez le numéro** (format : `+14155238886`)
7. **Mettez à jour votre `.env`** :
   ```bash
   TWILIO_SMS_FROM=+14155238886  # Votre nouveau numéro Twilio
   ```

### Numéros Twilio d'essai

Si vous avez un **compte Twilio d'essai**, vous pouvez utiliser un numéro de test fourni par Twilio. Vérifiez dans :
- **Phone Numbers** → **Manage** → **Active numbers**
- Vous devriez voir un numéro Twilio déjà configuré

### Vérifier vos numéros Twilio

1. Console Twilio → **Phone Numbers** → **Manage** → **Active numbers**
2. Vous verrez tous vos numéros Twilio avec leurs capacités (SMS, Voice, etc.)
3. Utilisez l'un de ces numéros dans `TWILIO_SMS_FROM`

## 📋 Checklist de dépannage

- [ ] **Le numéro `TWILIO_SMS_FROM` est un numéro Twilio** (acheté dans la console Twilio)
- [ ] Le numéro destinataire est **différent** de `TWILIO_SMS_FROM`
- [ ] Les **permissions géographiques** sont activées pour la région du destinataire
- [ ] Le numéro est au **format international** : `+41791234567`
- [ ] Le compte Twilio est **payant** (pas d'essai) ou le numéro est **vérifié** (compte d'essai)
- [ ] Les **crédits Twilio** sont suffisants
- [ ] Le numéro Twilio (`TWILIO_SMS_FROM`) a la capacité **SMS** activée

## 🎯 Test recommandé

Pour tester rapidement :

1. **Utilisez un numéro suisse** (si vous êtes en Suisse) :
   ```bash
   npx tsx scripts/test-twilio-sms.ts +41791234567
   ```

2. **Ou activez les permissions pour la France** dans la console Twilio, puis :
   ```bash
   npx tsx scripts/test-twilio-sms.ts +33628403812
   ```

3. **Vérifiez que le numéro est différent** de `TWILIO_SMS_FROM`

## 📚 Ressources

- [Documentation Twilio Geo Permissions](https://www.twilio.com/docs/usage/best-practices/geo-permissions)
- [Console Twilio Settings](https://console.twilio.com/us1/develop/settings/general)
- [Codes d'erreur Twilio](https://www.twilio.com/docs/api/errors)

