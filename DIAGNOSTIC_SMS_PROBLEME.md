# Diagnostic du Problème d'Envoi SMS

## 🔍 Problème Identifié

Aucun SMS n'est envoyé malgré la configuration `SMS_DRY_RUN=false` et la présence de crédits sur SMSup.

## ✅ Ce qui a été Vérifié et Corrigé

### 1. Configuration des Variables d'Environnement
- ✅ `SMS_DRY_RUN=false` est bien configuré dans `.env`
- ✅ `SMSUP_API_TOKEN` est défini
- ✅ `SMSUP_SENDER=Witstyl-Pierre` est configuré
- ✅ Le serveur a été redémarré

### 2. Settings de Notifications
- ✅ Les templates SMS sont configurés dans `notification_settings`
- ✅ Les clients ont des numéros de téléphone
- ✅ Les rendez-vous sont créés avec succès

### 3. Format de l'API SMSup
- ❌ **PROBLÈME TROUVÉ** : L'API SMSup attend du **XML**, pas du JSON
- ✅ **CORRIGÉ** : Le code a été modifié pour envoyer du XML au lieu de JSON

### 4. Format d'Authentification
- ❌ **PROBLÈME TROUVÉ** : L'API SMSup utilise `login` et `password`, pas `key`
- ✅ **CORRIGÉ** : Le code a été modifié pour utiliser `login` et `password`
- ⚠️ **PROBLÈME RESTANT** : L'API retourne toujours "Le login et le mot de passe ne correspondent pas"

## 🚨 Problème Actuel

Avant refonte, l'API SMSup retournait l'erreur suivante :
```xml
<response>
  <status>-1</status>
  <message>Le login et le mot de passe ne correspondent pas</message>
  <details>Utilisateur ou mot de passe incorrect</details>
</response>
```

### Analyse

1. **Format XML** : ✅ Corrigé - L'API accepte maintenant le format XML
2. **Authentification** : ❌ **PROBLÈME** - Le login/password ne correspond pas

### Résolution

- L'API moderne utilise un **token** (`Authorization: Bearer <token>`) envoyé sur `https://api.smsup.ch/send`.
- Le payload peut être `application/x-www-form-urlencoded` avec `text`, `to`, `sender`.
- La réponse JSON contient `status` (1 = OK, < 0 = erreur).
- Les variables `SMSUP_LOGIN` / `SMSUP_PASSWORD` sont conservées uniquement pour rétro-compatibilité (logs), mais ne sont plus utilisées pour authentifier les envois.

## 📋 Format Actuel du Code

Le code envoie maintenant une requête POST vers `https://api.smsup.ch/send` avec :

- Header `Authorization: Bearer <SMSUP_API_TOKEN>`
- Body `application/x-www-form-urlencoded` contenant `text`, `to`, `sender`
- Header `Accept: application/json` pour parser la réponse (`status`, `ticket`, etc.)

## 🧪 Test Direct

Pour tester l'envoi SMS directement :
```bash
npx tsx scripts/test-sms-direct.ts +41791338240
```

## 📝 Prochaines Étapes

1. **Créer un token API** dans le dashboard SMSup (`Tokens API`)
2. **Ajouter `SMSUP_API_TOKEN`** et `SMSUP_SENDER` dans `.env`
3. **Redémarrer le serveur** (`npm run dev`)
4. **Tester avec** `npx tsx scripts/test-sms-direct.ts +4179XXXXXXX`
5. **Contrôler les logs** `[SmsUp] ENVOI RÉEL` + la réception du SMS réel

## 🔗 Ressources

- Documentation SMSup : https://www.smsup.ch/api/
- Dashboard SMSup : https://www.smsup.ch/
- Script de test : `scripts/test-sms-direct.ts`

