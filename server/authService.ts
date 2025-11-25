import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL et SUPABASE_ANON_KEY doivent être configurés dans .env');
}

// Créer le client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types pour l'authentification
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: ownerData.email,
        password: ownerData.password,
        options: {
          data: {
            first_name: ownerData.firstName,
            last_name: ownerData.lastName,
            phone: ownerData.phone,
          }
        }
      });

      if (authError) {
        throw new Error(`Erreur d'authentification: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Échec de la création du compte utilisateur');
      }

      // 2. Créer l'enregistrement utilisateur dans la table users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: ownerData.email,
          first_name: ownerData.firstName,
          last_name: ownerData.lastName,
          phone: ownerData.phone,
          is_active: true,
          email_verified: false
        })
        .select()
        .single();

      if (userError) {
        throw new Error(`Erreur de création utilisateur: ${userError.message}`);
      }

      // 3. Créer le salon
      const { data: salonData, error: salonError } = await supabase
        .from('salons')
        .insert({
          user_id: authData.user.id,
          name: ownerData.salonName,
          address: ownerData.salonAddress,
          phone: ownerData.salonPhone,
          email: ownerData.salonEmail,
          description: ownerData.salonDescription || '',
          is_active: true
        })
        .select()
        .single();

      if (salonError) {
        throw new Error(`Erreur de création salon: ${salonError.message}`);
      }

      return {
        user: userData,
        salon: salonData,
        authUser: authData.user,
        message: 'Compte salon créé avec succès'
      };

    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      throw error;
    }
  }

  // Connexion d'un propriétaire de salon
  static async loginOwner(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(`Erreur de connexion: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('Échec de la connexion');
      }

      // Récupérer les informations utilisateur
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userError) {
        throw new Error(`Erreur de récupération utilisateur: ${userError.message}`);
      }

      // Récupérer le salon
      const { data: salonData, error: salonError } = await supabase
        .from('salons')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (salonError) {
        console.warn('Aucun salon trouvé pour cet utilisateur:', salonError.message);
      }

      return {
        user: userData,
        salon: salonData,
        authUser: data.user,
        session: data.session
      };

    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      throw error;
    }
  }

  // Déconnexion
  static async logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(`Erreur de déconnexion: ${error.message}`);
      }
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw error;
    }
  }

  // Récupérer l'utilisateur actuel
  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        throw new Error(`Erreur de récupération utilisateur: ${error.message}`);
      }

      if (!user) {
        return null;
      }

      // Récupérer les informations utilisateur
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) {
        throw new Error(`Erreur de récupération données utilisateur: ${userError.message}`);
      }

      return userData;

    } catch (error) {
      console.error('Erreur lors de la récupération utilisateur:', error);
      return null;
    }
  }

  // Vérifier si l'utilisateur est connecté
  static async isAuthenticated() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        return false;
      }

      return !!session;
    } catch (error) {
      return false;
    }
  }
}

// Service d'authentification pour les clients
export class ClientAuthService {
  // Inscription d'un client
  static async registerClient(clientData: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
  }) {
    try {
      // 1. Créer l'utilisateur avec Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: clientData.email,
        password: clientData.password,
        options: {
          data: {
            first_name: clientData.firstName,
            last_name: clientData.lastName,
            phone: clientData.phone,
            user_type: 'client'
          }
        }
      });

      if (authError) {
        throw new Error(`Erreur d'authentification: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Échec de la création du compte client');
      }

      // 2. Créer l'enregistrement client dans la table clients
      const { data: createdClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          id: authData.user.id,
          first_name: clientData.firstName,
          last_name: clientData.lastName,
          email: clientData.email,
          phone: clientData.phone,
          is_active: true
        })
        .select()
        .single();

      if (clientError) {
        throw new Error(`Erreur de création client: ${clientError.message}`);
      }

      return {
        client: createdClient,
        authUser: authData.user,
        message: 'Compte client créé avec succès'
      };

    } catch (error) {
      console.error('Erreur lors de l\'inscription client:', error);
      throw error;
    }
  }

  // Connexion d'un client
  static async loginClient(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(`Erreur de connexion: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('Échec de la connexion');
      }

      // Récupérer les informations client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (clientError) {
        throw new Error(`Erreur de récupération client: ${clientError.message}`);
      }

      return {
        client: clientData,
        authUser: data.user,
        session: data.session
      };

    } catch (error) {
      console.error('Erreur lors de la connexion client:', error);
      throw error;
    }
  }
}
