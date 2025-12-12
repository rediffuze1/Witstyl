/**
 * Script de test pour vérifier que le cookie de session est bien émis et réutilisé
 * après un login réussi
 */

import 'dotenv/config';
import { createServer } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import http from 'http';

// Forcer l'environnement de production
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

// Importer l'app Express depuis le point d'entrée production
import app from '../server/prod.js';

const PORT = 3003;
const BASE_URL = `http://localhost:${PORT}`;

const server = createServer(app);

// Credentials de test depuis les variables d'environnement
const TEST_EMAIL = process.env.TEST_LOGIN_EMAIL || 'veignatpierre@gmail.com';
const TEST_PASSWORD = process.env.TEST_LOGIN_PASSWORD || 'Pa$$w0rd';

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Test 1: POST /api/salon/login et récupération du Set-Cookie
 */
async function testLoginAndGetCookie(): Promise<{ success: boolean; cookie?: string; sessionId?: string; error?: string }> {
  return new Promise((resolve) => {
    const url = new URL('/api/salon/login', BASE_URL);
    const options: any = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res: IncomingMessage) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const status = res.statusCode || 500;
        
        if (status !== 200) {
          resolve({
            success: false,
            error: `Login failed with status ${status}: ${data.substring(0, 200)}`,
          });
          return;
        }

        // Récupérer le header Set-Cookie
        const setCookieHeader = res.headers['set-cookie'];
        const cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;

        if (!cookie) {
          resolve({
            success: false,
            error: 'Set-Cookie header absent dans la réponse de login',
          });
          return;
        }

        // Extraire le sessionId depuis le cookie (format: connect.sid=s%3A...)
        const sessionIdMatch = cookie.match(/connect\.sid=([^;]+)/);
        const sessionId = sessionIdMatch ? sessionIdMatch[1] : undefined;

        // Parser la réponse JSON
        let responseData;
        try {
          responseData = JSON.parse(data);
        } catch (e) {
          resolve({
            success: false,
            error: `Failed to parse login response: ${data.substring(0, 200)}`,
          });
          return;
        }

        if (!responseData.success) {
          resolve({
            success: false,
            error: `Login response indicates failure: ${responseData.message || 'Unknown error'}`,
          });
          return;
        }

        resolve({
          success: true,
          cookie,
          sessionId,
        });
      });
    });

    req.on('error', (error: Error) => {
      resolve({
        success: false,
        error: error.message,
      });
    });

    req.write(JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }));
    req.end();
  });
}

/**
 * Test 2: GET /api/auth/user avec le cookie de session
 */
async function testAuthUserWithCookie(cookie: string): Promise<{ success: boolean; authenticated?: boolean; error?: string; data?: any }> {
  return new Promise((resolve) => {
    const url = new URL('/api/auth/user', BASE_URL);
    const options: any = {
      method: 'GET',
      headers: {
        'Cookie': cookie,
      },
    };

    const req = http.request(url, options, (res: IncomingMessage) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const status = res.statusCode || 500;
        
        if (status !== 200) {
          resolve({
            success: false,
            error: `GET /api/auth/user failed with status ${status}: ${data.substring(0, 200)}`,
          });
          return;
        }

        // Parser la réponse JSON
        let responseData;
        try {
          responseData = JSON.parse(data);
        } catch (e) {
          resolve({
            success: false,
            error: `Failed to parse auth/user response: ${data.substring(0, 200)}`,
          });
          return;
        }

        resolve({
          success: true,
          authenticated: responseData.authenticated === true,
          data: responseData,
        });
      });
    });

    req.on('error', (error: Error) => {
      resolve({
        success: false,
        error: error.message,
      });
    });

    req.end();
  });
}

/**
 * Test 3: GET /api/auth/user sans cookie (doit retourner authenticated: false)
 */
async function testAuthUserWithoutCookie(): Promise<{ success: boolean; authenticated?: boolean; error?: string }> {
  return new Promise((resolve) => {
    const url = new URL('/api/auth/user', BASE_URL);
    const options: any = {
      method: 'GET',
    };

    const req = http.request(url, options, (res: IncomingMessage) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const status = res.statusCode || 500;
        
        if (status !== 200) {
          resolve({
            success: false,
            error: `GET /api/auth/user failed with status ${status}: ${data.substring(0, 200)}`,
          });
          return;
        }

        // Parser la réponse JSON
        let responseData;
        try {
          responseData = JSON.parse(data);
        } catch (e) {
          resolve({
            success: false,
            error: `Failed to parse auth/user response: ${data.substring(0, 200)}`,
          });
          return;
        }

        resolve({
          success: true,
          authenticated: responseData.authenticated === true,
        });
      });
    });

    req.on('error', (error: Error) => {
      resolve({
        success: false,
        error: error.message,
      });
    });

    req.end();
  });
}

async function runTests(): Promise<void> {
  console.log('🧪 Test de persistance de session (cookie Set-Cookie)\n');
  console.log(`📍 Serveur de test sur ${BASE_URL}\n`);
  console.log(`📧 Email de test: ${TEST_EMAIL}\n`);

  // Démarrer le serveur
  server.listen(PORT, async () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}\n`);
    console.log('='.repeat(60));
    console.log('TESTS DE PERSISTANCE DE SESSION');
    console.log('='.repeat(60));
    console.log('');

    // Attendre un peu que le serveur soit prêt
    await new Promise(resolve => setTimeout(resolve, 500));

    let passed = 0;
    let failed = 0;

    // Test 1: Login et récupération du cookie
    console.log('📋 Test 1: POST /api/salon/login et récupération du Set-Cookie');
    process.stdout.write('   En cours... ');
    const loginResult = await testLoginAndGetCookie();

    if (!loginResult.success) {
      console.log('❌ FAILED');
      console.log(`   Erreur: ${loginResult.error}`);
      failed++;
    } else {
      console.log('✅ PASSED');
      console.log(`   Cookie reçu: ${loginResult.cookie?.substring(0, 80)}...`);
      console.log(`   Session ID: ${loginResult.sessionId?.substring(0, 50)}...`);
      passed++;

      // Test 2: GET /api/auth/user avec le cookie
      console.log('\n📋 Test 2: GET /api/auth/user avec le cookie de session');
      process.stdout.write('   En cours... ');
      const authResult = await testAuthUserWithCookie(loginResult.cookie!);

      if (!authResult.success) {
        console.log('❌ FAILED');
        console.log(`   Erreur: ${authResult.error}`);
        failed++;
      } else if (!authResult.authenticated) {
        console.log('❌ FAILED');
        console.log(`   Authenticated: ${authResult.authenticated} (attendu: true)`);
        console.log(`   Réponse complète: ${JSON.stringify(authResult.data, null, 2)}`);
        failed++;
      } else {
        console.log('✅ PASSED');
        console.log(`   Authenticated: ${authResult.authenticated}`);
        console.log(`   User Type: ${authResult.data?.userType || 'N/A'}`);
        console.log(`   User ID: ${authResult.data?.user?.id || 'N/A'}`);
        passed++;
      }

      // Test 3: GET /api/auth/user sans cookie (doit retourner authenticated: false)
      console.log('\n📋 Test 3: GET /api/auth/user sans cookie (doit retourner authenticated: false)');
      process.stdout.write('   En cours... ');
      const noCookieResult = await testAuthUserWithoutCookie();

      if (!noCookieResult.success) {
        console.log('❌ FAILED');
        console.log(`   Erreur: ${noCookieResult.error}`);
        failed++;
      } else if (noCookieResult.authenticated) {
        console.log('❌ FAILED');
        console.log(`   Authenticated: ${noCookieResult.authenticated} (attendu: false)`);
        failed++;
      } else {
        console.log('✅ PASSED');
        console.log(`   Authenticated: ${noCookieResult.authenticated} (correct)`);
        passed++;
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log(`Résultats: ${passed} passés, ${failed} échoués`);
    console.log('='.repeat(60));

    if (failed === 0) {
      console.log('\n✅ Tous les tests sont passés !');
      console.log('✅ Le cookie de session est correctement émis et réutilisé\n');
      process.exit(0);
    } else {
      console.log(`\n❌ ${failed} test(s) ont échoué`);
      console.log('❌ Le cookie de session n\'est pas correctement émis ou réutilisé\n');
      process.exit(1);
    }
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

