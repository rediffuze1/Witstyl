import { Client, ClientConfig, Pool, PoolConfig } from 'pg';

export function createPgClientConfig(connectionString: string): ClientConfig {
  return {
    connectionString,
    ssl: {
      rejectUnauthorized: true
    }
  };
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

export function createPgClient(connectionString?: string): Client {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL est requise pour créer un client PostgreSQL');
  }
  const config = createPgClientConfig(url);
  return new Client(config);
}

export function createPgPool(connectionString?: string): Pool {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL est requise pour créer un pool PostgreSQL');
  }
  const baseClientConfig = createPgClientConfig(url);
  
  const config: PoolConfig = {
    connectionString: baseClientConfig.connectionString as string,
    ssl: baseClientConfig.ssl as any,
    ...(process.env.VERCEL || process.env.NODE_ENV === 'production'
      ? { connectionTimeoutMillis: 3000, query_timeout: 3000, idleTimeoutMillis: 10000 }
      : {}),
    max: 1,
  };
  
  return new Pool(config);
}

