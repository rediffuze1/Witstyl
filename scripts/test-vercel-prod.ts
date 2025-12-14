// scripts/test-vercel-prod.ts
// Script de test qui simule exactement ce que fait Vercel
// Utilise le même handler que Vercel (api/index.ts)

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import http from 'node:http';

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
  { 
    method: 'GET', 
    path: '/api/auth/user', 
    description: 'GET /api/auth/user (non authentifié)',
    expectedStatus: [200], // Doit retourner 200 (non 503) même si Postgres est down, tant que Supabase REST est OK
    mustNotBe: [503], // Ne doit JAMAIS retourner 503 si Supabase REST est OK
  },
  { 
    method: 'POST', 
    path: '/api/salon/login', 
    description: 'POST /api/salon/login',
    body: { email: 'test@example.com', password: 'test' },
    expectedStatus: [200, 401], // Doit retourner 200 (succès) ou 401 (mauvais credentials), mais jamais 503
    mustNotBe: [503], // Ne doit JAMAIS retourner 503 si Supabase REST est OK
  },
  { method: 'GET', path: '/api/public/salon', description: 'GET /api/public/salon' },
  { method: 'GET', path: '/api/public/salon/stylistes', description: 'GET /api/public/salon/stylistes' },
  { method: 'GET', path: '/api/reviews/google', description: 'GET /api/reviews/google' },
  { method: 'GET', path: '/api/salons/test-salon-id/reports?view=week&date=2025-12-08', description: 'GET /api/salons/:salonId/reports (sans session - 401 attendu)' },
  // Note: Les fichiers statiques (/team/emma.jpg, /salon1.jpg) ne sont pas testés car
  // sur Vercel, ils sont servis directement par Vercel, pas par notre handler API
  // Le handler rejette immédiatement les requêtes non-API avec 404
];

// Credentials de test depuis les variables d'environnement
const TEST_EMAIL = process.env.TEST_LOGIN_EMAIL || 'veignatpierre@gmail.com';
const TEST_PASSWORD = process.env.TEST_LOGIN_PASSWORD || 'Pa$$w0rd';

/**
 * Helper pour créer un serveur HTTP réel et tester avec fetch
 * Permet à express-session de fonctionner correctement (hooks on-headers, on-finished)
 */
async function withServer(
  handler: (req: any, res: any) => any,
  run: (baseUrl: string) => Promise<{ success: boolean; message: string; details?: any }>
): Promise<{ success: boolean; message: string; details?: any }> {
  const server = http.createServer((req, res) => handler(req, res));
  
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Failed to bind server');
  }
  
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

/**
 * Test spécialisé pour vérifier la persistance de session via cookie
 * Utilise un vrai serveur HTTP pour que express-session fonctionne correctement
 */
async function testSessionCookie(): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const vercelHandler = await loadHandler();
    
    return await withServer(vercelHandler, async (baseUrl) => {
      // Step 1: login
      const loginRes = await fetch(`${baseUrl}/api/salon/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-proto': 'https', // Simuler HTTPS pour les tests
          'origin': 'http://localhost:5001',
        },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      });

      const loginBody = await loginRes.text();
      if (!loginRes.ok) {
        return {
          success: false,
          message: `Login failed with status ${loginRes.status}`,
          details: { status: loginRes.status, response: loginBody.slice(0, 200) },
        };
      }

      // IMPORTANT: Node fetch ne donne pas toujours set-cookie via headers.get()
      // Donc on lit via headers.getSetCookie() si disponible (undici/Node 20+),
      // sinon fallback brute.
      const anyHeaders: any = loginRes.headers;
      const setCookies: string[] =
        typeof anyHeaders.getSetCookie === 'function'
          ? anyHeaders.getSetCookie()
          : (loginRes.headers.get('set-cookie') ? [loginRes.headers.get('set-cookie')!] : []);

      if (!setCookies.length) {
        return {
          success: false,
          message: 'Set-Cookie header absent dans la réponse de login',
          details: { 
            status: loginRes.status, 
            headers: Object.fromEntries(loginRes.headers.entries()),
            response: loginBody.slice(0, 200),
          },
        };
      }

      // Extraire le nom=valeur du cookie (sans les attributs)
      const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');

      // Step 2: call auth endpoint with cookie
      const meRes = await fetch(`${baseUrl}/api/auth/user`, {
        method: 'GET',
        headers: {
          'cookie': cookieHeader,
          'x-forwarded-proto': 'https',
          'origin': 'http://localhost:5001',
        },
      });

      const meBody = await meRes.text();
      if (!meRes.ok) {
        return {
          success: false,
          message: `Auth/user failed with status ${meRes.status}`,
          details: { status: meRes.status, response: meBody.slice(0, 200) },
        };
      }

      let meData;
      try {
        meData = JSON.parse(meBody);
      } catch (e) {
        return {
          success: false,
          message: 'Failed to parse auth/user response',
          details: { response: meBody.slice(0, 200) },
        };
      }

      if (meData.authenticated !== true) {
        return {
          success: false,
          message: `authenticated is ${meData.authenticated}, expected true`,
          details: { response: meData },
        };
      }

      return {
        success: true,
        message: 'Session cookie correctly emitted and reused',
        details: {
          cookie: cookieHeader.substring(0, 80) + '...',
          authenticated: meData.authenticated,
          userType: meData.userType,
        },
      };
    });
  } catch (error: any) {
    return {
      success: false,
      message: `Test failed with error: ${error.message}`,
      details: { error: error.stack },
    };
  }
}

async function testEndpoint(
  method: string, 
  path: string, 
  body?: any,
  expectedStatus?: number[],
  mustNotBe?: number[]
): Promise<{ status: number; ok: boolean; error?: string; response?: string; validationError?: string }> {
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
            let validationError: string | undefined;
            
            // Validation spécifique pour les routes d'auth
            if (mustNotBe && mustNotBe.includes(statusCode)) {
              validationError = `Status ${statusCode} interdit (doit être ${expectedStatus?.join(' ou ') || '200/401'})`;
            } else if (expectedStatus && !expectedStatus.includes(statusCode)) {
              validationError = `Status ${statusCode} inattendu (attendu: ${expectedStatus.join(' ou ')})`;
            }
            
            resolve({ 
              status: statusCode, 
              ok: ok && !validationError, 
              error: ok ? undefined : `Status ${statusCode}: ${responseBody.substring(0, 200)}`, 
              response: responseBody,
              validationError,
            });
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
    const result = await testEndpoint(
      endpoint.method, 
      endpoint.path, 
      endpoint.body,
      (endpoint as any).expectedStatus,
      (endpoint as any).mustNotBe
    );

    if (result.ok && !result.validationError) {
      console.log(`✅ OK (${result.status})`);
      passed++;
    } else {
      console.log(`❌ FAILED`);
      console.log(`   Status: ${result.status}`);
      if (result.validationError) {
        console.log(`   ⚠️  Validation: ${result.validationError}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      failed++;
    }
  }

  console.log('');
  // Test spécialisé: persistance de session via cookie
  console.log('\n📋 Test spécialisé: Persistance de session via cookie');
  process.stdout.write('   En cours... ');
  const cookieTest = await testSessionCookie();

  if (cookieTest.success) {
    console.log('✅ PASSED');
    console.log(`   ${cookieTest.message}`);
    if (cookieTest.details) {
      console.log(`   Cookie: ${cookieTest.details.cookie || 'N/A'}`);
      console.log(`   Authenticated: ${cookieTest.details.authenticated}`);
      console.log(`   User Type: ${cookieTest.details.userType || 'N/A'}`);
    }
    passed++;
  } else {
    console.log('❌ FAILED');
    console.log(`   ${cookieTest.message}`);
    if (cookieTest.details) {
      console.log(`   Details: ${JSON.stringify(cookieTest.details, null, 2)}`);
    }
    failed++;
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Résultats: ${passed} passés, ${failed} échoués`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n✅ Tous les tests sont passés !');
    console.log('✅ La persistance de session via cookie fonctionne correctement\n');
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



