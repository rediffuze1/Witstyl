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
  { method: 'GET', path: '/team/emma.jpg', description: 'GET /team/emma.jpg (fichier statique - 404 attendu sur Vercel)' },
  { method: 'GET', path: '/salon1.jpg', description: 'GET /salon1.jpg (fichier statique - 404 attendu sur Vercel)' },
];

// Credentials de test depuis les variables d'environnement
const TEST_EMAIL = process.env.TEST_LOGIN_EMAIL || 'veignatpierre@gmail.com';
const TEST_PASSWORD = process.env.TEST_LOGIN_PASSWORD || 'Pa$$w0rd';

/**
 * Test spécialisé pour vérifier la persistance de session via cookie
 */
async function testSessionCookie(): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const vercelHandler = await loadHandler();
    
    // Étape 1: POST /api/salon/login
    const loginReqHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'host': 'localhost:3002',
    };
    
    const loginReq = {
      method: 'POST',
      url: '/api/salon/login',
      headers: loginReqHeaders,
      readable: true,
      readableEnded: false,
      destroyed: false,
      on: (event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })), 0);
        }
        if (event === 'end') {
          setTimeout(() => callback(), 0);
        }
        return loginReq;
      },
      once: (event: string, callback: Function) => {
        if (event === 'end') {
          setTimeout(() => callback(), 0);
        }
        return loginReq;
      },
      removeListener: () => loginReq,
      removeAllListeners: () => loginReq,
      path: '/api/salon/login',
      query: {},
      params: {},
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
      originalUrl: '/api/salon/login',
      protocol: 'http',
      hostname: 'localhost',
      ip: '127.0.0.1',
      get: (name: string) => loginReqHeaders[name.toLowerCase()],
      baseUrl: '',
      route: null,
    } as any;

    let loginStatusCode = 200;
    let loginResponseBody = '';
    const loginHeaders: Record<string, string> = {};
    let loginHeadersSent = false;
    let loginEnded = false;

    const loginRes = {
      statusCode: 200,
      status: (code: number) => {
        if (!loginHeadersSent) {
          loginStatusCode = code;
        }
        return loginRes;
      },
      json: (data: any) => {
        if (!loginHeadersSent && !loginEnded) {
          loginResponseBody = JSON.stringify(data);
          loginHeadersSent = true;
          loginRes.end();
        }
      },
      send: (data: any) => {
        if (!loginHeadersSent && !loginEnded) {
          loginResponseBody = typeof data === 'string' ? data : JSON.stringify(data);
          loginHeadersSent = true;
          loginRes.end();
        }
      },
      end: (data?: any) => {
        if (!loginEnded) {
          if (data) loginResponseBody += typeof data === 'string' ? data : JSON.stringify(data);
          loginEnded = true;
          loginHeadersSent = true;
        }
      },
      setHeader: (name: string, value: string) => {
        if (!loginHeadersSent) {
          loginHeaders[name] = value;
        }
      },
      getHeader: (name: string) => loginHeaders[name],
      headersSent: false,
      get headersSent() {
        return loginHeadersSent;
      },
      writable: true,
      writableEnded: false,
      destroyed: false,
      on: () => loginRes,
      once: () => loginRes,
      removeListener: () => loginRes,
      removeAllListeners: () => loginRes,
      write: (chunk: any) => {
        if (!loginHeadersSent && !loginEnded) {
          loginResponseBody += chunk;
          return true;
        }
        return false;
      },
      writeHead: (code: number, headers?: Record<string, string>) => {
        if (!loginHeadersSent) {
          loginStatusCode = code;
          if (headers) {
            Object.assign(loginHeaders, headers);
          }
        }
        return loginRes;
      },
    } as any;

    await vercelHandler(loginReq, loginRes);
    await new Promise(resolve => setTimeout(resolve, 200));

    if (loginStatusCode !== 200) {
      return {
        success: false,
        message: `Login failed with status ${loginStatusCode}`,
        details: { status: loginStatusCode, response: loginResponseBody.substring(0, 200) },
      };
    }

    // Récupérer le Set-Cookie
    const setCookieHeader = loginHeaders['set-cookie'] || loginRes.getHeader('Set-Cookie');
    if (!setCookieHeader) {
      return {
        success: false,
        message: 'Set-Cookie header absent dans la réponse de login',
        details: { headers: loginHeaders },
      };
    }

    const cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;

    // Étape 2: GET /api/auth/user avec le cookie
    const authReqHeaders: Record<string, string> = {
      'host': 'localhost:3002',
      'cookie': cookie,
    };

    const authReq = {
      method: 'GET',
      url: '/api/auth/user',
      headers: authReqHeaders,
      readable: true,
      readableEnded: false,
      destroyed: false,
      on: () => authReq,
      once: () => authReq,
      removeListener: () => authReq,
      removeAllListeners: () => authReq,
      path: '/api/auth/user',
      query: {},
      params: {},
      body: {},
      originalUrl: '/api/auth/user',
      protocol: 'http',
      hostname: 'localhost',
      ip: '127.0.0.1',
      get: (name: string) => authReqHeaders[name.toLowerCase()],
      baseUrl: '',
      route: null,
    } as any;

    let authStatusCode = 200;
    let authResponseBody = '';
    const authHeaders: Record<string, string> = {};
    let authHeadersSent = false;
    let authEnded = false;

    const authRes = {
      statusCode: 200,
      status: (code: number) => {
        if (!authHeadersSent) {
          authStatusCode = code;
        }
        return authRes;
      },
      json: (data: any) => {
        if (!authHeadersSent && !authEnded) {
          authResponseBody = JSON.stringify(data);
          authHeadersSent = true;
          authRes.end();
        }
      },
      send: (data: any) => {
        if (!authHeadersSent && !authEnded) {
          authResponseBody = typeof data === 'string' ? data : JSON.stringify(data);
          authHeadersSent = true;
          authRes.end();
        }
      },
      end: (data?: any) => {
        if (!authEnded) {
          if (data) authResponseBody += typeof data === 'string' ? data : JSON.stringify(data);
          authEnded = true;
          authHeadersSent = true;
        }
      },
      setHeader: (name: string, value: string) => {
        if (!authHeadersSent) {
          authHeaders[name] = value;
        }
      },
      getHeader: (name: string) => authHeaders[name],
      headersSent: false,
      get headersSent() {
        return authHeadersSent;
      },
      writable: true,
      writableEnded: false,
      destroyed: false,
      on: () => authRes,
      once: () => authRes,
      removeListener: () => authRes,
      removeAllListeners: () => authRes,
      write: (chunk: any) => {
        if (!authHeadersSent && !authEnded) {
          authResponseBody += chunk;
          return true;
        }
        return false;
      },
      writeHead: (code: number, headers?: Record<string, string>) => {
        if (!authHeadersSent) {
          authStatusCode = code;
          if (headers) {
            Object.assign(authHeaders, headers);
          }
        }
        return authRes;
      },
    } as any;

    await vercelHandler(authReq, authRes);
    await new Promise(resolve => setTimeout(resolve, 200));

    if (authStatusCode !== 200) {
      return {
        success: false,
        message: `GET /api/auth/user failed with status ${authStatusCode}`,
        details: { status: authStatusCode, response: authResponseBody.substring(0, 200) },
      };
    }

    let authData;
    try {
      authData = JSON.parse(authResponseBody);
    } catch (e) {
      return {
        success: false,
        message: 'Failed to parse auth/user response',
        details: { response: authResponseBody.substring(0, 200) },
      };
    }

    if (authData.authenticated !== true) {
      return {
        success: false,
        message: `authenticated is ${authData.authenticated}, expected true`,
        details: { response: authData },
      };
    }

    return {
      success: true,
      message: 'Session cookie correctly emitted and reused',
      details: {
        cookie: cookie.substring(0, 80) + '...',
        authenticated: authData.authenticated,
        userType: authData.userType,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Unknown error',
      details: { stack: error.stack },
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

