import { useQuery } from '@tanstack/react-query';

export interface Stylist {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  photoUrl?: string | null;
  specialties?: string[];
  isActive: boolean;
}

/**
 * Hook pour récupérer les stylistes du salon depuis l'API publique
 */
export function useSalonStylists() {
  return useQuery<Stylist[]>({
    queryKey: ['/api/public/salon/stylistes'],
    queryFn: async () => {
      const response = await fetch('/api/public/salon/stylistes', {
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


