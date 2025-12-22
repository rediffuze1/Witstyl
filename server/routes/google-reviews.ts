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
            console.log('[google-reviews] ✅ Place ID récupéré depuis la DB:', placeId);
          }
        }
      } catch (dbError) {
        console.warn('[google-reviews] ⚠️ Erreur récupération Place ID depuis DB:', dbError);
      }
    }

    // Si toujours pas de Place ID, retourner liste vide
    if (!placeId || placeId.length < 5) {
      console.log('[google-reviews] ⚠️ GOOGLE_PLACE_ID non configuré, retour liste vide');
      return res.json({
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
      });
    }

    console.log('[google-reviews] 🔍 Récupération avis pour Place ID:', placeId);

    // Appel à Google Places API (New)
    // Documentation: https://developers.google.com/maps/documentation/places/web-service/place-details
    const apiUrl = `https://places.googleapis.com/v1/places/${placeId}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[google-reviews] [${requestId}] ❌ Erreur Google Places API: ${response.status}`);
      
      // Si erreur 400 (API key invalid) ou 403 (forbidden)
      if (response.status === 400 || response.status === 403) {
        return res.status(502).json({
          success: false,
          error: 'GOOGLE_API_KEY_INVALID',
          message: 'La clé API Google Places est invalide ou n\'a pas les permissions nécessaires',
          data: { reviews: [], averageRating: 0, totalReviews: 0 }
        });
      }
      
      // Si erreur 404 (lieu non trouvé)
      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'GOOGLE_PLACE_NOT_FOUND',
          message: 'Le lieu Google spécifié n\'a pas été trouvé',
          data: { reviews: [], averageRating: 0, totalReviews: 0 }
        });
      }

      // Pour les autres erreurs
      return res.status(502).json({
        success: false,
        error: 'GOOGLE_API_ERROR',
        message: `Erreur de l'API Google Places: ${response.statusText}`,
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

