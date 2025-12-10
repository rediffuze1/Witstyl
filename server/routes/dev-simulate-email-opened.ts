/**
 * Route de développement : Simuler l'ouverture d'un email
 * 
 * Cette route permet de tester le système sans webhook Resend.
 * Utile pour le développement local.
 * 
 * POST /api/dev/simulate-email-opened
 * Body: { "appointmentId": "uuid" }
 */

import express, { type Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { markEmailAsOpened } from '../core/notifications/emailService.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const router = express.Router();
router.use(express.json());

router.post('/simulate-email-opened', async (req: Request, res: Response) => {
  try {
    console.log('[DevSimulateEmail] 📧 Simulation d\'ouverture d\'email');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Configuration Supabase manquante',
      });
    }

    const body = req.body || {};
    const appointmentId = body.appointmentId?.trim();

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        error: 'appointmentId requis dans le body',
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Vérifier que l'appointment existe et a un email envoyé
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, email_sent_at, email_opened_at')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment non trouvé',
      });
    }

    if (!appointment.email_sent_at) {
      return res.status(400).json({
        success: false,
        error: 'Email non encore envoyé pour cet appointment',
      });
    }

    if (appointment.email_opened_at) {
      return res.status(400).json({
        success: false,
        error: 'Email déjà marqué comme ouvert',
        email_opened_at: appointment.email_opened_at,
      });
    }

    // Marquer l'email comme ouvert
    await markEmailAsOpened(appointmentId, supabase);

    // Créer un événement email de type "opened"
    const { error: eventError } = await supabase
      .from('email_events')
      .insert({
        appointment_id: appointmentId,
        type: 'opened',
        provider: 'Resend',
        metadata: {
          simulated: true,
          simulated_at: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

    if (eventError) {
      console.error('[DevSimulateEmail] ❌ Erreur lors de la création de l\'événement:', eventError);
    }

    console.log(`[DevSimulateEmail] ✅ Email marqué comme ouvert pour ${appointmentId}`);

    return res.json({
      success: true,
      message: 'Email marqué comme ouvert avec succès',
      appointmentId,
      email_opened_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[DevSimulateEmail] ❌ Erreur:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la simulation',
    });
  }
});

export default router;


