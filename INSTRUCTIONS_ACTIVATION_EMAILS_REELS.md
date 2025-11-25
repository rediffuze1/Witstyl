# 📧 Instructions pour Activer l'Envoi Réel des Emails

## 🐛 Problème Identifié

Votre fichier `.env` contient :
```bash
NOTIFICATIONS_DRY_RUN=true
```

Cette variable force **tous** les canaux (SMS + Email) en mode DRY RUN, même si `EMAIL_DRY_RUN` n'est pas défini.

## ✅ Solution

### Option 1 : Définir EMAIL_DRY_RUN explicitement (RECOMMANDÉ)

Ajoutez dans votre `.env` :
```bash
# Forcer l'envoi réel des emails (ignorer NOTIFICATIONS_DRY_RUN)
EMAIL_DRY_RUN=false
```

Avec cette configuration :
- ✅ `EMAIL_DRY_RUN=false` → Emails envoyés réellement
- ✅ `NOTIFICATIONS_DRY_RUN=true` → Ignoré pour les emails (mais toujours utilisé pour SMS si `SMS_DRY_RUN` n'est pas défini)

### Option 2 : Utiliser les flags séparés

Remplacez `NOTIFICATIONS_DRY_RUN=true` par :
```bash
# Ancienne variable (dépréciée, à supprimer)
# NOTIFICATIONS_DRY_RUN=true

# Nouvelles variables (recommandées)
SMS_DRY_RUN=true      # SMS en mode test
EMAIL_DRY_RUN=false   # Emails envoyés réellement
```

### Option 3 : Supprimer NOTIFICATIONS_DRY_RUN

Supprimez la ligne `NOTIFICATIONS_DRY_RUN=true` de votre `.env` et ajoutez :
```bash
SMS_DRY_RUN=true      # SMS en mode test (défaut)
# EMAIL_DRY_RUN non défini = false par défaut = envoi réel
```

## 🔧 Configuration Recommandée pour Production

```bash
# Resend Configuration
RESEND_API_KEY=re_your-api-key-here
RESEND_FROM=SalonPilot <noreply@salonpilot.ch>

# SMS Configuration (dry run pour l'instant)
SMS_DRY_RUN=true

# Email Configuration (envoi réel)
EMAIL_DRY_RUN=false

# Ancienne variable (à supprimer si vous utilisez les nouvelles)
# NOTIFICATIONS_DRY_RUN=true
```

## 🧪 Vérification

Après modification du `.env` :

1. **Redémarrer le serveur** :
   ```bash
   pkill -f "tsx server/index.ts"
   npm run dev
   ```

2. **Vérifier les logs au démarrage** :
   ```
   [Notifications] 📧 Email: ✅ ENVOI RÉEL
   [Notifications] 🔧 EMAIL_DRY_RUN: false
   ```

3. **Tester l'envoi d'email** depuis l'interface `/settings` → Notifications

4. **Vérifier les logs serveur** :
   - Vous devriez voir `[Resend] 📧 ENVOI RÉEL D'EMAIL` (pas `[DRY RUN]`)
   - Vous devriez voir la réponse de Resend avec un `Email ID`

5. **Vérifier votre boîte email** ou le dashboard Resend

## ⚠️ Important

- Assurez-vous que le domaine dans `RESEND_FROM` est **vérifié** dans Resend
- Si le domaine n'est pas vérifié, Resend renverra une erreur 422
- L'erreur sera visible dans les logs serveur et la réponse HTTP

## 📝 Résumé

**Pour activer l'envoi réel des emails :**

1. Ajoutez `EMAIL_DRY_RUN=false` dans votre `.env`
2. Redémarrez le serveur
3. Vérifiez les logs au démarrage
4. Testez l'envoi depuis l'interface

**Les emails seront maintenant envoyés réellement via Resend !** ✅



