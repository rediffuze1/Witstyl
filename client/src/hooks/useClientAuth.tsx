import { useState, useEffect, createContext, useContext, ReactNode } from "react";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  notes?: string;
  preferredStylistId?: string;
  sex?: string;
}

// Statut d'authentification: 3 états clairs
type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface ClientAuthContextType {
  client: Client | null;
  status: AuthStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshClient: () => Promise<boolean>;
  updateClient: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Rafraîchir l'état d'authentification depuis le serveur
  const refreshClient = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/user", {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        // Erreur réseau ou 5xx: traiter comme anonyme
        console.warn('[useClientAuth] Erreur réseau:', response.status);
        setStatus('anonymous');
        setClient(null);
        return false;
      }

      const authData = await response.json();
      
      // L'API retourne toujours 200, traiter selon authenticated
      if (authData.authenticated && authData.userType === 'client' && authData.profile) {
        setClient(authData.profile);
        setStatus('authenticated');
        return true;
      } else {
        setClient(null);
        setStatus('anonymous');
        return false;
      }
    } catch (error) {
      console.error("[useClientAuth] Erreur lors du refresh:", error);
      setClient(null);
      setStatus('anonymous');
      return false;
    }
  };

  const updateClient = async () => {
    await refreshClient();
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setStatus('loading');
      
      const response = await fetch("/api/client/login", {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[useClientAuth] Erreur login:', errorData.message || response.statusText);
        setStatus('anonymous');
        return false;
      }

      const data = await response.json();
      
      // Si le serveur retourne success, la connexion est réussie
      if (data.success && data.client) {
        const clientData = {
          id: data.client.id,
          firstName: data.client.firstName,
          lastName: data.client.lastName,
          email: data.client.email,
          phone: data.client.phone,
        };
        
        // Mettre à jour immédiatement le contexte
        setClient(clientData);
        setStatus('authenticated');
        
        // Tenter de rafraîchir en arrière-plan avec un délai pour laisser les cookies se propager
        // Ne pas bloquer ou changer le status si cela échoue
        setTimeout(() => {
          refreshClient().catch(err => {
            console.warn('[useClientAuth] Erreur lors du refresh après login (non bloquant):', err);
            // Garder le statut authenticated même si le refresh échoue
          });
        }, 500);
        
        return true;
      }
      
      // Si pas de success, échec
      setStatus('anonymous');
      return false;
    } catch (error) {
      console.error("[useClientAuth] Erreur de connexion:", error);
      setStatus('anonymous');
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/client/logout", { 
        method: "POST",
        credentials: 'include'
      });
      setClient(null);
      setStatus('anonymous');
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
      // Déconnecter quand même localement
      setClient(null);
      setStatus('anonymous');
    }
  };

  // Vérification initiale au montage
  useEffect(() => {
    let mounted = true;
    
    refreshClient().then(() => {
      if (mounted && status === 'loading') {
        // Le refresh a déjà mis à jour le status, mais si on est toujours loading, passer à anonymous
        if (!client) {
          setStatus('anonymous');
        }
      }
    }).catch((error) => {
      console.error('[useClientAuth] Erreur lors de la vérification initiale:', error);
      if (mounted) {
        setStatus('anonymous');
      }
    });
    
    return () => {
      mounted = false;
    };
  }, []);

  // Déterminer isLoading et isAuthenticated depuis status
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  const value: ClientAuthContextType = {
    client,
    status,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshClient,
    updateClient,
  };

  return (
    <ClientAuthContext.Provider value={value}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const context = useContext(ClientAuthContext);
  if (context === undefined) {
    throw new Error("useClientAuth must be used within a ClientAuthProvider");
  }
  return context;
}
