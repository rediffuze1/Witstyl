# Fix : Erreur Cannot find module '/var/task/server/core/notifications/utils' sur Vercel

## 🎯 Problème identifié

**Erreur en production Vercel :**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/core/notifications/utils' 
imported from /var/task/server/core/notifications/NotificationService.js
```

**Cause racine :**
- Import dynamique `await import('./utils.js')` qui ne fonctionne pas dans Vercel Serverless ESM
- Même avec import statique `import { ... } from './utils.js'`, Vercel ne résout pas correctement le module après compilation TypeScript
- Problème de résolution de module ESM dans l'environnement Vercel Serverless

## ✅ Solution appliquée

### Stratégie : Inlining de la fonction

Au lieu d'importer `buildAppointmentTemplateContextForTest` depuis `utils.ts`, la fonction a été **inlinée directement** dans `NotificationService.ts` pour éviter tout problème de résolution de module.

### Modifications apportées

**Fichier modifié :** `server/core/notifications/NotificationService.ts`

#### 1. Suppression de l'import problématique
```typescript
// AVANT (causait l'erreur)
import { buildAppointmentTemplateContextForTest } from './utils.js';

// APRÈS (supprimé)
// Plus d'import depuis utils.js
```

#### 2. Inlining de la fonction
```typescript
// AVANT
const templateContext = buildAppointmentTemplateContextForTest(salonId, salonName);

// APRÈS (inliné)
const testDate = new Date();
testDate.setDate(testDate.getDate() + 1);
testDate.setHours(15, 0, 0, 0);
const formattedDate = format(testDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
const formattedTime = format(testDate, "HH:mm", { locale: fr });
const templateContext: AppointmentTemplateContext = {
  clientFirstName: 'TestClient',
  clientFullName: 'Test Client',
  appointmentDate: formattedDate,
  appointmentTime: formattedTime,
  serviceName: 'Coupe Test',
  salonName: salonName || 'Salon de Test',
  stylistName: 'Coiffeur·euse Test',
};
```

### Avantages de cette approche

1. ✅ **Pas de dépendance externe** : Plus besoin de résoudre `utils.js` au runtime
2. ✅ **Compatible ESM** : Pas de problème de résolution de module
3. ✅ **Robuste sur Vercel** : Fonctionne dans tous les environnements Serverless
4. ✅ **Minimal** : Changement localisé, pas de refactor massif
5. ✅ **Même fonctionnalité** : Comportement identique à l'import

## 📋 Checklist de vérification en production

### 1. Vérifier le build Vercel

- [ ] Le build Vercel se termine sans erreur
- [ ] Aucune erreur TypeScript dans les logs de build
- [ ] Le fichier `server/core/notifications/NotificationService.js` est généré

### 2. Tester l'endpoint en production

**Endpoint à tester :** `POST /api/owner/notifications/send-test-email`

**Commande curl :**
```bash
curl -X POST https://witstyl.vercel.app/api/owner/notifications/send-test-email \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{"testEmail": "test@example.com"}'
```

**Résultat attendu :**
- ✅ Status 200
- ✅ Réponse JSON avec `ok: true`
- ✅ Logs Vercel montrent `[NotificationService] ✅ EMAIL DE TEST ENVOYÉ AVEC SUCCÈS`
- ✅ Aucune erreur `ERR_MODULE_NOT_FOUND`

### 3. Vérifier les logs Vercel

Dans les logs Vercel, chercher :
- ✅ `[POST /api/owner/notifications/send-test-email] ✅ Route appelée`
- ✅ `[NotificationService] 📧 Email de test:`
- ✅ `[NotificationService] ✅ EMAIL DE TEST ENVOYÉ AVEC SUCCÈS`
- ❌ **Aucune** erreur `Cannot find module '/var/task/server/core/notifications/utils'`

### 4. Test depuis l'interface

1. Se connecter en tant qu'owner
2. Aller dans `/settings`
3. Section "Envoyer un email de test"
4. Entrer une adresse email
5. Cliquer sur "Envoyer"
6. ✅ Vérifier que l'email est envoyé sans erreur

## 🔍 Diagnostic si l'erreur persiste

Si l'erreur persiste après déploiement :

1. **Vérifier que le code est bien déployé**
   - Vérifier le commit déployé sur Vercel
   - Vérifier que le fichier modifié est bien dans le build

2. **Vérifier les logs de build Vercel**
   - Chercher des erreurs TypeScript
   - Vérifier que `NotificationService.ts` est bien compilé

3. **Vérifier la structure du bundle**
   - Le fichier `server/core/notifications/NotificationService.js` doit exister
   - Il ne doit **pas** contenir d'import vers `./utils.js`

4. **Vérifier les imports restants**
   - Chercher dans le code s'il y a d'autres imports depuis `utils.js` qui pourraient causer problème

## 📝 Notes techniques

### Pourquoi l'inlining plutôt qu'un fix d'import ?

1. **Robustesse** : L'inlining évite complètement le problème de résolution de module
2. **Simplicité** : Pas besoin de modifier la configuration TypeScript/Vercel
3. **Performance** : Pas d'overhead d'import au runtime
4. **Maintenabilité** : La fonction est simple et ne change pas souvent

### Alternative (non appliquée)

Si on voulait garder l'import, il faudrait :
1. Vérifier que `utils.ts` est bien inclus dans le build Vercel
2. S'assurer que l'extension `.js` correspond au fichier généré
3. Potentiellement modifier la configuration TypeScript pour forcer l'inclusion

Mais l'inlining est plus simple et plus robuste pour ce cas d'usage.

## ✅ Validation finale

- [x] Code modifié et testé localement
- [x] Aucune erreur de lint
- [x] Imports nécessaires (`format`, `fr`) déjà présents dans le fichier
- [x] Fonctionnalité identique à l'import original
- [ ] Déployé sur Vercel et testé en production
- [ ] Logs Vercel vérifiés
- [ ] Email de test envoyé avec succès

