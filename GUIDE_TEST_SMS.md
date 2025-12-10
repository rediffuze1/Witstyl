# 🧪 Guide : Tester l'envoi de SMS

## 🎯 Méthodes de test

Il existe plusieurs façons de tester l'envoi de SMS selon votre besoin.

---

## 1️⃣ Test direct d'envoi SMS (le plus simple)

### Via l'API de test

Cette route permet d'envoyer un SMS de test directement à un numéro.

**Route :** `POST /api/owner/notifications/send-test-sms`

**Prérequis :**
- Être connecté en tant qu'owner (session active)
- Avoir configuré ClickSend dans votre `.env`

**Exemple avec curl :**

```bash
curl -X POST http://localhost:5001/api/owner/notifications/send-test-sms \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=VOTRE_SESSION_ID" \
  -d '{
    "to": "+41791234567",
    "message": "Test SMS depuis Witstyl - ClickSend"
  }'
```

**Réponse attendue :**

```json
{
  "success": true,
  "message": "SMS de test envoyé avec succès",
  "to": "+41791234567",
  "metadata": {
    "dryRun": true,
    "to": "+41791234567",
    "from": "Witstyl"
  }
}
```

**Note :** Si `SMS_DRY_RUN=true`, le SMS sera loggé mais pas envoyé. Vous verrez dans les logs :
```
[ClickSendSms] [DRY RUN] Envoi SMS vers +41791234567
[ClickSendSms] [DRY RUN] Message: Test SMS depuis Witstyl - ClickSend
```

---

## 2️⃣ Test via l'interface (si disponible)

Si vous avez une interface de test dans le dashboard, utilisez-la pour tester facilement.

---

## 3️⃣ Test via un script Node.js

Créez un fichier `test-sms.js` :

```javascript
import 'dotenv/config';
import { notificationService } from './server/core/notifications/index.js';

async function testSms() {
  const result = await notificationService.sendSms({
    to: '+41791234567',
    message: 'Test SMS depuis Witstyl - ClickSend'
  });

  console.log('Résultat:', result);
}

testSms().catch(console.error);
```

Exécutez :
```bash
tsx test-sms.js
```

---

## 4️⃣ Test via un RDV réel (Option B)

Pour tester le système complet (Option B : SMS si email non ouvert) :

### Étape 1 : Créer un RDV

Créez un RDV via l'interface avec un numéro de téléphone valide.

### Étape 2 : Vérifier que l'email est envoyé

Dans les logs, vous devriez voir :
```
[EmailService] ✅ Email de confirmation envoyé
[NotificationService] ✅ Événement email "sent" enregistré
```

### Étape 3 : Simuler que l'email n'est pas ouvert

**Option A : Attendre 12h** (pas pratique pour tester)

**Option B : Modifier la date en base** (pour tester rapidement) :

```sql
-- Mettre email_sent_at à il y a 13 heures
UPDATE appointments
SET email_sent_at = NOW() - INTERVAL '13 hours'
WHERE id = 'votre-appointment-id';
```

### Étape 4 : Exécuter le cron job manuellement

```bash
tsx server/cron/check-email-opened-and-send-sms.ts
```

**Résultat attendu :**
- Si email non ouvert après 12h → SMS envoyé (ou loggé si `SMS_DRY_RUN=true`)
- Si email ouvert → Pas de SMS

---

## 5️⃣ Test via l'API de test des notifications intelligentes

### Test SMS de confirmation (Option B)

**Route :** `POST /api/owner/notifications/test-confirmation-sms`

```bash
curl -X POST http://localhost:5001/api/owner/notifications/test-confirmation-sms \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=VOTRE_SESSION_ID" \
  -d '{
    "appointmentId": "uuid-du-rdv"
  }'
```

Cette route vérifie toutes les conditions (email envoyé, non ouvert, 12h écoulées) et envoie le SMS si nécessaire.

### Test SMS de rappel (Option C)

**Route :** `POST /api/owner/notifications/test-reminder-sms`

```bash
curl -X POST http://localhost:5001/api/owner/notifications/test-reminder-sms \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=VOTRE_SESSION_ID" \
  -d '{
    "appointmentId": "uuid-du-rdv"
  }'
```

Cette route vérifie les conditions (RDV dans 24-36h, fenêtre horaire) et envoie le SMS si nécessaire.

---

## 🔍 Vérifier les logs

Après chaque test, vérifiez les logs du serveur :

### En mode DRY RUN (`SMS_DRY_RUN=true`) :

```
[ClickSendSms] [DRY RUN] Envoi SMS vers +41791234567
[ClickSendSms] [DRY RUN] Message: Votre message ici
[ClickSendSms] [DRY RUN] Depuis: Witstyl
```

### En mode réel (`SMS_DRY_RUN=false`) :

```
[ClickSendSms] 📱 Envoi SMS vers +41791234567
[ClickSendSms] 📱 Depuis: Witstyl
[ClickSendSms] ✅ SMS envoyé avec succès
[ClickSendSms] 📋 Réponse ClickSend: {...}
```

---

## ⚠️ Important : Mode DRY RUN

Par défaut, `SMS_DRY_RUN=true`, donc les SMS sont **loggés mais pas envoyés**.

Pour envoyer de **vrais SMS**, modifiez votre `.env` :

```bash
SMS_DRY_RUN=false
```

Puis redémarrez le serveur.

---

## 🧪 Script de test rapide

Créez `scripts/test-sms-quick.ts` :

```typescript
#!/usr/bin/env tsx

import 'dotenv/config';
import { notificationService } from '../server/core/notifications/index.js';

const testPhone = process.argv[2] || '+41791234567';
const testMessage = process.argv[3] || 'Test SMS depuis Witstyl';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 Test d\'envoi SMS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📱 Numéro: ${testPhone}`);
  console.log(`💬 Message: ${testMessage}`);
  console.log('');

  const result = await notificationService.sendSms({
    to: testPhone,
    message: testMessage,
  });

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 Résultat:');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(JSON.stringify(result, null, 2));
  console.log('');

  if (result.success) {
    console.log('✅ Test réussi !');
    if (result.metadata?.dryRun) {
      console.log('⚠️  Mode DRY RUN : SMS loggé mais pas envoyé');
      console.log('   Pour envoyer de vrais SMS, mettez SMS_DRY_RUN=false dans .env');
    } else {
      console.log('📱 SMS réellement envoyé !');
    }
  } else {
    console.log('❌ Test échoué :', result.error);
  }
  console.log('');
}

main().catch(console.error);
```

**Usage :**

```bash
# Test avec numéro et message par défaut
tsx scripts/test-sms-quick.ts

# Test avec votre numéro
tsx scripts/test-sms-quick.ts +41791234567 "Mon message de test"

# Test avec votre numéro et message personnalisé
tsx scripts/test-sms-quick.ts +41791234567 "Test depuis Witstyl"
```

---

## 📋 Checklist de test

- [ ] Vérifier que `SMS_PROVIDER=clicksend` dans `.env`
- [ ] Vérifier que `CLICKSEND_USERNAME` et `CLICKSEND_API_KEY` sont définis
- [ ] Vérifier que `CLICKSEND_SMS_FROM` est défini
- [ ] Décider : `SMS_DRY_RUN=true` (test) ou `false` (réel)
- [ ] Redémarrer le serveur : `npm run dev`
- [ ] Vérifier les logs au démarrage (doit afficher ClickSend)
- [ ] Tester avec l'API ou le script

---

## 🆘 Dépannage

### "SMS non envoyé" en mode DRY RUN

C'est normal ! Vérifiez les logs, vous devriez voir `[DRY RUN]`. Pour envoyer de vrais SMS, mettez `SMS_DRY_RUN=false`.

### "CLICKSEND_USERNAME ou CLICKSEND_API_KEY non configuré"

Vérifiez que les variables sont bien dans votre `.env` et redémarrez le serveur.

### "Erreur lors de l'envoi"

Vérifiez :
1. Les credentials ClickSend sont corrects
2. Le numéro est au format E.164 (+41791234567)
3. Le Sender ID est valide (max 11 caractères pour alphanumérique)

---

## 💡 Astuce

Pour tester rapidement sans créer de RDV, utilisez la route `/api/owner/notifications/send-test-sms` qui est la plus simple et directe.


