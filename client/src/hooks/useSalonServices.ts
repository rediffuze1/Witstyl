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
 */
export function useSalonServices() {
  const { data: salonData } = useSalonData();
  const salonId = salonData?.salon?.id;

  return useQuery<Service[]>({
    queryKey: ['/api/salons', salonId, 'services'],
    queryFn: async () => {
      if (!salonId) {
        return [];
      }

      const response = await fetch(`/api/salons/${salonId}/services`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data;
    },
    enabled: !!salonId,
    staleTime: 1000 * 60 * 5, // Cache 5 minutes
    retry: 1,
  });
}


