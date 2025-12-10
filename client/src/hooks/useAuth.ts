import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";

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
      
      if (!response.ok) {
        // Seulement logger les vraies erreurs (réseau, 5xx)
        if (response.status >= 500) {
          console.error("Erreur serveur lors de la récupération utilisateur:", response.status);
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
      const response = await fetch("/api/salon/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur de connexion");
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

      if (!response.ok) {
        throw new Error("Erreur de déconnexion");
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