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
      
      // Gérer différents formats de réponse
      if (Array.isArray(data)) {
        return data;
      }
      // Si c'est un objet avec une propriété stylistes, l'extraire
      if (data && typeof data === 'object' && Array.isArray(data.stylistes)) {
        return data.stylistes;
      }
      // Si c'est un objet avec une propriété data, l'extraire
      if (data && typeof data === 'object' && Array.isArray(data.data)) {
        return data.data;
      }
      
      console.warn('[useSalonStylists] Réponse inattendue:', typeof data, data);
      return [];
    },
    staleTime: 1000 * 60 * 5, // Cache 5 minutes
    retry: 1,
  });
}




