import { useQuery } from '@tanstack/react-query';

export interface SalonData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  theme_color?: string | null;
}

interface SalonApiResponse {
  salon: SalonData | null;
  hours: Array<{
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
  }>;
}

/**
 * Hook pour récupérer les informations du salon depuis l'API publique
 * Utilise GET /api/public/salon qui retourne le salon le plus récent
 */
export function useSalonData() {
  return useQuery<SalonApiResponse>({
    queryKey: ['/api/public/salon'],
    queryFn: async () => {
      const response = await fetch('/api/public/salon', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache 5 minutes
    retry: 1,
  });
}




