// server/vite.ts
// Stub pour la prod Vercel : on exporte des fonctions vides
// pour éviter l'erreur "Cannot find module '/var/task/server/vite'".

import type { Express } from "express";
import type { Server } from "http";

/**
 * En développement, ce fichier peut être remplacé par une vraie
 * intégration Vite. En production Vercel, ces fonctions ne font rien.
 */
export async function setupVite(_app: Express, _server?: Server) {
  // Ne rien faire en prod
  return;
}

export function serveStatic(_app: Express) {
  // Ne rien faire en prod
  return;
}

export function log(message: string, source = "express") {
  // Stub pour la fonction log - en prod on utilise console.log directement
  console.log(message);
}

export default {
  setupVite,
  serveStatic,
  log,
};
