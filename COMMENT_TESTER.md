# 🧪 Comment Tester les Notifications

## ⚠️ IMPORTANT : Où regarder les logs

Les logs de notifications apparaissent dans le **TERMINAL DU SERVEUR**, **PAS** dans la console du navigateur (F12).

### 📍 Où trouver les logs

1. **Terminal où vous avez lancé `npm run dev`**
   - C'est là que vous verrez les logs `[SmsUp] [DRY RUN]` et `[Resend] [DRY RUN]`
   - Les logs commencent par `[Notifications]`, `[SmsUp]`, ou `[Resend]`

2. **Console du navigateur (F12)**
   - Ne contient PAS les logs de notifications
   - Contient seulement les logs JavaScript du frontend

---

## 🚀 Test Rapide

### Étape 1 : Vérifier que le serveur tourne

Dans le terminal où vous avez lancé `npm run dev`, vous devriez voir au démarrage :
```
[Notifications] ⚠️ Mode DRY RUN activé - Les notifications seront loggées mais pas envoyées
```

### Étape 2 : Créer un rendez-vous

1. Ouvrir `http://localhost:5001/calendar`
2. Créer un nouveau rendez-vous :
   - Cliquer sur un créneau libre
   - Remplir : Client, Service, Coiffeur·euse, Date/Heure
   - Sauvegarder

### Étape 3 : Regarder le TERMINAL du serveur

**Dans le terminal (pas dans le navigateur !)**, vous devriez voir :

```
[POST /api/appointments] ✅ Rendez-vous créé: appointment-123
[POST /api/appointments] 📧 Envoi des notifications de confirmation...
[SmsUp] [DRY RUN] SMS qui serait envoyé:
[SmsUp] [DRY RUN]   To: +41791234567
[SmsUp] [DRY RUN]   Message: Votre rendez-vous chez Witstyl est confirmé le...
[SmsUp] [DRY RUN]   Payload: { ... }
[Resend] [DRY RUN] Email qui serait envoyé:
[Resend] [DRY RUN]   To: client@example.com
[Resend] [DRY RUN]   From: Witstyl <noreply@witstyl.ch>
[Resend] [DRY RUN]   Subject: Votre rendez-vous est confirmé - Witstyl
[Resend] [DRY RUN]   HTML (premiers 200 caractères): ...
[POST /api/appointments] ✅ Notifications envoyées avec succès
```

---

## 🔍 Si vous ne voyez PAS les logs

### Vérification 1 : Le serveur tourne-t-il ?

```bash
# Dans un nouveau terminal, vérifier les processus
ps aux | grep "npm run dev" | grep -v grep

# Vérifier si le port 5001 est utilisé
lsof -ti:5001
```

Si le port est occupé, arrêter les processus :
```bash
kill -9 $(lsof -ti:5001)
```

### Vérification 2 : Les variables d'environnement sont-elles chargées ?

```bash
# Vérifier que NOTIFICATIONS_DRY_RUN est bien défini
grep NOTIFICATIONS_DRY_RUN .env

# Vérifier que les variables VITE sont présentes
grep VITE_SUPABASE .env
```

### Vérification 3 : Y a-t-il des erreurs dans le terminal ?

Regardez dans le terminal du serveur pour voir s'il y a des erreurs comme :
- `[Notifications] Erreur lors de la récupération du client`
- `[Notifications] Erreur lors de la construction du contexte`
- `⚠️ Impossible de construire le contexte de notification`

**Note** : Si vous voyez des avertissements comme :
- `[NotificationService] Email non envoyé: adresse email manquante`
- `[NotificationService] SMS non envoyé: numéro de téléphone manquant`

C'est normal ! Le système gère maintenant les clients sans email ou téléphone sans erreur.

### Vérification 4 : Le rendez-vous a-t-il bien été créé ?

- Vérifier dans le calendrier que le rendez-vous apparaît
- Si le rendez-vous n'apparaît pas, il y a peut-être une erreur avant l'envoi des notifications

---

## 📝 Logs à rechercher

### ✅ Logs de succès (ce que vous devriez voir)

```
[POST /api/appointments] ✅ Rendez-vous créé: ...
[POST /api/appointments] 📧 Envoi des notifications de confirmation...
[SmsUp] [DRY RUN] SMS qui serait envoyé: ...
[Resend] [DRY RUN] Email qui serait envoyé: ...
[POST /api/appointments] ✅ Notifications envoyées avec succès
```

### ⚠️ Logs d'avertissement (peuvent apparaître - normal dans certains cas)

```
[POST /api/appointments] ⚠️ Impossible de construire le contexte de notification
[Notifications] Erreur lors de la récupération du client: ...
[Notifications] Erreur lors de la récupération du service: ...
[NotificationService] Email non envoyé: adresse email manquante pour le client ...
[NotificationService] SMS non envoyé: numéro de téléphone manquant pour le client ...
[Notifications] Avertissement: styliste non trouvé, utilisation du nom par défaut
```

**Note** : Les avertissements pour email/téléphone manquants sont normaux si le client n'a pas ces informations. Le rendez-vous est quand même créé avec succès.

### ❌ Logs d'erreur (problème à résoudre)

```
[POST /api/appointments] ❌ Erreur lors de l'envoi des notifications: ...
[Notifications] Erreur lors de la construction du contexte: ...
```

---

## 🎯 Test Complet

1. **Ouvrir le terminal du serveur** (celui où `npm run dev` tourne)
2. **Créer un rendez-vous** depuis `/calendar`
3. **Regarder immédiatement le terminal** (pas le navigateur !)
4. **Vérifier les logs** qui commencent par `[SmsUp]` ou `[Resend]`

---

## 💡 Astuce

Si vous avez plusieurs terminaux ouverts, cherchez celui qui affiche :
- `[SERVER] Server running on port 5001`
- `[Notifications] ⚠️ Mode DRY RUN activé...`

C'est dans ce terminal que vous verrez les logs de notifications !

