/**
 * Route webhook pour recevoir les événements Resend
 * 
 * Cette route reçoit les webhooks Resend pour tracker :
 * - email.delivered
 * - email.opened
 * 
 * Documentation Resend : https://resend.com/docs/webhooks
 */

import express, { type Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
// IMPORTANT: En ESM, les imports relatifs TypeScript doivent inclure l'extension .js
import { markEmailAsOpened } from '../core/notifications/emailService.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const router = express.Router();
router.use(express.json());

/**
 * POST /api/notifications/resend/webhook
 * 
 * Reçoit les événements Resend et met à jour la base de données
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('[ResendWebhook] 📨 Webhook reçu');
    console.log('[ResendWebhook] 📋 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[ResendWebhook] 📋 Body:', JSON.stringify(req.body, null, 2));

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[ResendWebhook] ❌ Configuration Supabase manquante');
      return res.status(500).json({
        success: false,
        error: 'Configuration Supabase manquante',
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Resend envoie les événements dans req.body
    // Format typique : { type: 'email.opened', data: { email_id: '...', ... } }
    const eventType = req.body.type || req.body.event;
    const eventData = req.body.data || req.body;

    if (!eventType) {
      console.warn('[ResendWebhook] ⚠️  Type d\'événement manquant dans le webhook');
      return res.status(400).json({
        success: false,
        error: 'Type d\'événement manquant',
      });
    }

    console.log(`[ResendWebhook] 📧 Type d'événement: ${eventType}`);

    // Extraire l'ID de l'email depuis les métadonnées Resend
    // Resend peut envoyer l'ID de l'email dans différentes propriétés
    const emailId = eventData.email_id || eventData.id || eventData.message_id;
    const recipientEmail = eventData.to || eventData.recipient;

    if (!emailId) {
      console.warn('[ResendWebhook] ⚠️  ID de l\'email manquant dans le webhook');
      // Ne pas faire échouer, juste logger
    }

    // Chercher l'appointment associé à cet email
    // On peut utiliser les tags/metadata Resend pour stocker l'appointmentId
    // Ou chercher par email du client et date de rendez-vous proche
    let appointmentId: string | null = null;

    // Méthode 1 : Si Resend envoie des tags avec appointmentId
    // Les tags Resend sont un tableau : [{ name: 'appointmentId', value: '...' }]
    if (eventData.tags && Array.isArray(eventData.tags)) {
      const appointmentIdTag = eventData.tags.find((tag: { name?: string; value?: string }) => tag.name === 'appointmentId');
      if (appointmentIdTag && appointmentIdTag.value) {
        appointmentId = String(appointmentIdTag.value);
      }
    }

    // Méthode 2 : Si Resend envoie des metadata avec appointmentId
    if (!appointmentId && eventData.metadata && eventData.metadata.appointmentId) {
      appointmentId = String(eventData.metadata.appointmentId);
    }

    // Méthode 3 : Chercher par email du client (moins fiable mais fallback)
    if (!appointmentId && recipientEmail) {
      // Chercher les appointments récents avec cet email
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('email', recipientEmail)
        .limit(1);

      if (clients && clients.length > 0) {
        const clientId = clients[0].id;
        // Chercher l'appointment le plus récent pour ce client
        const { data: appointments } = await supabase
          .from('appointments')
          .select('id')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (appointments && appointments.length > 0) {
          appointmentId = appointments[0].id;
        }
      }
    }

    if (!appointmentId) {
      console.warn('[ResendWebhook] ⚠️  Impossible de trouver l\'appointment associé à cet email');
      // Retourner success quand même pour ne pas faire retry par Resend
      return res.json({
        success: true,
        message: 'Webhook reçu mais appointment non trouvé',
      });
    }

    console.log(`[ResendWebhook] 📋 Appointment trouvé: ${appointmentId}`);

    // Traiter selon le type d'événement
    if (eventType === 'email.opened' || eventType === 'email_opened') {
      // Marquer l'email comme ouvert
      await markEmailAsOpened(appointmentId, supabase);

      // Créer un événement email de type "opened"
      const { error: eventError } = await supabase
        .from('email_events')
        .insert({
          appointment_id: appointmentId,
          type: 'opened',
          provider: 'Resend',
          provider_event_id: emailId,
          metadata: {
            recipient: recipientEmail,
            timestamp: eventData.timestamp || new Date().toISOString(),
            user_agent: eventData.user_agent,
            ip: eventData.ip,
          },
          timestamp: new Date().toISOString(),
        });

      if (eventError) {
        console.error('[ResendWebhook] ❌ Erreur lors de la création de l\'événement "opened":', eventError);
      } else {
        console.log(`[ResendWebhook] ✅ Événement "opened" enregistré pour ${appointmentId}`);
      }
    } else if (eventType === 'email.delivered' || eventType === 'email_delivered') {
      // Créer un événement email de type "delivered"
      const { error: eventError } = await supabase
        .from('email_events')
        .insert({
          appointment_id: appointmentId,
          type: 'delivered',
          provider: 'Resend',
          provider_event_id: emailId,
          metadata: {
            recipient: recipientEmail,
            timestamp: eventData.timestamp || new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });

      if (eventError) {
        console.error('[ResendWebhook] ❌ Erreur lors de la création de l\'événement "delivered":', eventError);
      } else {
        console.log(`[ResendWebhook] ✅ Événement "delivered" enregistré pour ${appointmentId}`);
      }
    } else {
      // Autres événements (bounced, complained, etc.)
      console.log(`[ResendWebhook] ℹ️  Événement non traité: ${eventType}`);
      
      const { error: eventError } = await supabase
        .from('email_events')
        .insert({
          appointment_id: appointmentId,
          type: eventType,
          provider: 'Resend',
          provider_event_id: emailId,
          metadata: eventData,
          timestamp: new Date().toISOString(),
        });

      if (eventError) {
        console.error(`[ResendWebhook] ❌ Erreur lors de la création de l'événement "${eventType}":`, eventError);
      }
    }

    // Toujours retourner success pour ne pas faire retry par Resend
    return res.json({
      success: true,
      message: 'Webhook traité avec succès',
      appointmentId,
      eventType,
    });
  } catch (error: any) {
    console.error('[ResendWebhook] ❌ Erreur lors du traitement du webhook:', error);
    // Retourner success quand même pour ne pas faire retry par Resend
    // (on log l'erreur mais on ne veut pas que Resend retry indéfiniment)
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du traitement du webhook',
    });
  }
});

export default router;

