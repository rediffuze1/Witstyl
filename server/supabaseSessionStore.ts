/**
 * Store de session Express basé sur PostgreSQL
 * Utilise la table 'express_sessions' pour persister les sessions entre les invocations serverless
 * Utilise une connexion PostgreSQL directe pour éviter les problèmes avec l'API REST
 */

import session from 'express-session';
import { Client } from 'pg';
// IMPORTANT: En ESM, les imports relatifs doivent inclure l'extension .js
import { createPgClient, executeQueryWithTimeout } from './db/client.js';

interface SessionData {
  sid: string;
  sess: any;
  expire: Date;
}

class SupabaseSessionStore extends session.Store {
  private getClient: () => Promise<Client>;

  constructor() {
    super();
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL est requis pour SupabaseSessionStore');
    }

    // Créer une fonction qui retourne un nouveau client PostgreSQL à chaque fois
    // (pour éviter les problèmes de connexion persistante dans un environnement serverless)
    // Utilise la configuration optimisée pour Supabase Pooler avec timeout strict
    const isVercel = !!process.env.VERCEL;
    const isProduction = process.env.NODE_ENV === 'production';
    const connectionTimeoutMs = (isVercel || isProduction) ? 3000 : 10000; // 3s en prod, 10s en dev

    this.getClient = async () => {
      const client = createPgClient(DATABASE_URL);
      
      // Log runtime de la config SSL juste avant connect()
      // Important pour diagnostiquer les erreurs SELF_SIGNED_CERT_IN_CHAIN
      const config = (client as any).connectionParameters || {};
      const sslConfig = config.ssl;
      const host = config.host || 'unknown';
      console.log('[SupabaseSessionStore] Connexion PG:', {
        host,
        'typeof config.ssl': typeof sslConfig,
        'config.ssl.rejectUnauthorized': sslConfig?.rejectUnauthorized,
        'NODE_TLS_REJECT_UNAUTHORIZED': process.env.NODE_TLS_REJECT_UNAUTHORIZED,
      });
      
      // Timeout strict pour la connexion
      const connectPromise = client.connect();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          client.end().catch(() => {});
          reject(new Error(`Connection timeout after ${connectionTimeoutMs}ms`));
        }, connectionTimeoutMs);
      });

      try {
        await Promise.race([connectPromise, timeoutPromise]);
        return client;
      } catch (error: any) {
        await client.end().catch(() => {});
        throw error;
      }
    };
  }

  async get(sid: string, callback: (err?: any, session?: session.SessionData | null) => void) {
    let client: Client | null = null;
    try {
      client = await this.getClient();
      const result = await executeQueryWithTimeout(
        client,
        'SELECT sess, expire FROM express_sessions WHERE sid = $1',
        [sid],
        3000 // 3s max pour récupérer une session
      );

      if (result.rows.length === 0) {
        return callback(null, null);
      }

      const row = result.rows[0];

      // Vérifier si la session a expiré
      const expire = new Date(row.expire);
      if (expire < new Date()) {
        // Supprimer la session expirée (sans attendre)
        this.destroy(sid, () => {}); // Fire and forget
        return callback(null, null);
      }

      callback(null, row.sess);
    } catch (err: any) {
      const isTimeout = err.message?.includes('timeout');
      if (isTimeout) {
        console.warn('[SupabaseSessionStore] Timeout lors de la récupération de la session (DB lente ou indisponible)');
      } else {
        console.error('[SupabaseSessionStore] Exception lors de la récupération de la session:', err.message);
      }
      // En cas d'exception/timeout, on retourne null plutôt que de propager l'erreur
      // Cela permet à l'app de continuer même si le store est indisponible
      callback(null, null);
    } finally {
      if (client) {
        await client.end().catch(() => {}); // Ignorer les erreurs de fermeture
      }
    }
  }

  async set(sid: string, session: session.SessionData, callback?: (err?: any) => void) {
    let client: Client | null = null;
    try {
      client = await this.getClient();
      const expire = new Date(Date.now() + (session.cookie?.maxAge || 24 * 60 * 60 * 1000));

      await executeQueryWithTimeout(
        client,
        `INSERT INTO express_sessions (sid, sess, expire)
         VALUES ($1, $2, $3)
         ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
        [sid, JSON.stringify(session), expire.toISOString()],
        3000 // 3s max pour sauvegarder une session
      );

      callback?.();
    } catch (err: any) {
      const isTimeout = err.message?.includes('timeout');
      if (isTimeout) {
        console.warn('[SupabaseSessionStore] Timeout lors de la sauvegarde de session (DB lente ou indisponible)');
      } else {
        console.error('[SupabaseSessionStore] Exception lors de la sauvegarde de session:', err.message);
      }
      // En cas d'erreur/timeout, on appelle le callback avec l'erreur
      // Express-session peut alors utiliser un fallback ou ignorer l'erreur
      callback?.(err);
    } finally {
      if (client) {
        await client.end().catch(() => {}); // Ignorer les erreurs de fermeture
      }
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    const client = await this.getClient();
    try {
      await client.query('DELETE FROM express_sessions WHERE sid = $1', [sid]);
      callback?.();
    } catch (err) {
      callback?.(err);
    } finally {
      await client.end();
    }
  }

  async touch(sid: string, session: session.SessionData, callback?: (err?: any) => void) {
    const client = await this.getClient();
    try {
      const expire = new Date(Date.now() + (session.cookie?.maxAge || 24 * 60 * 60 * 1000));

      await client.query(
        'UPDATE express_sessions SET expire = $1 WHERE sid = $2',
        [expire.toISOString(), sid]
      );

      callback?.();
    } catch (err) {
      callback?.(err);
    } finally {
      await client.end();
    }
  }

  async all(callback: (err?: any, obj?: { [sid: string]: session.SessionData } | null) => void) {
    const client = await this.getClient();
    try {
      const result = await client.query('SELECT sid, sess, expire FROM express_sessions');

      const sessions: { [sid: string]: session.SessionData } = {};
      const now = new Date();

      for (const row of result.rows) {
        const expire = new Date(row.expire);
        if (expire >= now) {
          sessions[row.sid] = row.sess;
        }
      }

      callback(null, sessions);
    } catch (err) {
      callback(err);
    } finally {
      await client.end();
    }
  }

  async length(callback: (err?: any, length?: number) => void) {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM express_sessions WHERE expire >= $1',
        [new Date().toISOString()]
      );

      callback(null, parseInt(result.rows[0].count, 10) || 0);
    } catch (err) {
      callback(err);
    } finally {
      await client.end();
    }
  }

  async clear(callback?: (err?: any) => void) {
    const client = await this.getClient();
    try {
      await client.query('DELETE FROM express_sessions');
      callback?.();
    } catch (err) {
      callback?.(err);
    } finally {
      await client.end();
    }
  }
}

export default SupabaseSessionStore;

