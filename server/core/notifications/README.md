# Système de Notifications Witstyl

## Architecture

Le système de notifications est conçu avec une architecture en couches pour permettre de changer facilement de provider sans modifier la logique métier.

```
┌─────────────────────────────────────┐
│   Logique Métier (Endpoints API)      │
│   - POST /api/appointments            │
│   - PUT /api/appointments/:id         │
│   - DELETE /api/appointments/:id       │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   NotificationService                │
│   - sendBookingConfirmation()        │
│   - sendBookingReminder()            │
│   - sendBookingCancellation()        │
│   - sendBookingModification()        │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Interfaces Abstraites             │
│   - SmsProvider                      │
│   - EmailProvider                    │
└──────────────┬────────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐  ┌──────────────┐
│ SmsUpProvider│  │ResendProvider│
│ (Implémentation)│ (Implémentation)│
└──────────────┘  └──────────────┘
```

## Structure des fichiers

```
server/
├── core/
│   └── notifications/
│       ├── types.ts              # Interfaces SmsProvider, EmailProvider, BookingNotificationContext
│       ├── NotificationService.ts # Service métier (logique de haut niveau)
│       ├── utils.ts              # Utilitaires (buildNotificationContext)
│       ├── index.ts              # Point d'entrée (composition des providers)
│       └── README.md             # Ce fichier
└── infrastructure/
    ├── sms/
    │   └── SmsUpProvider.ts      # Implémentation SMSup
    └── email/
        └── ResendEmailProvider.ts # Implémentation Resend
```

## Configuration

### Variables d'environnement

Ajoutez ces variables dans votre fichier `.env` :

```env
# SMSup (SMS)
SMSUP_API_TOKEN=your-smsup-api-token
SMSUP_SENDER=Witstyl
SMSUP_API_URL=https://api.smsup.ch/send  # Optionnel

# Resend (Email)
RESEND_API_KEY=re_your-resend-api-key-here
RESEND_FROM=Witstyl <noreply@witstyl.ch>

# Mode dry run (true/false)
# Si true : les notifications sont loggées dans la console mais pas réellement envoyées
# Utile pour le développement sans crédits sur SMSup/Resend
# Si false : les notifications sont réellement envoyées (nécessite des clés API valides)
NOTIFICATIONS_DRY_RUN=true
```

### Mode développement / Dry Run

Le système supporte deux modes de fonctionnement :

1. **Mode Dry Run** (`NOTIFICATIONS_DRY_RUN=true`) :
   - Les notifications sont loggées dans la console avec le préfixe `[DRY RUN]`
   - Les payloads complets sont affichés (to, message, subject, html, etc.)
   - Aucun appel réel n'est fait aux APIs externes
   - Retourne toujours `{ success: true }` pour ne pas bloquer la logique métier
   - Utile pour le développement sans crédits sur SMSup/Resend

2. **Mode Production** (`NOTIFICATIONS_DRY_RUN=false` ou non défini) :
   - Les notifications sont réellement envoyées via les APIs
   - Nécessite des clés API valides avec crédits
   - Les erreurs sont gérées proprement et retournent `{ success: false, error: "..." }`

Si les clés API ne sont pas configurées et que le dry run est désactivé, le système crée des providers "mock" qui loggent seulement.

## Utilisation

### Dans les endpoints API

Les notifications sont automatiquement envoyées lors de :
- **Création d'un rendez-vous** (`POST /api/appointments`) → Confirmation (email + SMS)
- **Modification d'un rendez-vous** (`PUT /api/appointments/:id`) → Modification (email) ou Annulation (email si status='cancelled')
- **Suppression d'un rendez-vous** (`DELETE /api/appointments/:id`) → Annulation (email)

### Exemple d'utilisation manuelle

```typescript
import { notificationService } from '@/core/notifications';

const context: BookingNotificationContext = {
  bookingId: 'appointment-123',
  clientName: 'Jean Dupont',
  clientEmail: 'jean@example.com',
  clientPhone: '+41791234567',
  serviceName: 'Coupe',
  salonName: 'Mon Salon',
  stylistName: 'Marie Martin',
  startDate: new Date('2025-11-20T14:00:00'),
  endDate: new Date('2025-11-20T15:00:00'),
};

// Envoyer une confirmation
await notificationService.sendBookingConfirmation(context);

// Envoyer un rappel
await notificationService.sendBookingReminder(context);

// Envoyer une annulation
await notificationService.sendBookingCancellation(context);
```

## Changer de provider

### Exemple : Remplacer SMSup par Twilio

1. **Créer le nouveau provider** (`server/infrastructure/sms/TwilioSmsProvider.ts`) :

```typescript
import { SmsProvider } from '../../core/notifications/types';
import twilio from 'twilio';

export class TwilioSmsProvider implements SmsProvider {
  private client: twilio.Twilio;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.client = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  async sendSms({ to, message }: { to: string; message: string }): Promise<void> {
    await this.client.messages.create({
      body: message,
      to,
      from: this.fromNumber,
    });
  }
}
```

2. **Modifier uniquement** `server/core/notifications/index.ts` :

```typescript
// Avant
import { SmsUpProvider } from '../../infrastructure/sms/SmsUpProvider';
const smsProvider = new SmsUpProvider({
  token: process.env.SMSUP_API_TOKEN!,
  sender: process.env.SMSUP_SENDER || 'Witstyl',
  dryRun: process.env.SMS_DRY_RUN === 'true',
});

// Après
import { TwilioSmsProvider } from '../../infrastructure/sms/TwilioSmsProvider';
const smsProvider = new TwilioSmsProvider(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
  process.env.TWILIO_FROM_NUMBER!
);
```

3. **Aucune autre modification nécessaire** ! La logique métier continue de fonctionner.

### Exemple : Remplacer Resend par Brevo

1. **Créer le nouveau provider** (`server/infrastructure/email/BrevoEmailProvider.ts`) :

```typescript
import { EmailProvider } from '../../core/notifications/types';
import { TransactionalEmailsApi, SendSmtpEmail } from '@getbrevo/brevo';

export class BrevoEmailProvider implements EmailProvider {
  private client: TransactionalEmailsApi;

  constructor(apiKey: string, from: string) {
    this.client = new TransactionalEmailsApi();
    this.client.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);
    this.from = from;
  }

  async sendEmail({ to, subject, html, text }: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    const email: SendSmtpEmail = {
      sender: { email: this.from },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    };
    await this.client.sendTransacEmail(email);
  }
}
```

2. **Modifier uniquement** `server/core/notifications/index.ts` :

```typescript
// Avant
import { ResendEmailProvider } from '../../infrastructure/email/ResendEmailProvider';
const emailProvider = new ResendEmailProvider(process.env.RESEND_API_KEY!, process.env.RESEND_FROM!);

// Après
import { BrevoEmailProvider } from '../../infrastructure/email/BrevoEmailProvider';
const emailProvider = new BrevoEmailProvider(process.env.BREVO_API_KEY!, process.env.BREVO_FROM!);
```

## Points d'entrée pour l'envoi des notifications

Les notifications sont automatiquement déclenchées dans :

1. **`server/index.ts`** :
   - `POST /api/appointments` (ligne ~4003) → `sendBookingConfirmation()`
   - `PUT /api/appointments/:id` (ligne ~4267) → `sendBookingModification()` ou `sendBookingCancellation()`
   - `DELETE /api/appointments/:id` (ligne ~4346) → `sendBookingCancellation()`

2. **Pour les rappels** : À implémenter avec un job/cron qui appelle `sendBookingReminder()` pour les rendez-vous du lendemain.

## Gestion des erreurs

Les notifications sont envoyées de manière **non-bloquante** :

- Les méthodes des providers retournent `{ success: boolean; error?: string }` au lieu de lancer des exceptions
- Le `NotificationService` log les erreurs mais n'interrompt pas l'exécution
- Les erreurs sont loggées avec `console.error` pour faciliter le débogage
- En mode dry run, les erreurs ne peuvent pas survenir (retourne toujours `{ success: true }`)
- Si l'envoi échoue, l'erreur est loggée mais l'opération principale (création/modification/suppression) continue
- Cela garantit que les rendez-vous peuvent être créés même si les services externes sont temporairement indisponibles

### Format des résultats

Tous les providers implémentent maintenant un format de retour standardisé :

```typescript
// Succès
{ success: true }

// Erreur
{ success: false, error: "Message d'erreur détaillé" }
```

Cela permet une gestion d'erreur cohérente et non-bloquante dans toute l'application.

## Tests

Pour tester sans configurer les services externes ou sans crédits :

1. **Mode Dry Run** (recommandé) :
   - Définir `NOTIFICATIONS_DRY_RUN=true` dans votre `.env`
   - Les notifications seront loggées dans la console avec le préfixe `[DRY RUN]`
   - Les payloads complets sont affichés (to, message, subject, html, etc.)
   - Aucun appel réel n'est fait aux APIs externes
   - Retourne toujours `{ success: true }` pour ne pas bloquer la logique métier

2. **Mode Mock** (fallback) :
   - Ne pas définir `SMSUP_API_TOKEN` ni `RESEND_API_KEY`
   - Les notifications seront loggées dans la console en mode "mock"
   - Vérifier les logs pour confirmer que les notifications sont déclenchées

Pour tester avec les vrais services :
1. Configurer les clés API dans `.env`
2. Créer/modifier/annuler un rendez-vous depuis l'interface
3. Vérifier que l'email et le SMS sont bien reçus

