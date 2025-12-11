// scripts/test-api-prod.ts
// Script de test pour valider tous les endpoints en mode production simulé

import { createServer } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import http from 'http';

// Forcer l'environnement de production
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

// Importer l'app Express depuis le point d'entrée production
import app from '../server/prod.js';

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

const server = createServer(app);

// Liste des endpoints à tester
const endpoints = [
  { method: 'GET', path: '/api/auth/user', description: 'GET /api/auth/user (non authentifié)' },
  { method: 'POST', path: '/api/salon/login', description: 'POST /api/salon/login', body: { email: 'test@example.com', password: 'test' } },
  { method: 'GET', path: '/api/public/salon', description: 'GET /api/public/salon' },
  { method: 'GET', path: '/api/public/salon/stylistes', description: 'GET /api/public/salon/stylistes' },
  { method: 'GET', path: '/api/reviews/google', description: 'GET /api/reviews/google' },
  { method: 'GET', path: '/api/salons/test-salon-id/reports?view=week&date=2025-12-08', description: 'GET /api/salons/:salonId/reports (sans session - 401 attendu)' },
  { method: 'GET', path: '/team/emma.jpg', description: 'GET /team/emma.jpg (fichier statique)' },
  { method: 'GET', path: '/salon1.jpg', description: 'GET /salon1.jpg (fichier statique)' },
];

async function testEndpoint(method: string, path: string, body?: any): Promise<{ status: number; ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const req = http.request(url, options, (res: IncomingMessage) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const status = res.statusCode || 500;
        const ok = status < 500; // On accepte 4xx mais pas 5xx
        resolve({ status, ok, error: ok ? undefined : `Status ${status}: ${data.substring(0, 200)}` });
      });
    });

    req.on('error', (error: Error) => {
      resolve({ status: 0, ok: false, error: error.message });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Démarrage des tests API en mode production simulé...\n');
  console.log(`📍 Serveur de test sur ${BASE_URL}\n`);

  // Démarrer le serveur
  server.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}\n`);
    console.log('='.repeat(60));
    console.log('TESTS DES ENDPOINTS');
    console.log('='.repeat(60));
    console.log('');

    // Attendre un peu que le serveur soit prêt
    setTimeout(async () => {
      let passed = 0;
      let failed = 0;

      for (const endpoint of endpoints) {
        process.stdout.write(`Testing ${endpoint.description}... `);
        const result = await testEndpoint(endpoint.method, endpoint.path, endpoint.body);

        if (result.ok) {
          console.log(`✅ OK (${result.status})`);
          passed++;
        } else {
          console.log(`❌ FAILED`);
          console.log(`   Status: ${result.status}`);
          if (result.error) {
            console.log(`   Error: ${result.error}`);
          }
          failed++;
        }
      }

      console.log('');
      console.log('='.repeat(60));
      console.log(`Résultats: ${passed} passés, ${failed} échoués`);
      console.log('='.repeat(60));

      if (failed === 0) {
        console.log('\n✅ Tous les tests sont passés !');
        process.exit(0);
      } else {
        console.log(`\n❌ ${failed} test(s) ont échoué`);
        process.exit(1);
      }
    }, 1000);
  });
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

runTests().catch((error) => {
  console.error('❌ Erreur lors du démarrage des tests:', error);
  process.exit(1);
});

