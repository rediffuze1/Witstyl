import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

/**
 * Type pour les paramètres d'apparence du salon
 * 
 * Note: L'application est mono-salon (un seul salon par instance).
 * La couleur principale est stockée dans la table `salons` (colonne `theme_color`).
 * Cette lecture est possible en anonyme pour garantir la cohérence du thème même sans session.
 */
export type SalonAppearance = {
  primaryColor: string | null;
};

/**
 * Hook pour récupérer les paramètres d'apparence du salon
 * 
 * Ce hook charge les paramètres du salon de manière publique (sans authentification)
 * pour permettre l'affichage de la couleur principale même pour les visiteurs anonymes.
 * 
 * @returns {object} - { appearance: SalonAppearance | null, loading: boolean }
 */
export function useSalonAppearance() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/public/salon"],
    queryFn: async () => {
      const response = await fetch("/api/public/salon");
      if (!response.ok) {
        // Ne pas throw, retourner null pour permettre le rendu avec couleur par défaut
        console.warn("[useSalonAppearance] Impossible de charger les paramètres du salon:", response.status);
        return null;
      }
      const data = await response.json();
      return data;
    },
    retry: 1, // Réduire les retries pour éviter les blocages
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
    // Ne pas suspendre le rendu en cas d'erreur
    throwOnError: false,
  });

  const [appearance, setAppearance] = useState<SalonAppearance | null>(null);

  useEffect(() => {
    if (data?.salon?.theme_color) {
      setAppearance({
        primaryColor: data.salon.theme_color,
      });
    } else {
      // Si pas de couleur définie, retourner null pour utiliser la couleur par défaut
      setAppearance(null);
    }
  }, [data]);

  // En cas d'erreur, retourner null pour utiliser la couleur par défaut
  if (error) {
    console.warn("[useSalonAppearance] Erreur lors du chargement:", error);
  }

  return {
    appearance,
    loading: isLoading,
  };
}



