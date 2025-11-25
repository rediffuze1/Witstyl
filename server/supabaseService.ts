import { createClient } from '@supabase/supabase-js';

// Configuration Supabase côté serveur
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL et SUPABASE_ANON_KEY doivent être configurés dans .env');
}

if (!supabaseServiceRoleKey) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY manquant : certaines opérations serveur seront limitées');
}

// Client Supabase anonyme (pour les opérations publiques)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

// Client Supabase avec service role (pour les opérations admin)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
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
  }) {
    try {
      // 1. Créer l'utilisateur avec Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: ownerData.email,
        password: ownerData.password,
        user_metadata: {
          first_name: ownerData.firstName,
          last_name: ownerData.lastName,
          phone: ownerData.phone
        },
        email_confirm: true // Auto-confirmer l'email pour le développement
      });

      if (authError) {
        throw new Error(`Erreur d'authentification: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Erreur d\'authentification: Utilisateur non créé');
      }

      // Normaliser l'email en minuscules
      const normalizedEmail = this.normalizeEmail(ownerData.email);
      console.log('[SalonAuthService] Email normalisé pour inscription:', ownerData.email, '→', normalizedEmail);

      // 2. Créer l'entrée utilisateur dans la table users (email en minuscules)
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: normalizedEmail, // Email normalisé en minuscules
          password_hash: 'supabase_auth', // Le hash est géré par Supabase Auth
          first_name: ownerData.firstName,
          last_name: ownerData.lastName,
          phone: ownerData.phone
        });

      if (userError) {
        console.error('Erreur lors de la création de l\'utilisateur:', userError);
        // Ne pas échouer si l'utilisateur existe déjà
      }

      // 3. Créer le salon
      const { data: salonData, error: salonError } = await supabaseAdmin
        .from('salons')
        .insert({
          id: `salon-${authData.user.id}`,
          user_id: authData.user.id,
          name: ownerData.salonName,
          address: ownerData.salonAddress,
          phone: ownerData.salonPhone,
          email: ownerData.salonEmail,
          description: ownerData.salonDescription
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
          id: authData.user.id,
          email: authData.user.email,
          firstName: ownerData.firstName,
          lastName: ownerData.lastName,
          phone: ownerData.phone
        },
        salon: salonData
      };

    } catch (error: any) {
      console.error('Erreur lors de l\'inscription:', error);
      throw new Error(`Erreur d'authentification: ${error.message}`);
    }
  }

  // Connexion d'un propriétaire de salon
  static async loginOwner(email: string, password: string) {
    try {
      // Normaliser l'email en minuscules avant la connexion
      const normalizedEmail = this.normalizeEmail(email);
      console.log('[SalonAuthService] Email normalisé pour login:', email, '→', normalizedEmail);
      
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) {
        throw new Error(`Erreur de connexion: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('Erreur de connexion: Utilisateur non trouvé');
      }

      // Récupérer les informations du salon
      const { data: salonData, error: salonError } = await supabaseAdmin
        .from('salons')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (salonError) {
        console.warn('Salon non trouvé pour l\'utilisateur:', salonError);
      }

      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.user_metadata?.first_name || '',
          lastName: data.user.user_metadata?.last_name || '',
          phone: data.user.user_metadata?.phone || ''
        },
        salon: salonData,
        session: data.session
      };

    } catch (error: any) {
      console.error('Erreur lors de la connexion:', error);
      throw new Error(`Erreur de connexion: ${error.message}`);
    }
  }

  // Obtenir l'utilisateur actuel
  static async getCurrentUser(sessionToken?: string): Promise<AuthUser | null> {
    try {
      let user;
      
      if (sessionToken) {
        // Créer un client Supabase avec le token de session
        // supabaseAnonKey est vérifié au début du fichier (ligne 8-10), donc il ne peut pas être undefined ici
        if (!supabaseAnonKey) {
          console.error('SUPABASE_ANON_KEY manquant pour getCurrentUser');
          return null;
        }
        // Utiliser non-null assertion car on vient de vérifier
        const supabaseWithToken = createClient(supabaseUrl!, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${sessionToken}`
            }
          },
          auth: {
            persistSession: false
          }
        });
        
        const { data, error } = await supabaseWithToken.auth.getUser();
        if (error || !data.user) {
          console.error('Erreur getCurrentUser avec token:', error);
          return null;
        }
        user = data.user;
      } else {
        // Utiliser la session actuelle
        const { data: { user: currentUser }, error } = await supabaseAdmin.auth.getUser();
        if (error || !currentUser) return null;
        user = currentUser;
      }

      return {
        id: user.id,
        email: user.email || '',
        firstName: user.user_metadata?.first_name || '',
        lastName: user.user_metadata?.last_name || '',
        phone: user.user_metadata?.phone || '',
        profileImageUrl: user.user_metadata?.profile_image_url
      };

    } catch (error: any) {
      console.error('Erreur lors de la récupération utilisateur:', error);
      return null;
    }
  }

  // Déconnexion
  static async logout() {
    try {
      const { error } = await supabaseAdmin.auth.signOut();
      if (error) {
        console.error('Erreur lors de la déconnexion:', error);
      }
    } catch (error: any) {
      console.error('Erreur lors de la déconnexion:', error);
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
      const { data, error } = await supabaseAdmin
        .from('pg_catalog.pg_tables')
        .select('*')
        .limit(1);
      
      return !error;
    } catch (error) {
      console.error('Erreur de connexion à la base de données:', error);
      return false;
    }
  },

  // Obtenir les statistiques de la base de données
  async getStats() {
    try {
      const tables = ['users', 'salons', 'services', 'stylistes', 'clients', 'appointments'];
      const stats: Record<string, number> = {};

      for (const table of tables) {
        const { count, error } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        stats[table] = error ? 0 : count || 0;
      }

      return stats;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return {};
    }
  }
};