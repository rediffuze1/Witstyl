# 🚀 Guide de Diagnostic Rapide - Resend

## ⚡ Test Rapide en 3 Étapes

### ÉTAPE 1 : Vérifier les Logs Serveur

1. **Ouvrir le terminal** où le serveur tourne (dans Cursor : `Ctrl + ``)

2. **Envoyer un email de test** depuis l'interface `/settings` → Notifications

3. **Regarder les logs** - Vous devriez voir :
   ```
   [Resend] 📧 ENVOI RÉEL D'EMAIL
   [Resend] Réponse brute de Resend: {...}
   ```

**❌ Si vous voyez `[DRY RUN]`** → Redémarrer le serveur après avoir ajouté `EMAIL_DRY_RUN=false`

**❌ Si vous ne voyez RIEN** → Passer à l'ÉTAPE 2

---

### ÉTAPE 2 : Test Direct Resend

1. **Ouvrir un terminal** dans Cursor (`Ctrl + ``)

2. **Exécuter** :
   ```bash
   node test-resend-direct.js veignatpierre@gmail.com
   ```

3. **Analyser la réponse** :

#### ✅ Si succès :
```
✅ EMAIL ENVOYÉ AVEC SUCCÈS !
   Email ID: re_xxxxxxxxxxxxx
```
→ **Resend fonctionne !** Le problème est dans l'application.

#### ❌ Si erreur "domain not verified" :
```
❌ ERREUR: The domain witstyl.ch is not verified
```

**Solution** :
- Option 1 : Vérifier le domaine sur https://resend.com/domains
- Option 2 : Utiliser le domaine de test (voir ÉTAPE 3)

#### ❌ Si erreur "unauthorized" :
```
❌ ERREUR: Unauthorized
```

**Solution** : Vérifier/générer une nouvelle clé API sur https://resend.com/api-keys

---

### ÉTAPE 3 : Solution Rapide (Domaine de Test)

Si le domaine n'est pas vérifié, utilisez le domaine de test Resend :

1. **Modifier `.env`** :
   ```bash
   RESEND_FROM=Witstyl <onboarding@resend.dev>
   ```

2. **Redémarrer le serveur** :
   ```bash
   pkill -f "tsx server/index.ts"
   npm run dev
   ```

3. **Tester à nouveau** depuis l'interface

---

## 🔍 Vérifications Complémentaires

### Vérifier le Dashboard Resend

1. Aller sur https://resend.com/emails
2. Vérifier si des emails apparaissent
3. Si oui → Resend fonctionne, vérifier votre boîte email
4. Si non → Les emails ne sont pas envoyés

### Vérifier les Domaines

1. Aller sur https://resend.com/domains
2. Vérifier que `witstyl.ch` est listé et vérifié
3. Si non → Ajouter et suivre les instructions DNS

---

## 📋 Checklist Rapide

- [ ] Logs serveur vérifiés (pas de `[DRY RUN]`)
- [ ] Script de test direct exécuté
- [ ] Dashboard Resend vérifié
- [ ] Domaine vérifié OU domaine de test utilisé
- [ ] Clé API valide

---

## 🆘 Si Rien Ne Fonctionne

1. **Copier les logs** du terminal serveur
2. **Copier la réponse** du script `test-resend-direct.js`
3. **Vérifier le dashboard Resend** pour les erreurs
4. **Contacter le support Resend** avec ces informations

---

## 💡 Astuce

Le script `test-resend-direct.js` teste directement Resend sans passer par l'application. Si ce script fonctionne mais pas l'application, le problème est dans le code de l'application (probablement dans la logique de dry-run ou dans l'appel à Resend).



