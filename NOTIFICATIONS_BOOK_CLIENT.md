## Notifications lors d’une réservation client (`/book-client`)

### Flux côté backend

1. Le formulaire React envoie un `POST /api/appointments` avec :
   - `clientId` (issu de la session client)
   - `serviceId`, `stylistId`, `startTime`, `endTime`
   - `clientInfo` (prénom, nom, email, téléphone saisis à l’étape “Confirmation”)
2. La route `POST /api/appointments` (dans `server/index.ts`) :
   - Normalise les infos client en fusionnant `body.clientInfo` et la session `req.session.client`
   - Met à jour la table `clients` si une nouvelle info est fournie
   - Crée le rendez-vous dans Supabase
   - Construit le contexte via `buildNotificationContext`
   - Override systématiquement l’email/téléphone/nom avec les valeurs fraîchement saisies
   - Loggue le contexte via `[BookClient][Notifications] …`
   - Appelle `notificationService.sendBookingConfirmation(context)`
   - Loggue le succès ou l’erreur (`[BookClient][Notifications][ERROR] …`)

### Logs à surveiller

- `grep "[BookClient][Notifications]" server.log`
- En cas de succès :
  ```
  [BookClient][Notifications] Préparation de l'email …
  [BookClient][Notifications] Email de confirmation ENVOYÉ …
  ```
- En cas d’échec (l’email ne bloque pas la création du rendez-vous) :
  ```
  [BookClient][Notifications][ERROR] Échec lors de l'envoi …
  ```

### Tests manuels

1. Démarrer `npm run dev`
2. Réserver via `/book-client` avec un email réel
3. Vérifier les logs ci-dessus
4. Vérifier Resend + Gmail → l’email doit apparaître comme pour le bouton “Envoyer un email de test”



