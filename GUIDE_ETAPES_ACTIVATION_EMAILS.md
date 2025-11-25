# 📧 Guide Pas à Pas - Activation de l'Envoi Réel des Emails

## 🎯 Objectif

Activer l'envoi réel des emails via Resend (au lieu du mode DRY RUN).

---

## 📝 ÉTAPE 1 : Modifier le fichier `.env`

### Option A : Via Cursor (Éditeur)

1. **Ouvrir le fichier `.env`** :
   - Dans Cursor, appuyez sur `Cmd + P` (Mac) ou `Ctrl + P` (Windows/Linux)
   - Tapez `.env` et appuyez sur `Entrée`

2. **Ajouter la ligne** :
   - Allez à la fin du fichier
   - Ajoutez cette ligne :
     ```bash
     EMAIL_DRY_RUN=false
     ```

3. **Sauvegarder** :
   - `Cmd + S` (Mac) ou `Ctrl + S` (Windows/Linux)

### Option B : Via Terminal

1. **Ouvrir le terminal dans Cursor** :
   - `Ctrl + `` (backtick) ou `Cmd + J` (Mac)
   - Ou menu : `Terminal` → `New Terminal`

2. **Ouvrir le fichier `.env`** :
   ```bash
   code .env
   ```
   ou
   ```bash
   nano .env
   ```

3. **Ajouter la ligne** :
   - Allez à la fin du fichier
   - Ajoutez : `EMAIL_DRY_RUN=false`
   - Sauvegarder : `Ctrl + O` puis `Entrée` (nano) ou `Cmd + S` (code)

---

## 🔄 ÉTAPE 2 : Redémarrer le Serveur

### Option A : Via Terminal dans Cursor

1. **Ouvrir le terminal** :
   - `Ctrl + `` (backtick) ou `Cmd + J` (Mac)
   - Ou menu : `Terminal` → `New Terminal`

2. **Arrêter le serveur actuel** :
   ```bash
   pkill -f "tsx server/index.ts"
   ```
   ou appuyez sur `Ctrl + C` dans le terminal où le serveur tourne

3. **Redémarrer le serveur** :
   ```bash
   npm run dev
   ```

### Option B : Via le Terminal Système

1. **Ouvrir Terminal.app** (Mac) ou Terminal (Linux/Windows)
   - Raccourci : `Cmd + Espace` puis tapez "Terminal" (Mac)

2. **Naviguer vers le projet** :
   ```bash
   cd "/Users/pierre/Downloads/App/V1/Transfert vers cursor/SalonPilot"
   ```

3. **Arrêter le serveur** :
   ```bash
   pkill -f "tsx server/index.ts"
   ```

4. **Redémarrer** :
   ```bash
   npm run dev
   ```

---

## 👀 ÉTAPE 3 : Voir les Logs au Démarrage

### Dans le Terminal

Après avoir lancé `npm run dev`, vous devriez voir dans le terminal :

```
═══════════════════════════════════════════════════════════════
[Notifications] ⚙️  CONFIGURATION DES NOTIFICATIONS
═══════════════════════════════════════════════════════════════
[Notifications] 📱 SMS: ⚠️  DRY RUN (log uniquement)
[Notifications] 📧 Email: ✅ ENVOI RÉEL
[Notifications] 🔑 RESEND_API_KEY: ✅ Définie (re_JCiGcc...)
[Notifications] 📧 RESEND_FROM: SalonPilot <noreply@salonpilot.ch>
[Notifications] 🔧 EMAIL_DRY_RUN: false
═══════════════════════════════════════════════════════════════
```

**✅ Si vous voyez `Email: ✅ ENVOI RÉEL`** → C'est bon !

**❌ Si vous voyez `Email: ⚠️  DRY RUN`** → Vérifiez que `EMAIL_DRY_RUN=false` est bien dans le `.env`

---

## 🌐 ÉTAPE 4 : Ouvrir l'Interface Web

1. **Ouvrir votre navigateur** :
   - Chrome : `Cmd + T` (Mac) ou `Ctrl + T` (Windows/Linux)
   - Firefox : `Cmd + T` (Mac) ou `Ctrl + T` (Windows/Linux)

2. **Aller sur la page Settings** :
   - URL : `http://localhost:5001/settings`
   - Ou naviguer depuis l'interface : Menu → Settings

3. **Aller dans l'onglet Notifications** :
   - Cliquez sur l'onglet "Notifications" dans la page Settings

---

## 📧 ÉTAPE 5 : Envoyer un Email de Test

1. **Scroller jusqu'à la section "Envoyer un email de test"**

2. **Saisir votre adresse email** :
   - Dans le champ "Email de test"
   - Exemple : `veignatpierre@gmail.com`

3. **Cliquer sur le bouton "Envoyer"**

4. **Attendre la réponse** :
   - Un toast vert devrait apparaître : "Email de test envoyé à ..."
   - Si erreur : un toast rouge avec le message d'erreur

---

## 🔍 ÉTAPE 6 : Vérifier les Logs Serveur

### Dans le Terminal où le serveur tourne

Vous devriez voir :

```
[POST /api/owner/notifications/send-test-email] ✅ Route appelée
[NotificationService] 📧 Email de test: ...
[NotificationService] 📤 Appel à emailProvider.sendEmail()...
═══════════════════════════════════════════════════════════════
[Resend] 📧 ENVOI RÉEL D'EMAIL
═══════════════════════════════════════════════════════════════
[Resend] To: votre-email@example.com
[Resend] From: SalonPilot <noreply@salonpilot.ch>
[Resend] Subject: [TEST] ...
[Resend] Payload complet: {...}
[Resend] Appel à Resend API...
[Resend] Réponse brute de Resend: {...}
═══════════════════════════════════════════════════════════════
[Resend] ✅ EMAIL ENVOYÉ AVEC SUCCÈS
═══════════════════════════════════════════════════════════════
[Resend] Email ID: re_xxxxxxxxxxxxx
```

**✅ Si vous voyez `[Resend] 📧 ENVOI RÉEL D'EMAIL`** → L'email est envoyé réellement !

**❌ Si vous voyez `[Resend] [DRY RUN]`** → Le serveur n'a pas été redémarré ou `EMAIL_DRY_RUN=false` n'est pas dans le `.env`

---

## 🐛 ÉTAPE 7 : Vérifier les Erreurs (si problème)

### Dans la Console du Navigateur

1. **Ouvrir la Console** :
   - Chrome/Edge : `Cmd + Option + J` (Mac) ou `Ctrl + Shift + J` (Windows/Linux)
   - Firefox : `Cmd + Option + K` (Mac) ou `Ctrl + Shift + K` (Windows/Linux)
   - Safari : `Cmd + Option + C` (Mac)

2. **Vérifier les erreurs** :
   - Onglet "Console" ouvert
   - Cherchez les erreurs en rouge
   - Si erreur 500 : cliquez dessus pour voir les détails

### Dans le Terminal Serveur

Si vous voyez :
```
[Resend] ❌ ERREUR LORS DE L'ENVOI
[Resend] Erreur Resend: {...}
```

**Erreurs courantes** :
- **422** : Domaine non vérifié dans Resend → Vérifiez le domaine dans le dashboard Resend
- **401** : Clé API invalide → Vérifiez `RESEND_API_KEY` dans le `.env`
- **403** : Permissions insuffisantes → Vérifiez les permissions de la clé API

---

## 📬 ÉTAPE 8 : Vérifier la Réception de l'Email

### Option A : Vérifier votre Boîte Email

1. **Ouvrir Gmail** (ou votre client email)
2. **Vérifier** :
   - Boîte de réception
   - Dossier Spam/Pourriels
   - Dossier Promotions (Gmail)

### Option B : Vérifier le Dashboard Resend

1. **Aller sur** : https://resend.com/emails
2. **Se connecter** avec votre compte Resend
3. **Vérifier la liste des emails envoyés** :
   - Statut : "Delivered" = email livré
   - Statut : "Bounced" = email rejeté
   - Statut : "Failed" = échec d'envoi

---

## ✅ Checklist de Vérification

Cochez chaque étape au fur et à mesure :

- [ ] **Étape 1** : `EMAIL_DRY_RUN=false` ajouté dans `.env`
- [ ] **Étape 2** : Serveur redémarré
- [ ] **Étape 3** : Logs au démarrage montrent `Email: ✅ ENVOI RÉEL`
- [ ] **Étape 4** : Interface `/settings` → Notifications ouverte
- [ ] **Étape 5** : Email de test envoyé depuis l'interface
- [ ] **Étape 6** : Logs serveur montrent `[Resend] 📧 ENVOI RÉEL D'EMAIL`
- [ ] **Étape 7** : Pas d'erreur dans la console navigateur
- [ ] **Étape 8** : Email reçu OU visible dans le dashboard Resend

---

## 🆘 En Cas de Problème

### Le serveur ne démarre pas

1. Vérifiez que vous êtes dans le bon dossier :
   ```bash
   pwd
   # Doit afficher : /Users/pierre/Downloads/App/V1/Transfert vers cursor/SalonPilot
   ```

2. Vérifiez que Node.js est installé :
   ```bash
   node --version
   ```

3. Réinstallez les dépendances si nécessaire :
   ```bash
   npm install
   ```

### Les logs ne montrent pas "ENVOI RÉEL"

1. Vérifiez que `EMAIL_DRY_RUN=false` est bien dans `.env` :
   ```bash
   grep EMAIL_DRY_RUN .env
   ```

2. Vérifiez qu'il n'y a pas d'espaces ou de guillemets :
   ```bash
   EMAIL_DRY_RUN=false  # ✅ Correct
   EMAIL_DRY_RUN="false"  # ❌ Éviter les guillemets
   EMAIL_DRY_RUN = false  # ❌ Éviter les espaces
   ```

3. Redémarrez le serveur après modification

### L'email n'arrive pas

1. Vérifiez les logs serveur pour voir l'erreur Resend
2. Vérifiez le dashboard Resend pour voir le statut
3. Vérifiez que le domaine dans `RESEND_FROM` est vérifié dans Resend
4. Vérifiez votre dossier Spam

---

## 📚 Raccourcis Utiles

### Cursor
- `Cmd + P` : Ouvrir un fichier
- `Cmd + S` : Sauvegarder
- `Ctrl + `` : Ouvrir/fermer le terminal
- `Cmd + J` : Ouvrir/fermer le panneau latéral
- `Cmd + /` : Commenter/décommenter

### Terminal
- `Ctrl + C` : Arrêter un processus
- `Ctrl + L` : Effacer l'écran
- `Cmd + K` (Mac) : Effacer l'écran
- `↑` / `↓` : Naviguer dans l'historique

### Navigateur
- `Cmd + T` : Nouvel onglet
- `Cmd + R` : Recharger la page
- `Cmd + Shift + R` : Recharger sans cache
- `Cmd + Option + J` : Console (Chrome Mac)
- `Ctrl + Shift + J` : Console (Chrome Windows)

---

## 🎉 Résultat Attendu

À la fin de ce processus :

✅ Les emails sont envoyés réellement via Resend  
✅ Les logs sont détaillés et utiles  
✅ Les erreurs sont visibles immédiatement  
✅ Vous pouvez tester facilement depuis l'interface  

**Tout est prêt pour l'envoi réel d'emails !** 🚀



