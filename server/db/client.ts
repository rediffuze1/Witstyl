/**
 * Configuration PostgreSQL optimisée pour Supabase Pooler (Transaction Mode)
 * Compatible avec Vercel serverless et Supabase Supavisor
 */

import { Client, ClientConfig, Pool, PoolConfig } from 'pg';

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
 * Convertit les \n échappés en vrais sauts de ligne
 */
function readPgRootCaFromEnv(): string | undefined {
  const raw = process.env.PGSSLROOTCERT;
  if (!raw) return undefined;
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
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
  const pgSslCa = readPgRootCaFromEnv();
  
  let sslConfig: { rejectUnauthorized: boolean; ca?: string } | boolean = false;
  let sslMode = 'DISABLED';
  
  // Détecter si SSL est requis depuis l'URL
  const urlRequiresSsl = DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('sslmode=prefer');
  
  if (urlRequiresSsl || isPooler || isSupabase) {
    // SSL requis : utiliser configuration explicite
    if (pgSslCa) {
      // Certificat CA fourni : SSL sécurisé avec CA personnalisé
      // INTERDIT: rejectUnauthorized: false si CA fourni
      sslConfig = { 
        rejectUnauthorized: true, // Toujours true si CA fourni
        ca: pgSslCa // PEM avec sauts de ligne réels
      };
      sslMode = 'ENABLED (rejectUnauthorized: true, CA provided)';
    } else {
      // Pas de CA : SSL sécurisé par défaut
      // INTERDIT: rejectUnauthorized: false en production
      sslConfig = { rejectUnauthorized: true };
      sslMode = 'ENABLED (rejectUnauthorized: true - secure)';
    }
  } else if (isProduction && !isVercel) {
    // Production locale : SSL standard
    sslConfig = true;
    sslMode = 'ENABLED (standard verification)';
  }
  
  // Log de diagnostic uniquement en dev
  devLogSslDiagnostic({
    hasRootCa: !!pgSslCa,
    sslRejectUnauthorized: sslConfig === false ? false : (typeof sslConfig === 'object' ? sslConfig.rejectUnauthorized : true),
    caLength: pgSslCa ? pgSslCa.length : 0,
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
      hasCa: !!pgSslCa,
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
 * Patch SSL: injecte directement le CA depuis PGSSLROOTCERT pour éviter SELF_SIGNED_CERT_IN_CHAIN
 * IMPORTANT: Toujours utiliser createPgClientConfig() pour conserver la logique de nettoyage du DSN
 */
export function createPgClient(connectionString?: string): Client {
  const DATABASE_URL = connectionString || process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL est requise pour créer un client PostgreSQL');
  }
  
  // Lire le certificat CA depuis PGSSLROOTCERT
  const ca = readPgRootCaFromEnv();
  
  // Toujours partir de la config existante (ne rien casser: pooler/pgbouncer/clean DSN/etc.)
  const config: ClientConfig = createPgClientConfig(connectionString);
  
  // Si CA fourni, on override uniquement la partie SSL
  // Cela garantit que le CA est bien injecté même si createPgClientConfig() ne l'a pas détecté
  if (ca) {
    config.ssl = { rejectUnauthorized: true, ca };
  }
  
  // Log de diagnostic en dev
  devLogSslDiagnostic({
    hasRootCa: !!ca,
    sslRejectUnauthorized: config.ssl === false ? false : true,
    caLength: ca ? ca.length : 0,
  });
  
  return new Client(config);
}

/**
 * Crée un pool PostgreSQL avec la configuration optimisée
 * Si Pool est utilisé ailleurs, applique le même patch SSL
 * IMPORTANT: Utilise createPgClientConfig() comme base pour conserver la logique de nettoyage du DSN
 */
export function createPgPool(connectionString?: string): Pool {
  const DATABASE_URL = connectionString || process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL est requise pour créer un pool PostgreSQL');
  }
  
  // Lire le certificat CA depuis PGSSLROOTCERT
  const ca = readPgRootCaFromEnv();
  
  // Utiliser createPgClientConfig() comme base pour conserver la logique de nettoyage du DSN
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
  
  // Si CA fourni, on override uniquement la partie SSL
  if (ca) {
    config.ssl = { rejectUnauthorized: true, ca };
  }
  
  // Log de diagnostic en dev
  devLogSslDiagnostic({
    hasRootCa: !!ca,
    sslRejectUnauthorized: config.ssl === false ? false : true,
    caLength: ca ? ca.length : 0,
  });
  
  return new Pool(config);
}

