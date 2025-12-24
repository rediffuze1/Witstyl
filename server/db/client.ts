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
 * IMPORTANT: PGSSLROOTCERT peut contenir plusieurs certificats PEM concaténés
 * (collés l'un à la suite de l'autre). C'est OK avec pg.
 * Exemple: si Supabase fournit un CA "db direct" + un CA "pooler" + un bundle,
 * vous pouvez tous les concaténer dans PGSSLROOTCERT (garder \\n échappés).
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

  return s.includes("BEGIN CERTIFICATE") ? s : undefined;
}

/**
 * Construit les options SSL pour PostgreSQL
 * 
 * IMPORTANT: on ne veut jamais casser les roots par défaut.
 * On ajoute le CA custom en PLUS des roots Node.
 * Force SNI (servername) pour éviter que le serveur présente un mauvais cert "default".
 */
function buildPgSslOptions(opts: { host: string; ca?: string }) {
  const { host, ca } = opts;

  const mergedCa = ca
    ? [ca, ...tls.rootCertificates]
    : [...tls.rootCertificates];

  return {
    rejectUnauthorized: true as const,
    ca: mergedCa,
    servername: host, // SNI explicite
  };
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
  
  // Interdire NODE_TLS_REJECT_UNAUTHORIZED=0
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    console.warn('[DB] ⚠️ SÉCURITÉ: NODE_TLS_REJECT_UNAUTHORIZED=0 détecté - IGNORÉ (sécurité)');
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; // Utiliser la valeur par défaut (1)
  }
  
  // Lire le certificat CA depuis PGSSLROOTCERT (sans fallback)
  const ca = readPgRootCaFromEnv();
  
  // Nettoyer l'URL pour éviter les conflits avec la config SSL côté code
  let cleanConnectionStringOrDatabaseUrl = DATABASE_URL;
  
  if ((isPooler || isSupabase) && !DATABASE_URL.includes('sslmode=')) {
    const separator = cleanConnectionStringOrDatabaseUrl.includes('?') ? '&' : '?';
    cleanConnectionStringOrDatabaseUrl = `${cleanConnectionStringOrDatabaseUrl}${separator}sslmode=require`;
  }
  
  // Construire la config SSL avec SNI explicite
  const url = new URL(cleanConnectionStringOrDatabaseUrl);
  const host = url.hostname;
  
  // Détecter si SSL est requis depuis l'URL
  const urlRequiresSsl = cleanConnectionStringOrDatabaseUrl.includes('sslmode=require') || cleanConnectionStringOrDatabaseUrl.includes('sslmode=prefer');
  
  let sslConfig: { rejectUnauthorized: boolean; ca?: string | string[]; servername?: string } | boolean = false;
  
  if (urlRequiresSsl || isPooler || isSupabase) {
    // SSL requis : utiliser buildPgSslOptions avec SNI
    sslConfig = buildPgSslOptions({ host, ca });
  } else if (isProduction && !isVercel) {
    // Production locale : SSL standard
    sslConfig = true;
  }
  
  // Timeouts agressifs pour éviter les FUNCTION_INVOCATION_TIMEOUT sur Vercel
  // Actifs uniquement en production/Vercel
  const timeouts = (isVercel || isProduction) ? {
    connectionTimeoutMillis: 3000, // 3s max pour établir la connexion (agressif)
    query_timeout: 3000, // 3s max pour chaque requête (agressif)
    idleTimeoutMillis: 10000, // 10s max d'inactivité
  } : {};
  
  const config: ClientConfig = {
    connectionString: cleanConnectionStringOrDatabaseUrl,
    // IMPORTANT: SSL configuré avec rejectUnauthorized: true (sécurisé)
    // Si PGSSLROOTCERT fourni, utilise le certificat CA personnalisé + root certificates Node
    // SNI explicite pour éviter les certificats "par défaut"
    ssl: sslConfig,
    // Configuration optimisée pour serverless
    keepAlive: true, // Maintenir la connexion active (important pour pgbouncer)
    ...timeouts,
  };
  
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
  
  const client = new Client(config);
  
  // Intercepter les erreurs SSL pour logging safe
  client.on('error', (error: any) => {
    if (error?.code === 'SELF_SIGNED_CERT_IN_CHAIN' || error?.message?.includes('certificate') || error?.message?.includes('SSL')) {
      try {
        const url = new URL(config.connectionString as string);
        const host = url.hostname;
        const ca = readPgRootCaFromEnv();
        console.error("[DB] TLS target:", {
          host,
          port: url.port || "(default)",
          hasCa: !!ca,
          caLen: ca?.length ?? 0,
        });
      } catch {
        // Ignore URL parsing errors
      }
    }
  });
  
  return client;
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

