import { useQuery } from '@tanstack/react-query';
import { useSalonData } from './useSalonData';

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  tags?: string[];
}

/**
 * Hook pour récupérer les services du salon depuis l'API publique
 * Utilise GET /api/public/salon/services qui retourne les services du salon le plus récent
 */
export function useSalonServices() {
  return useQuery<Service[]>({
    queryKey: ['/api/public/salon/services'],
    queryFn: async () => {
      const response = await fetch('/api/public/salon/services', {
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn('[useSalonServices] Erreur HTTP:', response.status, '- retour liste vide');
        return [];
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0, // Pas de cache - toujours récupérer les données fraîches depuis la DB
    refetchOnMount: true, // Toujours refetch au montage pour synchronisation immédiate
    refetchOnWindowFocus: true, // Refetch si l'utilisateur revient sur la page
    retry: 1,
  });
}




