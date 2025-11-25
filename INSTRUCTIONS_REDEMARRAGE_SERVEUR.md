# ⚠️ INSTRUCTIONS IMPORTANTES : Redémarrer le Serveur

## 🎯 Problème

Les routes suivantes retournent 404 :
- `POST /api/owner/notifications/send-test-email`
- `GET /api/owner/notification-templates/versions`

## ✅ Solution

**Le serveur DOIT être redémarré** pour que les nouvelles routes soient prises en compte par Express.

### Étapes à Suivre

1. **Arrêter le serveur actuel** :
   - Dans le terminal où `npm run dev` tourne
   - Appuyer sur `Ctrl+C`
   - Attendre que le processus s'arrête complètement

2. **Redémarrer le serveur** :
   ```bash
   npm run dev
   ```

3. **Vérifier les logs de démarrage** :
   Vous devriez voir ces lignes dans les logs :
   ```
   [SERVER] ✅ POST /api/owner/notifications/send-test-email (ligne 5174)
   [SERVER] ✅ GET /api/owner/notification-templates/versions (ligne 5294)
   [SERVER] ✅ GET /api/owner/notification-templates/versions/:id (ligne 5356)
   [SERVER] ✅ POST /api/owner/notification-templates/versions/:id/restore (ligne 5417)
   ```

4. **Tester depuis l'interface** :
   - Aller sur `http://localhost:5001/settings`
   - Section "Notifications"
   - L'historique doit se charger sans erreur 404
   - Le bouton "Envoyer un email de test" doit fonctionner

## 🧪 Test Rapide

Après redémarrage, tester avec curl (sans auth, devrait retourner 401, PAS 404) :

```bash
# Test GET versions
curl http://localhost:5001/api/owner/notification-templates/versions
# Résultat attendu: {"error":"Non autorisé..."} avec code 401 - PAS 404

# Test POST send-test-email
curl -X POST http://localhost:5001/api/owner/notifications/send-test-email \
  -H "Content-Type: application/json" \
  -d '{"testEmail":"test@example.com"}'
# Résultat attendu: {"error":"Non autorisé..."} avec code 401 - PAS 404
```

Si vous obtenez encore 404, vérifier :
1. Que le serveur s'est bien redémarré (vérifier les logs)
2. Que les routes sont bien listées dans les logs de démarrage
3. Vérifier les logs serveur quand vous appelez les routes depuis le frontend

## 📊 Vérification des Logs

Quand vous appelez les routes depuis le frontend, vous devriez voir dans les logs serveur :

```
[GET /api/owner/notification-templates/versions] ✅ Route appelée
[POST /api/owner/notifications/send-test-email] ✅ Route appelée
```

Si vous voyez plutôt :
```
[404 Middleware] GET /api/owner/notification-templates/versions
```

C'est que le middleware 404 est appelé, donc les routes ne sont pas enregistrées → **le serveur n'a pas été redémarré correctement**.

## ✅ Confirmation

Une fois le serveur redémarré :
- ✅ Plus de 404 dans la console navigateur
- ✅ L'historique des versions se charge
- ✅ Le bouton "Envoyer un email de test" fonctionne
- ✅ Les logs serveur montrent "Route appelée"



