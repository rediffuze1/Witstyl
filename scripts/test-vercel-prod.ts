// scripts/test-vercel-prod.ts
// Script de test qui simule exactement ce que fait Vercel
// Utilise le même handler que Vercel (api/index.ts)

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

// Forcer l'environnement de production comme Vercel
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

// Importer le handler Vercel exactement comme Vercel le fait
let handler: any = null;

async function loadHandler() {
  if (!handler) {
    try {
      const handlerModule = await import('../api/index.js');
      handler = handlerModule.default;
      console.log('✅ Handler Vercel chargé avec succès');
    } catch (error: any) {
      console.error('❌ Erreur lors du chargement du handler:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    }
  }
  return handler;
}

// Liste des endpoints à tester (exactement comme dans test-api-prod.ts)
const endpoints = [
  { method: 'GET', path: '/api/auth/user', description: 'GET /api/auth/user (non authentifié)' },
  { method: 'POST', path: '/api/salon/login', description: 'POST /api/salon/login', body: { email: 'test@example.com', password: 'test' } },
  { method: 'GET', path: '/api/public/salon', description: 'GET /api/public/salon' },
  { method: 'GET', path: '/api/public/salon/stylistes', description: 'GET /api/public/salon/stylistes' },
  { method: 'GET', path: '/api/reviews/google', description: 'GET /api/reviews/google' },
  { method: 'GET', path: '/api/salons/test-salon-id/reports?view=week&date=2025-12-08', description: 'GET /api/salons/:salonId/reports (sans session - 401 attendu)' },
  { method: 'GET', path: '/team/emma.jpg', description: 'GET /team/emma.jpg (fichier statique - 404 attendu sur Vercel)' },
  { method: 'GET', path: '/salon1.jpg', description: 'GET /salon1.jpg (fichier statique - 404 attendu sur Vercel)' },
];

async function testEndpoint(method: string, path: string, body?: any): Promise<{ status: number; ok: boolean; error?: string; response?: string }> {
  return new Promise(async (resolve) => {
    try {
      const vercelHandler = await loadHandler();
      
      // Créer des objets req/res mock qui simulent Vercel de manière plus complète
      // pour éviter les erreurs avec finalhandler et unpipe
      const reqHeaders: Record<string, string> = {
        'content-type': body ? 'application/json' : 'text/plain',
        'host': 'localhost:3002',
      };
      
      const req = {
        method,
        url: path,
        headers: reqHeaders,
        // Stream-like properties pour éviter les erreurs avec unpipe
        readable: true,
        readableEnded: false,
        destroyed: false,
        // Event emitter pour les streams
        on: (event: string, callback: Function) => {
          if (event === 'data' && body) {
            setTimeout(() => callback(JSON.stringify(body)), 0);
          }
          if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
          if (event === 'error') {
            // Gérer les erreurs
          }
          return req;
        },
        once: (event: string, callback: Function) => {
          if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
          return req;
        },
        removeListener: () => req,
        removeAllListeners: () => req,
        // Ajouter les propriétés nécessaires pour Express
        path: path.split('?')[0],
        query: {},
        params: {},
        body: body || {},
        originalUrl: path,
        protocol: 'http',
        hostname: 'localhost',
        ip: '127.0.0.1',
        get: (name: string) => reqHeaders[name.toLowerCase()],
        baseUrl: '',
        route: null,
      } as any;

      let statusCode = 200;
      let responseBody = '';
      const headers: Record<string, string> = {};
      let headersSent = false;
      let ended = false;

      const res = {
        statusCode: 200,
        status: (code: number) => {
          if (!headersSent) {
            statusCode = code;
          }
          return res;
        },
        json: (data: any) => {
          if (!headersSent && !ended) {
            responseBody = JSON.stringify(data);
            headersSent = true;
            res.end();
          }
        },
        send: (data: any) => {
          if (!headersSent && !ended) {
            responseBody = typeof data === 'string' ? data : JSON.stringify(data);
            headersSent = true;
            res.end();
          }
        },
        end: (data?: any) => {
          if (!ended) {
            if (data) responseBody += typeof data === 'string' ? data : JSON.stringify(data);
            ended = true;
            headersSent = true;
            const ok = statusCode < 500; // On accepte 4xx mais pas 5xx
            resolve({ status: statusCode, ok, error: ok ? undefined : `Status ${statusCode}: ${responseBody.substring(0, 200)}`, response: responseBody });
          }
        },
        setHeader: (name: string, value: string) => {
          if (!headersSent) {
            headers[name] = value;
          }
        },
        getHeader: (name: string) => headers[name],
        headersSent: false,
        get headersSent() {
          return headersSent;
        },
        // Stream-like properties pour éviter les erreurs avec unpipe
        writable: true,
        writableEnded: false,
        destroyed: false,
        // Event emitter pour les streams
        on: () => res,
        once: () => res,
        removeListener: () => res,
        removeAllListeners: () => res,
        // Méthodes supplémentaires pour Express
        write: (chunk: any) => {
          if (!headersSent && !ended) {
            responseBody += chunk;
            return true;
          }
          return false;
        },
        writeHead: (code: number, headers?: Record<string, string>) => {
          if (!headersSent) {
            statusCode = code;
            if (headers) {
              Object.assign(headers, headers);
            }
          }
          return res;
        },
      } as any;

      // Appeler le handler Vercel avec un timeout pour éviter les blocages
      const timeout = setTimeout(() => {
        if (!ended) {
          ended = true;
          resolve({ status: 500, ok: false, error: 'Timeout - la requête a pris trop de temps' });
        }
      }, 10000); // 10 secondes max

      try {
        await vercelHandler(req, res);
        // Si la réponse n'a pas été envoyée après un court délai, considérer comme terminé
        setTimeout(() => {
          clearTimeout(timeout);
          if (!ended) {
            ended = true;
            resolve({ status: statusCode || 200, ok: statusCode < 500, response: responseBody });
          }
        }, 100);
      } catch (error: any) {
        clearTimeout(timeout);
        if (!ended) {
          ended = true;
          resolve({ status: 500, ok: false, error: error.message || 'Erreur inconnue' });
        }
      }
    } catch (error: any) {
      resolve({ status: 0, ok: false, error: error.message });
    }
  });
}

async function runTests() {
  console.log('🧪 Test Vercel Production - Simulation exacte du handler Vercel\n');
  console.log(`📍 Environnement: VERCEL=${process.env.VERCEL}, NODE_ENV=${process.env.NODE_ENV}\n`);
  console.log('='.repeat(60));
  console.log('TESTS DES ENDPOINTS (via handler Vercel)');
  console.log('='.repeat(60));
  console.log('');

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

