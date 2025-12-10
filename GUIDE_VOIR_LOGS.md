# 🔍 Guide : Voir les logs des notifications

## 📋 Où voir les logs

Les logs des notifications s'affichent dans le **terminal où vous avez lancé `npm run dev`**.

### Terminal du serveur

C'est le terminal où vous voyez :
```
> rest-express@1.0.0 dev
> NODE_ENV=development tsx server/index.ts
```

**C'est ici que vous devez regarder** pour voir les logs des emails et SMS.

---

## 🔍 Logs à rechercher

### Pour les emails

Quand vous testez un email, cherchez :

```
═══════════════════════════════════════════════════════════════
[POST /api/owner/notifications/send-test-email] ✅ Route appelée
═══════════════════════════════════════════════════════════════
```

Puis :

**En mode DRY RUN (`EMAIL_DRY_RUN=true`) :**
```
[Resend] [DRY RUN] 📧 Email qui serait envoyé
[Resend] [DRY RUN]   To: votre-email@exemple.com
[Resend] [DRY RUN]   Subject: ...
```

**En mode réel (`EMAIL_DRY_RUN=false`) :**
```
[Resend] 📧 ENVOI RÉEL D'EMAIL
[Resend] To: votre-email@exemple.com
[Resend] Subject: ...
[Resend] ✅ Email envoyé avec succès
```

### Pour les SMS

Quand vous testez un SMS, cherchez :

```
═══════════════════════════════════════════════════════════════
[POST /api/owner/notifications/send-test-sms] ✅ Route appelée
═══════════════════════════════════════════════════════════════
```

Puis :

**En mode DRY RUN (`SMS_DRY_RUN=true`) :**
```
[ClickSend] [DRY RUN] Envoi SMS vers +41791234567
[ClickSend] [DRY RUN] Message: Test SMS depuis SalonPilot
[ClickSend] [DRY RUN] Depuis: SalonPilot
```

**En mode réel (`SMS_DRY_RUN=false`) :**
```
[ClickSend] 📱 Envoi SMS vers +41791234567
[ClickSend] 📱 Depuis: SalonPilot
[ClickSend] ✅ SMS envoyé avec succès
```

---

## 🐛 Problème : Je ne vois rien dans les logs

### Vérification 1 : Le serveur est-il démarré ?

Vérifiez que vous voyez dans le terminal :
```
[SERVER] ✅ Routes disponibles: ...
```

Si non, le serveur n'est pas démarré. Lancez :
```bash
npm run dev
```

### Vérification 2 : La requête arrive-t-elle au serveur ?

Cherchez dans les logs :
```
[POST /api/owner/notifications/send-test-sms] ✅ Route appelée
```

Si vous ne voyez **pas** cette ligne :
- La requête n'arrive pas au serveur
- Vérifiez l'URL dans le navigateur (devtools → Network)
- Vérifiez que vous êtes bien connecté (session active)

### Vérification 3 : Êtes-vous dans le bon terminal ?

**Important :** Les logs s'affichent dans le terminal du serveur, **pas** dans le terminal du client.

Si vous avez deux terminaux :
- Terminal 1 : `npm run dev` (serveur) → **C'est ici que vous devez regarder**
- Terminal 2 : `npm run dev:client` (client) → Pas de logs ici

### Vérification 4 : Les logs sont-ils filtrés ?

Vérifiez que vous voyez bien tous les logs. Parfois les terminaux filtrent ou tronquent les logs.

---

## 🧪 Test rapide pour vérifier

### 1. Test SMS via l'interface

1. Allez dans **Paramètres** → **Notifications**
2. Dans la section "Envoyer un SMS de test", entrez votre numéro : `+41791234567`
3. Cliquez sur **Envoyer**
4. **Regardez immédiatement le terminal du serveur**

Vous devriez voir :
```
═══════════════════════════════════════════════════════════════
[POST /api/owner/notifications/send-test-sms] ✅ Route appelée
═══════════════════════════════════════════════════════════════
[POST /api/owner/notifications/send-test-sms] req.body: {
  "to": "+41791234567",
  "message": "Test SMS depuis SalonPilot - Vérification de la configuration"
}
[POST /api/owner/notifications/send-test-sms] 📱 Préparation de l'envoi SMS
[ClickSend] [DRY RUN] Envoi SMS vers +41791234567
...
```

### 2. Test Email via l'interface

1. Allez dans **Paramètres** → **Notifications**
2. Dans la section "Envoyer un email de test", entrez votre email
3. Cliquez sur **Envoyer**
4. **Regardez immédiatement le terminal du serveur**

Vous devriez voir :
```
═══════════════════════════════════════════════════════════════
[POST /api/owner/notifications/send-test-email] ✅ Route appelée
═══════════════════════════════════════════════════════════════
[Resend] [DRY RUN] 📧 Email qui serait envoyé
...
```

---

## 🔧 Si vous ne voyez toujours rien

### Option 1 : Vérifier la console du navigateur

Ouvrez les DevTools (F12) → **Console** et cherchez les erreurs :
- Erreur 401 → Vous n'êtes pas connecté
- Erreur 404 → La route n'existe pas
- Erreur 500 → Erreur serveur (vérifiez les logs)

### Option 2 : Vérifier l'onglet Network

Ouvrez les DevTools (F12) → **Network** :
1. Filtrez par "send-test"
2. Cliquez sur la requête
3. Vérifiez :
   - **Status** : doit être 200 (ou 401 si non connecté)
   - **Response** : doit contenir `success: true` ou une erreur

### Option 3 : Test direct via curl

Testez directement depuis le terminal (remplacez `SESSION_ID` par votre session) :

```bash
curl -X POST http://localhost:5001/api/owner/notifications/send-test-sms \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=SESSION_ID" \
  -d '{
    "to": "+41791234567",
    "message": "Test direct"
  }'
```

Vous devriez voir les logs dans le terminal du serveur.

---

## 📊 Logs complets attendus

### Test SMS (mode DRY RUN)

```
═══════════════════════════════════════════════════════════════
[POST /api/owner/notifications/send-test-sms] ✅ Route appelée
═══════════════════════════════════════════════════════════════
[POST /api/owner/notifications/send-test-sms] req.body: {
  "to": "+41791234567",
  "message": "Test SMS depuis SalonPilot"
}
[POST /api/owner/notifications/send-test-sms] 📱 Préparation de l'envoi SMS
[POST /api/owner/notifications/send-test-sms] 📱 To: +41791234567
[POST /api/owner/notifications/send-test-sms] 📱 Message: Test SMS depuis SalonPilot
[ClickSend] [DRY RUN] Envoi SMS vers +41791234567
[ClickSend] [DRY RUN] Message: Test SMS depuis SalonPilot
[ClickSend] [DRY RUN] Depuis: SalonPilot
[POST /api/owner/notifications/send-test-sms] 📊 Résultat: {
  "success": true,
  "metadata": {
    "dryRun": true,
    "to": "+41791234567",
    "from": "SalonPilot"
  }
}
[POST /api/owner/notifications/send-test-sms] ✅ SMS envoyé avec succès à +41791234567
[POST /api/owner/notifications/send-test-sms] ⚠️  Mode DRY RUN : SMS loggé mais pas envoyé
═══════════════════════════════════════════════════════════════
```

### Test Email (mode DRY RUN)

```
═══════════════════════════════════════════════════════════════
[POST /api/owner/notifications/send-test-email] ✅ Route appelée
═══════════════════════════════════════════════════════════════
[Resend] [DRY RUN] 📧 Email qui serait envoyé
[Resend] [DRY RUN]   To: votre-email@exemple.com
[Resend] [DRY RUN]   Subject: ...
[Resend] [DRY RUN]   HTML complet: ...
═══════════════════════════════════════════════════════════════
```

---

## 💡 Astuce

Pour voir **tous** les logs en temps réel, utilisez :

```bash
# Voir uniquement les logs de notifications
npm run dev | grep -E "\[Notifications\]|\[Resend\]|\[ClickSend\]|\[POST.*notifications\]"
```

Ou créez un fichier de log :

```bash
npm run dev 2>&1 | tee server.log
```

Puis regardez `server.log` pour tous les logs.

---

## ✅ Checklist de débogage

- [ ] Le serveur est démarré (`npm run dev`)
- [ ] Je regarde le **bon terminal** (celui du serveur)
- [ ] Je vois `[POST /api/owner/notifications/send-test-*] ✅ Route appelée`
- [ ] Je suis connecté en tant qu'owner
- [ ] Les variables d'environnement sont correctes
- [ ] Je vérifie la console du navigateur pour les erreurs


