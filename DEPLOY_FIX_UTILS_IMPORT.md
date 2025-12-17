# Déploiement : Fix de l'erreur Cannot find module 'utils' sur Vercel

## ✅ État actuel

**Code local :** ✅ Corrigé
- Import `from './utils.js'` supprimé de `NotificationService.ts`
- Fonction `buildAppointmentTemplateContextForTest` inlinée
- Aucun import utils trouvé dans `NotificationService.ts`

**Production Vercel :** ❌ Pas encore déployé
- Le code modifié n'a pas été commité et déployé
- Vercel utilise encore l'ancienne version avec l'import problématique

## 🚀 Instructions de déploiement

### Étape 1 : Vérifier les modifications

```bash
# Vérifier que l'import utils a bien été supprimé
grep -n "import.*utils\|from.*utils" server/core/notifications/NotificationService.ts
# Devrait retourner : Aucun résultat ✅

# Vérifier que la fonction est bien inlinée
grep -A 15 "Construire un contexte de test" server/core/notifications/NotificationService.ts
# Devrait montrer le code inliné ✅
```

### Étape 2 : Commit et push

```bash
# Ajouter les fichiers modifiés
git add server/core/notifications/NotificationService.ts
git add server/core/appointments/AppointmentService.ts
git add server/index.ts
git add server/utils/bookingValidation.ts
git add sql/add_notification_events.sql
git add MANAGER_CANCEL_EMAIL_IMPLEMENTATION.md
git add FIX_VERCEL_UTILS_IMPORT.md

# Commit avec message descriptif
git commit -m "fix: inline buildAppointmentTemplateContextForTest to fix Vercel ESM import error

- Remove import from './utils.js' in NotificationService.ts
- Inline buildAppointmentTemplateContextForTest function
- Fixes ERR_MODULE_NOT_FOUND error on Vercel Serverless
- Also includes manager cancel email feature with idempotence"

# Push vers le dépôt
git push origin main
```

### Étape 3 : Vérifier le déploiement Vercel

1. **Aller sur Vercel Dashboard**
   - Vérifier que le build est en cours
   - Attendre la fin du build

2. **Vérifier les logs de build**
   - Chercher des erreurs TypeScript
   - Vérifier que le build se termine avec succès

3. **Vérifier que le code est déployé**
   - Le commit doit être visible dans les déploiements Vercel
   - Le build doit être récent (quelques minutes)

### Étape 4 : Tester l'endpoint

**Depuis l'interface web :**
1. Aller sur `https://witstyl.vercel.app/settings`
2. Section "Envoyer un email de test"
3. Entrer une adresse email
4. Cliquer sur "Envoyer"
5. ✅ Vérifier qu'il n'y a **plus** d'erreur `Cannot find module 'utils'`

**Depuis curl (optionnel) :**
```bash
curl -X POST https://witstyl.vercel.app/api/owner/notifications/send-test-email \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{"testEmail": "test@example.com"}'
```

**Résultat attendu :**
- ✅ Status 200
- ✅ Réponse JSON avec `{"ok": true, ...}`
- ✅ **Aucune erreur** `ERR_MODULE_NOT_FOUND`

### Étape 5 : Vérifier les logs Vercel

Dans les logs Vercel de la fonction serverless :

**Logs attendus (succès) :**
```
[POST /api/owner/notifications/send-test-email] ✅ Route appelée
[NotificationService] 📧 Email de test:
[NotificationService] 📤 Appel à emailProvider.sendEmail()...
[NotificationService] ✅ EMAIL DE TEST ENVOYÉ AVEC SUCCÈS
```

**Logs à ne PAS voir (erreur) :**
```
❌ Cannot find module '/var/task/server/core/notifications/utils'
❌ ERR_MODULE_NOT_FOUND
```

## 🔍 Diagnostic si le problème persiste

Si après déploiement l'erreur persiste :

### 1. Vérifier le cache Vercel

Vercel peut mettre en cache les builds. Solutions :
- **Forcer un nouveau déploiement** : Faire un commit vide ou modifier un commentaire
- **Invalider le cache** : Dans Vercel Dashboard → Settings → Build & Development Settings → Clear Build Cache

### 2. Vérifier que le bon commit est déployé

```bash
# Vérifier le dernier commit
git log --oneline -1

# Vérifier dans Vercel Dashboard que ce commit est bien déployé
```

### 3. Vérifier les fichiers dans le build Vercel

Dans les logs de build Vercel, chercher :
- `server/core/notifications/NotificationService.js` est généré
- Le fichier ne contient **pas** d'import vers `utils`

### 4. Vérifier s'il y a d'autres imports problématiques

```bash
# Chercher tous les imports utils dans le projet
grep -r "from.*utils\.js\|import.*utils\.js" server/ --include="*.ts" | grep -v node_modules
```

## ✅ Checklist de validation finale

- [ ] Code modifié et vérifié localement
- [ ] Aucun import `utils` dans `NotificationService.ts`
- [ ] Fonction inlinée correctement
- [ ] Commit créé avec message descriptif
- [ ] Code pushé vers le dépôt
- [ ] Build Vercel terminé avec succès
- [ ] Endpoint testé depuis l'interface
- [ ] Aucune erreur `ERR_MODULE_NOT_FOUND` dans les logs
- [ ] Email de test envoyé avec succès

## 📝 Notes importantes

1. **Le problème vient du fait que le code n'est pas encore déployé**
   - Le code local est correct ✅
   - Vercel utilise encore l'ancienne version ❌
   - Il faut déployer pour que le fix prenne effet

2. **Si l'erreur persiste après déploiement**
   - Vérifier le cache Vercel
   - Vérifier que le bon commit est déployé
   - Vérifier les logs de build pour des erreurs

3. **Le fix est robuste**
   - L'inlining évite complètement le problème de résolution de module
   - Pas de dépendance externe au runtime
   - Compatible avec tous les environnements ESM

