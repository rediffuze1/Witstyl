/**
 * Configuration PostgreSQL optimisée pour Supabase Pooler (Transaction Mode)
 * Compatible avec Vercel serverless et Supabase Supavisor
 */

import { Client, ClientConfig } from 'pg';

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
  
  // Extraire le host pour les logs
  let dbHost = 'unknown';
  try {
    const urlObj = new URL(DATABASE_URL);
    dbHost = urlObj.hostname;
  } catch (e) {
    // Ignorer si l'URL ne peut pas être parsée
  }
  
  // Configuration SSL - Sécurisée par défaut avec support certificat CA Supabase
  // Support PG_SSL_CA (PEM multi-line) pour certificat CA personnalisé
  // Par défaut: rejectUnauthorized: true (sécurisé)
  // Override possible via PG_SSL_REJECT_UNAUTHORIZED=false si nécessaire
  const pgSslCa = process.env.PG_SSL_CA;
  const pgSslRejectUnauthorized = process.env.PG_SSL_REJECT_UNAUTHORIZED;
  const shouldRejectUnauthorized = pgSslRejectUnauthorized === undefined 
    ? true // Par défaut: sécurisé
    : pgSslRejectUnauthorized.toLowerCase() !== 'false'; // Respecter l'override si fourni
  
  let sslConfig: { rejectUnauthorized: boolean; ca?: string } | boolean = false;
  let sslMode = 'DISABLED';
  
  // Détecter si SSL est requis depuis l'URL
  const urlRequiresSsl = DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('sslmode=prefer');
  
  if (urlRequiresSsl || isPooler || isSupabase) {
    // SSL requis : utiliser configuration explicite
    if (pgSslCa) {
      // Certificat CA fourni : SSL sécurisé avec CA personnalisé
      sslConfig = { 
        rejectUnauthorized: true, // Toujours true si CA fourni
        ca: pgSslCa // PEM multi-line
      };
      sslMode = 'ENABLED (rejectUnauthorized: true, CA provided)';
    } else {
      // Pas de CA : utiliser rejectUnauthorized selon override
      sslConfig = { rejectUnauthorized: shouldRejectUnauthorized };
      sslMode = shouldRejectUnauthorized 
        ? 'ENABLED (rejectUnauthorized: true - secure)' 
        : 'ENABLED (rejectUnauthorized: false - override)';
    }
  } else if (isProduction && !isVercel) {
    // Production locale : SSL standard
    sslConfig = true;
    sslMode = 'ENABLED (standard verification)';
  }
  
  // Log SSL explicite pour diagnostic (toujours en prod/Vercel)
  if (isVercel || isProduction) {
    const sslEnabled = sslConfig !== false;
    const rejectUnauthorizedValue = sslConfig === false 
      ? 'N/A' 
      : typeof sslConfig === 'object' 
        ? (sslConfig.rejectUnauthorized ? 'true (secure)' : 'false (override)')
        : 'true (standard)';
    
    console.log('[DB] 🔐 Configuration SSL:', {
      sslEnabled,
      sslMode,
      rejectUnauthorized: rejectUnauthorizedValue,
      host: dbHost,
      port: dbPort,
      isPooler,
      isSupabase,
      pgbouncerDetected: DATABASE_URL.includes('pgbouncer=true'),
      sslmodeInUrl: DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('sslmode=prefer'),
      caProvided: !!pgSslCa,
      caLength: pgSslCa ? pgSslCa.length : 0,
      pgSslOverride: pgSslRejectUnauthorized || 'none'
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
  // Pour Supabase pooler, on force rejectUnauthorized: false côté code, peu importe ce qui est dans l'URL
  let cleanConnectionString = DATABASE_URL;
  
  // Pour Supabase pooler, s'assurer que sslmode=require est présent dans l'URL (pour compatibilité)
  // Mais la vraie config SSL est forcée côté code avec rejectUnauthorized: false
  if ((isPooler || isSupabase) && !DATABASE_URL.includes('sslmode=')) {
    const separator = cleanConnectionString.includes('?') ? '&' : '?';
    cleanConnectionString = `${cleanConnectionString}${separator}sslmode=require`;
  }
  
  const config: ClientConfig = {
    connectionString: cleanConnectionString,
    // IMPORTANT: Pour Supabase pooler, on FORCE rejectUnauthorized: false
    // Cela override toute config SSL dans l'URL (sslmode=require ne force pas rejectUnauthorized: false)
    ssl: sslConfig, // FORCÉ pour pooler Supabase (rejectUnauthorized: false)
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
 */
export function createPgClient(connectionString?: string): Client {
  const config = createPgClientConfig(connectionString);

  // DEBUG temporaire
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  const u = new URL(config.connectionString as string);
  console.log('[DB][DEBUG] sslmode in URL =', u.searchParams.get('sslmode'));
  console.log('[DB][DEBUG] config.ssl =', config.ssl);
  console.log('[DB][DEBUG] PGSSLMODE =', process.env.PGSSLMODE);
  console.log('[DB][DEBUG] NODE_TLS_REJECT_UNAUTHORIZED =', process.env.NODE_TLS_REJECT_UNAUTHORIZED);
}

  return new Client(config);
}

