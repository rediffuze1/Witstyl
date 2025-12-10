# Guide de Configuration et Test des Notifications

Ce document explique comment configurer et tester le système de notifications (SMS et Email) de SalonPilot.

## Architecture

Le système de notifications utilise une architecture provider-agnostic :

```
┌─────────────────────────────────────┐
│   Logique Métier (Endpoints API)    │
│   - POST /api/appointments           │
│   - PUT /api/appointments/:id        │
│   - DELETE /api/appointments/:id      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   NotificationService                │
│   - sendBookingConfirmation()        │
│   - sendBookingReminder()            │
│   - sendBookingCancellation()        │
│   - sendBookingModification()        │
│   - testNotification()               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Interfaces Abstraites              │
│   - SmsProvider                      │
│   - EmailProvider                    │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐  ┌──────────────┐
│ SmsUpProvider│  │ResendProvider│
│ (Implémentation)│ (Implémentation)│
└──────────────┘  └──────────────┘
```

## Configuration

### Variables d'environnement

Ajoutez ces variables dans votre fichier `.env` :

```bash
# SMS Provider (SMSup)
SMSUP_API_TOKEN=your-smsup-api-token
SMSUP_SENDER=SalonPilot
SMSUP_API_URL=https://api.smsup.ch/send  # Optionnel

# Email Provider (Resend)
RESEND_API_KEY=re_your-resend-api-key-here
RESEND_FROM=SalonPilot <noreply@salonpilot.ch>

# Mode de test (dry-run) - INDÉPENDANTS pour SMS et Email
SMS_DRY_RUN=true   # true = SMS loggés uniquement (défaut: true)
EMAIL_DRY_RUN=false # false = emails réellement envoyés (défaut: false)

# Mode DEBUG pour les notifications (logs détaillés)
NOTIFICATIONS_DEBUG=false # true = logs DEBUG détaillés (défaut: false)

# Ancienne variable (dépréciée, utilisée comme fallback si SMS_DRY_RUN/EMAIL_DRY_RUN non définis)
# NOTIFICATIONS_DRY_RUN=true
```

### Mode Dry-Run (SMS et Email indépendants)

Les modes dry-run sont maintenant **indépendants** pour SMS et Email, permettant un contrôle granulaire :

- **`SMS_DRY_RUN=true`** (défaut) : Les SMS sont loggés dans la console mais **pas envoyés**
- **`SMS_DRY_RUN=false`** : Les SMS sont **réellement envoyés** via SMSup
- **`EMAIL_DRY_RUN=true`** : Les emails sont loggés dans la console mais **pas envoyés**
- **`EMAIL_DRY_RUN=false`** (défaut) : Les emails sont **réellement envoyés** via Resend

**Configuration recommandée :**

- **Développement local** (tout en dry-run) :
  ```bash
  SMS_DRY_RUN=true
  EMAIL_DRY_RUN=true
  ```

- **Production / Pré-production** (emails réels, SMS en test) :
  ```bash
  SMS_DRY_RUN=true
  EMAIL_DRY_RUN=false
  ```

- **Production complète** (tout réel) :
  ```bash
  SMS_DRY_RUN=false
  EMAIL_DRY_RUN=false
  ```

**Note :** Les SMS restent en mode test par défaut (`SMS_DRY_RUN=true`) pour l'instant. Le passage à `SMS_DRY_RUN=false` devra être fait une fois les crédits SMSup configurés et les templates validés.

## Utilisation dans le code

### Point d'entrée

Le service de notifications est exporté depuis `server/core/notifications/index.ts` :

```typescript
import { notificationService } from './core/notifications/index.js';
import { buildNotificationContext } from './core/notifications/utils.js';
```

### Exemple d'utilisation

```typescript
// Après avoir créé un rendez-vous
const notificationContext = await buildNotificationContext(appointmentId, supabase);
if (notificationContext) {
  await notificationService.sendBookingConfirmation(notificationContext);
}
```

### Méthodes disponibles

- **`sendBookingConfirmation(ctx)`** : Envoie SMS + Email de confirmation
  - ✅ Utilise les templates depuis `notification_settings`
  - ✅ Fallback vers templates par défaut si vide
- **`sendBookingReminder(ctx)`** : Envoie SMS de rappel
  - ✅ Utilise le template depuis `notification_settings`
  - ✅ Fallback vers template par défaut si vide
- **`sendTestConfirmationEmail(params)`** : Envoie un email de test avec contexte factice
  - ✅ Utilise les templates depuis `notification_settings`
  - ✅ Contexte de test avec valeurs factices
- **`sendBookingCancellation(ctx)`** : Envoie Email d'annulation
  - ⚠️ Utilise encore des templates codés en dur (non configurable)
- **`sendBookingModification(ctx)`** : Envoie Email de modification
  - ⚠️ Utilise encore des templates codés en dur (non configurable)
- **`testNotification(ctx)`** : Méthode de test retournant les résultats détaillés
  - ✅ Retourne templates bruts, contexte, templates rendus

## Tests

### 1. Test via endpoint dédié

Un endpoint de test est disponible pour tester les notifications sans créer un rendez-vous :

```bash
POST /api/dev/send-test-notification
Content-Type: application/json

{
  "customerPhone": "+41791234567",
  "customerEmail": "test@example.com",
  "customerName": "Jean Dupont",
  "salonName": "Salon Test",
  "serviceName": "Coupe",
  "stylistName": "Marie Martin"
}
```

**Exemple avec curl :**

```bash
curl -X POST http://localhost:5001/api/dev/send-test-notification \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "+41791234567",
    "customerEmail": "test@example.com",
    "customerName": "Jean Dupont",
    "salonName": "Salon Test",
    "serviceName": "Coupe",
    "stylistName": "Marie Martin"
  }'
```

### 2. Test en mode Dry-Run complet (SMS + Email)

1. Définir dans `.env` :
   ```bash
   SMS_DRY_RUN=true
   EMAIL_DRY_RUN=true
   ```
2. Redémarrer le serveur
3. Appeler l'endpoint de test ou créer un rendez-vous
4. Vérifier les logs dans la console :
   - Les payloads SMS et Email doivent être affichés
   - Aucun appel HTTP réel ne doit être fait

**Logs attendus en mode dry-run :**

```
═══════════════════════════════════════════════════════════════
[Notifications] ⚙️  CONFIGURATION DES NOTIFICATIONS
═══════════════════════════════════════════════════════════════
[Notifications] 📱 SMS: ⚠️  DRY RUN (log uniquement)
[Notifications] 📧 Email: ⚠️  DRY RUN (log uniquement)
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
[SmsUp] [DRY RUN] 📱 SMS qui serait envoyé
═══════════════════════════════════════════════════════════════
[SmsUp] [DRY RUN]   To: +41791234567
[SmsUp] [DRY RUN]   Message: Votre rendez-vous chez Salon Test...
...
```

### 3. Test en mode mixte (Emails réels, SMS en dry-run)

1. Définir dans `.env` :
   ```bash
   SMS_DRY_RUN=true
   EMAIL_DRY_RUN=false
   RESEND_API_KEY=re_your-resend-api-key-here
   ```
2. Redémarrer le serveur
3. Appeler l'endpoint de test avec une adresse email valide
4. Vérifier :
   - **Logs SMS** : `[SmsUp] [DRY RUN] ...` (pas d'envoi réel)
   - **Logs Email** : `[Resend] Envoi email à ...` (sans tag DRY RUN, envoi réel)
   - **Côté Resend** : L'email apparaît dans le dashboard et est reçu

**Note :** Si vous n'avez pas de crédits Resend, l'API retournera une erreur, mais le code gère cela proprement sans crasher.

### 4. Test en mode réel complet (SMS + Email)

1. Définir dans `.env` :
   ```bash
   SMS_DRY_RUN=false
   EMAIL_DRY_RUN=false
   SMSUP_API_TOKEN=your-smsup-api-token
   RESEND_API_KEY=re_your-resend-api-key
   ```
2. S'assurer que les clés API sont configurées et valides
3. Redémarrer le serveur
4. Appeler l'endpoint de test ou créer un rendez-vous
5. Vérifier :
   - Les requêtes HTTP partent vers SMSup et Resend
   - Les erreurs éventuelles sont loggées proprement
   - L'application continue de fonctionner normalement

### 5. Test du flux complet

1. Configurer les variables d'environnement selon vos besoins (voir sections précédentes)
2. Créer un rendez-vous via l'interface utilisateur
3. Vérifier que les notifications sont envoyées :
   - **SMS** : Vérifier les logs (dry-run) ou la réception (mode réel)
   - **Email** : Vérifier les logs (dry-run) ou la réception (mode réel)

## Intégration dans les flux

Les notifications sont automatiquement envoyées dans les flux suivants :

### Création de rendez-vous

- **Endpoint** : `POST /api/appointments`
- **Notification** : `sendBookingConfirmation()`
- **Déclenchement** : Après création réussie en base de données

### Modification de rendez-vous

- **Endpoint** : `PUT /api/appointments/:id`
- **Notification** : 
  - `sendBookingCancellation()` si status = 'cancelled'
  - `sendBookingModification()` sinon
- **Déclenchement** : Après mise à jour réussie en base de données

### Suppression de rendez-vous

- **Endpoint** : `DELETE /api/appointments/:id`
- **Notification** : `sendBookingCancellation()`
- **Déclenchement** : Avant suppression en base de données (pour récupérer les données)

## Gestion des erreurs

Les notifications sont **non-bloquantes** :

- Si l'envoi échoue, l'erreur est loggée mais le flux principal continue
- Les erreurs sont visibles dans les logs du serveur
- Les erreurs ne remontent pas au client (pour ne pas bloquer l'UX)

## Fichiers clés

- **`server/core/notifications/index.ts`** : Point d'entrée, initialisation des providers
- **`server/core/notifications/NotificationService.ts`** : Logique métier des notifications
- **`server/core/notifications/types.ts`** : Interfaces et types TypeScript
- **`server/core/notifications/utils.ts`** : Utilitaires (buildNotificationContext)
- **`server/infrastructure/sms/SmsUpProvider.ts`** : Implémentation provider SMS
- **`server/infrastructure/email/ResendEmailProvider.ts`** : Implémentation provider Email

## Changer de provider

Pour changer de provider (ex: SMSup → Twilio, Resend → Brevo) :

1. Créer une nouvelle classe implémentant `SmsProvider` ou `EmailProvider`
2. Modifier uniquement `server/core/notifications/index.ts` pour utiliser le nouveau provider
3. Aucune autre modification nécessaire

## Mode DEBUG

Pour activer les logs détaillés du système de notifications :

```bash
NOTIFICATIONS_DEBUG=true
```

Les logs DEBUG afficheront :
- Templates bruts complets (pas seulement les 100 premiers caractères)
- Contexte de rendu détaillé
- Chaque placeholder remplacé individuellement
- Fallbacks utilisés (si un template est vide)
- Template rendu final complet

**Recommandation** : Activer en développement, désactiver en production pour éviter les logs trop verbeux.

## Templates Configurables

Le système utilise maintenant des **templates configurables** depuis l'interface manager (`/settings > Notifications`) :

- ✅ **Email de confirmation** : Sujet + HTML
- ✅ **SMS de confirmation** : Message texte
- ✅ **SMS de rappel** : Message texte
- ✅ **Délai de rappel** : 12h, 24h ou 48h

Les templates supportent des placeholders :
- `{{client_first_name}}`, `{{client_full_name}}`
- `{{appointment_date}}`, `{{appointment_time}}`
- `{{service_name}}`, `{{salon_name}}`, `{{stylist_name}}`

Voir `VALIDATION_NOTIFICATIONS.md` pour plus de détails.

## Versioning des Templates

Le système crée automatiquement un **historique des versions** à chaque modification :

- ✅ Chaque sauvegarde crée un snapshot de l'état précédent
- ✅ Possibilité de restaurer une version précédente
- ✅ Interface dans `/settings > Notifications > Historique des versions`

Voir `NOTIFICATION_VERSIONING_GUIDE.md` pour plus de détails.

## Dépannage

### Les notifications ne partent pas

1. Vérifier que `SMS_DRY_RUN` et `EMAIL_DRY_RUN` sont bien configurés
2. Vérifier les logs du serveur au démarrage pour voir la configuration active
3. Vérifier les logs du serveur pour voir les erreurs lors de l'envoi
4. Vérifier que les clés API sont correctes (en mode réel)
5. Utiliser l'endpoint de test pour isoler le problème
6. Activer `NOTIFICATIONS_DEBUG=true` pour des logs plus détaillés

### Les templates personnalisés ne sont pas utilisés

1. Vérifier que les templates sont bien sauvegardés dans `/settings`
2. Vérifier en DB que les valeurs sont présentes dans `notification_settings`
3. Vérifier les logs : `Template brut` doit afficher votre template personnalisé
4. Vérifier que le cache est invalidé (redémarrer le serveur si nécessaire)
5. Activer `NOTIFICATIONS_DEBUG=true` pour voir les détails

### Erreurs de crédit

- En mode dry-run : normal, les notifications ne partent pas (log uniquement)
- En mode réel : vérifier que vous avez des crédits sur SMSup/Resend
- Les erreurs sont loggées mais n'interrompent pas l'application
- Vérifier les logs pour voir les messages d'erreur détaillés des APIs

### Logs manquants

- Vérifier que le serveur est bien démarré
- Vérifier que les logs ne sont pas filtrés
- En mode dry-run, les logs doivent apparaître avec `[DRY RUN]`
- Vérifier la configuration au démarrage : les flags SMS_DRY_RUN et EMAIL_DRY_RUN sont affichés

