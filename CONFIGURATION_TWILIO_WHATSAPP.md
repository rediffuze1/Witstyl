# Configuration Twilio WhatsApp - Étapes Côté Twilio

Si vous avez déjà :
- ✅ Transféré votre compte WhatsApp perso en Business
- ✅ Configuré `.env` avec `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- ✅ Mis `SMS_DRY_RUN=false`

**Il reste ces étapes importantes côté Twilio :**

## 🔴 ÉTAPES OBLIGATOIRES

### 1. Enregistrer votre numéro WhatsApp dans Twilio

Votre numéro WhatsApp Business doit être **enregistré et approuvé** dans Twilio.

**Étapes :**

1. Connectez-vous à la [Console Twilio](https://console.twilio.com/)
2. Allez dans **Messaging** → **Try it out** → **Send a WhatsApp message**
3. Ou directement : **Messaging** → **Senders** → **WhatsApp Senders**
4. Cliquez sur **"Add new WhatsApp Sender"** ou **"Register WhatsApp Number"**
5. Entrez votre numéro WhatsApp Business (format : `+41791234567`)
6. Suivez le processus d'approbation

**⚠️ Important :**
- Le numéro doit être le même que celui dans `TWILIO_WHATSAPP_FROM` (sans le préfixe `whatsapp:`)
- Le processus d'approbation peut prendre quelques heures à quelques jours
- Vous recevrez un email de confirmation une fois approuvé

### 2. Créer et approuver des templates de messages

**WhatsApp exige que les messages initiaux** (premiers messages à un nouveau contact) soient basés sur des **templates pré-approuvés**.

**Étapes :**

1. Dans la console Twilio, allez dans **Messaging** → **Content Templates** → **WhatsApp Templates**
2. Cliquez sur **"Create Template"**
3. Créez un template pour les **confirmations de rendez-vous** :
   - **Nom** : `appointment_confirmation`
   - **Catégorie** : `UTILITY` (pour les notifications transactionnelles)
   - **Langue** : `fr` (ou votre langue)
   - **Corps du message** : 
     ```
     Bonjour {{1}},

     Votre rendez-vous est confirmé :
     📅 Date : {{2}}
     ⏰ Heure : {{3}}
     💇 Service : {{4}}
     👤 Coiffeur : {{5}}

     À bientôt !
     ```
   - **Variables** : `{{1}}` = nom client, `{{2}}` = date, etc.

4. Créez un template pour les **rappels** :
   - **Nom** : `appointment_reminder`
   - **Catégorie** : `UTILITY`
   - **Corps du message** :
     ```
     Rappel : Votre rendez-vous {{1}} à {{2}} avec {{3}} est confirmé.

     À bientôt !
     ```

5. **Soumettez les templates pour approbation**
   - Le processus peut prendre **quelques minutes à 48 heures**
   - Vous recevrez un email une fois approuvés

**⚠️ Important :**
- Les templates doivent être approuvés **avant** d'envoyer des messages
- Pour les messages de suivi (réponses à un message reçu), les templates ne sont pas nécessaires

### 3. Vérifier votre entreprise auprès de Meta (si nécessaire)

Si vous utilisez un compte WhatsApp Business vérifié, vous devrez peut-être :

1. Accéder à votre [Meta Business Manager](https://business.facebook.com/)
2. Aller dans **Paramètres** → **Centre de sécurité**
3. Compléter la vérification de votre entreprise
4. Lier votre compte WhatsApp Business à Meta Business Manager

**Note :** Cette étape peut ne pas être nécessaire si vous utilisez le Sandbox Twilio pour les tests.

## 🟡 ÉTAPES OPTIONNELLES (mais recommandées)

### 4. Configurer un Messaging Service (recommandé pour la production)

Un **Messaging Service** permet de gérer plusieurs numéros et d'avoir une meilleure gestion des erreurs.

**Étapes :**

1. Dans la console Twilio, allez dans **Messaging** → **Services** → **Create Messaging Service**
2. Donnez un nom (ex: "SalonPilot WhatsApp")
3. Ajoutez votre numéro WhatsApp au service
4. Copiez le **Messaging Service SID** (commence par `MG...`)
5. Dans votre `.env`, ajoutez :
   ```bash
   TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. Vous pouvez alors retirer `TWILIO_WHATSAPP_FROM` (le Messaging Service a la priorité)

### 5. Configurer les webhooks (pour recevoir des messages)

Si vous voulez recevoir des réponses des clients :

1. Dans la console Twilio, allez dans **Messaging** → **Settings** → **WhatsApp Sandbox Settings**
2. Configurez l'**Inbound Message URL** : `https://votre-domaine.com/api/webhooks/twilio`
3. Configurez l'**Status Callback URL** (optionnel) : pour suivre le statut des messages

**Note :** Cette étape n'est pas nécessaire si vous envoyez uniquement des notifications (pas de réponses).

## ✅ Vérification Finale

### Checklist avant de tester :

- [ ] Numéro WhatsApp enregistré dans Twilio
- [ ] Numéro approuvé par Twilio (statut "Approved" dans la console)
- [ ] Templates de messages créés et approuvés
- [ ] `.env` configuré avec les bonnes variables
- [ ] `SMS_DRY_RUN=false`
- [ ] Serveur redémarré

### Test d'envoi

1. **Vérifiez les logs au démarrage** :
   ```
   [Notifications] 📱 SMS Provider: TWILIO
   [Notifications] 📱 SMS: ✅ ENVOI RÉEL
   [Notifications] 🔑 TWILIO_ACCOUNT_SID: ✅ Défini
   [Notifications] 🔑 TWILIO_AUTH_TOKEN: ✅ Défini
   [Notifications] 📱 TWILIO_WHATSAPP_FROM: ✅ Défini
   ```

2. **Créez un rendez-vous de test** et vérifiez les logs :
   ```
   [TwilioWhatsApp] 📱 Envoi WhatsApp vers whatsapp:+4179XXXXXXX
   [TwilioWhatsApp] ✅ WhatsApp envoyé avec succès
   [TwilioWhatsApp] 📋 SID: SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **Vérifiez la réception** du message sur le téléphone destinataire

## 🆘 Problèmes Courants

### Erreur : "21608 - Numéro WhatsApp non autorisé"

**Cause :** Le numéro n'est pas enregistré dans Twilio ou n'est pas approuvé.

**Solution :**
1. Vérifiez que le numéro est bien enregistré dans **Messaging** → **Senders** → **WhatsApp Senders**
2. Attendez l'approbation (peut prendre quelques heures)
3. Vérifiez que le numéro dans `.env` correspond exactement au numéro enregistré

### Erreur : "21614 - Numéro WhatsApp invalide"

**Cause :** Le format du numéro est incorrect ou le numéro ne supporte pas WhatsApp Business.

**Solution :**
1. Vérifiez le format : `whatsapp:+41791234567` (avec le préfixe `whatsapp:`)
2. Vérifiez que le numéro est bien un compte WhatsApp Business
3. Vérifiez que le numéro est actif et peut recevoir des messages

### Erreur : "Template non trouvé" ou "Template non approuvé"

**Cause :** Vous essayez d'envoyer un message initial sans template approuvé.

**Solution :**
1. Créez un template dans **Messaging** → **Content Templates**
2. Attendez l'approbation (peut prendre jusqu'à 48h)
3. Utilisez le nom du template dans votre code (si vous modifiez le provider pour utiliser des templates)

**Note :** Pour l'instant, notre provider envoie des messages texte simples. Si vous avez besoin d'utiliser des templates, il faudra modifier le code pour utiliser l'API de templates Twilio.

### Messages non reçus malgré le succès

**Vérifications :**
1. Vérifiez les crédits Twilio (Console → Billing)
2. Vérifiez que le numéro destinataire supporte WhatsApp
3. Vérifiez les logs pour les erreurs détaillées
4. Vérifiez dans la console Twilio → Logs → Messages pour voir le statut

## 📚 Ressources

- [Documentation Twilio WhatsApp](https://www.twilio.com/docs/whatsapp)
- [Console Twilio](https://console.twilio.com/)
- [Guide d'approbation des templates](https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates)


