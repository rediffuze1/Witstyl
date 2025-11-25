/**
 * HOC pour protéger les routes client
 * 
 * Bloque l'accès tant que isHydrating === true
 * Redirige si userType != "client"
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuthContext } from '@/contexts/AuthContext';

export function withClientAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ClientAuthWrapper(props: P) {
    const { isHydrating, userType, status } = useAuthContext();
    const [, setLocation] = useLocation();

    useEffect(() => {
      // Ne rien faire pendant l'hydratation
      if (isHydrating) {
        console.log('[withClientAuth] Hydratation en cours, attente...');
        return;
      }

      // Si non authentifié, rediriger vers login
      if (status === 'anonymous') {
        console.log('[withClientAuth] Non authentifié, redirection vers /client-login');
        setLocation('/client-login', { replace: true });
        return;
      }

      // Si owner, rediriger vers dashboard
      if (userType === 'owner') {
        console.log('[withClientAuth] Owner détecté, redirection vers /dashboard');
        setLocation('/dashboard', { replace: true });
        return;
      }

      // Si client, autoriser l'accès
      if (userType === 'client') {
        console.log('[withClientAuth] Client authentifié, accès autorisé');
        return;
      }

      // Par défaut, rediriger vers login
      console.log('[withClientAuth] UserType inconnu, redirection vers /client-login');
      setLocation('/client-login', { replace: true });
    }, [isHydrating, userType, status, setLocation]);

    // Afficher un loader pendant l'hydratation
    if (isHydrating) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Chargement de la session...</p>
          </div>
        </div>
      );
    }

    // Si non authentifié ou pas client, ne rien afficher (redirection en cours)
    if (status === 'anonymous' || userType !== 'client') {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Redirection...</p>
          </div>
        </div>
      );
    }

    // Client authentifié, afficher le composant
    return <Component {...props} />;
  };
}



