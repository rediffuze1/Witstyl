/**
 * AuthContext unifié pour gérer l'authentification owner et client
 * 
 * Ce contexte centralise toute la logique d'authentification et garantit
 * que la session est correctement restaurée avant toute navigation.
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLocation } from 'wouter';

// Types
export type UserType = 'owner' | 'client' | null;
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface Owner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  salonId: string | null;
}

interface Client {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface AuthContextType {
  // État d'authentification
  isHydrating: boolean; // true pendant la restauration de la session
  status: AuthStatus;
  userType: UserType;
  isAuthenticated: boolean;
  
  // Données utilisateur
  owner: Owner | null;
  client: Client | null;
  salonId: string | null; // SalonId chargé depuis la DB (pour owner ou client)
  
  // Actions
  loginOwner: (email: string, password: string) => Promise<boolean>;
  loginClient: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  
  // Helpers
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isHydrating, setIsHydrating] = useState(true);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [userType, setUserType] = useState<UserType>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  /**
   * Charge le salonId depuis la base de données
   * Selon le userType, récupère le salon depuis salons ou clients
   * 
   * Pour owner: le salonId est déjà dans /api/auth/user
   * Pour client: récupère depuis /api/public/salon (mono-salon)
   */
  const loadSalon = useCallback(async (authUserType: UserType, userId: string, email: string): Promise<string | null> => {
    try {
      console.log('[AuthContext] loadSalon - Début:', { userType: authUserType, userId, email });
      
      if (authUserType === 'owner') {
        // Pour owner: le salonId devrait déjà être dans /api/auth/user
        // Si ce n'est pas le cas, c'est que la session n'est pas complète
        // On retourne null et la session sera restaurée plus tard
        console.log('[AuthContext] loadSalon - Owner: salonId devrait être dans la session');
        return null; // Sera chargé via restoreSession
      } else if (authUserType === 'client') {
        // Pour client: récupérer depuis /api/public/salon (mono-salon)
        const salonResponse = await fetch('/api/public/salon', {
          credentials: 'include',
        });
        
        if (salonResponse.ok) {
          const salonData = await salonResponse.json();
          if (salonData?.salon?.id) {
            console.log('[AuthContext] loadSalon - SalonId trouvé pour client (mono-salon):', salonData.salon.id);
            return salonData.salon.id;
          }
        }
        
        return null;
      }
      
      return null;
    } catch (error) {
      console.error('[AuthContext] loadSalon - Erreur:', error);
      return null;
    }
  }, []);

  /**
   * Restaure la session depuis le serveur
   * Appelée au montage et après login/logout
   */
  const restoreSession = useCallback(async () => {
    try {
      console.log('[AuthContext] restoreSession - Début');
      setIsHydrating(true);
      setStatus('loading');
      
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.log('[AuthContext] restoreSession - Non authentifié (status:', response.status, ')');
        setStatus('anonymous');
        setUserType(null);
        setOwner(null);
        setClient(null);
        setSalonId(null);
        setIsHydrating(false);
        return;
      }
      
      const data = await response.json();
      
      if (data.authenticated && data.userType) {
        console.log('[AuthContext] restoreSession - Authentifié:', data.userType);
        
        if (data.userType === 'owner' && data.user) {
          setUserType('owner');
          setStatus('authenticated');
          
          const ownerData: Owner = {
            id: data.user.id,
            email: data.user.email || '',
            firstName: data.user.firstName || '',
            lastName: data.user.lastName || '',
            phone: data.user.phone,
            salonId: data.user.salonId || null,
          };
          
          setOwner(ownerData);
          setClient(null);
          
          // Le salonId devrait être dans ownerData.salonId
          // Si manquant, essayer de le charger (mais normalement il devrait être là)
          let finalSalonId = ownerData.salonId;
          if (!finalSalonId) {
            console.warn('[AuthContext] restoreSession - ⚠️ SalonId manquant pour owner, tentative de chargement...');
            // Le salonId devrait être chargé par le middleware backend
            // Si ce n'est pas le cas, on laisse null et l'utilisateur devra se reconnecter
            finalSalonId = null;
          }
          
          setSalonId(finalSalonId);
          console.log('[AuthContext] restoreSession - Owner restauré, salonId:', finalSalonId);
          
        } else if (data.userType === 'client' && data.profile) {
          setUserType('client');
          setStatus('authenticated');
          
          const clientData: Client = {
            id: data.profile.id,
            email: data.profile.email || '',
            firstName: data.profile.firstName || '',
            lastName: data.profile.lastName || '',
            phone: data.profile.phone,
          };
          
          setClient(clientData);
          setOwner(null);
          
          // Charger le salonId pour le client (mono-salon)
          const clientSalonId = await loadSalon('client', clientData.id, clientData.email);
          setSalonId(clientSalonId);
          console.log('[AuthContext] restoreSession - Client restauré, salonId:', clientSalonId);
          
        } else {
          console.warn('[AuthContext] restoreSession - Données incomplètes:', data);
          setStatus('anonymous');
          setUserType(null);
          setOwner(null);
          setClient(null);
          setSalonId(null);
        }
      } else {
        console.log('[AuthContext] restoreSession - Non authentifié');
        setStatus('anonymous');
        setUserType(null);
        setOwner(null);
        setClient(null);
        setSalonId(null);
      }
    } catch (error) {
      console.error('[AuthContext] restoreSession - Erreur:', error);
      setStatus('anonymous');
      setUserType(null);
      setOwner(null);
      setClient(null);
      setSalonId(null);
    } finally {
      setIsHydrating(false);
      console.log('[AuthContext] restoreSession - Fin, isHydrating = false');
    }
  }, [loadSalon]);

  /**
   * Login owner
   */
  const loginOwner = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setIsHydrating(true);
      
      const response = await fetch('/api/salon/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        setIsHydrating(false);
        return false;
      }
      
      // Restaurer la session après login
      await restoreSession();
      return true;
    } catch (error) {
      console.error('[AuthContext] loginOwner - Erreur:', error);
      setIsHydrating(false);
      return false;
    }
  }, [restoreSession]);

  /**
   * Login client
   */
  const loginClient = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setIsHydrating(true);
      
      const response = await fetch('/api/client/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        setIsHydrating(false);
        return false;
      }
      
      // Restaurer la session après login
      await restoreSession();
      return true;
    } catch (error) {
      console.error('[AuthContext] loginClient - Erreur:', error);
      setIsHydrating(false);
      return false;
    }
  }, [restoreSession]);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      setIsHydrating(true);
      
      // Déterminer l'endpoint de logout selon le userType
      const endpoint = userType === 'owner' ? '/api/logout' : '/api/client/logout';
      
      await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      });
      
      // Réinitialiser l'état
      setStatus('anonymous');
      setUserType(null);
      setOwner(null);
      setClient(null);
      setSalonId(null);
      setIsHydrating(false);
      
      // Rediriger vers la page d'accueil
      setLocation('/');
    } catch (error) {
      console.error('[AuthContext] logout - Erreur:', error);
      // Réinitialiser quand même
      setStatus('anonymous');
      setUserType(null);
      setOwner(null);
      setClient(null);
      setSalonId(null);
      setIsHydrating(false);
    }
  }, [userType, setLocation]);

  /**
   * Refresh manuel
   */
  const refresh = useCallback(async () => {
    await restoreSession();
  }, [restoreSession]);

  // Restaurer la session au montage
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const value: AuthContextType = {
    isHydrating,
    status,
    userType,
    isAuthenticated: status === 'authenticated',
    owner,
    client,
    salonId,
    loginOwner,
    loginClient,
    logout,
    refresh,
    isLoading: isHydrating || status === 'loading',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

