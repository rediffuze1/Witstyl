# Guide de Tests - SalonPilot

## 🧪 Tests des Notifications (Mode Dry Run)

### Prérequis
1. Vérifier que votre fichier `.env` contient :
   ```env
   NOTIFICATIONS_DRY_RUN=true
   SMSUP_API_KEY=votre_clé_ici
   RESEND_API_KEY=votre_clé_ici
   ```

2. Redémarrer le serveur si nécessaire :
   ```bash
   npm run dev
   ```

### Test 1 : Créer un rendez-vous et vérifier les logs

**Étapes :**
1. Ouvrir `http://localhost:5001/calendar` (ou `/book` pour la version publique)
2. Créer un nouveau rendez-vous :
   - Sélectionner un client
   - Sélectionner un service
   - Sélectionner un coiffeur·euse
   - Choisir une date et heure
   - Cliquer sur "Créer" ou "Confirmer"

3. **Vérifier les logs dans le terminal du serveur** :
   Vous devriez voir :
   ```
   [SmsUp] [DRY RUN] SMS qui serait envoyé:
   [SmsUp] [DRY RUN]   To: +41791234567
   [SmsUp] [DRY RUN]   Message: Votre rendez-vous chez SalonPilot est confirmé le...
   [SmsUp] [DRY RUN]   Payload: { ... }
   
   [Resend] [DRY RUN] Email qui serait envoyé:
   [Resend] [DRY RUN]   To: client@example.com
   [Resend] [DRY RUN]   From: SalonPilot <noreply@salonpilot.ch>
   [Resend] [DRY RUN]   Subject: Votre rendez-vous est confirmé - SalonPilot
   [Resend] [DRY RUN]   HTML (premiers 200 caractères): ...
   ```

4. **Vérifier que le rendez-vous est créé** :
   - Le rendez-vous doit apparaître dans le calendrier
   - Aucune erreur ne doit bloquer la création

### Test 2 : Modifier un rendez-vous

**Étapes :**
1. Dans `/calendar`, cliquer sur un rendez-vous existant
2. Modifier la date ou l'heure
3. Sauvegarder

4. **Vérifier les logs** :
   Vous devriez voir :
   ```
   [Resend] [DRY RUN] Email qui serait envoyé:
   [Resend] [DRY RUN]   Subject: Modification de votre rendez-vous - SalonPilot
   ```

### Test 3 : Annuler un rendez-vous

**Étapes :**
1. Dans `/calendar`, cliquer sur un rendez-vous
2. Cliquer sur "Supprimer" ou changer le statut à "Annulé"
3. Confirmer

4. **Vérifier les logs** :
   Vous devoriez voir :
   ```
   [Resend] [DRY RUN] Email qui serait envoyé:
   [Resend] [DRY RUN]   Subject: Annulation de votre rendez-vous - SalonPilot
   ```

---

## 🎨 Tests du Thème (Couleur Principale)

### Prérequis
1. Vérifier que la colonne `theme_color` existe dans Supabase (déjà fait ✅)
2. Vérifier que la policy RLS est créée (déjà fait ✅)

### Test 1 : Vérifier que le thème se charge sans être connecté

**Étapes :**
1. Ouvrir un navigateur en navigation privée (ou un autre navigateur)
2. Aller sur `http://localhost:5001/`
3. **Vérifier** :
   - La page se charge sans erreur
   - La couleur principale du salon s'affiche (si définie dans la base)
   - Si aucune couleur n'est définie, la couleur par défaut (gris) s'affiche

4. **Vérifier la console du navigateur** (F12 → Console) :
   - Aucune erreur JavaScript
   - La requête vers `/api/public/salon` doit réussir (status 200)

### Test 2 : Tester après clear cookies

**Étapes :**
1. Sur la landing page (`/`), ouvrir les DevTools (F12)
2. Aller dans l'onglet "Application" (Chrome) ou "Stockage" (Firefox)
3. Cliquer sur "Clear site data" ou "Effacer les données du site"
4. Recharger la page (F5)

5. **Vérifier** :
   - La page se recharge
   - La couleur du salon est toujours affichée (chargée depuis l'API publique)
   - Pas besoin de se connecter pour voir la couleur

### Test 3 : Modifier la couleur depuis les paramètres

**Étapes :**
1. Se connecter en manager (`/salon-login`)
2. Aller dans `/settings`
3. Scroller jusqu'à la section "Apparence du site"
4. Modifier la couleur principale (ex: `hsl(211 66% 66%)` ou utiliser le sélecteur de couleur)
5. Cliquer sur "Enregistrer"

6. **Vérifier immédiatement** :
   - La couleur change sur le dashboard
   - La couleur change dans la barre de navigation
   - Les boutons utilisent la nouvelle couleur

7. **Vérifier sur la landing** :
   - Ouvrir un nouvel onglet en navigation privée
   - Aller sur `http://localhost:5001/`
   - La nouvelle couleur doit s'afficher

### Test 4 : Vérifier dans la base de données

**Étapes :**
1. Dans Supabase SQL Editor, exécuter :
   ```sql
   SELECT id, name, theme_color 
   FROM salons 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

2. **Vérifier** :
   - Votre salon a bien une valeur dans `theme_color`
   - La valeur correspond à celle que vous avez définie dans les paramètres

---

## 🔍 Vérifications Générales

### Vérifier les logs du serveur au démarrage

Au démarrage, vous devriez voir :
```
[Notifications] ⚠️ Mode DRY RUN activé - Les notifications seront loggées mais pas envoyées
```

### Vérifier qu'il n'y a pas d'erreurs

**Dans le terminal du serveur :**
- Aucune erreur TypeScript
- Aucune erreur de connexion à Supabase
- Aucune erreur concernant `theme_color`

**Dans la console du navigateur (F12) :**
- Aucune erreur JavaScript
- Les requêtes API retournent 200 (succès)

---

## 📝 Checklist de Tests

### Notifications
- [ ] Création de rendez-vous → Logs [DRY RUN] SMS et Email visibles
- [ ] Modification de rendez-vous → Logs [DRY RUN] Email visible
- [ ] Annulation de rendez-vous → Logs [DRY RUN] Email visible
- [ ] Le rendez-vous est créé même si les notifications sont en dry run

### Thème
- [ ] Landing page charge la couleur sans être connecté
- [ ] Après clear cookies, la couleur est toujours affichée
- [ ] Modification de couleur depuis `/settings` fonctionne
- [ ] La nouvelle couleur s'affiche immédiatement sur le dashboard
- [ ] La nouvelle couleur s'affiche sur la landing après rechargement
- [ ] La valeur `theme_color` est bien sauvegardée dans la base de données

---

## 🐛 En cas de problème

### Les notifications ne s'affichent pas dans les logs
- Vérifier que `NOTIFICATIONS_DRY_RUN=true` dans `.env`
- Redémarrer le serveur après modification de `.env`
- Vérifier que les clés API sont définies (même sans crédits)

### La couleur ne s'affiche pas
- Vérifier que `theme_color` existe dans la table `salons` (script SQL)
- Vérifier que la policy RLS `public_read_salon_appearance` existe
- Vérifier les logs du serveur pour des erreurs API
- Vérifier la console du navigateur (F12) pour des erreurs JavaScript

### Erreur "column theme_color does not exist"
- Réexécuter le script SQL `sql/add_theme_color_to_salons.sql`

### Erreur "permission denied" sur `/api/public/salon`
- Vérifier que la policy RLS est bien créée
- Réexécuter la partie "CREATE POLICY" du script SQL



