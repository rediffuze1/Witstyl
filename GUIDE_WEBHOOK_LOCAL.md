# 🔧 Guide : Tester le webhook Resend en local (sans domaine)

## 🎯 Problème

Vous n'avez pas encore de domaine, donc le webhook Resend ne peut pas atteindre votre serveur local (`localhost:5001`).

## ✅ Solution : Utiliser ngrok (gratuit)

### 1. Installer ngrok

```bash
# macOS
brew install ngrok

# Ou téléchargez depuis https://ngrok.com/download
```

### 2. Créer un compte ngrok (gratuit)

1. Allez sur https://ngrok.com
2. Créez un compte gratuit
3. Récupérez votre token d'authentification

### 3. Configurer ngrok

```bash
# Authentifier ngrok avec votre token
ngrok config add-authtoken YOUR_NGROK_TOKEN
```

### 4. Exposer votre serveur local

Dans un **nouveau terminal**, lancez :

```bash
# Exposer le port 5001 (votre serveur Express)
ngrok http 5001
```

Vous obtiendrez une URL comme :
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:5001
```

### 5. Configurer le webhook Resend

1. Allez dans [Resend Dashboard](https://resend.com/webhooks)
2. Créez/modifiez le webhook avec :
   - **URL** : `https://abc123.ngrok-free.app/api/notifications/resend/webhook`
   - **Événements** : `email.delivered`, `email.opened`

### 6. Tester

1. Créez un RDV via l'interface
2. Ouvrez l'email de confirmation
3. Vérifiez les logs du serveur :
   ```
   [ResendWebhook] 📨 Webhook reçu
   [ResendWebhook] ✅ Événement "opened" enregistré
   ```

## 🔄 Alternative : Tester sans webhook (pour le développement)

Si vous voulez tester le système sans webhook pour l'instant, vous pouvez simuler manuellement l'ouverture d'email :

### Option 1 : Via SQL direct

```sql
-- Simuler l'ouverture d'un email pour un appointment
UPDATE appointments
SET email_opened_at = NOW()
WHERE id = 'votre-appointment-id';
```

### Option 2 : Via l'API (à créer si besoin)

Vous pouvez créer une route de test pour simuler l'ouverture :

```bash
# Simuler l'ouverture d'email
curl -X POST http://localhost:5001/api/dev/simulate-email-opened \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": "votre-appointment-id"}'
```

## 📝 Note importante

**ngrok gratuit :**
- ✅ URL change à chaque redémarrage (mais vous pouvez utiliser un compte payant pour une URL fixe)
- ✅ Parfait pour le développement et les tests
- ✅ Gratuit jusqu'à 40 connexions/minutes

**Pour la production :**
- Vous devrez configurer le webhook avec votre vrai domaine
- L'URL sera : `https://votre-domaine.com/api/notifications/resend/webhook`

## 🧪 Test complet

1. **Démarrer le serveur** :
   ```bash
   npm run dev
   ```

2. **Démarrer ngrok** (dans un autre terminal) :
   ```bash
   ngrok http 5001
   ```

3. **Configurer le webhook Resend** avec l'URL ngrok

4. **Créer un RDV** via l'interface

5. **Vérifier les logs** :
   - Email envoyé → `email_sent_at` mis à jour
   - Email ouvert → Webhook reçu → `email_opened_at` mis à jour

6. **Attendre 12h** (ou modifier la date en base pour tester) :
   - Si email non ouvert → SMS envoyé automatiquement



