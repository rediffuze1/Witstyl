// Serveur de développement avec support Vite pour le hot-reload
// Ce fichier est utilisé uniquement en développement local (npm run dev)
// Il ne doit JAMAIS être importé par Vercel ou en production

import 'dotenv/config';
import express from "express";
import { createServer, type Server } from "http";
import { setupVite, log } from "./vite.js";
import app from "./index.js";

// Créer le serveur HTTP pour le développement
const server = createServer(app);

// Configuration Vite pour le hot-reload en développement
setupVite(app, server)
  .then(() => {
    const port = parseInt(process.env.PORT || '5001', 10);
    const host = process.env.HOST || '0.0.0.0';
    server.listen(port, host, () => {
      log(`serving on ${host}:${port}`);
      console.log('[DEV SERVER] ✅ Serveur de développement démarré avec Vite');
      console.log('[DEV SERVER] ✅ Routes salon/hours enregistrées:');
      console.log('[DEV SERVER] ✅ GET /api/salons/:salonId/hours');
      console.log('[DEV SERVER] ✅ PUT /api/salons/:salonId/hours');
      console.log('[DEV SERVER] ✅ Router salons monté sur /api/salons');
      console.log('[DEV SERVER] ✅ Routes notification-settings enregistrées:');
      console.log('[DEV SERVER] ✅ GET /api/owner/notification-settings');
      console.log('[DEV SERVER] ✅ PUT /api/owner/notification-settings');
      console.log('[DEV SERVER] ✅ POST /api/owner/notifications/send-test-email');
      console.log('[DEV SERVER] ✅ POST /api/owner/notifications/send-test-sms');
      console.log('[DEV SERVER] ✅ POST /api/owner/notifications/test-confirmation-sms');
      console.log('[DEV SERVER] ✅ POST /api/owner/notifications/test-reminder-sms');
      console.log('[DEV SERVER] ✅ POST /api/notifications/resend/webhook');
    });
  })
  .catch((err) => {
    console.error('[DEV SERVER] ❌ Erreur lors du chargement de Vite:', err);
    process.exit(1);
  });

