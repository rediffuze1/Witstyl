# Guide : Intégration ClickSend SMS

Ce guide explique comment configurer et utiliser ClickSend comme provider SMS dans Witstyl.

## 📝 Configuration

### 1. Créer un compte ClickSend

1. Créez un compte sur [ClickSend](https://www.clicksend.com/)
2. Obtenez votre **Username** et **API Key** depuis le dashboard
3. Configurez un **Sender ID** (nom alphanumérique) ou un numéro de téléphone

### 2. Variables d'environnement

Ajoutez ces variables dans votre fichier `.env` :

```bash
# Provider SMS
SMS_PROVIDER=clicksend

# Credentials ClickSend
CLICKSEND_USERNAME=your-username
CLICKSEND_API_KEY=your-api-key

# Sender ID alphanumérique ou numéro (ex: "Witstyl" ou "+41791234567")
CLICKSEND_SMS_FROM=Witstyl

# Mode dry-run (true pour tester sans envoyer réellement)
SMS_DRY_RUN=false
```

### 3. Format du Sender ID

Le `CLICKSEND_SMS_FROM` peut être :
- **Sender ID alphanumérique** : `Witstyl` (max 11 caractères, lettres et chiffres)
- **Numéro de téléphone** : `+41791234567` (format E.164)

**Note** : Les Sender ID alphanumériques peuvent ne pas être disponibles dans tous les pays. Vérifiez la documentation ClickSend pour votre région.

## 🧪 Test

### 1. Route API de test

Une route API est disponible pour tester l'envoi de SMS :

```bash
POST /api/owner/notifications/send-test-sms
```

**Headers :**
```
Content-Type: application/json
```

**Body :**
```json
{
  "to": "+41791234567",
  "message": "Message de test depuis Witstyl"
}
```

**Réponse (succès) :**
```json
{
  "success": true,
  "to": "+41791234567",
  "message": "Message de test depuis Witstyl",
  "metadata": {
    "messageId": "...",
    "status": "...",
    "to": "+41791234567",
    "from": "Witstyl"
  }
}
```

**Réponse (erreur) :**
```json
{
  "success": false,
  "error": "Message d'erreur",
  "details": "...",
  "to": "+41791234567",
  "metadata": {...}
}
```

### 2. Test avec curl

```bash
curl -X POST http://localhost:5001/api/owner/notifications/send-test-sms \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your-session-cookie" \
  -d '{
    "to": "+41791234567",
    "message": "Test SMS ClickSend depuis Witstyl"
  }'
```

**Note** : Vous devez être authentifié en tant qu'owner pour utiliser cette route.

### 3. Test avec fetch (JavaScript)

```javascript
const response = await fetch('/api/owner/notifications/send-test-sms', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Pour inclure les cookies de session
  body: JSON.stringify({
    to: '+41791234567',
    message: 'Test SMS ClickSend depuis Witstyl',
  }),
});

const result = await response.json();
console.log(result);
```

## 🔧 Utilisation dans le code

Le provider ClickSend est automatiquement utilisé si `SMS_PROVIDER=clicksend` est configuré.

### Utilisation via NotificationService

```typescript
import { notificationService } from './core/notifications/index.js';

// Envoyer un SMS directement
const result = await notificationService.sendSms({
  to: '+41791234567',
  message: 'Votre message ici',
});

if (result.success) {
  console.log('SMS envoyé avec succès:', result.metadata);
} else {
  console.error('Erreur:', result.error);
}
```

### Utilisation dans les notifications automatiques

Les notifications automatiques (confirmation, rappel, annulation) utilisent automatiquement le provider configuré. Aucune modification de code n'est nécessaire.

## 📊 Mode Dry Run

Pour tester sans envoyer réellement de SMS :

```bash
SMS_DRY_RUN=true
```

En mode dry-run :
- Les SMS sont loggés dans la console
- Aucun SMS n'est réellement envoyé
- Aucune clé API n'est requise

## 🆘 Dépannage

### Erreur : "CLICKSEND_USERNAME et CLICKSEND_API_KEY sont requis"

**Solution** : Vérifiez que les variables d'environnement sont correctement définies dans votre `.env`.

### Erreur : "CLICKSEND_SMS_FROM est requis"

**Solution** : Définissez `CLICKSEND_SMS_FROM` avec un Sender ID ou un numéro valide.

### Erreur : "Erreur HTTP 401" ou "Unauthorized"

**Solution** : Vérifiez que votre `CLICKSEND_USERNAME` et `CLICKSEND_API_KEY` sont corrects dans le dashboard ClickSend.

### Erreur : "Sender ID not available"

**Solution** : Le Sender ID alphanumérique n'est peut-être pas disponible pour votre pays. Utilisez un numéro de téléphone à la place.

## 📚 Ressources

- [Documentation ClickSend API](https://developers.clicksend.com/docs/rest/v3/)
- [Dashboard ClickSend](https://dashboard.clicksend.com/)
- [Support ClickSend](https://www.clicksend.com/support)

## 🔄 Migration depuis un autre provider

Pour migrer depuis SMSup, Twilio, etc. :

1. Configurez les variables ClickSend dans `.env`
2. Changez `SMS_PROVIDER=clicksend`
3. Redémarrez le serveur
4. Testez avec la route `/api/owner/notifications/send-test-sms`

Aucune modification de code n'est nécessaire, le système utilise automatiquement le provider configuré.



