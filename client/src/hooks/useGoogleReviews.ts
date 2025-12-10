import { useQuery } from '@tanstack/react-query';

export interface GoogleReview {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  time: string;
  relativeTimeDescription?: string;
}

interface GoogleReviewsResponse {
  reviews: GoogleReview[];
  averageRating?: number;
  totalReviews?: number;
}

/**
 * Hook pour récupérer les avis Google (top 5 uniquement)
 * L'API backend doit exposer GET /api/reviews/google
 */
export function useGoogleReviews() {
  return useQuery<GoogleReviewsResponse>({
    queryKey: ['/api/reviews/google'],
    queryFn: async () => {
      const response = await fetch('/api/reviews/google', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      
      // S'assurer qu'on ne retourne que les 5 meilleurs (triés par note DESC puis date DESC)
      const sortedReviews = (data.reviews || [])
        .sort((a: GoogleReview, b: GoogleReview) => {
          // D'abord par note décroissante
          if (b.rating !== a.rating) {
            return b.rating - a.rating;
          }
          // Puis par date décroissante (plus récent en premier)
          return new Date(b.time).getTime() - new Date(a.time).getTime();
        })
        .slice(0, 5);

      return {
        ...data,
        reviews: sortedReviews,
      };
    },
    staleTime: 1000 * 60 * 30, // Cache 30 minutes
    retry: 1,
  });
}


