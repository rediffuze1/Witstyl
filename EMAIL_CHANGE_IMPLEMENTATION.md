# Implémentation : Changement d'email de connexion avec confirmation

## 📋 Vue d'ensemble

Cette implémentation permet de changer l'email de connexion Supabase Auth lorsqu'un salon modifie son email dans les paramètres, avec un flow sécurisé et confirmé.

### Garanties de sécurité

- ✅ **Jamais de modification directe** de l'email Supabase Auth sans confirmation
- ✅ **Jamais de blocage** de l'utilisateur hors de son compte
- ✅ **Compatible** Vercel + Supabase Auth
- ✅ **Idempotence** : pas de doublons même en cas de retry

## 🔧 Modifications apportées

### 1. Migration SQL

**Fichier** : `sql/add_email_confirmation_to_salons.sql`

Ajoute deux colonnes à la table `salons` :
- `pending_email` : Email en attente de confirmation
- `email_verified_at` : Timestamp de la dernière confirmation

### 2. Endpoint de changement d'email

**Route** : `PATCH /api/owner/salon/email`

**Logique** :
1. Valide le format email
2. Si `newEmail === currentAuthEmail` → mise à jour directe de `salon.email`
3. Sinon :
   - Sauvegarde `pending_email = newEmail`
   - Ne modifie **pas** l'email Auth directement
   - Déclenche la confirmation Supabase Auth via `admin.updateUserById()`
   - Log `[EMAIL_CHANGE][CONFIRMATION_SENT]`

**Réponse** :
```json
{
  "success": true,
  "message": "Un email de confirmation a été envoyé. Votre email de connexion sera mis à jour après validation.",
  "pending": true,
  "pendingEmail": "nouveau@email.com"
}
```

### 3. Route de confirmation

**Route** : `GET /auth/confirm-email`

**Logique** :
1. Vérifie que l'utilisateur a bien confirmé via Supabase Auth
2. Récupère tous les salons avec `pending_email`
3. Vérifie que l'email Auth correspond à `pending_email`
4. Si OK :
   - Copie `pending_email → salon.email`
   - `pending_email = null`
   - `email_verified_at = now()`
   - Log `[EMAIL_CHANGE][CONFIRMED]`
5. Redirige vers `/settings?emailConfirmed=true`

**Réponse HTML** : Page de confirmation avec redirection automatique

## 🔍 Logs structurés

### Logs attendus

**Demande de changement** :
```
[EMAIL_CHANGE][REQUEST] 📧 Demande de changement d'email
[EMAIL_CHANGE][REQUEST] ✅ Même email que Auth, mise à jour directe salon.email
// OU
[EMAIL_CHANGE][REQUEST] 📝 Nouvel email différent, sauvegarde pending_email et confirmation
[EMAIL_CHANGE][CONFIRMATION_SENT] 📤 Déclenchement confirmation Supabase Auth
[EMAIL_CHANGE][CONFIRMATION_SENT] ✅ Confirmation envoyée
```

**Confirmation** :
```
[EMAIL_CHANGE][CONFIRMED] 🔗 Callback confirmation email
[EMAIL_CHANGE][CONFIRMED] ✅ Token vérifié
[EMAIL_CHANGE][CONFIRMED] 📝 Synchronisation email
[EMAIL_CHANGE][CONFIRMED] ✅ Email confirmé et synchronisé
```

## 🗄️ Migration de la base de données

### Étape 1 : Appliquer la migration

**Option A : Via Supabase Dashboard**
1. Ouvrir Supabase Dashboard → SQL Editor
2. Copier le contenu de `sql/add_email_confirmation_to_salons.sql`
3. Exécuter la requête

**Option B : Via MCP (si configuré)**
```bash
# La migration sera appliquée automatiquement lors du déploiement
```

### Étape 2 : Vérifier la création

```sql
-- Vérifier que les colonnes existent
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'salons' 
AND column_name IN ('pending_email', 'email_verified_at');

-- Vérifier les salons avec pending_email
SELECT id, email, pending_email, email_verified_at 
FROM salons 
WHERE pending_email IS NOT NULL;
```

## ⚙️ Configuration

### Variables d'environnement

- `SUPABASE_URL` : URL du projet Supabase (requis)
- `SUPABASE_SERVICE_ROLE_KEY` : Clé service role (requis)
- `SUPABASE_ANON_KEY` : Clé anonyme (requis pour la route de confirmation)
- `APP_URL` ou `VERCEL_URL` : URL de l'application pour les redirections

**Note** : `VERCEL_URL` est automatiquement défini par Vercel en production.

## 📧 Flow utilisateur

### Scénario 1 : Email identique à l'email Auth

1. Utilisateur modifie l'email dans `/settings`
2. `newEmail === currentAuthEmail`
3. ✅ Mise à jour directe de `salon.email`
4. Pas de confirmation nécessaire

### Scénario 2 : Nouvel email différent

1. Utilisateur modifie l'email dans `/settings`
2. `newEmail !== currentAuthEmail`
3. ✅ `pending_email` sauvegardé
4. ✅ Email de confirmation envoyé par Supabase Auth
5. Utilisateur clique sur le lien dans l'email
6. ✅ Supabase Auth met à jour l'email Auth
7. ✅ Callback `/auth/confirm-email` synchronise `pending_email → salon.email`
8. ✅ Redirection vers `/settings?emailConfirmed=true`

## 🧪 Tests

### Test 1 : Changement avec même email

```bash
PATCH /api/owner/salon/email
Body: { "email": "current@email.com" }  # Même que l'email Auth

# Résultat attendu :
# - salon.email mis à jour directement
# - Pas de pending_email
# - Pas d'email de confirmation envoyé
```

### Test 2 : Changement avec nouvel email

```bash
PATCH /api/owner/salon/email
Body: { "email": "new@email.com" }

# Résultat attendu :
# - pending_email = "new@email.com"
# - Email de confirmation envoyé par Supabase
# - Utilisateur peut toujours se connecter avec l'ancien email
```

### Test 3 : Confirmation

1. Cliquer sur le lien dans l'email Supabase
2. Vérifier :
   - ✅ Redirection vers `/auth/confirm-email`
   - ✅ `salon.email = newEmail`
   - ✅ `pending_email = null`
   - ✅ `email_verified_at` mis à jour
   - ✅ Redirection vers `/settings?emailConfirmed=true`

### Test 4 : Email non confirmé

1. Demander un changement d'email
2. **Ne pas** cliquer sur le lien
3. Vérifier :
   - ✅ Utilisateur peut toujours se connecter avec l'ancien email
   - ✅ `pending_email` reste en attente
   - ✅ Aucun impact sur l'accès

### Test 5 : Email invalide

```bash
PATCH /api/owner/salon/email
Body: { "email": "invalid-email" }

# Résultat attendu :
# - Status 400
# - Message d'erreur "Format d'email invalide"
# - Aucune modification en base
```

## 🔐 Sécurité

### Garanties

1. **Pas de modification directe** : L'email Auth n'est jamais modifié sans confirmation
2. **Pas de blocage** : L'utilisateur peut toujours se connecter avec l'ancien email
3. **Vérification** : La route de confirmation vérifie que `pending_email` correspond à l'email Auth
4. **Idempotence** : Pas de doublons même en cas de retry
5. **RLS** : Les colonnes `pending_email` et `email_verified_at` sont protégées par RLS existante

### Edge cases gérés

- ✅ Email identique à l'email Auth → mise à jour directe
- ✅ Email non confirmé → aucun impact, utilisateur peut toujours se connecter
- ✅ Email invalide → validation côté serveur
- ✅ Token expiré → message d'erreur clair
- ✅ Aucune demande en attente → message d'erreur clair
- ✅ Email déjà confirmé → message de succès

## 📝 Notes importantes

1. **Supabase Auth** : Utilise `admin.updateUserById()` avec `email_confirm: false` pour déclencher l'email de confirmation. Supabase envoie automatiquement l'email.

2. **Route de confirmation** : La route `/auth/confirm-email` vérifie tous les salons avec `pending_email` et trouve celui dont l'email Auth correspond. Cette approche est nécessaire car Supabase Auth ne fournit pas directement le userId dans le callback.

3. **Redirection** : Après confirmation, l'utilisateur est redirigé vers `/settings?emailConfirmed=true` pour afficher un message de succès.

4. **Compatibilité** : Le système fonctionne avec les sessions Express existantes et Supabase Auth.

## 🚀 Déploiement

1. Appliquer la migration SQL (`sql/add_email_confirmation_to_salons.sql`)
2. Déployer le code modifié
3. Vérifier les variables d'environnement (`APP_URL` ou `VERCEL_URL`)
4. Tester le flow complet :
   - Demander un changement d'email
   - Recevoir l'email de confirmation
   - Cliquer sur le lien
   - Vérifier la synchronisation

## ✅ Checklist de validation

- [ ] Migration SQL appliquée
- [ ] Colonnes `pending_email` et `email_verified_at` créées
- [ ] Endpoint `PATCH /api/owner/salon/email` fonctionnel
- [ ] Route `GET /auth/confirm-email` fonctionnelle
- [ ] Test changement avec même email → mise à jour directe
- [ ] Test changement avec nouvel email → confirmation envoyée
- [ ] Test confirmation → synchronisation réussie
- [ ] Test email non confirmé → utilisateur peut toujours se connecter
- [ ] Logs structurés visibles dans Vercel
- [ ] Redirection après confirmation fonctionnelle

## 🔄 Améliorations futures (optionnel)

1. **Token temporaire** : Stocker un token temporaire dans la base pour identifier plus facilement l'utilisateur dans le callback
2. **Expiration** : Ajouter une expiration pour `pending_email` (ex: 24h)
3. **Annulation** : Permettre d'annuler une demande en attente
4. **UI** : Afficher un badge "⏳ En attente de confirmation" dans `/settings` si `pending_email !== null`

