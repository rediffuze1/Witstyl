# Résolution : SMS en statut "Programmé" qui ne partent pas

## Problème identifié

Vos SMS apparaissent dans le dashboard SMSup avec le statut **"Programmé" (Scheduled)** mais ne sont pas envoyés. Cela signifie que :

1. ✅ L'API SMSup accepte vos requêtes (ticket créé, crédit débité)
2. ❌ L'expéditeur "SalonPilot" n'est pas validé/approuvé
3. ⏳ Les SMS restent en attente jusqu'à validation de l'expéditeur

## Solutions possibles

### Solution 1 : Utiliser un numéro de téléphone comme expéditeur (RECOMMANDÉ)

Au lieu d'utiliser un nom d'expéditeur ("SalonPilot"), utilisez un numéro de téléphone suisse. Les numéros sont généralement validés automatiquement.

**Modification dans `.env` :**

```bash
# Au lieu de :
SMSUP_SENDER=SalonPilot

# Utilisez votre numéro de téléphone (format suisse) :
SMSUP_SENDER=+41791338240
# OU sans le + (selon ce que SMSup accepte) :
SMSUP_SENDER=41791338240
```

**Important :** Vérifiez dans la documentation SMSup si le numéro doit être au format `+41...` ou `41...` ou `079...`.

### Solution 2 : Contacter le support SMSup

Si vous devez absolument utiliser "SalonPilot" comme expéditeur :

1. **Contactez le support SMSup** via leur site web ou email
2. **Demandez la validation de l'expéditeur "SalonPilot"**
3. **Fournissez les informations nécessaires** (votre compte, numéro de téléphone, etc.)

### Solution 3 : Chercher dans d'autres sections du dashboard

L'onglet de validation des expéditeurs peut être dans :

- **"Paramètres"** ou **"Settings"**
- **"Configuration"** ou **"Configuration"**
- **"Mon compte"** ou **"My Account"**
- **"Services"** > **"API SMS"** > sous-section "Expéditeurs"
- **Menu utilisateur** (icône profil) > **"Gestion des expéditeurs"**

### Solution 4 : Vérifier les restrictions du compte

Certains comptes SMSup peuvent avoir des restrictions :
- Compte en attente de vérification
- Compte avec fonctionnalités limitées
- Nécessité d'une mise à niveau du compte

## Test après modification

Une fois que vous avez modifié `SMSUP_SENDER` dans `.env` :

1. **Redémarrez le serveur** :
   ```bash
   npm run dev
   ```

2. **Testez avec le script direct** :
   ```bash
   npx tsx scripts/test-sms-direct.ts +41791338240
   ```

3. **Vérifiez les logs** :
   - Vous devriez voir `status: 1` (succès) au lieu de `status: -8`
   - Le SMS devrait partir immédiatement

4. **Vérifiez dans le dashboard SMSup** :
   - Le statut devrait passer de "Programmé" à "Délivré" rapidement

## Documentation SMSup

Consultez la documentation officielle pour plus d'informations :
- [Documentation SMSup - Expéditeurs](https://doc.smsup.ch/fr/)
- [Documentation SMSup - API](https://doc.smsup.ch/fr/api/sms/envoi/message-unitaire)

## Note importante

Le statut "Programmé" signifie que SMSup a accepté votre SMS mais qu'il attend une validation. Une fois l'expéditeur validé (ou si vous utilisez un numéro), les SMS partiront automatiquement et les prochains SMS auront le statut "Délivré" directement.

