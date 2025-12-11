// scripts/test-vercel-prod-endpoints.ts
// Script pour tester les endpoints en production Vercel

import https from 'https';
import http from 'http';

const VERCEL_URL = process.env.VERCEL_URL || 'https://witstyl.vercel.app';

const endpoints = [
  { method: 'GET', path: '/api/auth/user', description: 'GET /api/auth/user (non authentifié)', expectedStatus: 200 },
  { method: 'POST', path: '/api/salon/login', description: 'POST /api/salon/login', body: { email: 'test@example.com', password: 'test' }, expectedStatus: 401 },
  { method: 'GET', path: '/api/public/salon', description: 'GET /api/public/salon', expectedStatus: 200 },
  { method: 'GET', path: '/api/public/salon/stylistes', description: 'GET /api/public/salon/stylistes', expectedStatus: 200 },
];

async function testEndpoint(method: string, path: string, description: string, expectedStatus: number, body?: any): Promise<{ status: number; ok: boolean; error?: string; response?: string }> {
  return new Promise((resolve) => {
    const url = new URL(path, VERCEL_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Witstyl-Test-Script/1.0',
      },
    };

    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        const status = res.statusCode || 0;
        // On accepte le status attendu ou 4xx, mais pas 5xx
        const ok = status < 500 && (status === expectedStatus || (expectedStatus === 200 && status < 400));
        resolve({
          status,
          ok,
          error: ok ? undefined : `Status ${status} (attendu: ${expectedStatus}): ${data.substring(0, 200)}`,
          response: data.substring(0, 500),
        });
      });
    });

    req.on('error', (error: Error) => {
      resolve({ status: 0, ok: false, error: error.message });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ status: 0, ok: false, error: 'Timeout après 10 secondes' });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Test des endpoints en production Vercel');
  console.log(`📍 URL: ${VERCEL_URL}\n`);
  console.log('='.repeat(60));
  console.log('TESTS DES ENDPOINTS');
  console.log('='.repeat(60));
  console.log('');

  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const endpoint of endpoints) {
    process.stdout.write(`Testing ${endpoint.description}... `);
    const result = await testEndpoint(
      endpoint.method,
      endpoint.path,
      endpoint.description,
      endpoint.expectedStatus,
      endpoint.body
    );

    if (result.ok) {
      console.log(`✅ OK (${result.status})`);
      passed++;
    } else {
      console.log(`❌ FAILED`);
      console.log(`   Status: ${result.status} (attendu: ${endpoint.expectedStatus})`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
        errors.push(`${endpoint.description}: ${result.error}`);
      }
      if (result.status >= 500) {
        console.log(`   ⚠️  ERREUR 500 DÉTECTÉE - Vérifier les logs Vercel !`);
      }
      failed++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Résultats: ${passed} passés, ${failed} échoués`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n❌ Erreurs détectées:');
    errors.forEach((error) => {
      console.log(`   - ${error}`);
    });
    console.log('\n⚠️  Vérifiez les logs Vercel dans le dashboard pour plus de détails.');
    process.exit(1);
  } else {
    console.log('\n✅ Tous les tests sont passés !');
    console.log('✅ Aucune erreur 500 détectée.');
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error('❌ Erreur lors du démarrage des tests:', error);
  process.exit(1);
});

