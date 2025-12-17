# Implémentation : Emails d'annulation (Client + Manager)

## 📋 Vue d'ensemble

Cette implémentation garantit l'envoi systématique de **deux emails** lors de l'annulation d'un rendez-vous :
1. **Email client** : Confirmation d'annulation pour le client
2. **Email manager** : Notification pour le manager/owner

**Cas particulier** : Si `clientEmail === managerEmail`, un seul email fusionné est envoyé (évite la déduplication du provider).

### Garanties

- ✅ **Idempotence** : Pas de doublons même en cas de retry Vercel ou double-click
  - `event_type` distincts : `client_cancel_email` et `manager_cancel_email`
- ✅ **Non-bloquant** : Timebox de 2s max pour chaque email, ne retarde pas la réponse HTTP
- ✅ **Feature flag** : `ENABLE_MANAGER_CANCEL_EMAIL` (activé par défaut)
- ✅ **Logs structurés** : `[CANCEL_EMAIL]` et `[MANAGER_EMAIL]` avec détails complets
- ✅ **Gestion fusion** : Détection automatique de `clientEmail === managerEmail` → email fusionné

## 🔧 Fichiers modifiés

### 1. Migration SQL
**Fichier** : `sql/add_notification_events.sql`

Crée la table `notification_events` pour garantir l'idempotence :
- Clé unique `(event_type, appointment_id)`
- `event_type` peut être : `'client_cancel_email'` ou `'manager_cancel_email'`
- Index pour performances
- RLS activé avec politique service role

### 2. Service d'annulation
**Fichier** : `server/core/appointments/AppointmentService.ts`

**Modifications** :
- **Toujours envoyer l'email manager** (pas seulement si `cancelledByRole === 'client'`)
- Ajout de la fonction `sendClientCancelEmailWithIdempotence()` avec :
  - `event_type: 'client_cancel_email'`
  - Vérification d'idempotence via `notification_events`
  - Timebox de 2s avec `Promise.race()`
  - Logs structurés `[CANCEL_EMAIL]`
- Ajout de la fonction `sendManagerCancelEmailWithIdempotence()` avec :
  - `event_type: 'manager_cancel_email'`
  - Vérification d'idempotence via `notification_events`
  - Timebox de 2s avec `Promise.race()`
  - Feature flag `ENABLE_MANAGER_CANCEL_EMAIL`
  - Détection de `clientEmail === managerEmail` pour éviter la duplication
  - Logs structurés `[MANAGER_EMAIL]` avec `merged_with_client_email`
- Appels non-bloquants avec `void` + `.catch()` pour éviter les unhandled rejections
- Amélioration de `buildManagerCancellationContext()` avec fallback `RESEND_TO_OVERRIDE`

### 3. Service de notifications
**Fichier** : `server/core/notifications/NotificationService.ts`

**Modifications** :
- **Gestion du cas `clientEmail === managerEmail`** :
  - Détection automatique dans `sendBookingCancellationInfoToManager()`
  - Si même email → appel à `sendMergedCancellationEmail()` (email fusionné avec 2 sections)
  - Si emails différents → envoi séparé normal
- **Email fusionné** (`sendMergedCancellationEmail()`) :
  - Section client : Confirmation d'annulation
  - Section manager : Information manager
  - Metadata Resend : `email_type: 'merged_cancel'`, `merged_with_client_email: 'true'`
- **Emails séparés** :
  - Client : Metadata `email_type: 'client_cancel'`
  - Manager : Metadata `email_type: 'manager_cancel'`
- Amélioration des logs dans `sendBookingCancellation()` et `sendBookingCancellationInfoToManager()`
- Sujet d'email conforme : `"Annulation RDV — {client_full_name} — {appointment_date} {appointment_time}"`
- Ajout de l'ID du rendez-vous dans le contenu de l'email

## 🗄️ Migration de la base de données

### Étape 1 : Appliquer la migration

**Option A : Via Supabase Dashboard**
1. Ouvrir Supabase Dashboard → SQL Editor
2. Copier le contenu de `sql/add_notification_events.sql`
3. Exécuter la requête

**Option B : Via MCP (si configuré)**
```bash
# La migration sera appliquée automatiquement lors du déploiement
```

### Étape 2 : Vérifier la création

```sql
-- Vérifier que la table existe
SELECT * FROM notification_events LIMIT 1;

-- Vérifier la contrainte unique
SELECT event_type, appointment_id, COUNT(*) 
FROM notification_events 
GROUP BY event_type, appointment_id 
HAVING COUNT(*) > 1;
-- Devrait retourner 0 lignes
```

## ⚙️ Configuration

### Feature Flag

Par défaut, l'envoi d'email au manager est **activé**.

Pour désactiver :
```bash
# Dans Vercel ou .env
ENABLE_MANAGER_CANCEL_EMAIL=false
```

### Fallback Email (Dev)

Si l'email du manager n'est pas trouvé, le système utilise `RESEND_TO_OVERRIDE` en dev :
```bash
RESEND_TO_OVERRIDE=dev@example.com
```

## 📧 Format de l'email manager

**Sujet** : `Annulation RDV — {client_full_name} — {appointment_date} {appointment_time}`

**Contenu** :
- Client : {client_full_name}
- Service : {service_name}
- Coiffeur·euse : {stylist_name}
- Date : {appointment_date}
- Heure : {appointment_time}
- Annulé par : Client
- Raison : {cancellation_reason} (si fournie)
- Salon : {salon_name}
- ID du rendez-vous : {appointment_id}

## 🔍 Logs

### Logs attendus lors d'une annulation (emails différents)

```
[CANCEL] ✅ Appointment cancelled in DB: { appointmentId, cancelledByRole, updatedId }
[CANCEL_EMAIL] 📧 Preparing to send: { clientEmail, appointmentId }
[CANCEL_EMAIL] ✅ Sent successfully: { appointmentId, to: clientEmail }
[MANAGER_EMAIL] 📧 Preparing to send: { salonId, managerEmail, appointmentId, merged_with_client_email: false }
[MANAGER_EMAIL] 📤 Sending email: { to, subject, bookingId }
[MANAGER_EMAIL] ✅ Sent successfully: { appointmentId, to: managerEmail, merged_with_client_email: false }
```

### Logs attendus lors d'une annulation (même email)

```
[CANCEL] ✅ Appointment cancelled in DB: { appointmentId, cancelledByRole, updatedId }
[CANCEL_EMAIL] 🔀 Same email as manager, client email will be merged: { email, appointmentId }
[MANAGER_EMAIL] 🔀 Same email as client, manager email will be merged: { email, appointmentId }
[MANAGER_EMAIL] 📧 Preparing to send: { salonId, managerEmail, appointmentId, merged_with_client_email: true }
[MANAGER_EMAIL] 📤 Sending merged email: { to, subject, bookingId, merged_with_client_email: true }
[MANAGER_EMAIL] ✅ Merged email sent successfully: { to, appointmentId, merged_with_client_email: true }
```

### Cas d'idempotence (déjà envoyé)

```
[CANCEL_EMAIL] ⏭️ Skipped (already sent): { appointmentId, eventType: 'client_cancel_email' }
[MANAGER_EMAIL] ⏭️ Skipped (already sent): { appointmentId, eventType: 'manager_cancel_email' }
```

### Cas de timeout (non-bloquant)

```
[CANCEL_EMAIL] ⏱️ Timeout after 2s (non-blocking): { appointmentId, to: clientEmail }
[MANAGER_EMAIL] ⏱️ Timeout after 2s (non-blocking): { appointmentId, to: managerEmail }
```

### Cas d'erreur

```
[CANCEL_EMAIL] ❌ Failed to send: { appointmentId, to: clientEmail, error }
[MANAGER_EMAIL] ❌ Failed to send: { appointmentId, to: managerEmail, error }
```

## 🧪 Tests

### Test 1 : Annulation normale (emails différents)

1. Se connecter en tant que client
2. Créer un rendez-vous avec un client ayant un email différent du manager
3. Annuler le rendez-vous
4. Vérifier :
   - ✅ Email client reçu (sujet : "Annulation de votre rendez-vous")
   - ✅ Email manager reçu (sujet : "Annulation RDV — ...")
   - ✅ Logs `[CANCEL_EMAIL] ✅ Sent successfully`
   - ✅ Logs `[MANAGER_EMAIL] ✅ Sent successfully`
   - ✅ 2 lignes créées dans `notification_events` : `client_cancel_email` et `manager_cancel_email`

### Test 2 : Annulation avec même email (fusion)

1. Créer un rendez-vous où `clientEmail === managerEmail`
2. Annuler le rendez-vous
3. Vérifier :
   - ✅ **Un seul email** reçu (fusionné)
   - ✅ Email contient 2 sections : client + manager
   - ✅ Logs `[CANCEL_EMAIL] 🔀 Same email as manager, client email will be merged`
   - ✅ Logs `[MANAGER_EMAIL] ✅ Merged email sent successfully` avec `merged_with_client_email: true`
   - ✅ 1 seule ligne dans `notification_events` : `manager_cancel_email` (client_cancel_email est skip)

### Test 3 : Idempotence (double annulation)

1. Annuler un rendez-vous déjà annulé (ou rejouer l'annulation)
2. Vérifier :
   - ✅ Logs `[CANCEL_EMAIL] ⏭️ Skipped (already sent)` et `[MANAGER_EMAIL] ⏭️ Skipped (already sent)`
   - ✅ Pas de doublon dans `notification_events`
   - ✅ Pas de deuxième email envoyé

### Test 4 : Endpoint de test

**Endpoint** : `POST /api/owner/notifications/send-test-cancel-both?sameEmail=true`

```bash
curl -X POST https://witstyl.vercel.app/api/owner/notifications/send-test-cancel-both?sameEmail=true \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{"testEmail": "test@example.com"}'
```

**Résultat attendu** :
```json
{
  "ok": true,
  "sameEmail": true,
  "decision": "merged",
  "results": {
    "clientEmail": { "success": true, "sent": false },
    "managerEmail": { "success": true, "sent": true, "merged": true }
  }
}
```

### Test 5 : Feature flag

1. Définir `ENABLE_MANAGER_CANCEL_EMAIL=false`
2. Annuler un rendez-vous
3. Vérifier :
   - ✅ Email client envoyé normalement
   - ✅ Log `[MANAGER_EMAIL] ⚠️ Feature disabled`
   - ✅ Pas d'email manager envoyé

## 🔐 Sécurité

- ✅ RLS activé sur `notification_events` (service role uniquement)
- ✅ Vérification des permissions client avant annulation (existant)
- ✅ Pas d'exposition de données sensibles dans les logs

## 📝 Notes importantes

1. **Toujours envoyer les 2 emails** : L'email manager est maintenant envoyé **toujours**, pas seulement si `cancelledByRole === 'client'`. Cela garantit que le manager est informé de toutes les annulations.

2. **Gestion fusion** : Si `clientEmail === managerEmail`, un seul email fusionné est envoyé pour éviter la déduplication du provider. L'email contient 2 sections distinctes (client + manager).

3. **Idempotence séparée** : Les 2 emails ont des `event_type` distincts (`client_cancel_email` et `manager_cancel_email`), donc l'idempotence fonctionne indépendamment pour chaque type.

4. **Non-bloquant** : Les 2 emails sont envoyés en `void` avec `.catch()`, donc même en cas d'erreur, la réponse HTTP au client n'est pas retardée.

5. **Idempotence** : Si la table `notification_events` n'existe pas encore (migration non appliquée), le système continue quand même et log une erreur. Les emails seront envoyés mais sans protection contre les doublons.

6. **Fallback email** : L'email du manager est récupéré dans cet ordre :
   - `salons.email`
   - `users.email` (via `salons.user_id`)
   - `RESEND_TO_OVERRIDE` (dev uniquement)

7. **Metadata Resend** : Les emails incluent des metadata pour éviter la déduplication :
   - Client : `email_type: 'client_cancel'`
   - Manager : `email_type: 'manager_cancel'`
   - Fusionné : `email_type: 'merged_cancel'`, `merged_with_client_email: 'true'`

## 🚀 Déploiement

1. Appliquer la migration SQL (`sql/add_notification_events.sql`)
2. Déployer le code modifié
3. Vérifier les logs lors d'une première annulation
4. (Optionnel) Configurer `ENABLE_MANAGER_CANCEL_EMAIL` si besoin

## ✅ Checklist de validation

- [ ] Migration SQL appliquée
- [ ] Table `notification_events` créée avec contrainte unique
- [ ] Test d'annulation client → email manager reçu
- [ ] Test d'idempotence → pas de doublon
- [ ] Logs structurés visibles dans Vercel
- [ ] Feature flag fonctionnel (si testé)
- [ ] Timeout non-bloquant vérifié (si testé)

