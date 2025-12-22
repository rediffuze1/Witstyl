import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

/**
 * Route pour récupérer les avis Google d'un lieu
 * 
 * Utilise Google Places API (New) pour récupérer les avis d'un lieu Google
 * 
 * Configuration requise :
 * 1. Obtenir le Place ID du lieu sur Google My Business
 * 2. Créer une clé API Google dans Google Cloud Console
 * 3. Activer l'API "Places API (New)"
 * 4. Ajouter GOOGLE_PLACES_API_KEY dans les variables d'environnement Vercel
 * 5. Ajouter GOOGLE_PLACE_ID dans les variables d'environnement Vercel (optionnel, peut être dans la DB)
 */

interface GoogleReview {
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
 * GET /api/reviews/google
 * 
 * Récupère les avis Google du salon
 * 
 * Options de configuration :
 * 1. Via variables d'environnement : GOOGLE_PLACES_API_KEY et GOOGLE_PLACE_ID
 * 2. Via base de données : colonne google_place_id dans la table salons
 */
router.get('/', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[google-reviews] [${requestId}] GET /api/reviews/google`);
  
  try {
    const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
    const GOOGLE_PLACE_ID = process.env.GOOGLE_PLACE_ID;

    // Vérifier si la clé API est configurée
    if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY.length < 10) {
      console.log(`[google-reviews] [${requestId}] ⚠️ GOOGLE_PLACES_API_KEY non configurée`);
      return res.status(500).json({
        success: false,
        error: 'GOOGLE_API_NOT_CONFIGURED',
        message: 'La clé API Google Places n\'est pas configurée',
        data: { reviews: [], averageRating: 0, totalReviews: 0 }
      });
    }

    let placeId = GOOGLE_PLACE_ID;

    // Si pas de Place ID dans les env vars, essayer de le récupérer depuis la DB
    if (!placeId) {
      try {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: { persistSession: false }
          });

          // Récupérer le salon (on prend le premier salon actif)
          const { data: salons, error } = await supabase
            .from('salons')
            .select('id, google_place_id')
            .limit(1)
            .maybeSingle();

          if (!error && salons?.google_place_id) {
            placeId = salons.google_place_id;
            console.log(`[google-reviews] [${requestId}] ✅ Place ID récupéré depuis la DB`);
          }
        }
      } catch (dbError) {
        console.warn(`[google-reviews] [${requestId}] ⚠️ Erreur récupération Place ID depuis DB:`, dbError);
      }
    }

    // Si toujours pas de Place ID, retourner erreur explicite
    if (!placeId || placeId.length < 5) {
      console.log(`[google-reviews] [${requestId}] ⚠️ GOOGLE_PLACE_ID non configuré`);
      return res.status(500).json({
        success: false,
        error: 'GOOGLE_PLACE_ID_NOT_CONFIGURED',
        message: 'Le Place ID Google n\'est pas configuré',
        data: { reviews: [], averageRating: 0, totalReviews: 0 }
      });
    }

    console.log(`[google-reviews] [${requestId}] 🔍 Récupération avis pour Place ID: ${placeId.substring(0, 10)}...`);

    // Appel à Google Places API (New)
    // Documentation: https://developers.google.com/maps/documentation/places/web-service/place-details
    const apiUrl = `https://places.googleapis.com/v1/places/${placeId}`;
    
    console.log(`[google-reviews] [${requestId}] 🔍 Appel Google Places API (New):`, {
      endpoint: 'places.googleapis.com/v1/places',
      placeIdPrefix: placeId.substring(0, 10) + '...',
      hasApiKey: !!GOOGLE_PLACES_API_KEY,
      apiKeyLength: GOOGLE_PLACES_API_KEY?.length || 0
    });
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews',
      },
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        const errorText = await response.text();
        errorData = errorText ? JSON.parse(errorText) : {};
      } catch (parseError) {
        // Si le parsing échoue, utiliser le texte brut
        try {
          const errorText = await response.text();
          errorData = { message: errorText || 'Unknown error' };
        } catch {
          errorData = { message: 'Unknown error' };
        }
      }
      
      const errorStatus = errorData.error?.status || errorData.status || response.status;
      const errorMessage = errorData.error?.message || errorData.message || response.statusText;
      const errorReason = errorData.error?.reason || errorData.reason;
      
      console.error(`[google-reviews] [${requestId}] ❌ Erreur Google Places API:`, {
        status: response.status,
        errorStatus,
        errorMessage,
        errorReason,
        endpoint: 'places.googleapis.com/v1/places',
        hasApiKey: !!GOOGLE_PLACES_API_KEY,
        apiKeyLength: GOOGLE_PLACES_API_KEY?.length || 0
      });
      
      // Erreur 400 : analyser la raison pour donner un message actionnable
      if (response.status === 400) {
        // Si "Place ID not valid" ou "INVALID_ARGUMENT", essayer fallback legacy
        const isPlaceIdInvalid = errorReason === 'INVALID_ARGUMENT' || 
          errorMessage?.includes('Place ID not valid') || 
          errorMessage?.includes('Place ID') ||
          errorMessage?.includes('Invalid place_id');
        
        if (isPlaceIdInvalid) {
          console.log(`[google-reviews] [${requestId}] ⚠️ Place ID invalide avec API New, tentative fallback legacy...`);
          
          // Fallback vers API legacy
          try {
            const legacyUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_PLACES_API_KEY}&fields=rating,reviews,user_ratings_total`;
            const legacyResponse = await fetch(legacyUrl);
            
            if (legacyResponse.ok) {
              const legacyData = await legacyResponse.json();
              
              if (legacyData.status === 'OK' && legacyData.result) {
                console.log(`[google-reviews] [${requestId}] ✅ Fallback legacy réussi`);
                
                const reviews: GoogleReview[] = (legacyData.result.reviews || []).map((review: any, index: number) => ({
                  id: review.author_name || `review-${index}-${Date.now()}`,
                  authorName: review.author_name || 'Client anonyme',
                  rating: review.rating || 5,
                  text: review.text || '',
                  time: review.time ? new Date(review.time * 1000).toISOString() : new Date().toISOString(),
                  relativeTimeDescription: formatRelativeTime(review.time ? new Date(review.time * 1000).toISOString() : undefined),
                }));
                
                return res.json({
                  success: true,
                  data: {
                    reviews,
                    averageRating: legacyData.result.rating || 0,
                    totalReviews: legacyData.result.user_ratings_total || reviews.length,
                  }
                });
              } else {
                // Legacy API retourne une erreur
                return res.status(502).json({
                  success: false,
                  code: 'GOOGLE_PLACE_ID_INVALID',
                  error: 'GOOGLE_PLACE_ID_INVALID',
                  message: `Place ID invalide (${legacyData.status}). Vérifiez GOOGLE_PLACE_ID.`,
                  data: { reviews: [], averageRating: 0, totalReviews: 0 }
                });
              }
            } else {
              // Legacy API erreur HTTP
              return res.status(502).json({
                success: false,
                code: 'GOOGLE_API_KEY_INVALID',
                error: 'GOOGLE_API_KEY_INVALID',
                message: 'La clé API Google Places est invalide. Vérifiez GOOGLE_PLACES_API_KEY sur Vercel.',
                data: { reviews: [], averageRating: 0, totalReviews: 0 }
              });
            }
          } catch (legacyError: any) {
            console.error(`[google-reviews] [${requestId}] ❌ Erreur fallback legacy:`, legacyError);
            return res.status(502).json({
              success: false,
              code: 'GOOGLE_PLACE_ID_INVALID',
              error: 'GOOGLE_PLACE_ID_INVALID',
              message: `Place ID invalide. Vérifiez GOOGLE_PLACE_ID.`,
              data: { reviews: [], averageRating: 0, totalReviews: 0 }
            });
          }
        }
        
        // Raisons possibles : API_KEY_INVALID, BILLING_NOT_ENABLED, PERMISSION_DENIED, etc.
        if (errorReason === 'API_KEY_INVALID' || errorMessage?.includes('API key') || errorMessage?.includes('API_KEY')) {
          return res.status(502).json({
            success: false,
            code: 'GOOGLE_API_KEY_INVALID',
            error: 'GOOGLE_API_KEY_INVALID',
            message: 'La clé API Google Places est invalide. Vérifiez GOOGLE_PLACES_API_KEY sur Vercel.',
            data: { reviews: [], averageRating: 0, totalReviews: 0 }
          });
        }
        
        if (errorReason === 'BILLING_NOT_ENABLED' || errorMessage?.includes('billing') || errorMessage?.includes('BILLING')) {
          return res.status(502).json({
            success: false,
            code: 'GOOGLE_PLACES_API_NOT_AUTHORIZED',
            error: 'GOOGLE_PLACES_API_NOT_AUTHORIZED',
            message: 'La facturation Google Cloud n\'est pas activée ou l\'API Places n\'est pas activée. Vérifiez Google Cloud Console.',
            data: { reviews: [], averageRating: 0, totalReviews: 0 }
          });
        }
        
        if (errorReason === 'PERMISSION_DENIED' || errorMessage?.includes('permission') || errorMessage?.includes('PERMISSION')) {
          return res.status(502).json({
            success: false,
            code: 'GOOGLE_PLACES_API_NOT_AUTHORIZED',
            error: 'GOOGLE_PLACES_API_NOT_AUTHORIZED',
            message: 'Permissions insuffisantes pour l\'API Places. Vérifiez les restrictions de la clé API dans Google Cloud Console.',
            data: { reviews: [], averageRating: 0, totalReviews: 0 }
          });
        }
        
        // Erreur 400 générique
        return res.status(502).json({
          success: false,
          code: 'GOOGLE_API_BAD_REQUEST',
          error: 'GOOGLE_API_BAD_REQUEST',
          message: `Erreur 400 de l'API Google Places: ${errorMessage || errorReason || 'Requête invalide'}`,
          data: { reviews: [], averageRating: 0, totalReviews: 0 }
        });
      }
      
      // Erreur 403 : clé invalide ou permissions insuffisantes
      if (response.status === 403) {
        return res.status(502).json({
          success: false,
          code: 'GOOGLE_API_KEY_INVALID',
          error: 'GOOGLE_API_KEY_INVALID',
          message: 'La clé API Google Places est invalide ou n\'a pas les permissions nécessaires. Vérifiez GOOGLE_PLACES_API_KEY et les restrictions dans Google Cloud Console.',
          data: { reviews: [], averageRating: 0, totalReviews: 0 }
        });
      }
      
      // Si erreur 404 (lieu non trouvé)
      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          code: 'GOOGLE_PLACE_NOT_FOUND',
          error: 'GOOGLE_PLACE_NOT_FOUND',
          message: 'Le lieu Google spécifié n\'a pas été trouvé. Vérifiez GOOGLE_PLACE_ID.',
          data: { reviews: [], averageRating: 0, totalReviews: 0 }
        });
      }

      // Pour les autres erreurs
      return res.status(502).json({
        success: false,
        code: 'GOOGLE_API_ERROR',
        error: 'GOOGLE_API_ERROR',
        message: `Erreur ${response.status} de l'API Google Places: ${errorMessage || response.statusText}`,
        data: { reviews: [], averageRating: 0, totalReviews: 0 }
      });
    }

    const data = await response.json();

    // Transformer les avis Google au format attendu par le frontend
    const reviews: GoogleReview[] = (data.reviews || []).map((review: any, index: number) => ({
      id: review.name || `review-${index}-${Date.now()}`,
      authorName: review.authorAttribution?.displayName || 'Client anonyme',
      rating: review.rating || 5,
      text: review.text?.text || '',
      time: review.publishTime || new Date().toISOString(),
      relativeTimeDescription: formatRelativeTime(review.publishTime),
    }));

    const averageRating = data.rating || 0;
    const totalReviews = data.userRatingCount || reviews.length;

    console.log(`[google-reviews] [${requestId}] ✅ ${reviews.length} avis récupérés, note moyenne: ${averageRating}`);

    res.json({
      success: true,
      data: {
        reviews,
        averageRating,
        totalReviews
      }
    });
  } catch (error: any) {
    console.error(`[google-reviews] [${requestId}] ❌ Erreur inattendue:`, error.message);
    // En cas d'erreur inattendue
    res.status(500).json({
      success: false,
      error: 'GOOGLE_REVIEWS_FETCH_FAILED',
      message: 'Erreur lors de la récupération des avis Google',
      data: { reviews: [], averageRating: 0, totalReviews: 0 }
    });
  }
});

/**
 * Formate une date ISO en description relative (ex: "Il y a 2 semaines")
 */
function formatRelativeTime(isoDate?: string): string {
  if (!isoDate) return '';
  
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `Il y a ${months} mois`;
    }
    const years = Math.floor(diffDays / 365);
    return `Il y a ${years} an${years > 1 ? 's' : ''}`;
  } catch {
    return '';
  }
}

export default router;

