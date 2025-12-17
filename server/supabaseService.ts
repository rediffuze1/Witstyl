import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Configuration Supabase côté serveur - Lazy initialization pour éviter les erreurs au top-level
let supabaseUrl: string | undefined;
let supabaseAnonKey: string | undefined;
let supabaseServiceRoleKey: string | undefined;

// Fonction pour initialiser et vérifier les variables d'environnement
function ensureSupabaseConfig() {
  if (!supabaseUrl) {
    supabaseUrl = process.env.SUPABASE_URL;
  }
  if (!supabaseAnonKey) {
    supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  }
  if (!supabaseServiceRoleKey) {
    supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
    throw new Error(
      `Variables d'environnement Supabase manquantes: ${missing.join(', ')}. ` +
      `Vérifiez votre configuration dans Vercel Dashboard > Settings > Environment Variables.`
    );
  }

  if (!supabaseServiceRoleKey) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY manquant : certaines opérations serveur seront limitées');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey: supabaseServiceRoleKey || supabaseAnonKey,
  };
}

// Clients Supabase - Initialisation lazy
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    const config = ensureSupabaseConfig();
    _supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });
  }
  return _supabase;
}

function getSupabaseAdminClient(): SupabaseClient {
  if (!_supabaseAdmin) {
    const config = ensureSupabaseConfig();
    _supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _supabaseAdmin;
}

// Export des clients (lazy)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient];
  },
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseAdminClient()[prop as keyof SupabaseClient];
  },
});

// Types pour l'authentification côté serveur
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profileImageUrl?: string;
}

export interface SalonOwner {
  id: string;
  userId: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
}

// Service d'authentification pour les propriétaires de salon
export class SalonAuthService {
  // Fonction utilitaire pour normaliser les emails en minuscules
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  // Inscription d'un propriétaire de salon
  // Note: userId est optionnel - si fourni, l'utilisateur a déjà été créé côté client avec signUp
  static async registerOwner(ownerData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    salonName: string;
    salonAddress: string;
    salonPhone: string;
    salonEmail: string;
    salonDescription?: string;
    userId?: string; // ID de l'utilisateur créé côté client (si signUp déjà fait)
  }) {
    try {
      const adminClient = getSupabaseAdminClient();

      let userId: string;
      let authUser: any;

      // Si userId est fourni, l'utilisateur a déjà été créé côté client avec signUp
      if (ownerData.userId) {
        console.log('[SalonAuthService] Utilisateur déjà créé côté client, userId:', ownerData.userId);
        userId = ownerData.userId;
        
        // Récupérer l'utilisateur depuis Supabase Auth
        const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId);
        if (userError || !userData.user) {
          throw new Error(`Erreur de récupération utilisateur: ${userError?.message || 'Utilisateur non trouvé'}`);
        }
        authUser = userData.user;
      } else {
        // Sinon, créer l'utilisateur avec admin (legacy - ne devrait plus être utilisé)
        console.log('[SalonAuthService] ⚠️ Création utilisateur via admin (legacy)');
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email: ownerData.email,
          password: ownerData.password,
          user_metadata: {
            first_name: ownerData.firstName,
            last_name: ownerData.lastName,
            phone: ownerData.phone,
          },
          email_confirm: false, // Nécessite confirmation email
        });

        if (authError) {
          throw new Error(`Erreur d'authentification: ${authError.message}`);
        }

        if (!authData.user) {
          throw new Error("Erreur d'authentification: Utilisateur non créé");
        }

        userId = authData.user.id;
        authUser = authData.user;
      }

      // Normaliser l'email en minuscules
      const normalizedEmail = this.normalizeEmail(ownerData.email);
      console.log('[SalonAuthService] Email normalisé pour inscription:', ownerData.email, '→', normalizedEmail);

      // 2. Créer l'entrée utilisateur dans la table users (email en minuscules)
      const { error: userError } = await adminClient
        .from('users')
        .insert({
          id: userId,
          email: normalizedEmail, // Email normalisé en minuscules
          password_hash: 'supabase_auth', // Le hash est géré par Supabase Auth
          first_name: ownerData.firstName,
          last_name: ownerData.lastName,
          phone: ownerData.phone,
        });

      if (userError) {
        console.error("Erreur lors de la création de l'utilisateur:", userError);
        // Ne pas échouer si l'utilisateur existe déjà
      }

      // 3. Créer le salon
      const { data: salonData, error: salonError } = await adminClient
        .from('salons')
        .insert({
          id: `salon-${userId}`,
          user_id: userId,
          name: ownerData.salonName,
          address: ownerData.salonAddress,
          phone: ownerData.salonPhone,
          email: ownerData.salonEmail,
          description: ownerData.salonDescription,
        })
        .select()
        .single();

      if (salonError) {
        throw new Error(`Erreur de création du salon: ${salonError.message}`);
      }

      return {
        success: true,
        message: 'Salon account created successfully',
        user: {
          id: userId,
          email: authUser.email,
          firstName: ownerData.firstName,
          lastName: ownerData.lastName,
          phone: ownerData.phone,
        },
        salon: salonData,
      };
    } catch (error: any) {
      console.error("Erreur lors de l'inscription:", error);
      throw new Error(`Erreur d'authentification: ${error.message}`);
    }
  }

  // Connexion d'un propriétaire de salon
  static async loginOwner(email: string, password: string) {
    const startTime = Date.now();
    try {
      const adminClient = getSupabaseAdminClient();

      // Normaliser l'email en minuscules avant la connexion
      const normalizedEmail = this.normalizeEmail(email);
      console.log('[SalonAuthService] Email normalisé pour login:', email, '→', normalizedEmail);

      console.log('[SalonAuthService] 🔐 Appel Supabase Auth signInWithPassword...');
      const authStartTime = Date.now();
      const { data, error } = await adminClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      const authDuration = Date.now() - authStartTime;
      console.log(`[SalonAuthService] ✅ Supabase Auth répondu en ${authDuration}ms`);

      if (error) {
        // Messages d'erreur plus clairs selon le type d'erreur
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Email ou mot de passe incorrect.');
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Votre email n\'a pas été confirmé. Vérifiez votre boîte mail.');
        }
        throw new Error(`Erreur de connexion: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('Erreur de connexion: Utilisateur non trouvé');
      }

      // Récupérer les informations du salon (avec maybeSingle pour éviter l'erreur si aucun salon)
      console.log('[SalonAuthService] 🔍 Récupération du salon pour userId:', data.user.id);
      const salonStartTime = Date.now();
      const { data: salonData, error: salonError } = await adminClient
        .from('salons')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle();
      const salonDuration = Date.now() - salonStartTime;
      console.log(`[SalonAuthService] ✅ Récupération salon terminée en ${salonDuration}ms`);

      if (salonError && salonError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, ce qui est OK
        console.warn('[SalonAuthService] Erreur lors de la récupération du salon:', salonError);
      }

      const totalDuration = Date.now() - startTime;
      console.log(`[SalonAuthService] ✅ Login complet en ${totalDuration}ms (Auth: ${authDuration}ms, Salon: ${salonDuration}ms)`);
      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email || normalizedEmail,
          firstName: data.user.user_metadata?.first_name || '',
          lastName: data.user.user_metadata?.last_name || '',
          phone: data.user.user_metadata?.phone || '',
        },
        salon: salonData || null,
        session: data.session,
      };
    } catch (error: any) {
      console.error('[SalonAuthService] Erreur lors de la connexion:', error);
      // Propager l'erreur avec un message clair
      if (error.message) {
        throw error;
      }
      throw new Error(`Erreur de connexion: ${error.message || 'Une erreur inattendue est survenue'}`);
    }
  }

  // Obtenir l'utilisateur actuel
  static async getCurrentUser(sessionToken?: string): Promise<AuthUser | null> {
    try {
      const config = ensureSupabaseConfig();
      let user;

      if (sessionToken) {
        // Créer un client Supabase avec le token de session
        const supabaseWithToken = createClient(config.supabaseUrl, config.supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          },
          auth: {
            persistSession: false,
          },
        });

        const { data, error } = await supabaseWithToken.auth.getUser();
        if (error || !data.user) {
          console.error('Erreur getCurrentUser avec token:', error);
          return null;
        }
        user = data.user;
      } else {
        // Utiliser la session actuelle
        const adminClient = getSupabaseAdminClient();
        const { data: { user: currentUser }, error } = await adminClient.auth.getUser();
        if (error || !currentUser) return null;
        user = currentUser;
      }

      return {
        id: user.id,
        email: user.email || '',
        firstName: user.user_metadata?.first_name || '',
        lastName: user.user_metadata?.last_name || '',
        phone: user.user_metadata?.phone || '',
        profileImageUrl: user.user_metadata?.profile_image_url,
      };
    } catch (error: any) {
      console.error('Erreur lors de la récupération utilisateur:', error);
      return null;
    }
  }

  // Déconnexion
  static async logout() {
    try {
      const adminClient = getSupabaseAdminClient();
      const { error } = await adminClient.auth.signOut();
      if (error) {
        console.error("Erreur lors de la déconnexion:", error);
      }
    } catch (error: any) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  }
}

// Service d'authentification pour les clients
export class ClientAuthService {
  // Placeholder pour l'authentification client
  static async registerClient(clientData: any) {
    // TODO: Implémenter l'inscription client
    throw new Error('Client registration not implemented yet');
  }

  static async loginClient(email: string, password: string) {
    // TODO: Implémenter la connexion client
    throw new Error('Client login not implemented yet');
  }
}

// Fonctions utilitaires pour les opérations de base de données
export const dbUtils = {
  // Vérifier la connexion à la base de données
  async checkConnection(): Promise<boolean> {
    try {
      const adminClient = getSupabaseAdminClient();
      const { error } = await adminClient.from('users').select('id').limit(1);

      return !error;
    } catch (error) {
      console.error('Erreur de connexion à la base de données:', error);
      return false;
    }
  },

  // Obtenir les statistiques de la base de données
  async getStats() {
    try {
      const adminClient = getSupabaseAdminClient();
      const tables = ['users', 'salons', 'services', 'stylistes', 'clients', 'appointments'];
      const stats: Record<string, number> = {};

      for (const table of tables) {
        const { count, error } = await adminClient
          .from(table)
          .select('*', { count: 'exact', head: true });

        stats[table] = error ? 0 : count || 0;
      }

      return stats;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return {};
    }
  },
};
