import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface SalonRouteGuardProps {
  children: React.ReactNode;
}

export default function SalonRouteGuard({ children }: SalonRouteGuardProps) {
  const [location, setLocation] = useLocation();
  const { status, user, refresh } = useAuth();
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Si status est authenticated mais user est null, essayer de rafraîchir
  useEffect(() => {
    if (status === 'authenticated' && !user && retryCount < maxRetries) {
      const timer = setTimeout(async () => {
        console.log(`[SalonRouteGuard] Rafraîchissement de l'utilisateur (tentative ${retryCount + 1}/${maxRetries})...`);
        await refresh();
        setRetryCount(prev => prev + 1);
      }, 300 * (retryCount + 1)); // 300ms, 600ms, 900ms

      return () => clearTimeout(timer);
    }
  }, [status, user, retryCount, refresh]);

  // Redirection uniquement si anonyme, pas pendant le rendu
  useEffect(() => {
    if (status === 'anonymous') {
      // Éviter la boucle de redirection si déjà sur login/register
      if (location !== '/salon-login' && location !== '/salon-register') {
        console.log('[SalonRouteGuard] Redirection vers /salon-login (statut:', status, ')');
        setLocation('/salon-login', { replace: true });
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
    if (location === '/salon-login' || location === '/salon-register') {
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

  // État authentifié: afficher le contenu
  return <>{children}</>;
}

