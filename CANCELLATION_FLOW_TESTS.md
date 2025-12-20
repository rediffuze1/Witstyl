# Tests manuels – Flux d'annulation

Ce guide décrit les scénarios à vérifier après la mise en place de la nouvelle
logique d'annulation centralisée.

## 1. Annulation par le client (espace client)

1. Se connecter en tant que client (`/client-login`), créer un rendez-vous.
2. Vérifier que le rendez-vous apparaît dans le calendrier manager/styliste
   (`/dashboard` ou `/calendar`) **avant** annulation.
3. Depuis `/client-appointments`, cliquer sur « Annuler ».
4. Contrôles attendus :
   - La réponse HTTP renvoie `success: true`.
   - Le rendez-vous passe avec le badge **Annulé** côté client.
   - Le rendez-vous disparaît du planning manager (ou est filtré) après refresh.
   - Logs serveur :
     ```
     [Appointments] 🛑 Cancellation requested by client…
     [Appointments] ✅ Appointment cancelled in DB
     [NotificationService] … sendBookingCancellation …
     [NotificationService] … sendBookingCancellationInfoToManager …
     ```
   - Email « Annulation de votre rendez-vous » reçu par le client.
   - Email info manager reçu à l'adresse du salon / owner.

## 2. Annulation par le manager (dashboard)

1. Se connecter en owner/manager.
2. Créer un rendez-vous (via booking manager ou prise client).
3. Depuis le calendrier manager, annuler le rendez-vous (bouton suppression ou
   changement de statut « Annulé »).
4. Contrôles attendus :
   - Le rendez-vous est retiré du calendrier après refresh.
   - Email d'annulation envoyé au client (comportement existant).
   - (Optionnel) vérifier que l'email info manager n'est **pas** envoyé si
     l'annulation vient du manager (log `[Appointments] 📧 Sending cancellation info…`
     absent).
   - Logs serveur confirment `cancelledByRole: 'manager'`.

## 3. Cas limites

- **Annulation répétée** : relancer l'annulation sur un rendez-vous déjà annulé.
  - Attendu : réponse 200, log `Appointment already cancelled` et aucune
    notification en double.
- **Client non propriétaire** : appeler l'endpoint client avec un `appointmentId`
  appartenant à un autre client.
  - Attendu : HTTP 403, message `Accès refusé pour ce rendez-vous`.
- **Données calendrier** : vérifier que l'endpoint
  `GET /api/salons/:salonId/appointments` n'inclut pas les `status = 'cancelled'`
  (contrôle via logs ou en ajoutant `status` dans la réponse).

Documenter les captures/logs dans ce fichier lors de chaque campagne de test.




