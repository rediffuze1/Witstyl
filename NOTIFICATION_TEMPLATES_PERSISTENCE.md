# Persistance des Templates de Notifications

## Vue d'ensemble

Ce document explique comment fonctionne la persistance des templates de notifications (email et SMS) dans Witstyl, et comment garantir que les modifications sont correctement sauvegardées en base de données.

## Architecture

### Stockage

Les templates sont stockés dans la table Supabase `notification_settings` avec les colonnes suivantes :

- `confirmation_email_subject` (TEXT) : Sujet de l'email de confirmation
- `confirmation_email_text` (TEXT) : Contenu texte simple de l'email (sans HTML)
- `confirmation_email_html` (TEXT) : HTML généré automatiquement depuis le texte
- `confirmation_sms_text` (TEXT) : Template SMS de confirmation
- `reminder_sms_text` (TEXT) : Template SMS de rappel
- `reminder_offset_hours` (INTEGER) : Délai d'envoi du rappel (12, 24 ou 48 heures)

**Important** : Le HTML est généré automatiquement côté serveur à partir du texte simple. Le manager ne modifie que le texte, jamais le HTML directement.

### Cycle GET / PUT

#### GET `/api/owner/notification-settings`

1. **Backend** (`server/index.ts`) :
   - Vérifie l'authentification owner
   - Normalise le `salonId` (ajoute le préfixe "salon-" si nécessaire)
   - Appelle `NotificationSettingsRepository.getSettings(salonId)`

2. **Repository** (`NotificationSettingsRepository.ts`) :
   - Vérifie le cache in-memory (TTL: 5 minutes)
   - Si cache valide → retourne les valeurs en cache
   - Sinon → interroge Supabase
   - Si aucune ligne n'existe → crée une ligne avec les valeurs par défaut
   - Si une ligne existe → retourne **EXACTEMENT** ce qui est en DB
   - ⚠️ **Logique de fallback** : Les valeurs par défaut ne sont utilisées QUE si la valeur en DB est `NULL` ou `undefined`. Une chaîne vide `""` est considérée comme une valeur valide et est retournée telle quelle.

3. **Frontend** (`NotificationSettings.tsx`) :
   - Utilise `useQuery` avec `staleTime: 0` et `cacheTime: 0` pour forcer le rechargement depuis le serveur
   - Met à jour le state local avec les valeurs reçues de l'API
   - Affiche les valeurs dans le formulaire

#### PUT `/api/owner/notification-settings`

1. **Frontend** :
   - Récupère les valeurs actuelles du formulaire (state local)
   - Envoie un payload JSON avec :
     - `confirmationEmailSubject`
     - `confirmationEmailText`
     - `confirmationSmsText`
     - `reminderSmsText`
     - `reminderOffsetHours`

2. **Backend** :
   - Valide les champs (types, longueurs max)
   - Appelle `NotificationSettingsRepository.updateSettings(salonId, updateData)`

3. **Repository** :
   - Invalide le cache pour ce salon
   - Si la ligne existe → UPDATE
   - Si la ligne n'existe pas → INSERT avec les valeurs fournies + defaults pour les champs manquants
   - Génère automatiquement `confirmation_email_html` depuis `confirmation_email_text`
   - Sauvegarde en DB
   - Met à jour le cache avec les nouvelles valeurs
   - Retourne les settings mis à jour

4. **Frontend** :
   - Met à jour le state local avec les valeurs retournées par le serveur
   - Invalide et refetch la query pour s'assurer d'avoir les dernières valeurs

## Points critiques

### 1. Distinction NULL vs chaîne vide

Le code distingue clairement :
- `NULL` ou `undefined` → utilise le fallback (valeur par défaut)
- `""` (chaîne vide) → retourne `""` (valeur valide sauvegardée)

Cette distinction permet de :
- Sauvegarder une template vide si l'utilisateur le souhaite
- Ne pas écraser une valeur vide avec un fallback

### 2. Cache in-memory

Le repository utilise un cache in-memory avec un TTL de 5 minutes pour améliorer les performances. Le cache est :
- **Invalidé** après chaque `updateSettings()`
- **Invalidé** avant chaque mise à jour dans `getSettings()`
- **Loggé** pour faciliter le débogage

Si vous rencontrez des problèmes de persistance, vous pouvez :
- Vérifier les logs pour voir si le cache est utilisé
- Réduire le TTL du cache
- Désactiver temporairement le cache pour le débogage

### 3. Pas de dépendance à localStorage/cookies

**Important** : Les templates ne sont **jamais** stockées dans `localStorage` ou les cookies. Toute la persistance se fait via Supabase.

Le frontend utilise `staleTime: 0` et `cacheTime: 0` dans `useQuery` pour forcer le rechargement depuis le serveur à chaque fois, évitant ainsi d'utiliser un cache local qui pourrait contenir de vieilles valeurs.

### 4. Génération automatique du HTML

Le HTML est généré automatiquement côté serveur à partir du texte simple :
- Lors de la création de settings par défaut
- Lors de la mise à jour via `updateSettings()`
- Si le HTML est manquant lors d'un `getSettings()`

Le manager ne modifie jamais le HTML directement.

## Suppression de l'historique de versions

L'historique de versions des templates a été complètement supprimé :

- ✅ Plus aucun bloc UI "Historique des versions" dans `NotificationSettings.tsx`
- ✅ Plus aucun endpoint API pour l'historique (`/api/owner/notification-templates/versions`)
- ✅ Plus aucun appel à `createVersionFromCurrentSettings` lors des sauvegardes

**Note** : La table `notification_template_versions` peut rester en base de données (non utilisée), mais aucune logique de l'application ne l'utilise plus.

## Tests de persistance

### Test 1 : Modification simple

1. Modifier le sujet et le contenu de l'email dans `/settings`
2. Cliquer sur "Enregistrer les paramètres"
3. Recharger la page (`Cmd+R` / `F5`)
4. ✅ **Résultat attendu** : Les mêmes valeurs doivent s'afficher

### Test 2 : Suppression cookies / localStorage

1. Sauvegarder une template personnalisée
2. Supprimer **tous les cookies / localStorage** du site (DevTools → Application → Clear storage)
3. Se déconnecter
4. Se reconnecter en owner
5. Aller sur `/settings`
6. ✅ **Résultat attendu** : La template email doit être **celle en DB**, pas une valeur vide ou par défaut

### Test 3 : SMS non régressé

1. Modifier la template SMS de confirmation
2. Sauvegarder
3. Se déconnecter / supprimer cookies
4. Se reconnecter
5. Aller sur `/settings`
6. ✅ **Résultat attendu** : La template SMS doit être identique à celle sauvegardée

## Logs de débogage

Le système inclut des logs détaillés pour faciliter le débogage :

### Backend

- `[NotificationSettings] getSettings - Valeurs brutes depuis DB` : Affiche ce qui est lu depuis Supabase
- `[NotificationSettings] getSettings - Valeurs retournées` : Affiche ce qui est retourné au client
- `[NotificationSettings] updateSettings - Sauvegarde confirmationEmailText` : Affiche ce qui est sauvegardé
- `[NotificationSettings] updateSettings - Valeurs sauvegardées en DB` : Confirme ce qui est en DB après sauvegarde

### Frontend

- `[NotificationSettings] Données reçues de l'API GET` : Affiche ce qui est reçu depuis l'API
- `[NotificationSettings] useEffect - Données chargées depuis l'API` : Affiche ce qui est mis dans le state
- `[NotificationSettings] handleSave - Données à sauvegarder` : Affiche ce qui est envoyé au serveur
- `[NotificationSettings] onSuccess - Données reçues du serveur` : Affiche ce qui est retourné après sauvegarde

## Résolution de problèmes

### Problème : La template revient à une valeur par défaut après déconnexion

**Causes possibles** :
1. Le cache retourne de vieilles valeurs → Vérifier les logs pour voir si le cache est utilisé
2. La valeur n'est pas sauvegardée en DB → Vérifier les logs `updateSettings` pour confirmer la sauvegarde
3. La logique de fallback s'applique incorrectement → Vérifier que la valeur en DB n'est pas `NULL`

**Solution** :
- Vérifier les logs backend pour voir ce qui est lu depuis la DB
- Vérifier les logs frontend pour voir ce qui est reçu depuis l'API
- Vérifier directement dans Supabase que la valeur est bien présente dans `notification_settings`

### Problème : La template SMS persiste mais pas l'email

**Causes possibles** :
1. Le champ `confirmation_email_text` n'est pas inclus dans le payload PUT → Vérifier les logs `handleSave`
2. Le champ n'est pas mappé correctement dans le repository → Vérifier `updateSettings`
3. La colonne n'existe pas en DB → Exécuter la migration `sql/add_confirmation_email_text.sql`

**Solution** :
- Vérifier que `confirmationEmailText` est bien présent dans le payload envoyé
- Vérifier que le repository sauvegarde bien `confirmation_email_text` en DB
- Vérifier que la colonne existe dans Supabase

## Fichiers modifiés

- `server/core/notifications/NotificationSettingsRepository.ts` : Logique de persistance et cache
- `server/index.ts` : Endpoints GET et PUT `/api/owner/notification-settings`
- `client/src/components/NotificationSettings.tsx` : Composant React pour la configuration
- `sql/add_confirmation_email_text.sql` : Migration pour ajouter la colonne `confirmation_email_text`

## Conclusion

Le système de persistance des templates est maintenant robuste et ne dépend plus de `localStorage` ou des cookies. Toutes les valeurs sont stockées en base de données et rechargées depuis le serveur à chaque connexion, garantissant que les modifications sont toujours préservées.



