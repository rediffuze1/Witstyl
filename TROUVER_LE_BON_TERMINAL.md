# 🔍 Comment Trouver le Bon Terminal pour Voir les Logs de Notifications

## ⚠️ IMPORTANT

Les logs de notifications apparaissent **UNIQUEMENT** dans le terminal où vous avez lancé `npm run dev`, **PAS** dans la console du navigateur (F12).

---

## 📍 Étape 1 : Identifier le Terminal du Serveur

### Option A : Si vous avez lancé `npm run dev` dans un terminal

1. **Cherchez le terminal** où vous avez tapé `npm run dev`
2. **Vous devriez voir** au démarrage :
   ```
   ═══════════════════════════════════════════════════════════════
   [Notifications] ⚠️  MODE DRY RUN ACTIVÉ
   [Notifications] 📝 Les notifications seront LOGGÉES mais pas envoyées
   [Notifications] 👀 Regardez ce terminal pour voir les logs de notifications
   ═══════════════════════════════════════════════════════════════
   
   [SERVER] Server running on port 5001
   ```

3. **C'est ce terminal** que vous devez regarder pour voir les logs de notifications !

### Option B : Si vous ne trouvez pas le terminal

1. **Ouvrez un nouveau terminal** dans Cursor
2. **Tapez** :
   ```bash
   ps aux | grep "npm run dev" | grep -v grep
   ```
3. **Cherchez le PID** (numéro de processus)
4. **Ou simplement** : arrêtez tous les serveurs et redémarrez :
   ```bash
   # Arrêter tous les processus sur le port 5001
   lsof -ti:5001 | xargs kill -9
   
   # Redémarrer le serveur
   npm run dev
   ```

---

## 🧪 Étape 2 : Tester les Notifications

1. **Gardez le terminal du serveur ouvert et visible**
2. **Ouvrez votre navigateur** sur `http://localhost:5001/calendar`
3. **Créez un nouveau rendez-vous**
4. **Regardez IMMÉDIATEMENT le terminal du serveur** (pas le navigateur !)

---

## 📋 Ce que vous devriez voir dans le terminal

Quand vous créez un rendez-vous, vous devriez voir dans le **terminal du serveur** :

```
[POST /api/appointments] ✅ Rendez-vous créé: appointment-123

═══════════════════════════════════════════════════════════════
[POST /api/appointments] 📧 ENVOI DES NOTIFICATIONS DE CONFIRMATION
═══════════════════════════════════════════════════════════════
[POST /api/appointments] 📧 Contexte de notification construit avec succès
[POST /api/appointments] 📧 Client: Colette Girard
[POST /api/appointments] 📧 Email: colette@gmail.com
[POST /api/appointments] 📧 Téléphone: 079 2222222
[SmsUp] [DRY RUN] SMS qui serait envoyé:
[SmsUp] [DRY RUN]   To: +41791234567
[SmsUp] [DRY RUN]   Message: Votre rendez-vous chez Witstyl est confirmé le...
[SmsUp] [DRY RUN]   Payload: { ... }
[Resend] [DRY RUN] Email qui serait envoyé:
[Resend] [DRY RUN]   To: colette@gmail.com
[Resend] [DRY RUN]   From: Witstyl <noreply@witstyl.ch>
[Resend] [DRY RUN]   Subject: Votre rendez-vous est confirmé - Witstyl
[Resend] [DRY RUN]   HTML (premiers 200 caractères): ...
[POST /api/appointments] ✅ Notifications envoyées avec succès
═══════════════════════════════════════════════════════════════
```

---

## ❌ Si vous ne voyez RIEN dans le terminal

### Vérification 1 : Le serveur tourne-t-il ?

```bash
# Vérifier si le port 5001 est utilisé
lsof -ti:5001
```

Si rien ne s'affiche, le serveur n'est pas démarré. Redémarrez-le :
```bash
npm run dev
```

### Vérification 2 : Êtes-vous dans le bon terminal ?

- ❌ **Console du navigateur (F12)** → Ne contient PAS les logs de notifications
- ✅ **Terminal où `npm run dev` tourne** → Contient les logs de notifications

### Vérification 3 : Y a-t-il des erreurs ?

Regardez dans le terminal du serveur pour voir s'il y a des erreurs comme :
- `Error: listen EADDRINUSE` → Le port est occupé, arrêtez les autres processus
- `[Notifications] Erreur lors de la récupération du client` → Problème de données
- `⚠️ Impossible de construire le contexte de notification` → Problème de données

---

## 💡 Astuce : Créer un Terminal Dédié

Pour être sûr de voir les logs, créez un terminal dédié :

1. **Dans Cursor**, ouvrez un nouveau terminal (Terminal → New Terminal)
2. **Tapez** :
   ```bash
   cd /Users/pierre/Downloads/App/V1/Transfert\ vers\ cursor/Witstyl
   npm run dev
   ```
3. **Gardez ce terminal ouvert et visible**
4. **C'est dans ce terminal** que vous verrez tous les logs

---

## 🎯 Résumé

1. ✅ **Terminal du serveur** = Où vous avez lancé `npm run dev`
2. ❌ **Console du navigateur (F12)** = Ne contient PAS les logs de notifications
3. 👀 **Regardez le terminal du serveur** après avoir créé un rendez-vous
4. 📋 **Les logs commencent par** `[POST /api/appointments]` ou `[SmsUp]` ou `[Resend]`

---

## 🆘 Si ça ne fonctionne toujours pas

1. **Arrêtez tous les processus** :
   ```bash
   lsof -ti:5001 | xargs kill -9
   ```

2. **Redémarrez le serveur** :
   ```bash
   npm run dev
   ```

3. **Vérifiez que vous voyez** le message au démarrage :
   ```
   [Notifications] ⚠️  MODE DRY RUN ACTIVÉ
   ```

4. **Créez un rendez-vous** et regardez le terminal

Si vous ne voyez toujours rien, il y a peut-être un problème avec les données (client, service, styliste manquants).



