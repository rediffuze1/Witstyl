# 🔍 Diagnostic Resend - Guide Complet

## 🎯 Objectif

Identifier pourquoi les emails ne sont pas envoyés via Resend, même si la configuration semble correcte.

---

## 📋 ÉTAPE 1 : Vérifier les Logs Serveur

### Quand vous envoyez un email de test depuis l'interface :

1. **Ouvrir le terminal où le serveur tourne** (dans Cursor ou Terminal.app)

2. **Envoyer un email de test** depuis l'interface `/settings` → Notifications

3. **Regarder les logs dans le terminal**

### Ce que vous DEVRIEZ voir :

```
[POST /api/owner/notifications/send-test-email] ✅ Route appelée
[NotificationService] 📧 Email de test: ...
[NotificationService] 📤 Appel à emailProvider.sendEmail()...
═══════════════════════════════════════════════════════════════
[Resend] 📧 ENVOI RÉEL D'EMAIL
═══════════════════════════════════════════════════════════════
[Resend] To: veignatpierre@gmail.com
[Resend] From: SalonPilot <noreply@salonpilot.ch>
[Resend] Subject: [TEST] ...
[Resend] Payload complet: {...}
[Resend] Appel à Resend API...
[Resend] Réponse brute de Resend: {...}
```

### Si vous voyez `[DRY RUN]` :

→ Le serveur n'a pas été redémarré après avoir ajouté `EMAIL_DRY_RUN=false`

**Solution** : Redémarrer le serveur

### Si vous ne voyez RIEN dans les logs :

→ L'appel à Resend n'est pas fait ou échoue silencieusement

**Solution** : Passer à l'ÉTAPE 2

---

## 📋 ÉTAPE 2 : Test Direct avec Resend

### Exécuter le script de test direct :

1. **Ouvrir le terminal** dans Cursor :
   - `Ctrl + `` (backtick) ou `Cmd + J` (Mac)

2. **Exécuter le script** :
   ```bash
   node test-resend-direct.js veignatpierre@gmail.com
   ```

3. **Analyser la réponse** :

### ✅ Si succès :

```
✅ EMAIL ENVOYÉ AVEC SUCCÈS !
   Email ID: re_xxxxxxxxxxxxx
```

→ Resend fonctionne ! Le problème est dans l'application.

### ❌ Si erreur :

Le script affichera l'erreur exacte de Resend.

**Erreurs courantes** :

#### 1. Erreur "domain not verified" ou "422"

```
❌ ERREUR DE RESEND:
{
  "message": "The domain salonpilot.ch is not verified"
}
```

**Cause** : Le domaine `salonpilot.ch` n'est pas vérifié dans Resend.

**Solution** :
1. Aller sur https://resend.com/domains
2. Vérifier le domaine `salonpilot.ch`
3. Si le domaine n'existe pas, l'ajouter et suivre les instructions de vérification DNS
4. OU utiliser un domaine déjà vérifié (ex: `onboarding@resend.dev` pour les tests)

#### 2. Erreur "unauthorized" ou "401"

```
❌ ERREUR DE RESEND:
{
  "message": "Unauthorized"
}
```

**Cause** : La clé API est invalide ou expirée.

**Solution** :
1. Aller sur https://resend.com/api-keys
2. Vérifier que la clé API existe et est active
3. Générer une nouvelle clé si nécessaire
4. Mettre à jour `RESEND_API_KEY` dans le `.env`

#### 3. Erreur "from address not allowed"

```
❌ ERREUR DE RESEND:
{
  "message": "The from address is not allowed"
}
```

**Cause** : L'adresse `noreply@salonpilot.ch` n'est pas autorisée.

**Solution** :
1. Utiliser un domaine vérifié
2. OU utiliser `onboarding@resend.dev` pour les tests (domaine par défaut de Resend)

---

## 📋 ÉTAPE 3 : Vérifier le Dashboard Resend

1. **Aller sur** : https://resend.com/emails

2. **Vérifier la liste des emails** :
   - Si vous voyez des emails → Resend fonctionne, le problème est ailleurs
   - Si la liste est vide → Les emails ne sont pas envoyés

3. **Vérifier les domaines** :
   - Aller sur https://resend.com/domains
   - Vérifier que `salonpilot.ch` est listé et vérifié
   - Si non vérifié → Suivre les instructions de vérification DNS

---

## 📋 ÉTAPE 4 : Solutions selon le Problème

### Problème 1 : Domaine Non Vérifié

**Symptôme** : Erreur 422 dans les logs ou le script de test

**Solution** :

1. **Option A : Vérifier le domaine** (recommandé pour production)
   - Aller sur https://resend.com/domains
   - Ajouter `salonpilot.ch`
   - Suivre les instructions DNS
   - Attendre la vérification (peut prendre quelques minutes)

2. **Option B : Utiliser le domaine de test Resend** (pour tests rapides)
   - Modifier `.env` :
     ```bash
     RESEND_FROM=SalonPilot <onboarding@resend.dev>
     ```
   - Redémarrer le serveur
   - Tester à nouveau

### Problème 2 : Clé API Invalide

**Symptôme** : Erreur 401 dans les logs ou le script de test

**Solution** :
1. Aller sur https://resend.com/api-keys
2. Générer une nouvelle clé API
3. Mettre à jour `.env` :
   ```bash
   RESEND_API_KEY=re_votre_nouvelle_cle
   ```
4. Redémarrer le serveur

### Problème 3 : Aucun Log dans le Terminal

**Symptôme** : Aucun log `[Resend]` n'apparaît

**Causes possibles** :
1. Le serveur n'a pas été redémarré
2. `EMAIL_DRY_RUN=true` est toujours actif
3. L'appel à Resend n'est pas fait

**Solution** :
1. Vérifier `.env` : `EMAIL_DRY_RUN=false`
2. Redémarrer le serveur
3. Vérifier les logs au démarrage
4. Tester à nouveau

---

## 🧪 Test Rapide

### Commande unique pour tout tester :

```bash
# 1. Vérifier la configuration
echo "RESEND_API_KEY: $(grep RESEND_API_KEY .env | cut -d'=' -f2 | cut -c1-15)..."
echo "RESEND_FROM: $(grep RESEND_FROM .env | cut -d'=' -f2-)"
echo "EMAIL_DRY_RUN: $(grep EMAIL_DRY_RUN .env || echo 'non défini')"

# 2. Tester directement Resend
node test-resend-direct.js veignatpierre@gmail.com
```

---

## ✅ Checklist de Diagnostic

- [ ] Logs serveur vérifiés lors de l'envoi d'email
- [ ] Script de test direct exécuté
- [ ] Dashboard Resend vérifié (https://resend.com/emails)
- [ ] Domaines vérifiés (https://resend.com/domains)
- [ ] Clé API vérifiée (https://resend.com/api-keys)
- [ ] `.env` vérifié (`EMAIL_DRY_RUN=false`, `RESEND_API_KEY`, `RESEND_FROM`)

---

## 🆘 Si Rien Ne Fonctionne

1. **Vérifier que Resend est bien configuré** :
   - Compte actif
   - Crédits disponibles
   - Domaine vérifié OU utiliser `onboarding@resend.dev`

2. **Tester avec curl directement** :
   ```bash
   curl -X POST https://api.resend.com/emails \
     -H "Authorization: Bearer $(grep RESEND_API_KEY .env | cut -d'=' -f2)" \
     -H "Content-Type: application/json" \
     -d '{
       "from": "onboarding@resend.dev",
       "to": "veignatpierre@gmail.com",
       "subject": "Test direct",
       "html": "<p>Test</p>"
     }'
   ```

3. **Contacter le support Resend** si nécessaire

---

## 📞 Support

Si après tous ces tests le problème persiste :

1. **Copier les logs complets** du terminal serveur
2. **Copier la réponse du script de test** (`test-resend-direct.js`)
3. **Vérifier le dashboard Resend** pour voir les erreurs
4. **Contacter le support Resend** avec ces informations



