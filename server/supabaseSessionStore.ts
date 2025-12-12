/**
 * Store de session Express basé sur PostgreSQL
 * Utilise la table 'express_sessions' pour persister les sessions entre les invocations serverless
 * Utilise une connexion PostgreSQL directe pour éviter les problèmes avec l'API REST
 */

import session from 'express-session';
import { Client } from 'pg';

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
    this.getClient = async () => {
      const client = new Client({
        connectionString: DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' 
          ? { rejectUnauthorized: false } // Pour les certificats auto-signés Supabase
          : false,
      });
      await client.connect();
      return client;
    };
  }

  async get(sid: string, callback: (err?: any, session?: session.SessionData | null) => void) {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT sess, expire FROM express_sessions WHERE sid = $1',
        [sid]
      );

      if (result.rows.length === 0) {
        return callback(null, null);
      }

      const row = result.rows[0];

      // Vérifier si la session a expiré
      const expire = new Date(row.expire);
      if (expire < new Date()) {
        // Supprimer la session expirée
        await this.destroy(sid);
        return callback(null, null);
      }

      callback(null, row.sess);
    } catch (err: any) {
      console.error('[SupabaseSessionStore] Exception lors de la récupération de la session:', err);
      // En cas d'exception, on retourne null plutôt que de propager l'erreur
      callback(null, null);
    } finally {
      await client.end();
    }
  }

  async set(sid: string, session: session.SessionData, callback?: (err?: any) => void) {
    const client = await this.getClient();
    try {
      const expire = new Date(Date.now() + (session.cookie?.maxAge || 24 * 60 * 60 * 1000));

      await client.query(
        `INSERT INTO express_sessions (sid, sess, expire)
         VALUES ($1, $2, $3)
         ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
        [sid, JSON.stringify(session), expire.toISOString()]
      );

      callback?.();
    } catch (err: any) {
      console.error('[SupabaseSessionStore] Exception lors de la sauvegarde de session:', err);
      callback?.(err);
    } finally {
      await client.end();
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

