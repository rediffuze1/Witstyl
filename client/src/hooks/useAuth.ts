import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const { refresh } = useAuthContext();
  
  // Attendre que le composant soit monté côté client
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const { data: authData, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: "include",
      });
      
      // Vérifier le content-type avant de parser le JSON
      const contentType = response.headers.get("content-type") ?? "";
      
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        console.error("[useAuth] Réponse non-JSON pour /api/auth/user:", {
          status: response.status,
          statusText: response.statusText,
          contentType,
          text: text.substring(0, 200),
        });
        // Pour /api/auth/user, si ce n'est pas du JSON, on considère que l'utilisateur n'est pas authentifié
        return { authenticated: false, user: null };
      }
      
      if (!response.ok) {
        // Seulement logger les vraies erreurs (réseau, 5xx)
        if (response.status >= 500) {
          console.error("Erreur serveur lors de la récupération utilisateur:", response.status);
        }
        // Pour les erreurs 4xx, on considère que l'utilisateur n'est pas authentifié
        if (response.status === 401 || response.status === 403) {
          return { authenticated: false, user: null };
        }
        throw new Error("Erreur de récupération utilisateur");
      }
      
      const data = await response.json();
      console.log('[useAuth] userType=', data?.userType, 'salonId=', data?.user?.salonId, 'authenticated=', data?.authenticated);
      return data;
    },
    retry: false,
    refetchOnWindowFocus: true, // Refetch quand on revient sur la fenêtre
    refetchOnMount: true, // Toujours refetch quand on monte un composant pour vérifier la session
    staleTime: 0, // Considérer les données comme obsolètes immédiatement pour forcer la vérification
    enabled: isMounted, // Ne pas appeler l'API avant le montage côté client
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await fetchWithTimeout("/api/salon/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(credentials),
        timeout: 30000, // 30 secondes de timeout (augmenté pour éviter les timeouts)
      });

      // Vérifier le content-type avant de parser le JSON
      const contentType = response.headers.get("content-type") ?? "";
      
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        console.error("[useAuth] Réponse non-JSON reçue:", {
          status: response.status,
          statusText: response.statusText,
          contentType,
          text: text.substring(0, 200),
        });
        throw new Error(
          text || `Erreur serveur (${response.status}): La réponse n'est pas au format JSON`
        );
      }

      if (!response.ok) {
        try {
          const errorData = await response.json();
          // Utiliser le message d'erreur du serveur avec le code si disponible
          const errorMessage = errorData.message || "Erreur de connexion";
          const error = new Error(errorMessage) as any;
          error.code = errorData.code || 'UNKNOWN_ERROR';
          error.status = response.status;
          throw error;
        } catch (parseError: any) {
          // Si le parsing JSON échoue même avec content-type JSON, c'est une erreur serveur
          const error = new Error(`Erreur de connexion (${response.status}): ${response.statusText}`) as any;
          error.code = 'PARSE_ERROR';
          error.status = response.status;
          throw error;
        }
      }

      const data = await response.json();
      
      // Attendre un peu pour que les cookies de session soient propagés
      await new Promise(resolve => setTimeout(resolve, 200));
      
      return data;
    },
    onSuccess: async () => {
      // Invalider et refetch immédiatement pour mettre à jour le statut
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Attendre que la query soit rafraîchie
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });

      // Mettre à jour le AuthContext (protège les routes privées)
      await refresh();
      
      toast({
        title: "Connexion réussie",
        description: "Vous êtes maintenant connecté.",
      });
    },
    onError: (error: any) => {
      // Ne pas afficher de toast pour les timeouts - le composant le gère
      if (error.code === 'TIMEOUT' || error.message === 'TIMEOUT') {
        return; // Le composant affichera le message d'erreur avec bouton "Réessayer"
      }
      
      toast({
        title: "Erreur de connexion",
        description: error.message || "Une erreur est survenue lors de la connexion.",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });

      // Vérifier le content-type avant de parser le JSON
      const contentType = response.headers.get("content-type") ?? "";
      
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        console.error("[useAuth] Réponse non-JSON pour /api/logout:", {
          status: response.status,
          statusText: response.statusText,
          contentType,
          text: text.substring(0, 200),
        });
        // Pour logout, même si ce n'est pas du JSON, on considère que c'est OK
        return { success: true };
      }

      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || "Erreur de déconnexion");
        } catch (parseError) {
          throw new Error(`Erreur de déconnexion (${response.status}): ${response.statusText}`);
        }
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      await refresh();
      toast({
        title: "Déconnexion réussie",
        description: "Vous avez été déconnecté.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de déconnexion",
        description: error.message || "Une erreur est survenue lors de la déconnexion.",
        variant: "destructive",
      });
    },
  });

  const login = async (credentials: { email: string; password: string }) => {
    return loginMutation.mutateAsync(credentials);
  };

  const logout = async () => {
    return logoutMutation.mutateAsync();
  };

  // Déterminer le statut d'authentification
  const status = (() => {
    if (isLoading || !isMounted) return 'loading';
    if (error) return 'anonymous';
    if (authData?.authenticated === true) return 'authenticated';
    return 'anonymous';
  })();

  // Extraire les données utilisateur de la réponse
  const user = authData?.user || null;
  const isAuthenticated = authData?.authenticated === true;

  // Logging pour le débogage (temporaire)
  useEffect(() => {
    if (isMounted) {
      console.info('[auth]', { status, user: !!user, userType: authData?.userType });
    }
  }, [status, user, authData?.userType, isMounted]);

  // Déclencher un événement pour mettre à jour le contexte utilisateur
  useEffect(() => {
    if (user && (user as any)?.firstName) {
      // Déclencher un événement pour mettre à jour le contexte
      window.dispatchEvent(new CustomEvent('apiUserUpdated', { 
        detail: { firstName: (user as any).firstName } 
      }));
      // Mettre à jour localStorage aussi
      localStorage.setItem('userFirstName', (user as any).firstName);
    }
  }, [user, (user as any)?.firstName]);

  return {
    user,
    status,
    isLoading: isLoading || !isMounted,
    isAuthenticated,
    login,
    logout,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    refresh: () => queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }),
  };
}