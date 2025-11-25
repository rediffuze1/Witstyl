/**
 * HOC pour protéger les routes owner
 * 
 * Bloque l'accès tant que isHydrating === true
 * Redirige si userType != "owner"
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuthContext } from '@/contexts/AuthContext';

export function withOwnerAuth<P extends object>(Component: React.ComponentType<P>) {
  return function OwnerAuthWrapper(props: P) {
    const { isHydrating, userType, status } = useAuthContext();
    const [, setLocation] = useLocation();

    useEffect(() => {
      // Ne rien faire pendant l'hydratation
      if (isHydrating) {
        console.log('[withOwnerAuth] Hydratation en cours, attente...');
        return;
      }

      // Si non authentifié, rediriger vers login
      if (status === 'anonymous') {
        console.log('[withOwnerAuth] Non authentifié, redirection vers /salon-login');
        setLocation('/salon-login', { replace: true });
        return;
      }

      // Si client, rediriger vers client-dashboard
      if (userType === 'client') {
        console.log('[withOwnerAuth] Client détecté, redirection vers /client-dashboard');
        setLocation('/client-dashboard', { replace: true });
        return;
      }

      // Si owner, autoriser l'accès
      if (userType === 'owner') {
        console.log('[withOwnerAuth] Owner authentifié, accès autorisé');
        return;
      }

      // Par défaut, rediriger vers login
      console.log('[withOwnerAuth] UserType inconnu, redirection vers /salon-login');
      setLocation('/salon-login', { replace: true });
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

    // Si non authentifié ou pas owner, ne rien afficher (redirection en cours)
    if (status === 'anonymous' || userType !== 'owner') {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Redirection...</p>
          </div>
        </div>
      );
    }

    // Owner authentifié, afficher le composant
    return <Component {...props} />;
  };
}



