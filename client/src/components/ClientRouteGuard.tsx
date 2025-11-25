import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useClientAuth } from "@/hooks/useClientAuth";

interface ClientRouteGuardProps {
  children: React.ReactNode;
}

export default function ClientRouteGuard({ children }: ClientRouteGuardProps) {
  const [location, setLocation] = useLocation();
  const { status, client, refreshClient } = useClientAuth();
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Si status est authenticated mais client est null, essayer de rafraîchir
  useEffect(() => {
    if (status === 'authenticated' && !client && retryCount < maxRetries) {
      const timer = setTimeout(async () => {
        console.log(`[ClientRouteGuard] Rafraîchissement du client (tentative ${retryCount + 1}/${maxRetries})...`);
        await refreshClient();
        setRetryCount(prev => prev + 1);
      }, 300 * (retryCount + 1)); // 300ms, 600ms, 900ms
      
      return () => clearTimeout(timer);
    }
  }, [status, client, retryCount, refreshClient]);

  // Redirection uniquement si anonyme, pas pendant le rendu
  useEffect(() => {
    // Attendre un peu avant de rediriger pour laisser le temps à la session de se charger
    if (status === 'anonymous') {
      // Éviter la boucle de redirection si déjà sur login/register
      if (location !== '/client-login' && location !== '/client-register') {
        const timer = setTimeout(() => {
          // Vérifier à nouveau le status avant de rediriger
          console.log('[ClientRouteGuard] Redirection vers /client-login (statut:', status, ')');
          setLocation('/client-login', { replace: true });
        }, 500); // Délai pour laisser le temps à la session de se charger
        
        return () => clearTimeout(timer);
      }
    }
  }, [status, location, setLocation]);

  // État de chargement: afficher un spinner
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // État anonyme: pendant la redirection, afficher un spinner
  if (status === 'anonymous') {
    // Si on est déjà sur login/register, laisser la page s'afficher
    if (location === '/client-login' || location === '/client-register') {
      return null;
    }
    
    // Sinon, afficher un spinner pendant la redirection
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirection...</p>
        </div>
      </div>
    );
  }

  // État authentifié: afficher le contenu même si client est temporairement null
  // (le dashboard vérifiera client avant d'afficher les données)
  return <>{children}</>;
}
