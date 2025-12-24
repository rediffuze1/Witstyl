/**
 * Configuration PostgreSQL optimisée pour Supabase Pooler (Transaction Mode)
 * Compatible avec Vercel serverless et Supabase Supavisor
 */

import { Client, ClientConfig, Pool, PoolConfig } from 'pg';
import tls from 'node:tls';

/**
 * Vérifie que DATABASE_URL contient les paramètres requis pour le pooler
 */
export function validateDatabaseUrl(url: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Vérifier que c'est un pooler
  const isPooler = url.includes('pooler.supabase.com');
  if (!isPooler && process.env.VERCEL) {
    warnings.push('⚠️  DATABASE_URL ne semble pas utiliser le pooler Supavisor (recommandé pour Vercel)');
  }
  
  // Vérifier le port 6543 (Transaction Mode)
  const hasPort6543 = url.includes(':6543');
  if (isPooler && !hasPort6543) {
    warnings.push('⚠️  Port 6543 non détecté. Assurez-vous d\'utiliser Transaction Mode (port 6543)');
  }
  
  // Vérifier pgbouncer=true
  const hasPgbouncer = url.includes('pgbouncer=true');
  if (isPooler && !hasPgbouncer) {
    warnings.push('⚠️  Paramètre pgbouncer=true manquant. Ajoutez-le à l\'URL pour éviter les problèmes avec prepared statements');
  }
  
  // Vérifier sslmode=require
  const hasSslMode = url.includes('sslmode=require') || url.includes('sslmode=prefer');
  if (isPooler && !hasSslMode) {
    warnings.push('⚠️  Paramètre sslmode=require manquant. Ajoutez-le à l\'URL pour une connexion sécurisée');
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Lit le certificat CA depuis PGSSLROOTCERT (sans fallback)
 * Version ultra-robuste : gère guillemets, \r\n, \n, base64, etc.
 * 
 * IMPORTANT: Configure aussi NODE_EXTRA_CA_CERTS pour que Node.js merge automatiquement
 * le CA custom avec les root certificates par défaut.
 */
function readPgRootCaFromEnv(): string | undefined {
  const raw = process.env.PGSSLROOTCERT;
  if (!raw) return undefined;

  let s = raw.trim();

  // Vercel/CI peuvent parfois entourer la valeur de guillemets
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }

  // Normaliser les newlines (cas: "\\n", "\\r\\n", "\r\n")
  s = s
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");

  // Si c'est du base64 (parfois on stocke le cert comme ça), on décode
  if (!s.includes("BEGIN CERTIFICATE") && /^[A-Za-z0-9+/=]+$/.test(s)) {
    try {
      const decoded = Buffer.from(s, "base64").toString("utf8").trim();
      if (decoded.includes("BEGIN CERTIFICATE")) {
        s = decoded;
      }
    } catch {
      // ignore
    }
  }

  if (!s.includes("BEGIN CERTIFICATE")) return undefined;

  // ASTUCE: Configurer NODE_EXTRA_CA_CERTS pour que Node.js merge automatiquement
  // le CA custom avec les root certificates par défaut
  // Cela évite le problème où fournir `ca` remplace les root certificates
  if (!process.env.NODE_EXTRA_CA_CERTS) {
    process.env.NODE_EXTRA_CA_CERTS = s;
  } else if (!process.env.NODE_EXTRA_CA_CERTS.includes(s.substring(0, 50))) {
    // Ajouter le CA custom à NODE_EXTRA_CA_CERTS s'il n'est pas déjà présent
    process.env.NODE_EXTRA_CA_CERTS = `${process.env.NODE_EXTRA_CA_CERTS}\n${s}`;
  }

  return s;
}

/**
 * Construit une config SSL stricte
 * 
 * IMPORTANT: Le CA custom est déjà configuré via NODE_EXTRA_CA_CERTS dans readPgRootCaFromEnv()
 * Cela permet à Node.js de merger automatiquement le CA custom avec les root certificates par défaut.
 * 
 * Si on fournit `ca` directement, Node.js remplace les root certificates.
 * En utilisant NODE_EXTRA_CA_CERTS, on ajoute le CA custom SANS remplacer les root certificates.
 */
function buildStrictSsl(ca?: string): { rejectUnauthorized: true; ca?: string | string[] } {
  // Si NODE_EXTRA_CA_CERTS est configuré, on peut utiliser uniquement rejectUnauthorized
  // Node.js utilisera automatiquement les root certificates + NODE_EXTRA_CA_CERTS
  if (ca && process.env.NODE_EXTRA_CA_CERTS) {
    // Le CA est déjà dans NODE_EXTRA_CA_CERTS, on n'a pas besoin de le passer dans ca
    // Cela permet à Node.js d'utiliser les root certificates par défaut + le CA custom
    return { rejectUnauthorized: true as const };
  }

  // Fallback: si NODE_EXTRA_CA_CERTS n'est pas disponible, utiliser ca directement
  if (ca) {
    // Vérifier que rootCertificates est disponible (Node 19.9.0+)
    if (typeof tls.rootCertificates !== 'undefined' && Array.isArray(tls.rootCertificates) && tls.rootCertificates.length > 0) {
      return {
        rejectUnauthorized: true as const,
        ca: [ca, ...tls.rootCertificates],
      };
    }
    
    // Dernier fallback: utiliser uniquement le CA custom
    return {
      rejectUnauthorized: true as const,
      ca: ca,
    };
  }

  return { rejectUnauthorized: true as const };
}

/**
 * Log de diagnostic SSL uniquement en dev (pas en prod)
 */
function devLogSslDiagnostic(payload: { hasRootCa: boolean; sslRejectUnauthorized: boolean; caLength: number }) {
  if (process.env.NODE_ENV === "production") return;
  if (process.env.VERCEL) return; // optionnel: évite du bruit sur preview deployments
  if (process.env.NODE_ENV === "test") return;
  console.log("[DB] 🔍 SSL diagnostic (dev):", payload);
}

/**
 * Crée une configuration PostgreSQL optimisée pour serverless (Vercel + Supabase Pooler)
 */
export function createPgClientConfig(connectionString?: string): ClientConfig {
  const DATABASE_URL = connectionString || process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL est requise pour créer un client PostgreSQL');
  }
  
  // Valider l'URL et afficher des avertissements
  const validation = validateDatabaseUrl(DATABASE_URL);
  if (validation.warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('[DB] Avertissements sur DATABASE_URL:');
    validation.warnings.forEach(warning => console.warn(`[DB] ${warning}`));
  }
  
  // Détecter si c'est un pooler ou une connexion Supabase
  const isPooler = DATABASE_URL.includes('pooler.supabase.com');
  const isSupabase = DATABASE_URL.includes('supabase.com') || DATABASE_URL.includes('supabase.co');
  const isVercel = !!process.env.VERCEL;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Parser DATABASE_URL proprement pour extraire host, port, user, password, database
  let dbHost = 'unknown';
  let dbPort = 5432; // Port par défaut PostgreSQL
  let dbUser = 'unknown';
  let dbDatabase = 'unknown';
  let isValidUrl = false;
  
  try {
    const urlObj = new URL(DATABASE_URL);
    dbHost = urlObj.hostname;
    // Port : utiliser celui de l'URL ou 5432 par défaut
    dbPort = Number(urlObj.port || '5432');
    // Détecter pooler/pgbouncer : port 6543 (Transaction Mode) ou 5432 (Session Mode)
    if (urlObj.port === '6543' || DATABASE_URL.includes('pgbouncer=true')) {
      // Pooler détecté
    }
    dbUser = decodeURIComponent(urlObj.username || '');
    dbDatabase = urlObj.pathname.replace(/^\//, '') || 'unknown';
    isValidUrl = true;
  } catch (e: any) {
    // URL invalide : lancer une erreur claire
    console.error('[DB] ❌ DATABASE_URL invalide:', e.message);
    throw new Error('DB_CONFIG_INVALID: DATABASE_URL n\'est pas une URL valide');
  }
  
  // Configuration SSL - Sécurisée par défaut avec support certificat CA Supabase
  // Support PGSSLROOTCERT (PEM avec \n échappés) pour certificat CA personnalisé
  // INTERDIT: NODE_TLS_REJECT_UNAUTHORIZED=0 et rejectUnauthorized: false
  // Par défaut: rejectUnauthorized: true (sécurisé)
  
  // Interdire NODE_TLS_REJECT_UNAUTHORIZED=0
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    console.warn('[DB] ⚠️ SÉCURITÉ: NODE_TLS_REJECT_UNAUTHORIZED=0 détecté - IGNORÉ (sécurité)');
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; // Utiliser la valeur par défaut (1)
  }
  
  // Configuration SSL - Sécurisée par défaut avec support certificat CA Supabase
  // Support PGSSLROOTCERT (PEM avec \n échappés) pour certificat CA personnalisé
  // INTERDIT: NODE_TLS_REJECT_UNAUTHORIZED=0 et rejectUnauthorized: false
  // Par défaut: rejectUnauthorized: true (sécurisé)
  
  // Interdire NODE_TLS_REJECT_UNAUTHORIZED=0
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    console.warn('[DB] ⚠️ SÉCURITÉ: NODE_TLS_REJECT_UNAUTHORIZED=0 détecté - IGNORÉ (sécurité)');
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; // Utiliser la valeur par défaut (1)
  }
  
  // Lire le certificat CA depuis PGSSLROOTCERT (sans fallback)
  // Version ultra-robuste : gère guillemets, \r\n, \n, base64, etc.
  const ca = readPgRootCaFromEnv();
  
  let sslConfig: { rejectUnauthorized: boolean; ca?: string | string[] } | boolean = false;
  let sslMode = 'DISABLED';
  
  // Détecter si SSL est requis depuis l'URL
  const urlRequiresSsl = DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('sslmode=prefer');
  
  if (urlRequiresSsl || isPooler || isSupabase) {
    // SSL requis : utiliser configuration explicite
    // IMPORTANT: Utiliser buildStrictSsl() pour merger le CA custom avec les root certificates Node
    // Cela garantit la compatibilité avec les chaînes publiques ET Supabase/pooler
    sslConfig = buildStrictSsl(ca);
    sslMode = ca
      ? 'ENABLED (rejectUnauthorized: true, CA provided + Node root CAs)'
      : 'ENABLED (rejectUnauthorized: true - secure)';
  } else if (isProduction && !isVercel) {
    // Production locale : SSL standard
    sslConfig = true;
    sslMode = 'ENABLED (standard verification)';
  }
  
  // Log de diagnostic uniquement en dev
  devLogSslDiagnostic({
    hasRootCa: !!ca,
    sslRejectUnauthorized: sslConfig === false ? false : (typeof sslConfig === 'object' ? sslConfig.rejectUnauthorized : true),
    caLength: ca ? ca.length : 0,
  });
  
  // Log SSL explicite pour diagnostic (toujours en prod/Vercel)
  if (isVercel || isProduction) {
    const sslEnabled = sslConfig !== false;
    const rejectUnauthorizedValue = sslConfig === false 
      ? 'N/A' 
      : typeof sslConfig === 'object' 
        ? (sslConfig.rejectUnauthorized ? 'true (secure)' : 'false (override)')
        : 'true (standard)';
    
    console.log('[DB] 🔐 Configuration SSL:', {
      ssl: sslEnabled,
      hasCa: !!ca,
      host: dbHost,
      port: dbPort,
      sslMode,
      rejectUnauthorized: rejectUnauthorizedValue,
      isPooler,
      isSupabase,
      pgbouncerDetected: DATABASE_URL.includes('pgbouncer=true'),
      sslmodeInUrl: DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('sslmode=prefer')
    });
  }
  
  // Timeouts agressifs pour éviter les FUNCTION_INVOCATION_TIMEOUT sur Vercel
  // Actifs uniquement en production/Vercel
  const timeouts = (isVercel || isProduction) ? {
    connectionTimeoutMillis: 3000, // 3s max pour établir la connexion (agressif)
    query_timeout: 3000, // 3s max pour chaque requête (agressif)
    idleTimeoutMillis: 10000, // 10s max d'inactivité
  } : {};

  // Nettoyer l'URL pour éviter les conflits avec la config SSL côté code
  // Pour Supabase pooler, s'assurer que sslmode=require est présent dans l'URL (pour compatibilité)
  let cleanConnectionString = DATABASE_URL;
  
  if ((isPooler || isSupabase) && !DATABASE_URL.includes('sslmode=')) {
    const separator = cleanConnectionString.includes('?') ? '&' : '?';
    cleanConnectionString = `${cleanConnectionString}${separator}sslmode=require`;
  }
  
  const config: ClientConfig = {
    connectionString: cleanConnectionString,
    // IMPORTANT: SSL configuré avec rejectUnauthorized: true (sécurisé)
    // Si PGSSLROOTCERT fourni, utilise le certificat CA personnalisé
    ssl: sslConfig, // rejectUnauthorized: true avec ou sans CA
    // Configuration optimisée pour serverless
    keepAlive: true, // Maintenir la connexion active (important pour pgbouncer)
    // Pour serverless, on limite à 1 connexion par fonction
    // Le pooler gère le pooling côté serveur
    // Note: max est une propriété de Pool, pas de Client
    // Pour Client, on ne peut pas limiter les connexions (c'est un client unique)
    ...timeouts,
  };
  
  // Log de configuration pour diagnostic
  if (isVercel || isProduction) {
    console.log('[DB] ✅ Configuration PG client:', {
      host: dbHost,
      sslMode,
      rejectUnauthorized: sslConfig === false ? 'N/A' : (sslConfig as any).rejectUnauthorized === false ? 'false (no-verify)' : 'true (standard)',
      connectionTimeout: timeouts.connectionTimeoutMillis + 'ms',
      queryTimeout: timeouts.query_timeout + 'ms',
      keepAlive: config.keepAlive,
      isPooler: isPooler,
      isSupabase: isSupabase,
    });
  }
  
  return config;
}

/**
 * Wrapper pour exécuter une requête PostgreSQL avec timeout strict
 * Utilise Promise.race pour garantir qu'une requête ne bloque jamais plus de 5s
 */
export async function executeQueryWithTimeout<T>(
  client: Client,
  query: string,
  params?: any[],
  timeoutMs: number = 3000 // 3s strict pour éviter timeouts 30s
): Promise<T> {
  const isVercel = !!process.env.VERCEL;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isVercel && !isProduction) {
    // En dev, pas de timeout strict
    const result = await client.query(query, params);
    return result as T;
  }

  // En prod, timeout strict de 5s
  const queryPromise = client.query(query, params);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([queryPromise, timeoutPromise]) as T;
  } catch (error: any) {
    // Si c'est un timeout, logger et re-throw
    if (error.message.includes('timeout')) {
      console.error(`[DB] Query timeout after ${timeoutMs}ms: ${query.substring(0, 100)}...`);
    }
    throw error;
  }
}

/**
 * Crée un nouveau client PostgreSQL avec la configuration optimisée
 * IMPORTANT: Toujours appeler client.end() après utilisation dans un environnement serverless
 * 
 * Le CA est déjà injecté dans createPgClientConfig() - pas besoin de branchement ici
 */
export function createPgClient(connectionString?: string): Client {
  const config = createPgClientConfig(connectionString);
  
  // Log SSL config summary en prod Vercel uniquement (pour diagnostic)
  if (process.env.VERCEL && process.env.NODE_ENV === "production") {
    const caOpt: any = (config as any).ssl?.ca;
    const caCount = Array.isArray(caOpt) ? caOpt.length : caOpt ? 1 : 0;
    const caLen = Array.isArray(caOpt)
      ? caOpt.reduce((sum: number, c: any) => sum + String(c).length, 0)
      : caOpt
        ? String(caOpt).length
        : 0;

    console.log("[DB] SSL config summary:", {
      hasSsl: !!(config as any).ssl,
      hasCustomCa: !!readPgRootCaFromEnv(),
      caCount,
      caLen,
      rejectUnauthorized: (config as any).ssl?.rejectUnauthorized === true,
    });
  }
  
  return new Client(config);
}

/**
 * Crée un pool PostgreSQL avec la configuration optimisée
 * Le CA est déjà injecté dans createPgClientConfig() - pas besoin de branchement ici
 */
export function createPgPool(connectionString?: string): Pool {
  const baseClientConfig = createPgClientConfig(connectionString);
  
  // Construire la config Pool à partir de la config Client
  const config: PoolConfig = {
    connectionString: baseClientConfig.connectionString as string,
    ...(baseClientConfig.ssl ? { ssl: baseClientConfig.ssl as any } : {}),
    ...(process.env.VERCEL || process.env.NODE_ENV === 'production'
      ? { connectionTimeoutMillis: 3000, query_timeout: 3000, idleTimeoutMillis: 10000 }
      : {}),
    max: 1, // Serverless: 1 connexion max par fonction
  };
  
  return new Pool(config);
}

