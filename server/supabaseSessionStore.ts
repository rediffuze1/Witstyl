/**
 * Store de session Express basé sur Supabase
 * Utilise la table 'sessions' pour persister les sessions entre les invocations serverless
 */

import session from 'express-session';
import { createClient } from '@supabase/supabase-js';

interface SessionData {
  sid: string;
  sess: any;
  expire: Date;
}

class SupabaseSessionStore extends session.Store {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    super();
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour SupabaseSessionStore');
    }

    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }

  async get(sid: string, callback: (err?: any, session?: session.SessionData | null) => void) {
    try {
      const { data, error } = await this.supabase
        .from('sessions')
        .select('sess, expire')
        .eq('sid', sid)
        .single();

      if (error || !data) {
        return callback(null, null);
      }

      // Vérifier si la session a expiré
      const expire = new Date(data.expire);
      if (expire < new Date()) {
        // Supprimer la session expirée
        await this.destroy(sid);
        return callback(null, null);
      }

      callback(null, data.sess);
    } catch (err) {
      callback(err);
    }
  }

  async set(sid: string, session: session.SessionData, callback?: (err?: any) => void) {
    try {
      const expire = new Date(Date.now() + (session.cookie?.maxAge || 24 * 60 * 60 * 1000));

      const { error } = await this.supabase
        .from('sessions')
        .upsert({
          sid,
          sess: session,
          expire: expire.toISOString(),
        }, {
          onConflict: 'sid',
        });

      if (error) {
        return callback?.(error);
      }

      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      const { error } = await this.supabase
        .from('sessions')
        .delete()
        .eq('sid', sid);

      if (error) {
        return callback?.(error);
      }

      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async touch(sid: string, session: session.SessionData, callback?: (err?: any) => void) {
    try {
      const expire = new Date(Date.now() + (session.cookie?.maxAge || 24 * 60 * 60 * 1000));

      const { error } = await this.supabase
        .from('sessions')
        .update({ expire: expire.toISOString() })
        .eq('sid', sid);

      if (error) {
        return callback?.(error);
      }

      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async all(callback: (err?: any, obj?: { [sid: string]: session.SessionData } | null) => void) {
    try {
      const { data, error } = await this.supabase
        .from('sessions')
        .select('sid, sess, expire');

      if (error) {
        return callback(error);
      }

      const sessions: { [sid: string]: session.SessionData } = {};
      const now = new Date();

      for (const row of data || []) {
        const expire = new Date(row.expire);
        if (expire >= now) {
          sessions[row.sid] = row.sess;
        }
      }

      callback(null, sessions);
    } catch (err) {
      callback(err);
    }
  }

  async length(callback: (err?: any, length?: number) => void) {
    try {
      const { count, error } = await this.supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .gte('expire', new Date().toISOString());

      if (error) {
        return callback(error);
      }

      callback(null, count || 0);
    } catch (err) {
      callback(err);
    }
  }

  async clear(callback?: (err?: any) => void) {
    try {
      const { error } = await this.supabase
        .from('sessions')
        .delete()
        .neq('sid', ''); // Supprimer toutes les sessions

      if (error) {
        return callback?.(error);
      }

      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }
}

export default SupabaseSessionStore;

