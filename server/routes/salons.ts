// server/routes/salons.ts
import express from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { encodeStylistReason, normalizeClosedDateRecord } from '../utils/closed-dates.js';

const salonsRouter = express.Router();
salonsRouter.use(express.json());

// Mapping des jours pour les logs
const DAYS = [
  { value: 0, label: "Dimanche" },
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
];

// Fonction utilitaire pour normaliser l'ID du salon
function normalizeSalonId(salonId: string): string {
  if (!salonId) return '';
  // Retirer le préfixe "salon-" s'il existe
  return salonId.startsWith('salon-') ? salonId.substring(6) : salonId;
}

// GET /api/salons/:salonId/hours
salonsRouter.get('/:salonId/hours', async (req: Request, res: Response) => {
  try {
    const timestamp = new Date().toISOString();
    const rawId = req.params.salonId;
    const salonId = normalizeSalonId(rawId);

    console.log(`[GET /api/salons/:salonId/hours] ${timestamp} - rawId:`, rawId, 'normalized:', salonId);

    if (!salonId) {
      return res.status(400).json({ error: 'Salon ID manquant' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[GET /api/salons/:salonId/hours] Configuration Supabase manquante');
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Essayer avec l'ID normalisé d'abord, puis avec l'ID préfixé, puis avec l'ID réel du salon
    let hours: any[] | null = null;
    let hoursError: any = null;
    
    // D'abord, essayer de trouver le salon pour obtenir son ID réel
    let realSalonId: string | null = null;
    try {
      const { data: salon, error: salonError } = await supabase
        .from('salons')
        .select('id')
        .or(`id.eq.${salonId},id.eq.salon-${salonId}`)
        .maybeSingle();
      
      if (salon && !salonError) {
        realSalonId = salon.id;
        console.log('[GET /api/salons/:salonId/hours] 🔍 ID réel du salon trouvé:', realSalonId);
      }
    } catch (e: any) {
      console.log('[GET /api/salons/:salonId/hours] Impossible de trouver le salon, continuation avec IDs normalisés...');
    }
    
    // Liste des IDs à essayer (dans l'ordre de priorité)
    const idsToTry = realSalonId ? [realSalonId, salonId, `salon-${salonId}`] : [salonId, `salon-${salonId}`];
    console.log('[GET /api/salons/:salonId/hours] 🔍 IDs à essayer:', idsToTry);
    
    try {
      // Essayer d'abord avec opening_hours (nom correct dans le schéma)
      // Essayer avec tous les IDs possibles jusqu'à trouver des données
      for (const idToTry of idsToTry) {
        console.log(`[GET /api/salons/:salonId/hours] Essai avec ID: ${idToTry}`);
        
        // Essayer opening_hours
        let result = await supabase
          .from('opening_hours')
          .select('day_of_week, open_time, close_time, is_closed')
          .eq('salon_id', idToTry)
          .order('day_of_week', { ascending: true });
        
        hours = result.data;
        hoursError = result.error;
        
        // Si erreur et que c'est parce que la table n'existe pas, essayer salon_hours
        if (hoursError && (
          hoursError.code === '42P01' || 
          hoursError.message?.includes('does not exist') ||
          hoursError.message?.includes('Could not find the table') ||
          hoursError.message?.includes('schema cache')
        )) {
          console.log(`[GET /api/salons/:salonId/hours] Table opening_hours n'existe pas pour ID ${idToTry}, essai avec salon_hours...`);
          result = await supabase
      .from('salon_hours')
      .select('day_of_week, open_time, close_time, is_closed')
            .eq('salon_id', idToTry)
      .order('day_of_week', { ascending: true });
          
          hours = result.data;
          hoursError = result.error;
          
          // Si salon_hours échoue aussi, continuer avec le prochain ID
          if (hoursError && (
            hoursError.code === '42P01' || 
            hoursError.message?.includes('does not exist') ||
            hoursError.message?.includes('Could not find the table') ||
            hoursError.message?.includes('schema cache')
          )) {
            console.log(`[GET /api/salons/:salonId/hours] Table salon_hours n'existe pas non plus pour ID ${idToTry}, essai suivant...`);
            continue; // Essayer le prochain ID
          }
        }
        
        // Si on a trouvé des données, s'arrêter
        if (hours && hours.length > 0 && !hoursError) {
          console.log(`[GET /api/salons/:salonId/hours] ✅ ${hours.length} horaires trouvés avec ID: ${idToTry}`);
          break;
        }
        
        // Si pas d'erreur mais pas de données, continuer avec le prochain ID
        if (!hoursError && (!hours || hours.length === 0)) {
          console.log(`[GET /api/salons/:salonId/hours] Aucun horaire trouvé avec ID ${idToTry}, essai suivant...`);
          continue;
        }
        
        // Si erreur autre que "table n'existe pas", arrêter
        if (hoursError && !(
          hoursError.code === '42P01' || 
          hoursError.message?.includes('does not exist') ||
          hoursError.message?.includes('Could not find the table') ||
          hoursError.message?.includes('schema cache')
        )) {
          console.error(`[GET /api/salons/:salonId/hours] Erreur avec ID ${idToTry}:`, hoursError);
          break;
        }
      }
      
      // Si toutes les tentatives ont échoué à cause de tables inexistantes
      if (hoursError && (
        hoursError.code === '42P01' || 
        hoursError.message?.includes('does not exist') ||
        hoursError.message?.includes('Could not find the table') ||
        hoursError.message?.includes('schema cache')
      )) {
        console.log('[GET /api/salons/:salonId/hours] Aucune table n\'existe, retour tableau vide');
        return res.json({ hours: [] });
      }
    } catch (e: any) {
      // Si la table n'existe pas, retourner un tableau vide
      if (e.code === '42P01' || 
          e.message?.includes('does not exist') ||
          e.message?.includes('Could not find the table') ||
          e.message?.includes('schema cache')) {
        console.log('[GET /api/salons/:salonId/hours] Table n\'existe pas encore (catch), retour tableau vide');
        return res.json({ hours: [] });
      }
      hoursError = e;
    }

    // Si non trouvé, essayer avec l'ID préfixé
    if ((!hours || hours.length === 0) && !hoursError) {
      try {
      const prefixedId = `salon-${salonId}`;
        // Essayer d'abord avec opening_hours
        let result = await supabase
          .from('opening_hours')
          .select('day_of_week, open_time, close_time, is_closed')
          .eq('salon_id', prefixedId)
          .order('day_of_week', { ascending: true });
        
        if (!result.data || result.data.length === 0) {
          // Essayer avec salon_hours
          result = await supabase
        .from('salon_hours')
        .select('day_of_week, open_time, close_time, is_closed')
        .eq('salon_id', prefixedId)
        .order('day_of_week', { ascending: true });
        }
        
        if (result.data && result.data.length > 0) {
          return res.json({ hours: result.data });
        }
      } catch (e: any) {
        // Ignorer l'erreur si la table n'existe pas
        if (e.code !== '42P01' && !e.message?.includes('does not exist')) {
          console.error('[GET /api/salons/:salonId/hours] Erreur avec ID préfixé:', e);
        }
      }
    }

    if (hoursError) {
      // Si la table n'existe pas, retourner un tableau vide au lieu d'une erreur
      if (hoursError.code === '42P01' || 
          hoursError.message?.includes('does not exist') ||
          hoursError.message?.includes('Could not find the table') ||
          hoursError.message?.includes('schema cache')) {
        console.log('[GET /api/salons/:salonId/hours] Table n\'existe pas encore, retour tableau vide');
        return res.json({ hours: [] });
      }
      console.error('[GET /api/salons/:salonId/hours] ❌ Erreur Supabase:', hoursError);
      console.error('[GET /api/salons/:salonId/hours] ❌ Code:', hoursError.code);
      console.error('[GET /api/salons/:salonId/hours] ❌ Message:', hoursError.message);
      console.error('[GET /api/salons/:salonId/hours] ❌ Détails:', JSON.stringify(hoursError, null, 2));
      return res.status(500).json({ error: 'Impossible de charger les horaires', details: hoursError.message });
    }

    console.log(`[GET /api/salons/:salonId/hours] ✅ Succès - ${hours?.length || 0} horaires trouvés`);
    return res.json({ hours: hours || [] });
  } catch (e: any) {
    console.error('[GET /api/salons/:salonId/hours] Erreur:', e);
    return res.status(500).json({ error: 'Impossible de charger les horaires' });
  }
});

// PUT /api/salons/:salonId/hours
salonsRouter.put('/:salonId/hours', async (req: Request, res: Response) => {
  try {
    const timestamp = new Date().toISOString();
    const rawId = req.params.salonId;
    const salonId = normalizeSalonId(rawId);
    const user = (req as any).user;

    console.log(`[PUT /api/salons/:salonId/hours] ${timestamp}`);
    console.log(`[PUT /api/salons/:salonId/hours] rawId:`, rawId);
    console.log(`[PUT /api/salons/:salonId/hours] normalized salonId:`, salonId);
    console.log(`[PUT /api/salons/:salonId/hours] user:`, user ? {
      id: user.id,
      email: user.email,
      userType: user.userType,
      salonId: user.salonId
    } : 'null');

    if (!salonId) {
      return res.status(400).json({ error: 'Salon ID manquant' });
    }

    // Vérification d'autorisation
    if (!user) {
      console.error(`[PUT /api/salons/:salonId/hours] ❌ Utilisateur non authentifié`);
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[PUT /api/salons/:salonId/hours] Configuration Supabase manquante');
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Vérifier que le salon existe et que l'utilisateur y a accès
    // Chercher d'abord avec l'ID normalisé
    let salon = null;
    let salonError = null;
    
    const { data: salonData, error: error1 } = await supabase
      .from('salons')
      .select('id, user_id')
      .eq('id', salonId)
      .maybeSingle();
    
    salon = salonData;
    salonError = error1;

    // Si non trouvé et pas d'erreur, essayer avec ID préfixé
    if (!salon && !salonError) {
      const prefixedId = `salon-${salonId}`;
      console.log(`[PUT /api/salons/:salonId/hours] Tentative avec ID préfixé: ${prefixedId}`);
      const { data: salonPrefixed, error: error2 } = await supabase
        .from('salons')
        .select('id, user_id')
        .eq('id', prefixedId)
        .maybeSingle();
      
      if (salonPrefixed) {
        salon = salonPrefixed;
        console.log(`[PUT /api/salons/:salonId/hours] Salon trouvé avec ID préfixé: ${salon.id}`);
      } else if (error2) {
        salonError = error2;
      }
    }

    // Si toujours pas trouvé, chercher par user_id (pour les cas où le salon est associé à l'utilisateur)
    if (!salon && !salonError && user) {
      const userId = String(user.id);
      console.log(`[PUT /api/salons/:salonId/hours] Tentative recherche par user_id: ${userId}`);
      const { data: salonByUser, error: error3 } = await supabase
        .from('salons')
        .select('id, user_id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (salonByUser) {
        salon = salonByUser;
        console.log(`[PUT /api/salons/:salonId/hours] Salon trouvé par user_id: ${salon.id}`);
      } else if (error3) {
        salonError = error3;
      }
    }

    // Vérifier l'autorisation
    const userId = String(user.id);
    const isOwner = String(user.userType) === 'owner';
    const salonUserId = salon ? String(salon.user_id) : '';
    
    if (salonError) {
      console.error('[PUT /api/salons/:salonId/hours] Erreur Supabase lors de la recherche:', salonError);
      return res.status(500).json({ error: 'Erreur lors de la recherche du salon' });
    }
    
    if (!salon) {
      console.error(`[PUT /api/salons/:salonId/hours] Salon introuvable - salonId demandé: ${salonId}, userId: ${userId}`);
      return res.status(404).json({ error: 'Salon introuvable' });
    }

    if (isOwner && salonUserId !== userId) {
      console.error(`[PUT /api/salons/:salonId/hours] Accès refusé - salonUserId: ${salonUserId}, userId: ${userId}`);
      return res.status(403).json({ error: 'Accès refusé pour ce salon' });
    }

    const { hours } = req.body;

    console.log('[PUT /api/salons/:salonId/hours] Données reçues (type):', typeof hours, 'isArray:', Array.isArray(hours));
    console.log('[PUT /api/salons/:salonId/hours] Données reçues:', JSON.stringify(hours, null, 2));
    console.log('[PUT /api/salons/:salonId/hours] Nombre d\'horaires:', hours?.length || 0);

    if (!Array.isArray(hours)) {
      console.error('[PUT /api/salons/:salonId/hours] ❌ hours n\'est pas un tableau:', typeof hours);
      return res.status(400).json({ error: 'Les horaires doivent être un tableau' });
    }

    if (hours.length === 0) {
      console.warn('[PUT /api/salons/:salonId/hours] ⚠️ Aucun horaire reçu');
      return res.status(400).json({ error: 'Aucun horaire fourni' });
    }

    // Supprimer les anciens horaires
    const realSalonId = salon.id;
    console.log('[PUT /api/salons/:salonId/hours] Suppression des anciens horaires pour salon:', realSalonId);
    
    // Essayer d'abord avec opening_hours (nom correct dans le schéma)
    let deleteError: any = null;
    try {
      const deleteResult = await supabase
        .from('opening_hours')
        .delete()
        .or(`salon_id.eq.${realSalonId},salon_id.eq.${salonId}`);
      deleteError = deleteResult.error;
      if (deleteError) {
        console.log('[PUT /api/salons/:salonId/hours] Erreur suppression opening_hours, essai avec salon_hours...');
        const deleteResult2 = await supabase
      .from('salon_hours')
      .delete()
      .or(`salon_id.eq.${realSalonId},salon_id.eq.${salonId}`);
        deleteError = deleteResult2.error;
      }
    } catch (e: any) {
      // Si la table n'existe pas, essayer salon_hours
      if (e.code === '42P01' || e.message?.includes('does not exist')) {
        console.log('[PUT /api/salons/:salonId/hours] Table opening_hours n\'existe pas, essai avec salon_hours...');
        try {
          const deleteResult2 = await supabase
      .from('salon_hours')
      .delete()
      .or(`salon_id.eq.${realSalonId},salon_id.eq.${salonId}`);
          deleteError = deleteResult2.error;
        } catch (e2: any) {
          console.warn('[PUT /api/salons/:salonId/hours] Impossible de supprimer les anciens horaires, continuation...');
          deleteError = null; // Continuer même si la suppression échoue
        }
      } else {
        deleteError = e;
      }
    }
    
    if (deleteError && deleteError.code !== '42P01' && !deleteError.message?.includes('does not exist')) {
      console.warn('[PUT /api/salons/:salonId/hours] ⚠️ Erreur lors de la suppression (non bloquante):', deleteError);
    }

    // Mapping des jours de la semaine (string -> number)
    // Support des noms en français ET en anglais
    const dayNameToNumber: Record<string, number> = {
      // Anglais
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
      // Français
      'dimanche': 0,
      'lundi': 1,
      'mardi': 2,
      'mercredi': 3,
      'jeudi': 4,
      'vendredi': 5,
      'samedi': 6,
    };

    console.log('[PUT /api/salons/:salonId/hours] Traitement de', hours.length, 'horaires');

    // Insérer les nouveaux horaires
    const hoursToInsert: any[] = [];
    
    for (const h of hours) {
      // Filtrer seulement les jours ouverts (isOpen !== false)
      const isOpen = h.isOpen !== false && h.isOpen !== undefined;
      
      if (!isOpen) {
        console.log('[PUT /api/salons/:salonId/hours] Jour fermé ignoré:', h.day || h.dayOfWeek || h.day_of_week);
        continue;
      }

      // Récupérer le jour (peut être day, dayOfWeek, ou day_of_week)
      const dayKey = h.day ?? h.dayOfWeek ?? h.day_of_week;
      
      if (dayKey === undefined || dayKey === null) {
        console.error('[PUT /api/salons/:salonId/hours] ❌ Jour manquant dans:', JSON.stringify(h));
        throw new Error(`Jour manquant dans l'horaire: ${JSON.stringify(h)}`);
      }

      console.log('[PUT /api/salons/:salonId/hours] Traitement jour:', dayKey, 'type:', typeof dayKey);
      
      // Convertir en numéro si c'est une chaîne
      let dayOfWeek: number;
      if (typeof dayKey === 'string') {
        const dayLower = dayKey.toLowerCase().trim();
        dayOfWeek = dayNameToNumber[dayLower];
        if (dayOfWeek === undefined) {
          // Si c'est déjà un numéro en string, le parser
          dayOfWeek = parseInt(dayKey, 10);
          if (isNaN(dayOfWeek)) {
            console.error('[PUT /api/salons/:salonId/hours] ❌ Jour invalide:', dayKey);
            console.error('[PUT /api/salons/:salonId/hours] ❌ Jours disponibles:', Object.keys(dayNameToNumber).join(', '));
            throw new Error(`Jour invalide: ${dayKey}. Jours acceptés: ${Object.keys(dayNameToNumber).join(', ')}`);
          }
        } else {
          console.log('[PUT /api/salons/:salonId/hours] ✅ Jour converti:', dayKey, '->', dayOfWeek);
        }
      } else {
        dayOfWeek = typeof dayKey === 'number' ? dayKey : parseInt(String(dayKey), 10);
        if (isNaN(dayOfWeek)) {
          console.error('[PUT /api/salons/:salonId/hours] ❌ Jour invalide (numérique):', dayKey);
          throw new Error(`Jour invalide: ${dayKey}`);
        }
      }

      // Valider que le numéro est entre 0 et 6
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        console.error('[PUT /api/salons/:salonId/hours] ❌ Jour hors limites:', dayOfWeek);
        throw new Error(`Jour de la semaine invalide: ${dayOfWeek} (doit être entre 0 et 6)`);
      }

      // Valider que les heures sont présentes
      const openTime = h.openTime ?? h.open_time;
      const closeTime = h.closeTime ?? h.close_time;
      
      if (!openTime || !closeTime) {
        console.error('[PUT /api/salons/:salonId/hours] ❌ Heures manquantes pour jour:', dayOfWeek, 'h:', JSON.stringify(h));
        continue; // Ignorer cet horaire
      }

      const hourEntry = {
        salon_id: realSalonId,
        day_of_week: dayOfWeek,
        open_time: openTime,
        close_time: closeTime,
        is_closed: false, // On filtre déjà les jours fermés, donc ceux-ci sont ouverts
      };

      console.log('[PUT /api/salons/:salonId/hours] ✅ Horaire préparé:', JSON.stringify(hourEntry));
      hoursToInsert.push(hourEntry);
    }
    
    console.log('[PUT /api/salons/:salonId/hours] 🔍 ID utilisé pour sauvegarde:', realSalonId);
    console.log('[PUT /api/salons/:salonId/hours] 🔍 ID normalisé:', salonId);
    console.log('[PUT /api/salons/:salonId/hours] 🔍 ID préfixé:', `salon-${salonId}`);

    if (hoursToInsert.length === 0) {
      console.warn('[PUT /api/salons/:salonId/hours] ⚠️ Aucun horaire à insérer (tous les jours sont fermés)');
      return res.json({ success: true, message: 'Aucun horaire à sauvegarder (tous les jours sont fermés)', hours: [] });
    }

    console.log('[PUT /api/salons/:salonId/hours] Insertion de', hoursToInsert.length, 'horaires');

    // Essayer d'abord avec opening_hours (nom correct dans le schéma)
    let insertError: any = null;
    let insertSuccess = false;
    let usedTable = '';
    
    try {
      const result = await supabase
        .from('opening_hours')
        .insert(hoursToInsert);
      
      insertError = result.error;
      
      // Vérifier si l'erreur est due à l'absence de la table
      if (insertError && (
        insertError.message?.includes('Could not find the table') ||
        insertError.message?.includes('does not exist') ||
        insertError.code === '42P01' ||
        insertError.message?.includes('schema cache')
      )) {
        console.log('[PUT /api/salons/:salonId/hours] Table opening_hours n\'existe pas, essai avec salon_hours...');
        // Essayer avec salon_hours
        const result2 = await supabase
      .from('salon_hours')
      .insert(hoursToInsert);
        insertError = result2.error;
        if (!insertError) {
          insertSuccess = true;
          usedTable = 'salon_hours';
          console.log('[PUT /api/salons/:salonId/hours] ✅ Insertion réussie avec salon_hours');
        }
      } else if (!insertError) {
        insertSuccess = true;
        usedTable = 'opening_hours';
        console.log('[PUT /api/salons/:salonId/hours] ✅ Insertion réussie avec opening_hours');
      }
    } catch (e: any) {
      // Si la table n'existe pas, essayer salon_hours
      if (e.message?.includes('Could not find the table') || 
          e.message?.includes('does not exist') ||
          e.code === '42P01' ||
          e.message?.includes('schema cache')) {
        console.log('[PUT /api/salons/:salonId/hours] Exception: table n\'existe pas, essai avec salon_hours...');
        try {
          const result = await supabase
      .from('salon_hours')
      .insert(hoursToInsert);
          insertError = result.error;
          if (!insertError) {
            insertSuccess = true;
            usedTable = 'salon_hours';
            console.log('[PUT /api/salons/:salonId/hours] ✅ Insertion réussie avec salon_hours (catch)');
          }
        } catch (e2: any) {
          insertError = e2;
        }
      } else {
        insertError = e;
      }
    }

    if (insertError && !insertSuccess) {
      console.error('[PUT /api/salons/:salonId/hours] ❌ Erreur insertion:', insertError);
      console.error('[PUT /api/salons/:salonId/hours] ❌ Code:', insertError.code);
      console.error('[PUT /api/salons/:salonId/hours] ❌ Message:', insertError.message);
      console.error('[PUT /api/salons/:salonId/hours] ❌ Détails:', JSON.stringify(insertError, null, 2));
      
      // Message d'erreur plus clair pour l'utilisateur
      let errorMessage = 'Impossible de sauvegarder les horaires';
      if (insertError.message?.includes('Could not find the table') || 
          insertError.message?.includes('schema cache') ||
          insertError.code === '42P01') {
        errorMessage = 'La table opening_hours n\'existe pas dans Supabase. Veuillez exécuter le script SQL supabase_all_tables_complete.sql dans le SQL Editor de Supabase (Table Editor > SQL Editor).';
      } else if (insertError.message) {
        errorMessage = `Impossible de sauvegarder les horaires: ${insertError.message}`;
      }
      
      console.error('[PUT /api/salons/:salonId/hours] ❌ Message d\'erreur final:', errorMessage);
      return res.status(500).json({ error: errorMessage });
    }

    console.log(`[PUT /api/salons/:salonId/hours] ✅ Succès - ${hoursToInsert.length} horaires sauvegardés`);
    return res.json({ success: true, hours: hoursToInsert });
  } catch (e: any) {
    console.error('[PUT /api/salons/:salonId/hours] ❌ Erreur exception:', e);
    console.error('[PUT /api/salons/:salonId/hours] ❌ Stack:', e.stack);
    console.error('[PUT /api/salons/:salonId/hours] ❌ Message:', e.message);
    return res.status(500).json({ 
      error: 'Impossible de sauvegarder les horaires',
      details: e.message || String(e)
    });
  }
});

// GET /api/salons/:salonId/stylist-hours
salonsRouter.get('/:salonId/stylist-hours', async (req: Request, res: Response) => {
  try {
    const salonId = normalizeSalonId(req.params.salonId);
    if (!salonId) {
      return res.status(400).json({ error: 'Salon ID manquant' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Récupérer les stylistes du salon pour limiter les résultats
    const possibleSalonIds = [salonId, `salon-${salonId}`];
    const { data: stylistList, error: stylistError } = await supabase
      .from('stylistes')
      .select('id, salon_id')
      .in('salon_id', possibleSalonIds);

    if (stylistError) {
      console.error('[GET /api/salons/:salonId/stylist-hours] Erreur récupération stylistes:', stylistError);
      return res.status(500).json({ error: 'Impossible de charger les stylistes' });
    }

    const stylistIds = (stylistList || []).map((stylist: any) => stylist.id);

    if (!stylistIds.length) {
      return res.json({ hours: {} });
    }

    // Récupérer les horaires depuis stylist_schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('stylist_schedule')
      .select('id, stylist_id, day_of_week, start_time, end_time, is_available')
      .in('stylist_id', stylistIds);

    if (scheduleError) {
      if (scheduleError.code === '42P01' || scheduleError.message?.includes('does not exist')) {
        console.error('[GET /api/salons/:salonId/stylist-hours] ❌ Table stylist_schedule introuvable. Exécutez supabase_all_tables_complete.sql.');
        return res.status(500).json({ error: 'Table stylist_schedule introuvable. Veuillez exécuter le script SQL supabase_all_tables_complete.sql dans Supabase.' });
      }
      console.error('[GET /api/salons/:salonId/stylist-hours] Erreur:', scheduleError);
      return res.status(500).json({ error: 'Impossible de charger les horaires' });
    }

    const grouped: Record<string, any[]> = {};
    stylistIds.forEach((stylistId: string) => {
      grouped[stylistId] = DAYS.map(day => ({
        day_of_week: day.value,
        open_time: '09:00',
        close_time: '18:00',
        is_closed: true,
        slots: [], // Initialiser avec des slots vides
      }));
    });

    // Grouper les créneaux par styliste et par jour
    (schedule || []).forEach((entry: any) => {
      const stylistId = entry.stylist_id;
      if (!grouped[stylistId]) {
        grouped[stylistId] = [];
      }

      const dayIndex = entry.day_of_week ?? 0;
      let dayEntry = grouped[stylistId].find(h => h.day_of_week === dayIndex);
      
      if (!dayEntry) {
        // Créer une nouvelle entrée pour ce jour
        dayEntry = {
          day_of_week: dayIndex,
          open_time: '09:00',
          close_time: '18:00',
          is_closed: true,
          slots: [],
        };
        grouped[stylistId].push(dayEntry);
      }

      // Si le styliste est indisponible, marquer comme fermé
      if (entry.is_available === false) {
        dayEntry.is_closed = true;
        dayEntry.slots = [];
      } else {
        // Si disponible, ajouter le créneau aux slots
        dayEntry.is_closed = false;
        if (!dayEntry.slots) {
          dayEntry.slots = [];
        }
        dayEntry.slots.push({
          openTime: entry.start_time || '09:00',
          closeTime: entry.end_time || '18:00',
        });
        // Mettre à jour les horaires globaux (premier créneau pour compatibilité)
        if (dayEntry.slots.length === 1) {
          dayEntry.open_time = entry.start_time || '09:00';
          dayEntry.close_time = entry.end_time || '18:00';
        }
      }
    });

    // S'assurer que chaque styliste a les jours triés
    Object.keys(grouped).forEach((stylistId) => {
      grouped[stylistId] = grouped[stylistId]
        .sort((a, b) => a.day_of_week - b.day_of_week);
    });

    return res.json({ hours: grouped });
  } catch (e: any) {
    console.error('[GET /api/salons/:salonId/stylist-hours] Erreur:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/salons/:salonId/stylist-hours/:stylistId
// Fonction utilitaire pour normaliser l'ID du styliste
function normalizeStylistId(stylistId: string): string {
  if (!stylistId) return '';
  // Retirer le préfixe "stylist-" s'il existe
  return stylistId.startsWith('stylist-') ? stylistId.substring(8) : stylistId;
}

salonsRouter.put('/:salonId/stylist-hours/:stylistId', async (req: Request, res: Response) => {
  try {
    const salonId = normalizeSalonId(req.params.salonId);
    const rawStylistId = req.params.stylistId;
    const stylistId = normalizeStylistId(rawStylistId);
    const user = (req as any).user;

    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] salonId: ${salonId}, rawStylistId: ${rawStylistId}, normalized stylistId: ${stylistId}`);

    if (!salonId || !stylistId) {
      return res.status(400).json({ error: 'Salon ID ou Stylist ID manquant' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const possibleSalonIds = [salonId, `salon-${salonId}`];

    const { data: salonRecord, error: salonError } = await supabase
      .from('salons')
      .select('id, user_id')
      .in('id', possibleSalonIds)
      .maybeSingle();

    if (salonError) {
      console.error('[PUT /api/salons/:salonId/stylist-hours/:stylistId] Erreur lors de la récupération du salon:', salonError);
      return res.status(500).json({ error: 'Erreur lors de la récupération du salon' });
    }

    if (!salonRecord) {
      return res.status(404).json({ error: 'Salon introuvable' });
    }

    if (String(salonRecord.user_id) !== String(user.id)) {
      return res.status(403).json({ error: 'Accès refusé pour ce salon' });
    }

    // Essayer de trouver le styliste avec l'ID normalisé, puis avec l'ID brut
    const possibleStylistIds = rawStylistId !== stylistId ? [stylistId, rawStylistId] : [stylistId];
    
    let stylistRecord: any = null;
    let stylistFetchError: any = null;
    
    for (const testId of possibleStylistIds) {
      const { data, error } = await supabase
        .from('stylistes')
        .select('id, salon_id')
        .eq('id', testId)
        .maybeSingle();
      
      if (data) {
        stylistRecord = data;
        console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ✅ Styliste trouvé avec ID: ${testId}`);
        break;
      }
      if (error) {
        stylistFetchError = error;
      }
    }

    if (stylistFetchError && !stylistRecord) {
      console.error('[PUT /api/salons/:salonId/stylist-hours/:stylistId] Erreur lors de la récupération du styliste:', stylistFetchError);
      return res.status(500).json({ error: 'Erreur lors de la récupération du styliste' });
    }

    if (!stylistRecord) {
      console.error(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ❌ Styliste introuvable avec IDs testés: ${possibleStylistIds.join(', ')}`);
      return res.status(404).json({ error: 'Styliste introuvable' });
    }

    const stylistSalonId = stylistRecord.salon_id;
    const normalizedStylistSalonId = normalizeSalonId(stylistSalonId);

    if (normalizedStylistSalonId !== salonId) {
      return res.status(403).json({ error: 'Accès refusé : ce styliste n’appartient pas à ce salon.' });
    }

    const { hours } = req.body;

    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] 📥 Données reçues:`, JSON.stringify({ hours, stylistId, salonId }, null, 2));
    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] 📥 Type de hours:`, typeof hours, 'isArray:', Array.isArray(hours));

    if (!Array.isArray(hours)) {
      console.error(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ❌ hours n'est pas un tableau:`, typeof hours, hours);
      return res.status(400).json({ error: 'Les horaires doivent être un tableau' });
    }

    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] 📥 Nombre d'horaires reçus:`, hours.length);

    // Récupérer les horaires du salon pour validation
    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] Récupération des horaires du salon pour validation...`);
    let salonHours: any[] = [];
    try {
      // Essayer d'abord avec opening_hours
      let result = await supabase
        .from('opening_hours')
        .select('day_of_week, open_time, close_time, is_closed')
        .in('salon_id', possibleSalonIds);
      
      if (result.error || !result.data || result.data.length === 0) {
        // Essayer avec salon_hours
        result = await supabase
          .from('salon_hours')
          .select('day_of_week, open_time, close_time, is_closed')
          .in('salon_id', possibleSalonIds);
      }
      
      if (result.data) {
        salonHours = result.data.filter((h: any) => !h.is_closed);
        console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ${salonHours.length} jours ouverts trouvés pour le salon`);
      }
    } catch (e: any) {
      console.warn('[PUT /api/salons/:salonId/stylist-hours/:stylistId] Impossible de récupérer les horaires du salon, validation partielle');
    }

    // Valider et préparer les horaires à insérer
    const hoursToInsert: any[] = [];
    const dayNameToNumber: Record<string, number> = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6,
      'dimanche': 0, 'lundi': 1, 'mardi': 2, 'mercredi': 3, 'jeudi': 4, 'vendredi': 5, 'samedi': 6,
    };

    for (const h of hours) {
      console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] 🔍 Traitement horaire:`, JSON.stringify(h));
      
      // Convertir le jour en numéro si nécessaire
      let dayOfWeek: number;
      if (typeof h.day_of_week === 'string') {
        const dayLower = h.day_of_week.toLowerCase().trim();
        dayOfWeek = dayNameToNumber[dayLower] ?? parseInt(h.day_of_week, 10);
        console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] Jour string "${h.day_of_week}" -> ${dayOfWeek}`);
      } else {
        dayOfWeek = h.day_of_week;
        console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] Jour number: ${dayOfWeek}`);
      }

      if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        console.warn(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ❌ Jour invalide ignoré: ${h.day_of_week} (type: ${typeof h.day_of_week})`);
        continue;
      }

      const isClosed = h.is_closed || false;
      
      // Si le styliste est marqué comme indisponible, on l'enregistre comme fermé
      if (isClosed) {
        hoursToInsert.push({
          stylist_id: stylistRecord.id,
          day_of_week: dayOfWeek,
          start_time: null,
          end_time: null,
          is_available: false,
        });
        continue;
      }

      // Récupérer tous les créneaux du salon pour ce jour (peut y avoir plusieurs créneaux)
      const salonDaySlots = salonHours.filter((sh: any) => {
        const shDay = typeof sh.day_of_week === 'string' ? parseInt(sh.day_of_week, 10) : sh.day_of_week;
        return shDay === dayOfWeek;
      });
      
      if (salonDaySlots.length === 0) {
        console.warn(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ⚠️ Le salon est fermé le jour ${dayOfWeek} (${DAYS[dayOfWeek]?.label || 'inconnu'}), le styliste ne peut pas être disponible`);
        // Si le salon est fermé ce jour-là, forcer le styliste à être fermé aussi
        hoursToInsert.push({
          stylist_id: stylistRecord.id,
          day_of_week: dayOfWeek,
          start_time: null,
          end_time: null,
          is_available: false,
        });
        console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ✅ Horaire forcé fermé pour jour ${dayOfWeek}`);
        continue;
      }
      
      // Calculer les heures d'ouverture globales du salon (de l'heure la plus tôt à l'heure la plus tard)
      const toMinutes = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
      };
      
      const salonOpenTimes = salonDaySlots.map((s: any) => toMinutes(s.open_time));
      const salonCloseTimes = salonDaySlots.map((s: any) => toMinutes(s.close_time));
      const salonEarliestOpen = Math.min(...salonOpenTimes);
      const salonLatestClose = Math.max(...salonCloseTimes);
      
      console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ✅ Salon ouvert le jour ${dayOfWeek}, créneaux: ${salonDaySlots.map((s: any) => `${s.open_time}-${s.close_time}`).join(', ')}, global: ${Math.floor(salonEarliestOpen / 60)}:${String(salonEarliestOpen % 60).padStart(2, '0')} - ${Math.floor(salonLatestClose / 60)}:${String(salonLatestClose % 60).padStart(2, '0')}`);

      // Vérifier que les horaires du styliste sont dans les heures d'ouverture globales du salon
      const stylistOpenTime = h.open_time || '09:00';
      const stylistCloseTime = h.close_time || '18:00';
      
      const stylistOpenMinutes = toMinutes(stylistOpenTime);
      const stylistCloseMinutes = toMinutes(stylistCloseTime);

      // Vérifier que les horaires du styliste sont dans les limites globales du salon
      if (stylistOpenMinutes < salonEarliestOpen || stylistCloseMinutes > salonLatestClose) {
        console.warn(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] Les horaires du styliste (${stylistOpenTime}-${stylistCloseTime}) sont en dehors des horaires globaux du salon pour le jour ${dayOfWeek}`);
        // Ajuster les horaires pour qu'ils soient dans les limites globales du salon
        const adjustedOpenTime = stylistOpenMinutes < salonEarliestOpen 
          ? `${Math.floor(salonEarliestOpen / 60)}:${String(salonEarliestOpen % 60).padStart(2, '0')}`
          : stylistOpenTime;
        const adjustedCloseTime = stylistCloseMinutes > salonLatestClose
          ? `${Math.floor(salonLatestClose / 60)}:${String(salonLatestClose % 60).padStart(2, '0')}`
          : stylistCloseTime;
        
        hoursToInsert.push({
          stylist_id: stylistRecord.id,
          day_of_week: dayOfWeek,
          start_time: adjustedOpenTime,
          end_time: adjustedCloseTime,
          is_available: true,
        });
      } else {
        // Les horaires sont valides, les accepter tels quels (peuvent être continus et couvrir plusieurs créneaux)
        hoursToInsert.push({
          stylist_id: stylistRecord.id,
          day_of_week: dayOfWeek,
          start_time: stylistOpenTime,
          end_time: stylistCloseTime,
          is_available: true,
        });
      }
    }

    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ${hoursToInsert.length} horaires à insérer`);

    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] 📝 ${hoursToInsert.length} horaires préparés pour insertion`);
    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] 📝 Horaires à insérer:`, JSON.stringify(hoursToInsert, null, 2));

    // Supprimer les anciens horaires du styliste
    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] 🗑️ Suppression des anciens horaires pour stylist_id: ${stylistRecord.id}...`);
    
    // Essayer d'abord avec stylist_schedule (snake_case)
    let deleteError: any = null;
    let deleteResult = await supabase
      .from('stylist_schedule')
      .delete()
      .eq('stylist_id', stylistRecord.id);
    
    deleteError = deleteResult.error;
    
    // Si la table n'existe pas, essayer de la créer ou utiliser une alternative
    if (deleteError && (deleteError.code === '42P01' || deleteError.message?.includes('does not exist') || deleteError.message?.includes('schema cache'))) {
      console.warn('[PUT /api/salons/:salonId/stylist-hours/:stylistId] ⚠️ Table stylist_schedule introuvable, tentative de création...');
      // La table n'existe pas, on continue quand même (première utilisation)
      deleteError = null;
    } else if (deleteError) {
      console.warn('[PUT /api/salons/:salonId/stylist-hours/:stylistId] ⚠️ Erreur lors de la suppression (non bloquante):', deleteError);
    } else {
      console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ✅ Anciens horaires supprimés`);
    }

    if (hoursToInsert.length === 0) {
      console.warn('[PUT /api/salons/:salonId/stylist-hours/:stylistId] ⚠️ Aucun horaire à insérer');
      return res.json({ success: true, hours: [], message: 'Aucun horaire valide à sauvegarder' });
    }

    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] 💾 Insertion de ${hoursToInsert.length} horaires...`);
    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] 💾 Données à insérer:`, JSON.stringify(hoursToInsert, null, 2));
    
    // Essayer d'insérer dans stylist_schedule
    let insertResult = await supabase
      .from('stylist_schedule')
      .insert(hoursToInsert)
      .select();
    
    let insertError = insertResult.error;
    let insertedData = insertResult.data;

    // Si la table n'existe pas, retourner une erreur claire avec instructions complètes
    if (insertError && (insertError.code === '42P01' || insertError.message?.includes('does not exist') || insertError.message?.includes('schema cache'))) {
      console.error('[PUT /api/salons/:salonId/stylist-hours/:stylistId] ❌ Table stylist_schedule introuvable.');
      
      const fullSql = `-- Script SQL complet pour créer la table stylist_schedule
-- Copiez-collez ce script dans Supabase SQL Editor et exécutez-le

CREATE TABLE IF NOT EXISTS public.stylist_schedule (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  stylist_id VARCHAR NOT NULL REFERENCES public.stylistes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(stylist_id, day_of_week)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_stylist_schedule_stylist_id ON public.stylist_schedule(stylist_id);
CREATE INDEX IF NOT EXISTS idx_stylist_schedule_day_of_week ON public.stylist_schedule(day_of_week);

-- Enable Row Level Security (RLS)
ALTER TABLE public.stylist_schedule ENABLE ROW LEVEL SECURITY;

-- Policies pour stylist_schedule
DROP POLICY IF EXISTS "Allow owners to view stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to view stylist schedule" ON public.stylist_schedule FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to insert stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to insert stylist schedule" ON public.stylist_schedule FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to update stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to update stylist schedule" ON public.stylist_schedule FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow owners to delete stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to delete stylist schedule" ON public.stylist_schedule FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id = auth.uid())
);`;

      console.error('[PUT /api/salons/:salonId/stylist-hours/:stylistId] ❌ INSTRUCTIONS:');
      console.error('1. Allez dans Supabase Dashboard → SQL Editor');
      console.error('2. Copiez-collez le script SQL ci-dessous');
      console.error('3. Cliquez sur "Run"');
      console.error('4. Rechargez cette page et réessayez');
      console.error('');
      console.error(fullSql);
      
      return res.status(500).json({ 
        error: 'Table stylist_schedule introuvable', 
        details: 'La table stylist_schedule n\'existe pas dans votre base de données Supabase.',
        instructions: [
          '1. Allez dans Supabase Dashboard → SQL Editor',
          '2. Ouvrez le fichier: supabase_create_stylist_schedule.sql',
          '3. Copiez-collez tout le contenu dans l\'éditeur SQL',
          '4. Cliquez sur "Run" pour exécuter le script',
          '5. Rechargez cette page et réessayez de sauvegarder les horaires'
        ],
        sqlFile: 'supabase_create_stylist_schedule.sql',
        sql: fullSql
      });
    }

    if (insertError) {
      console.error('[PUT /api/salons/:salonId/stylist-hours/:stylistId] ❌ Erreur insertion:', insertError);
      console.error('[PUT /api/salons/:salonId/stylist-hours/:stylistId] ❌ Code:', insertError.code);
      console.error('[PUT /api/salons/:salonId/stylist-hours/:stylistId] ❌ Message:', insertError.message);
      console.error('[PUT /api/salons/:salonId/stylist-hours/:stylistId] ❌ Détails:', JSON.stringify(insertError, null, 2));
      console.error('[PUT /api/salons/:salonId/stylist-hours/:stylistId] ❌ Données tentées:', JSON.stringify(hoursToInsert, null, 2));
      return res.status(500).json({ error: 'Impossible de sauvegarder les horaires', details: insertError.message });
    }

    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ✅ ${hoursToInsert.length} horaires sauvegardés avec succès`);
    console.log(`[PUT /api/salons/:salonId/stylist-hours/:stylistId] ✅ Données insérées:`, JSON.stringify(insertedData, null, 2));
    const responseHours = (insertedData || hoursToInsert).map((item: any) => ({
      day_of_week: item.day_of_week,
      open_time: item.start_time || '09:00',
      close_time: item.end_time || '18:00',
      is_closed: item.is_available === false,
    }));
    return res.json({ success: true, hours: responseHours });
  } catch (e: any) {
    console.error('[PUT /api/salons/:salonId/stylist-hours/:stylistId] Erreur:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/salons/:salonId/stylistes/:stylistId - Mettre à jour un styliste (notamment la couleur)
// IMPORTANT: Cette route doit être définie AVANT les routes plus génériques pour éviter les conflits
salonsRouter.put('/:salonId/stylistes/:stylistId', async (req: Request, res: Response) => {
  const { salonId: rawSalonId, stylistId: rawStylistId } = req.params;
  const body = req.body || {};
  
  console.log(`[PUT /api/salons/:salonId/stylistes/:stylistId] ✅ Route appelée: salonId=${rawSalonId}, stylistId=${rawStylistId}, body=`, body);
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: "Configuration Supabase manquante" });
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Normaliser les IDs pour la recherche
    const normalizedSalonId = normalizeSalonId(rawSalonId);
    const normalizeStylistIdFn = (id: string) => id?.replace(/^(stylist-)/, '') || id;
    const normalizedStylistId = normalizeStylistIdFn(rawStylistId);
    
    // Essayer plusieurs formats d'ID pour trouver le styliste
    const possibleStylistIds = [rawStylistId, normalizedStylistId];
    if (rawStylistId.startsWith('stylist-')) {
      possibleStylistIds.push(rawStylistId.substring(8));
    }
    
    let stylist: any = null;
    let stylistFetchError: any = null;
    
    for (const testId of possibleStylistIds) {
      const { data, error } = await supabase
        .from('stylistes')
        .select('id, salon_id')
        .eq('id', testId)
        .maybeSingle();
      
      if (data) {
        stylist = data;
        console.log(`[PUT /api/salons/:salonId/stylistes/:stylistId] ✅ Styliste trouvé avec ID: ${testId}`);
        break;
      }
      if (error) {
        stylistFetchError = error;
      }
    }
    
    if (stylistFetchError && !stylist) {
      console.error('[PUT /api/salons/:salonId/stylistes/:stylistId] Erreur lors de la récupération du styliste:', stylistFetchError);
      return res.status(500).json({ error: 'Erreur lors de la récupération du styliste' });
    }
    
    if (!stylist) {
      console.error(`[PUT /api/salons/:salonId/stylistes/:stylistId] ❌ Styliste introuvable avec IDs testés: ${possibleStylistIds.join(', ')}`);
      return res.status(404).json({ error: 'Styliste introuvable' });
    }
    
    // Vérifier que le styliste appartient au salon
    const stylistSalonId = normalizeSalonId(stylist.salon_id);
    if (stylistSalonId !== normalizedSalonId) {
      console.error(`[PUT /api/salons/:salonId/stylistes/:stylistId] ❌ Salon ID mismatch: stylist.salon_id=${stylist.salon_id} (normalized: ${stylistSalonId}) !== salonId=${rawSalonId} (normalized: ${normalizedSalonId})`);
      return res.status(403).json({ error: 'Accès refusé : ce styliste n\'appartient pas à ce salon.' });
    }
    
    // Préparer les données de mise à jour (seulement les champs fournis)
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    // Ajouter la couleur si fournie (même si c'est une chaîne vide, on la sauvegarde)
    if (body.color !== undefined && body.color !== null) {
      updateData.color = body.color || null;
      console.log(`[PUT /api/salons/:salonId/stylistes/:stylistId] ✅ Couleur à mettre à jour: ${body.color}`);
    } else {
      console.log(`[PUT /api/salons/:salonId/stylistes/:stylistId] ⚠️ Couleur non fournie dans body.color`);
    }
    
    if (body.firstName !== undefined) updateData.first_name = body.firstName;
    if (body.lastName !== undefined) updateData.last_name = body.lastName;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.photoUrl !== undefined) updateData.photo_url = body.photoUrl;
    if (body.specialties !== undefined) updateData.specialties = body.specialties;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    
    console.log(`[PUT /api/salons/:salonId/stylistes/:stylistId] 📝 Données de mise à jour:`, JSON.stringify(updateData, null, 2));
    
    // Mettre à jour le styliste avec l'ID trouvé
    const { data, error: updateError } = await supabase
      .from('stylistes')
      .update(updateData)
      .eq('id', stylist.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('[PUT /api/salons/:salonId/stylistes/:stylistId] ❌ Erreur lors de la mise à jour du styliste:', updateError);
      return res.status(500).json({ error: "Erreur lors de la mise à jour", details: updateError.message });
    }
    
    console.log(`[PUT /api/salons/:salonId/stylistes/:stylistId] ✅ Données mises à jour depuis Supabase:`, JSON.stringify(data, null, 2));
    
    // Mapper les données de retour
    const mappedData = {
      id: data.id,
      salonId: data.salon_id,
      firstName: data.first_name,
      lastName: data.last_name,
      name: `${data.first_name} ${data.last_name}`,
      email: data.email,
      phone: data.phone,
      photoUrl: data.photo_url,
      specialties: data.specialties,
      isActive: data.is_active,
      color: data.color || null, // S'assurer que color est inclus même si null
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    
    console.log(`[PUT /api/salons/:salonId/stylistes/:stylistId] ✅ Données mappées retournées:`, JSON.stringify(mappedData, null, 2));
    return res.json(mappedData);
  } catch (error: any) {
    console.error('[PUT /api/salons/:salonId/stylistes/:stylistId] Exception:', error);
    return res.status(500).json({ error: "Erreur interne du serveur", details: error.message });
  }
});

// GET /api/salons/:salonId/closed-dates
salonsRouter.get('/:salonId/closed-dates', async (req: Request, res: Response) => {
  try {
    const rawSalonId = req.params.salonId;
    const salonId = normalizeSalonId(rawSalonId);
    if (!salonId) {
      return res.status(400).json({ error: 'Salon ID manquant' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Essayer plusieurs formats d'ID pour trouver les dates
    const possibleSalonIds = [rawSalonId]; // Essayer d'abord l'ID brut
    if (rawSalonId.startsWith('salon-')) {
      possibleSalonIds.push(rawSalonId.substring(6)); // Sans préfixe
    } else {
      possibleSalonIds.push(`salon-${salonId}`); // Avec préfixe
    }
    possibleSalonIds.push(salonId); // ID normalisé

    let closedDates: any[] | null = null;
    let error: any = null;
    
    console.log('[GET /api/salons/:salonId/closed-dates] Recherche dates avec IDs possibles:', possibleSalonIds);
    
    try {
      // Essayer de trouver les dates avec chaque format d'ID
      for (const testId of possibleSalonIds) {
        const result = await supabase
          .from('salon_closed_dates')
          .select('*')
          .eq('salon_id', testId)
          .order('date', { ascending: true });
        
        if (result.data && result.data.length > 0 && !result.error) {
          closedDates = result.data;
          console.log('[GET /api/salons/:salonId/closed-dates] ✅ Dates trouvées avec ID:', testId, 'nombre:', result.data.length);
          break;
        } else if (result.error) {
          error = result.error;
          console.log('[GET /api/salons/:salonId/closed-dates] Erreur avec ID', testId, ':', result.error.message);
        }
      }
      
      // Si aucune date trouvée, initialiser à tableau vide
      if (!closedDates) {
        closedDates = [];
      }
      
      // Vérifier si l'erreur est due à l'absence de la table
      if (error && (
        error.message?.includes('Could not find the table') ||
        error.message?.includes('does not exist') ||
        error.code === '42P01' ||
        error.message?.includes('schema cache')
      )) {
        console.log('[GET /api/salons/:salonId/closed-dates] Table salon_closed_dates n\'existe pas encore, retour tableau vide');
        return res.json([]);
      }
    } catch (e: any) {
      // Si la table n'existe pas, retourner un tableau vide
      if (e.code === '42P01' || 
          e.message?.includes('does not exist') ||
          e.message?.includes('Could not find the table') ||
          e.message?.includes('schema cache')) {
        console.log('[GET /api/salons/:salonId/closed-dates] Table salon_closed_dates n\'existe pas encore (catch), retour tableau vide');
        return res.json([]);
      }
      error = e;
    }

    if (error) {
      // Si la table n'existe pas, retourner un tableau vide
      if (error.code === '42P01' || 
          error.message?.includes('does not exist') ||
          error.message?.includes('Could not find the table') ||
          error.message?.includes('schema cache')) {
        console.log('[GET /api/salons/:salonId/closed-dates] Table salon_closed_dates n\'existe pas encore, retour tableau vide');
        return res.json([]);
      }
      console.error('[GET /api/salons/:salonId/closed-dates] Erreur:', error);
      return res.status(500).json({ error: 'Impossible de charger les dates de fermeture' });
    }

    const normalizedClosedDates = (closedDates || []).map((cd: any) => normalizeClosedDateRecord(cd));
    
    // Logger les données retournées pour déboguer
    console.log('[GET /api/salons/:salonId/closed-dates] 📤 Données retournées:', 
      normalizedClosedDates.map((cd: any) => ({
        id: cd.id,
        date: cd.date,
        reason: cd.reason,
        stylist_id: cd.stylist_id,
        hasEncodedStylist: cd._hasEncodedStylist || false,
      }))
    );
    return res.json(normalizedClosedDates);
  } catch (e: any) {
    console.error('[GET /api/salons/:salonId/closed-dates] Erreur:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/salons/:salonId/closed-dates
salonsRouter.post('/:salonId/closed-dates', async (req: Request, res: Response) => {
  try {
    const rawSalonId = req.params.salonId;
    const salonId = normalizeSalonId(rawSalonId);
    const user = (req as any).user;
    const { date, reason, startTime, endTime, stylistId } = req.body;
    console.log('[POST /api/salons/:salonId/closed-dates] 📥 Données reçues:', {
      date,
      reason,
      startTime,
      endTime,
      stylistId,
      body: req.body
    });

    console.log('[POST /api/salons/:salonId/closed-dates] Requête reçue:', {
      rawSalonId,
      normalizedSalonId: salonId,
      userId: user?.id,
      date,
      reason,
      startTime,
      endTime,
      stylistId,
    });

    if (!salonId || !date) {
      console.error('[POST /api/salons/:salonId/closed-dates] Paramètres manquants:', { salonId, date });
      return res.status(400).json({ error: 'Salon ID ou date manquant' });
    }

    if (!user) {
      console.error('[POST /api/salons/:salonId/closed-dates] Utilisateur non authentifié');
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Essayer plusieurs formats d'ID pour trouver le salon
    // Tester d'abord avec l'ID brut (tel qu'il est dans la DB), puis avec l'ID normalisé
    const possibleSalonIds = [rawSalonId]; // Essayer d'abord l'ID brut
    if (rawSalonId.startsWith('salon-')) {
      possibleSalonIds.push(rawSalonId.substring(6)); // Sans préfixe
    } else {
      possibleSalonIds.push(`salon-${salonId}`); // Avec préfixe
    }
    possibleSalonIds.push(salonId); // ID normalisé

    let salon: any = null;
    console.log('[POST /api/salons/:salonId/closed-dates] Recherche salon avec IDs possibles:', possibleSalonIds);
    for (const testId of possibleSalonIds) {
      console.log('[POST /api/salons/:salonId/closed-dates] Test ID:', testId);
      const { data, error } = await supabase
        .from('salons')
        .select('id, user_id')
        .eq('id', testId)
        .maybeSingle();
      
      console.log('[POST /api/salons/:salonId/closed-dates] Résultat recherche ID', testId, ':', { data: data ? { id: data.id, user_id: data.user_id } : null, error: error?.message });
      
      if (data && !error) {
        salon = data;
        console.log('[POST /api/salons/:salonId/closed-dates] ✅ Salon trouvé avec ID:', testId, 'user_id:', salon.user_id);
        break;
      } else if (error) {
        console.log('[POST /api/salons/:salonId/closed-dates] ❌ Erreur recherche salon avec ID:', testId, error.message);
      }
    }

    if (!salon) {
      console.error('[POST /api/salons/:salonId/closed-dates] Salon introuvable avec IDs testés:', possibleSalonIds);
      return res.status(404).json({ error: 'Salon introuvable' });
    }

    if (salon.user_id !== user.id) {
      console.error('[POST /api/salons/:salonId/closed-dates] Accès refusé:', {
        salonUserId: salon.user_id,
        requestUserId: user.id,
      });
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Utiliser l'ID du salon trouvé (peut être différent de salonId normalisé)
    const finalSalonId = salon.id;
    
    // Vérifier si la date existe déjà
    // On vérifie d'abord sans stylist_id pour éviter l'erreur si la colonne n'existe pas
    const { data: existing, error: checkError } = await supabase
      .from('salon_closed_dates')
      .select('id')
      .eq('salon_id', finalSalonId)
      .eq('date', date)
      .maybeSingle();

    if (checkError && !checkError.message?.includes('does not exist') && !checkError.message?.includes('Could not find the table')) {
      console.error('[POST /api/salons/:salonId/closed-dates] Erreur vérification existence:', checkError);
    }

    if (existing) {
      console.log('[POST /api/salons/:salonId/closed-dates] Date existe déjà:', date);
      return res.status(409).json({ error: 'Cette date de fermeture existe déjà' });
    }

    let reasonToStore = reason || null;
    if (stylistId) {
      reasonToStore = encodeStylistReason(reason, stylistId);
    }

    // Préparer les données à insérer (sans stylist_id pour éviter l'erreur si la colonne n'existe pas)
    const insertData: any = {
      salon_id: finalSalonId,
      date: date,
      reason: reasonToStore,
      start_time: startTime || null,
      end_time: endTime || null,
    };
    
    // Essayer d'insérer avec stylist_id si fourni, sinon sans
    let closedDate: any = null;
    let insertError: any = null;
    
    if (stylistId) {
      console.log('[POST /api/salons/:salonId/closed-dates] 🎯 Tentative insertion avec stylist_id:', stylistId);
      // Essayer d'abord avec stylist_id
      const result = await supabase
        .from('salon_closed_dates')
        .insert({
          ...insertData,
          stylist_id: stylistId,
        })
        .select()
        .single();
      
      closedDate = result.data;
      insertError = result.error;
      console.log('[POST /api/salons/:salonId/closed-dates] 📊 Résultat insertion avec stylist_id:', {
        success: !insertError,
        data: closedDate,
        error: insertError ? {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details
        } : null
      });
      
      // Si l'erreur est due à la colonne stylist_id manquante, réessayer sans en encodant le styliste dans la raison
      if (insertError) {
        const errorMessage = String(insertError.message || '');
        const errorCode = String(insertError.code || '');
        const errorDetails = String(insertError.details || '');
        
        const isStylistIdError = 
          errorMessage.includes('stylist_id') || 
          errorMessage.includes('schema cache') ||
          errorMessage.includes('Could not find') ||
          errorMessage.includes('column') ||
          errorDetails.includes('stylist_id') ||
          errorCode === '42703' ||
          errorCode === 'PGRST204' ||
          errorCode === '42P01';
        
        if (isStylistIdError) {
          console.warn('[POST /api/salons/:salonId/closed-dates] ⚠️ Colonne stylist_id absente - fallback avec encodage dans reason');
          const fallbackReason = encodeStylistReason(reason, stylistId);
          const retryInsertData = {
            ...insertData,
            reason: fallbackReason,
          };
          delete (retryInsertData as any).stylist_id;
          
          const retryResult = await supabase
            .from('salon_closed_dates')
            .insert(retryInsertData)
            .select()
            .single();
          
          closedDate = retryResult.data;
          insertError = retryResult.error;
          
          if (!insertError) {
            console.log('[POST /api/salons/:salonId/closed-dates] ✅ Date ajoutée avec fallback encodé (colonne stylist_id absente)');
            if (closedDate) {
              closedDate.stylist_id = stylistId;
            }
          } else {
            console.error('[POST /api/salons/:salonId/closed-dates] ❌ Échec du fallback encodé:', insertError);
          }
        }
      } else {
        console.log('[POST /api/salons/:salonId/closed-dates] ✅ Date ajoutée avec stylist_id:', stylistId);
      }
    } else {
      // Pas de stylistId, insertion normale
      const result = await supabase
        .from('salon_closed_dates')
        .insert(insertData)
        .select()
        .single();
      
      closedDate = result.data;
      insertError = result.error;
    }

    if (insertError) {
      console.error('[POST /api/salons/:salonId/closed-dates] Erreur insertion:', insertError);
      
      // Si la table n'existe pas, retourner une erreur avec instructions
      if (insertError.message?.includes('does not exist') || insertError.message?.includes('Could not find the table') || insertError.code === '42P01') {
        return res.status(500).json({ 
          error: 'La table salon_closed_dates n\'existe pas. Veuillez créer la table dans Supabase.',
          instructions: [
            '1. Allez dans Supabase Dashboard → SQL Editor',
            '2. Créez la table salon_closed_dates avec les colonnes nécessaires',
            '3. Rechargez cette page'
          ]
        });
      }
      
      // Si l'erreur concerne stylist_id, donner des instructions pour ajouter la colonne
      const errorMsg = String(insertError.message || '');
      const errorDetails = String(insertError.details || '');
      if (errorMsg.includes('stylist_id') || errorDetails.includes('stylist_id')) {
        return res.status(500).json({ 
          error: 'La colonne stylist_id n\'existe pas dans la table salon_closed_dates',
          details: insertError.message,
          instructions: [
            'Pour activer la fermeture par styliste:',
            '1. Allez dans Supabase Dashboard → SQL Editor',
            '2. Exécutez le script SQL suivant:',
            '   ALTER TABLE salon_closed_dates ADD COLUMN IF NOT EXISTS stylist_id UUID REFERENCES stylistes(id) ON DELETE CASCADE;',
            '3. Rechargez cette page et réessayez'
          ],
          sqlScript: 'ALTER TABLE salon_closed_dates ADD COLUMN IF NOT EXISTS stylist_id UUID REFERENCES stylistes(id) ON DELETE CASCADE;'
        });
      }
      
      return res.status(500).json({ error: 'Impossible d\'ajouter la date de fermeture', details: insertError.message });
    }

    const normalizedClosedDate = normalizeClosedDateRecord(closedDate);
    console.log('[POST /api/salons/:salonId/closed-dates] Date ajoutée avec succès:', normalizedClosedDate);
    return res.json(normalizedClosedDate);
  } catch (e: any) {
    console.error('[POST /api/salons/:salonId/closed-dates] Erreur:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/salons/:salonId/closed-dates/:dateId
salonsRouter.delete('/:salonId/closed-dates/:dateId', async (req: Request, res: Response) => {
  try {
    const rawSalonId = req.params.salonId;
    const salonId = normalizeSalonId(rawSalonId);
    const dateId = req.params.dateId;
    const user = (req as any).user;

    console.log('[DELETE /api/salons/:salonId/closed-dates/:dateId] Requête reçue:', {
      rawSalonId,
      normalizedSalonId: salonId,
      dateId,
      userId: user?.id,
    });

    if (!salonId || !dateId) {
      return res.status(400).json({ error: 'Salon ID ou Date ID manquant' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Essayer plusieurs formats d'ID pour trouver le salon
    const possibleSalonIds = [rawSalonId]; // Essayer d'abord l'ID brut
    if (rawSalonId.startsWith('salon-')) {
      possibleSalonIds.push(rawSalonId.substring(6)); // Sans préfixe
    } else {
      possibleSalonIds.push(`salon-${salonId}`); // Avec préfixe
    }
    possibleSalonIds.push(salonId); // ID normalisé

    let salon: any = null;
    for (const testId of possibleSalonIds) {
      const { data, error } = await supabase
        .from('salons')
        .select('id, user_id')
        .eq('id', testId)
        .maybeSingle();
      
      if (data && !error) {
        salon = data;
        console.log('[DELETE /api/salons/:salonId/closed-dates/:dateId] Salon trouvé avec ID:', testId);
        break;
      }
    }

    if (!salon) {
      console.error('[DELETE /api/salons/:salonId/closed-dates/:dateId] Salon introuvable avec IDs testés:', possibleSalonIds);
      return res.status(404).json({ error: 'Salon introuvable' });
    }

    if (salon.user_id !== user.id) {
      console.error('[DELETE /api/salons/:salonId/closed-dates/:dateId] Accès refusé:', {
        salonUserId: salon.user_id,
        requestUserId: user.id,
      });
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Utiliser l'ID du salon trouvé
    const finalSalonId = salon.id;

    const { error: deleteError } = await supabase
      .from('salon_closed_dates')
      .delete()
      .eq('id', dateId)
      .eq('salon_id', finalSalonId);

    if (deleteError) {
      console.error('[DELETE /api/salons/:salonId/closed-dates/:dateId] Erreur:', deleteError);
      return res.status(500).json({ error: 'Impossible de supprimer la date de fermeture', details: deleteError.message });
    }

    console.log('[DELETE /api/salons/:salonId/closed-dates/:dateId] Date supprimée avec succès');
    return res.json({ success: true });
  } catch (e: any) {
    console.error('[DELETE /api/salons/:salonId/closed-dates/:dateId] Erreur:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/salons/:salonId/appointments (optionnel, pour compatibilité)
salonsRouter.get('/:salonId/appointments', async (req: Request, res: Response) => {
  try {
    const timestamp = new Date().toISOString();
    const rawId = req.params.salonId;
    const salonId = normalizeSalonId(rawId);
    const user = (req as any).user;

    console.log(`[GET /api/salons/:salonId/appointments] ${timestamp} - rawId:`, rawId, 'normalized:', salonId);

    if (!salonId) {
      return res.status(400).json({ error: 'Salon ID manquant' });
    }

    // Vérification d'autorisation
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[GET /api/salons/:salonId/appointments] Configuration Supabase manquante');
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Vérifier que le salon existe (essayer avec l'ID normalisé, puis avec l'ID préfixé, puis avec l'ID brut, puis par user_id)
    let salon = null;
    
    // 1. Essayer avec l'ID normalisé (sans préfixe)
    const { data: salonData } = await supabase
      .from('salons')
      .select('id, user_id')
      .eq('id', salonId)
      .maybeSingle();
    
    if (salonData) {
      salon = salonData;
      console.log(`[GET /api/salons/:salonId/appointments] ✅ Salon trouvé avec ID normalisé: ${salonId}`);
    } else {
      // 2. Essayer avec l'ID préfixé
      const prefixedId = `salon-${salonId}`;
      const { data: salonDataPrefixed } = await supabase
        .from('salons')
        .select('id, user_id')
        .eq('id', prefixedId)
        .maybeSingle();
      
      if (salonDataPrefixed) {
        salon = salonDataPrefixed;
        console.log(`[GET /api/salons/:salonId/appointments] ✅ Salon trouvé avec ID préfixé: ${prefixedId}`);
      } else {
        // 3. Essayer avec l'ID brut (si salonId était déjà préfixé dans rawId)
        const { data: salonDataRaw } = await supabase
          .from('salons')
          .select('id, user_id')
          .eq('id', rawId)
          .maybeSingle();
        
        if (salonDataRaw) {
          salon = salonDataRaw;
          console.log(`[GET /api/salons/:salonId/appointments] ✅ Salon trouvé avec ID brut: ${rawId}`);
        } else if (user?.id) {
          // 4. Si le salon n'est pas trouvé par ID, chercher par user_id (plus fiable)
          console.log(`[GET /api/salons/:salonId/appointments] 🔍 Salon non trouvé par ID, recherche par user_id: ${user.id}`);
          const { data: salonDataByUser, error: salonErrorByUser } = await supabase
            .from('salons')
            .select('id, user_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
          
          if (salonErrorByUser) {
            console.error(`[GET /api/salons/:salonId/appointments] Erreur recherche par user_id:`, salonErrorByUser);
          }
          
          if (salonDataByUser) {
            salon = salonDataByUser;
            console.log(`[GET /api/salons/:salonId/appointments] ✅ Salon trouvé par user_id: ${user.id} → salon ID: ${salon.id}`);
          } else {
            console.warn(`[GET /api/salons/:salonId/appointments] ⚠️ Aucun salon trouvé pour user_id: ${user.id}`);
          }
        }
      }
    }

    if (!salon) {
      console.error(`[GET /api/salons/:salonId/appointments] ❌ Salon introuvable avec ID normalisé: ${salonId}, préfixé: salon-${salonId}, brut: ${rawId}, ou user_id: ${user?.id || 'N/A'}`);
      return res.status(404).json({ error: 'Salon introuvable' });
    }

    // Récupérer les appointments avec filtrage par date si fourni
    const realSalonId = salon.id;
    const prefixedSalonId = realSalonId.startsWith('salon-') ? realSalonId : `salon-${realSalonId}`;
    const normalizedSalonId = realSalonId.startsWith('salon-') ? realSalonId.substring(6) : realSalonId;
    
    // Essayer avec les deux formats d'ID pour être sûr
    // Note: Spécifier explicitement les colonnes qui existent réellement dans la table
    // La table appointments a: id, salon_id, client_id, stylist_id, service_id, appointment_date, duration, status, notes, created_at, updated_at
    let query = supabase
      .from('appointments')
      .select('id, salon_id, client_id, stylist_id, service_id, appointment_date, duration, status, notes, created_at, updated_at')
      .or(`salon_id.eq.${realSalonId},salon_id.eq.${prefixedSalonId},salon_id.eq.${normalizedSalonId}`)
      .neq('status', 'cancelled');

    // Filtrer par date si fourni dans les query params
    // Note: La table utilise appointment_date, pas start_time
    const { startDate, endDate } = req.query;
    if (startDate) {
      query = query.gte('appointment_date', startDate as string);
    }
    if (endDate) {
      query = query.lte('appointment_date', endDate as string);
    }

    const { data: appointments, error: appointmentsError } = await query
      .order('appointment_date', { ascending: true });

    if (appointmentsError) {
      console.error('[GET /api/salons/:salonId/appointments] Erreur Supabase:', appointmentsError);
      return res.status(500).json({ error: 'Impossible de charger les rendez-vous' });
    }

    // Enrichir les appointments avec les informations du service et du styliste
    const enrichedAppointments = await Promise.all(
      (appointments || []).map(async (apt: any) => {
        // Récupérer le service
        const { data: service } = await supabase
          .from('services')
          .select('id, name, duration, price')
          .eq('id', apt.service_id)
          .maybeSingle();
        
        // Récupérer le styliste (utiliser select('*') pour récupérer toutes les colonnes)
        const { data: stylist } = await supabase
          .from('stylistes')
          .select('*')
          .eq('id', apt.stylist_id)
          .maybeSingle();
        
        // Calculer endTime à partir de appointment_date + duration
        const startTime = apt.appointment_date || apt.start_time;
        const duration = apt.duration || service?.duration || 30;
        
        let startTimeISO: string;
        if (startTime) {
          const startDate = new Date(startTime);
          startTimeISO = startDate.toISOString();
        } else {
          startTimeISO = '';
        }
        
        const endTime = startTimeISO ? new Date(new Date(startTimeISO).getTime() + duration * 60000).toISOString() : null;
        
        // Construire le nom complet du styliste (gérer les différents formats de colonnes)
        const stylistFullName = stylist 
          ? `${(stylist as any).first_name || (stylist as any).firstName || ''} ${(stylist as any).last_name || (stylist as any).lastName || ''}`.trim() || (stylist as any).name || null
          : null;
        
        return {
          id: apt.id,
          salonId: apt.salon_id,
          clientId: apt.client_id,
          stylistId: apt.stylist_id,
          serviceId: apt.service_id,
          startTime: startTimeISO,
          endTime: endTime,
          status: apt.status || 'pending',
          notes: apt.notes || null,
          totalAmount: service?.price ? parseFloat(service.price as any) : null,
          createdAt: apt.created_at,
          updatedAt: apt.updated_at,
          // Informations enrichies pour l'affichage
          service: service ? {
            id: service.id,
            name: service.name,
            durationMinutes: (service as any).duration || duration,
            price: service.price ? parseFloat(service.price as any) : null,
          } : null,
          stylist: stylist ? {
            id: (stylist as any).id,
            fullName: stylistFullName,
            firstName: (stylist as any).first_name || (stylist as any).firstName || '',
            lastName: (stylist as any).last_name || (stylist as any).lastName || '',
          } : null,
        };
      })
    );

    console.log(`[GET /api/salons/:salonId/appointments] ✅ Succès - ${enrichedAppointments.length} rendez-vous trouvés et enrichis`);
    return res.json(enrichedAppointments);
  } catch (e: any) {
    console.error('[GET /api/salons/:salonId/appointments] Erreur:', e);
    return res.status(500).json({ error: 'Impossible de charger les rendez-vous' });
  }
});

// GET /api/salons/:salonId/reports
salonsRouter.get('/:salonId/reports', async (req: Request, res: Response) => {
  try {
    const timestamp = new Date().toISOString();
    const rawSalonId = req.params.salonId;
    const salonId = normalizeSalonId(rawSalonId);
    const user = (req as any).user;
    const view = req.query.view as string || 'week'; // 'day', 'week', 'month'
    const dateParam = req.query.date as string; // Date ISO string

    console.log(`[GET /api/salons/:salonId/reports] ${timestamp} - Requête reçue:`, {
      rawSalonId,
      normalizedSalonId: salonId,
      userId: user?.id,
      view,
      dateParam,
    });

    if (!salonId) {
      return res.status(400).json({ error: 'Salon ID manquant' });
    }

    // Vérification d'autorisation (identique à appointments)
    if (!user) {
      console.log(`[GET /api/salons/:salonId/reports] ${timestamp} - ❌ Utilisateur non authentifié`);
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[GET /api/salons/:salonId/reports] Configuration Supabase manquante');
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Vérifier que le salon existe (même logique que appointments)
    let salon: any = null;
    
    // 1. Essayer avec l'ID normalisé (sans préfixe)
    const { data: salonData } = await supabase
      .from('salons')
      .select('id, user_id')
      .eq('id', salonId)
      .maybeSingle();
    
    if (salonData) {
      salon = salonData;
      console.log(`[GET /api/salons/:salonId/reports] ✅ Salon trouvé avec ID normalisé: ${salonId}`);
    } else {
      // 2. Essayer avec l'ID préfixé
      const prefixedId = `salon-${salonId}`;
      const { data: salonDataPrefixed } = await supabase
        .from('salons')
        .select('id, user_id')
        .eq('id', prefixedId)
        .maybeSingle();
      
      if (salonDataPrefixed) {
        salon = salonDataPrefixed;
        console.log(`[GET /api/salons/:salonId/reports] ✅ Salon trouvé avec ID préfixé: ${prefixedId}`);
      } else {
        // 3. Essayer avec l'ID brut (si salonId était déjà préfixé dans rawId)
        const { data: salonDataRaw } = await supabase
          .from('salons')
          .select('id, user_id')
          .eq('id', rawSalonId)
          .maybeSingle();
        
        if (salonDataRaw) {
          salon = salonDataRaw;
          console.log(`[GET /api/salons/:salonId/reports] ✅ Salon trouvé avec ID brut: ${rawSalonId}`);
        } else if (user?.id) {
          // 4. Si le salon n'est pas trouvé par ID, chercher par user_id (plus fiable)
          console.log(`[GET /api/salons/:salonId/reports] 🔍 Salon non trouvé par ID, recherche par user_id: ${user.id}`);
          const { data: salonDataByUser, error: salonErrorByUser } = await supabase
            .from('salons')
            .select('id, user_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
          
          if (salonErrorByUser) {
            console.error(`[GET /api/salons/:salonId/reports] Erreur recherche par user_id:`, salonErrorByUser);
          }
          
          if (salonDataByUser) {
            salon = salonDataByUser;
            console.log(`[GET /api/salons/:salonId/reports] ✅ Salon trouvé par user_id: ${user.id} → salon ID: ${salon.id}`);
          } else {
            console.warn(`[GET /api/salons/:salonId/reports] ⚠️ Aucun salon trouvé pour user_id: ${user.id}`);
          }
        }
      }
    }

    if (!salon) {
      console.error(`[GET /api/salons/:salonId/reports] ❌ Salon introuvable avec ID normalisé: ${salonId}, préfixé: salon-${salonId}, brut: ${rawSalonId}, ou user_id: ${user?.id || 'N/A'}`);
      return res.status(404).json({ error: 'Salon introuvable' });
    }

    // Vérifier que le salon appartient à l'utilisateur
    if (salon.user_id !== user.id) {
      console.warn(`[GET /api/salons/:salonId/reports] ⚠️ Accès refusé: salon.user_id (${salon.user_id}) !== user.id (${user.id})`);
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const finalSalonId = salon.id;

    // Date de référence (depuis le paramètre ou maintenant)
    // Important : dateParam est au format YYYY-MM-DD, on doit le parser correctement
    let referenceDate: Date;
    if (dateParam) {
      // Parser la date en tenant compte du fuseau horaire local
      // dateParam est "YYYY-MM-DD", on crée une date à minuit dans le fuseau local
      const [year, month, day] = dateParam.split('-').map(Number);
      referenceDate = new Date(year, month - 1, day); // month est 0-indexed
    } else {
      referenceDate = new Date();
    }
    
    console.log('[GET /api/salons/:salonId/reports] Date de référence:', {
      dateParam,
      referenceDate: referenceDate.toISOString(),
      referenceDateLocal: `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`,
      view,
    });
    
    // Calculer les dates selon la vue
    let periodStart: Date;
    let periodEnd: Date;
    let chartData: Array<{ label: string; day?: string; revenue: number; appointments: number }> = [];
    
    if (view === 'day') {
      // Vue jour : données par heure
      periodStart = new Date(referenceDate);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(referenceDate);
      periodEnd.setHours(23, 59, 59, 999);
      
      // Initialiser les données par heure (7h-20h)
      for (let hour = 7; hour <= 20; hour++) {
        chartData.push({ label: `${hour.toString().padStart(2, '0')}:00`, revenue: 0, appointments: 0 } as { label: string; day?: string; revenue: number; appointments: number });
      }
    } else if (view === 'week') {
      // Vue semaine : données par jour
      // Calculer le lundi de la semaine contenant referenceDate (ISO week)
      // Utiliser la même logique que date-fns startOfWeek avec weekStartsOn: 1
      periodStart = new Date(referenceDate);
      const dayOfWeek = periodStart.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
      // Convertir pour que lundi = 0, dimanche = 6 (ISO standard)
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      periodStart.setDate(referenceDate.getDate() - daysFromMonday);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodStart.getDate() + 6);
      periodEnd.setHours(23, 59, 59, 999);
      
      // Vérification : periodStart doit être un lundi (day = 1)
      if (periodStart.getDay() !== 1) {
        console.warn('[GET /api/salons/:salonId/reports] ⚠️ periodStart n\'est pas un lundi:', {
          day: periodStart.getDay(),
          date: periodStart.toISOString(),
        });
      }
      
      console.log('[GET /api/salons/:salonId/reports] Période semaine calculée:', {
        referenceDate: referenceDate.toISOString(),
        dayOfWeek,
        daysFromMonday,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
      
      const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(periodStart);
        dayDate.setDate(periodStart.getDate() + i);
        // Ajouter à la fois 'label' et 'day' pour compatibilité avec le client
        chartData.push({ 
          label: days[i], 
          day: days[i], // Pour la vue semaine, utiliser les noms des jours
          revenue: 0, 
          appointments: 0 
        });
      }
    } else if (view === 'month') {
      // Vue mois : données par semaine
      periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59);
      
      // Calculer les semaines du mois (commencer au lundi de la première semaine)
      let weekStart = new Date(periodStart);
      const firstDayOfWeek = weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1; // Convertir dimanche=0 à dimanche=6
      weekStart.setDate(weekStart.getDate() - firstDayOfWeek);
      
      let weekNum = 1;
      while (weekStart <= periodEnd) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        // Ne compter que les semaines qui chevauchent le mois
        if (weekEnd >= periodStart && weekStart <= periodEnd) {
          chartData.push({ label: `Semaine ${weekNum}`, revenue: 0, appointments: 0 });
          weekNum++;
        }
        weekStart.setDate(weekStart.getDate() + 7);
      }
    } else if (view === 'year') {
      // Vue année : données par mois
      periodStart = new Date(referenceDate.getFullYear(), 0, 1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(referenceDate.getFullYear(), 11, 31, 23, 59, 59, 999);

      const months = [
        'Janvier',
        'Février',
        'Mars',
        'Avril',
        'Mai',
        'Juin',
        'Juillet',
        'Août',
        'Septembre',
        'Octobre',
        'Novembre',
        'Décembre',
      ];
      for (let i = 0; i < 12; i++) {
        chartData.push({ label: months[i], revenue: 0, appointments: 0 });
      }
    } else {
      return res.status(400).json({ error: 'Vue invalide' });
    }

    // Calculer les dates pour la période sélectionnée et la période précédente pour les comparaisons
    let statsPeriodStart: Date;
    let statsPeriodEnd: Date;
    let previousPeriodStart: Date;
    let previousPeriodEnd: Date;
    
    // Utiliser periodStart et periodEnd pour les statistiques (cohérent avec les graphiques)
    statsPeriodStart = new Date(periodStart);
    statsPeriodEnd = new Date(periodEnd);
    
    // Calculer la période précédente selon la vue
    if (view === 'day') {
      // Pour la vue jour : comparer avec le jour précédent
      previousPeriodStart = new Date(periodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
      previousPeriodStart.setHours(0, 0, 0, 0);
      previousPeriodEnd = new Date(previousPeriodStart);
      previousPeriodEnd.setHours(23, 59, 59, 999);
    } else if (view === 'week') {
      // Pour la vue semaine : comparer avec la semaine précédente (ISO week)
      // Soustraire 7 jours pour obtenir le lundi de la semaine précédente
      previousPeriodStart = new Date(periodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      previousPeriodStart.setHours(0, 0, 0, 0);
      // Le dimanche de la semaine précédente = lundi + 6 jours
      previousPeriodEnd = new Date(previousPeriodStart);
      previousPeriodEnd.setDate(previousPeriodStart.getDate() + 6);
      previousPeriodEnd.setHours(23, 59, 59, 999);
      
      // Vérification : previousPeriodStart doit être un lundi
      if (previousPeriodStart.getDay() !== 1) {
        console.warn('[GET /api/salons/:salonId/reports] ⚠️ previousPeriodStart n\'est pas un lundi:', {
          day: previousPeriodStart.getDay(),
          date: previousPeriodStart.toISOString(),
        });
      }
    } else if (view === 'month') {
      // Pour la vue mois : comparer avec le mois précédent
      previousPeriodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
      previousPeriodStart.setHours(0, 0, 0, 0);
      previousPeriodEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0, 23, 59, 59);
    } else {
      // Vue année : comparer avec l'année précédente
      previousPeriodStart = new Date(referenceDate.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      previousPeriodEnd = new Date(referenceDate.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    }

    // IMPORTANT : Utiliser periodStart et periodEnd pour TOUTES les requêtes
    // pour garantir la cohérence absolue entre KPIs et graphiques
    // statsPeriodStart et statsPeriodEnd sont déjà égaux à periodStart et periodEnd
    
    // 1. Total des rendez-vous pour la période sélectionnée (même requête que pour les graphiques)
    console.log('[GET /api/salons/:salonId/reports] 📊 Calcul statistiques pour période:', {
      view,
      dateParam,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      previousPeriodStart: previousPeriodStart.toISOString(),
      previousPeriodEnd: previousPeriodEnd.toISOString(),
    });
    
    // Récupérer les services AVANT de faire les requêtes d'appointments
    const { data: services } = await supabase
      .from('services')
      .select('id, name, price')
      .eq('salon_id', finalSalonId);

    const servicePriceMap = new Map(services?.map(s => [s.id, parseFloat(s.price as any) || 0]) || []);
    const serviceNameMap = new Map(services?.map(s => [s.id, (s as any).name || 'Service inconnu']) || []);
    
    // UNE SEULE requête pour les rendez-vous de la période (utilisée pour KPIs ET graphiques)
    const { data: periodAppointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, appointment_date, service_id, stylist_id, client_id, status')
      .eq('salon_id', finalSalonId)
      .gte('appointment_date', periodStart.toISOString())
      .lte('appointment_date', periodEnd.toISOString())
      .in('status', ['scheduled', 'confirmed', 'completed']);

    if (appointmentsError) {
      console.error('[GET /api/salons/:salonId/reports] ❌ Erreur appointments:', appointmentsError);
    }
    
    // Utiliser periodAppointments pour les KPIs (même source que les graphiques)
    const currentPeriodAppointments = periodAppointments;
    
    console.log('[GET /api/salons/:salonId/reports] ✅ Rendez-vous période sélectionnée:', {
      count: currentPeriodAppointments?.length || 0,
      sample: currentPeriodAppointments?.slice(0, 3).map(apt => ({
        id: apt.id,
        date: apt.appointment_date,
        service_id: apt.service_id,
      })),
    });

    // 2. Rendez-vous de la période précédente (pour comparaison)
    const { data: previousPeriodAppointments } = await supabase
      .from('appointments')
      .select('id')
      .eq('salon_id', finalSalonId)
      .gte('appointment_date', previousPeriodStart.toISOString())
      .lte('appointment_date', previousPeriodEnd.toISOString())
      .in('status', ['scheduled', 'confirmed', 'completed']);

    // Log pour debug
    console.log('[GET /api/salons/:salonId/reports] Services récupérés:', services?.length || 0);
    if (services && services.length > 0) {
      console.log('[GET /api/salons/:salonId/reports] Exemple service:', {
        id: services[0].id,
        name: (services[0] as any).name,
        price: services[0].price
      });
    }

    // 3. Chiffre d'affaires pour la période sélectionnée
    // IMPORTANT : Utiliser exactement les mêmes rendez-vous que pour les graphiques
    // pour garantir la cohérence absolue entre KPIs et graphiques
    let periodRevenue = 0;
    currentPeriodAppointments?.forEach(apt => {
      const price = servicePriceMap.get(apt.service_id) || 0;
      periodRevenue += price;
    });
    
    console.log('[GET /api/salons/:salonId/reports] 💰 Revenu calculé:', {
      appointmentsCount: currentPeriodAppointments?.length || 0,
      periodRevenue,
      samplePrices: currentPeriodAppointments?.slice(0, 3).map(apt => ({
        service_id: apt.service_id,
        price: servicePriceMap.get(apt.service_id) || 0,
      })),
    });

    // 4. Chiffre d'affaires de la période précédente
    const { data: previousPeriodAppointmentsWithServices } = await supabase
      .from('appointments')
      .select('service_id')
      .eq('salon_id', finalSalonId)
      .gte('appointment_date', previousPeriodStart.toISOString())
      .lte('appointment_date', previousPeriodEnd.toISOString())
      .in('status', ['scheduled', 'confirmed', 'completed']);

    let previousPeriodRevenue = 0;
    previousPeriodAppointmentsWithServices?.forEach(apt => {
      const price = servicePriceMap.get(apt.service_id) || 0;
      previousPeriodRevenue += price;
    });

    // 5. Nouveaux clients pour la période sélectionnée
    const { data: newClients, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('salon_id', finalSalonId)
      .gte('created_at', statsPeriodStart.toISOString())
      .lte('created_at', statsPeriodEnd.toISOString());

    // 6. Nouveaux clients de la période précédente
    const { data: previousPeriodNewClients } = await supabase
      .from('clients')
      .select('id')
      .eq('salon_id', finalSalonId)
      .gte('created_at', previousPeriodStart.toISOString())
      .lte('created_at', previousPeriodEnd.toISOString());

    // 7. Taux de fidélisation (clients avec au moins 2 rendez-vous)
    const { data: allClients } = await supabase
      .from('clients')
      .select('id')
      .eq('salon_id', finalSalonId);

    const { data: allAppointments } = await supabase
      .from('appointments')
      .select('client_id')
      .eq('salon_id', finalSalonId)
      .in('status', ['scheduled', 'confirmed', 'completed']);

    const clientAppointmentCount = new Map<string, number>();
    allAppointments?.forEach(apt => {
      const count = clientAppointmentCount.get(apt.client_id) || 0;
      clientAppointmentCount.set(apt.client_id, count + 1);
    });

    const loyalClients = Array.from(clientAppointmentCount.values()).filter(count => count >= 2).length;
    const retentionRate = allClients && allClients.length > 0 
      ? (loyalClients / allClients.length) * 100 
      : 0;

    // 8. Données pour les graphiques selon la vue
    // IMPORTANT : Utiliser periodAppointments déjà récupéré ci-dessus (même source que les KPIs)
    console.log('[GET /api/salons/:salonId/reports] 📊 Préparation données graphiques:', {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      view,
      appointmentsCount: periodAppointments?.length || 0,
    });

    periodAppointments?.forEach(apt => {
      const date = new Date(apt.appointment_date);
      const price = servicePriceMap.get(apt.service_id) || 0;
      
      if (view === 'day') {
        // Grouper par heure - s'assurer que la date est dans le bon fuseau horaire
        const hour = date.getHours();
        const index = hour - 7; // Commence à 7h
        if (index >= 0 && index < chartData.length) {
          chartData[index].revenue += price;
          chartData[index].appointments += 1;
        } else {
          console.log('[GET /api/salons/:salonId/reports] Heure hors limites:', { hour, index, chartDataLength: chartData.length, appointmentDate: apt.appointment_date });
        }
      } else if (view === 'week') {
        // Grouper par jour de la semaine
        const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1; // Convertir dimanche=0 à dimanche=6
        if (dayOfWeek >= 0 && dayOfWeek < chartData.length) {
          chartData[dayOfWeek].revenue += price;
          chartData[dayOfWeek].appointments += 1;
        }
      } else if (view === 'month') {
        // Vue mois : grouper par semaine
        const weekStart = new Date(periodStart);
        const daysDiff = Math.floor((date.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
        const weekIndex = Math.floor(daysDiff / 7);
        if (weekIndex >= 0 && weekIndex < chartData.length) {
          chartData[weekIndex].revenue += price;
          chartData[weekIndex].appointments += 1;
        }
      } else if (view === 'year') {
        const monthIndex = date.getMonth();
        if (monthIndex >= 0 && monthIndex < chartData.length) {
          chartData[monthIndex].revenue += price;
          chartData[monthIndex].appointments += 1;
        }
      }
    });

    // Pour compatibilité avec l'ancien format (vue semaine uniquement)
    const weeklyData = view === 'week' ? chartData.map(d => ({ day: d.label, revenue: d.revenue, appointments: d.appointments })) : undefined;
    
    // Vérification de cohérence : le revenu total des graphiques doit égaler periodRevenue
    const chartTotalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const chartTotalAppointments = chartData.reduce((sum, d) => sum + d.appointments, 0);
    
    console.log('[GET /api/salons/:salonId/reports] ✅ Vérification cohérence KPIs/Graphiques:', {
      kpiRevenue: periodRevenue,
      chartTotalRevenue,
      revenueMatch: Math.abs(periodRevenue - chartTotalRevenue) < 0.01,
      kpiAppointments: currentPeriodAppointments?.length || 0,
      chartTotalAppointments,
      appointmentsMatch: (currentPeriodAppointments?.length || 0) === chartTotalAppointments,
    });
    
    if (Math.abs(periodRevenue - chartTotalRevenue) > 0.01) {
      console.error('[GET /api/salons/:salonId/reports] ❌ INCOHÉRENCE DÉTECTÉE: Revenu KPI ≠ Revenu Graphiques', {
        kpiRevenue: periodRevenue,
        chartTotalRevenue,
        difference: periodRevenue - chartTotalRevenue,
      });
    }

    // 9. Top stylistes
    // D'abord, récupérer TOUS les stylistes du salon (actifs et inactifs)
    // Récupérer tous les champs possibles (name, first_name, last_name) pour compatibilité
    const { data: allStylists, error: allStylistsError } = await supabase
      .from('stylistes')
      .select('*')
      .eq('salon_id', finalSalonId);
    
    console.log('[GET /api/salons/:salonId/reports] 🔍 Tous les stylistes du salon:', {
      finalSalonId,
      count: allStylists?.length || 0,
      allStylists: allStylists?.map(st => {
        const name = (st as any).name || `${(st as any).first_name || ''} ${(st as any).last_name || ''}`.trim() || 'Sans nom';
        return { id: st.id, name, is_active: (st as any).is_active };
      }) || [],
      error: allStylistsError,
    });
    
    // Récupérer les IDs uniques des stylistes dans les rendez-vous de la période
    const uniqueStylistIdsInAppointments = [...new Set(
      currentPeriodAppointments
        ?.filter(apt => apt.stylist_id)
        .map(apt => apt.stylist_id) || []
    )];
    
    console.log('[GET /api/salons/:salonId/reports] 🔍 Stylistes dans les rendez-vous:', {
      uniqueStylistIdsInAppointments,
      count: uniqueStylistIdsInAppointments.length,
    });
    
    // Récupérer les informations complètes des stylistes depuis les rendez-vous
    // Faire une requête pour récupérer les stylistes par leurs IDs
    let stylistsFromAppointments: Array<{ id: string; name: string; first_name?: string; last_name?: string }> = [];
    
    if (uniqueStylistIdsInAppointments.length > 0) {
      // Essayer de récupérer les stylistes un par un si la requête .in() ne fonctionne pas
      // Récupérer tous les champs pour avoir name, first_name, last_name
      const fetchedStylistsPromises = uniqueStylistIdsInAppointments.map(async (stylistId) => {
        const { data: stylist, error } = await supabase
          .from('stylistes')
          .select('*')
          .eq('id', stylistId)
          .maybeSingle();
        
        if (error) {
          console.error(`[GET /api/salons/:salonId/reports] ❌ Erreur récupération styliste ${stylistId}:`, error);
          return null;
        }
        
        return stylist;
      });
      
      const fetchedStylistsResults = await Promise.all(fetchedStylistsPromises);
      const fetchedStylists = fetchedStylistsResults.filter(st => st !== null) as any[];
      
      console.log('[GET /api/salons/:salonId/reports] ✅ Stylistes récupérés par IDs:', {
        count: fetchedStylists.length,
        stylists: fetchedStylists.map(st => {
          const rawName = (st as any).name;
          const firstName = (st as any).first_name;
          const lastName = (st as any).last_name;
          const constructedName = rawName || `${firstName || ''} ${lastName || ''}`.trim();
          return {
            id: st.id,
            rawName,
            firstName,
            lastName,
            constructedName,
            allFields: Object.keys(st),
          };
        }),
      });
      
      stylistsFromAppointments = fetchedStylists.map(st => {
        // Construire le nom : priorité à name, sinon first_name + last_name
        let name = (st as any).name;
        if (!name || name.trim() === '') {
          const firstName = (st as any).first_name || '';
          const lastName = (st as any).last_name || '';
          name = `${firstName} ${lastName}`.trim();
        }
        if (!name || name.trim() === '') {
          name = 'Styliste inconnu';
        }
        
        return {
          id: st.id,
          name,
          first_name: (st as any).first_name,
          last_name: (st as any).last_name,
        };
      });
    }
    
    // Créer une map des stylistes existants par ID (depuis la requête principale et depuis les rendez-vous)
    const existingStylistsMap = new Map<string, { id: string; name: string }>();
    
    // Ajouter les stylistes de la requête principale
    allStylists?.forEach(st => {
      let name = (st as any).name;
      if (!name || name.trim() === '') {
        const firstName = (st as any).first_name || '';
        const lastName = (st as any).last_name || '';
        name = `${firstName} ${lastName}`.trim();
      }
      if (!name || name.trim() === '') {
        name = 'Styliste inconnu';
      }
      
      existingStylistsMap.set(st.id, { id: st.id, name });
      // Aussi stocker avec l'ID normalisé (sans préfixe "stylist-")
      const normalizedId = st.id.startsWith('stylist-') ? st.id.substring(8) : st.id;
      if (normalizedId !== st.id) {
        existingStylistsMap.set(normalizedId, { id: st.id, name });
      }
    });
    
    // Ajouter les stylistes récupérés depuis les rendez-vous (priorité car plus récents)
    stylistsFromAppointments.forEach(st => {
      existingStylistsMap.set(st.id, { id: st.id, name: st.name });
      const normalizedId = st.id.startsWith('stylist-') ? st.id.substring(8) : st.id;
      if (normalizedId !== st.id) {
        existingStylistsMap.set(normalizedId, { id: st.id, name: st.name });
      }
    });
    
    // Pour les stylistes qui sont dans les rendez-vous mais pas dans la table stylistes,
    // créer des entrées temporaires pour les statistiques
    const stylistsToUse: Array<{ id: string; name: string }> = [];
    
    // Ajouter les stylistes existants (depuis la requête principale)
    allStylists?.forEach(st => {
      let name = (st as any).name;
      if (!name || name.trim() === '') {
        const firstName = (st as any).first_name || '';
        const lastName = (st as any).last_name || '';
        name = `${firstName} ${lastName}`.trim();
      }
      if (!name || name.trim() === '') {
        name = 'Styliste inconnu';
      }
      stylistsToUse.push({ id: st.id, name });
    });
    
    // Ajouter les stylistes récupérés depuis les rendez-vous (s'ils ne sont pas déjà dans la liste)
    stylistsFromAppointments.forEach(st => {
      if (!stylistsToUse.find(s => s.id === st.id)) {
        stylistsToUse.push({ id: st.id, name: st.name });
      }
    });
    
    // Ajouter les stylistes manquants (présents dans les rendez-vous mais pas dans la table)
    uniqueStylistIdsInAppointments.forEach(stylistId => {
      if (!existingStylistsMap.has(stylistId)) {
        // Normaliser l'ID pour vérifier aussi
        const normalizedId = stylistId.startsWith('stylist-') ? stylistId.substring(8) : stylistId;
        if (!existingStylistsMap.has(normalizedId)) {
          // Créer une entrée temporaire
          stylistsToUse.push({ 
            id: stylistId, 
            name: `Styliste ${stylistId.substring(0, 8)}...` // Nom générique
          });
          console.log('[GET /api/salons/:salonId/reports] ⚠️ Styliste manquant créé temporairement:', stylistId);
        }
      }
    });
    
    console.log('[GET /api/salons/:salonId/reports] ✅ Stylistes à utiliser:', {
      count: stylistsToUse.length,
      stylists: stylistsToUse.map(st => ({ id: st.id, name: st.name })),
      detailedStylists: stylistsToUse,
    });

    // Normaliser les IDs des stylistes (enlever le préfixe "stylist-" si présent)
    const normalizeStylistId = (id: string | null | undefined): string | null => {
      if (!id) return null;
      return id.startsWith('stylist-') ? id.substring(8) : id;
    };
    
    // Créer une map pour convertir n'importe quel format d'ID vers l'ID normalisé
    const stylistIdMap = new Map<string, string>(); // originalId -> normalizedId
    stylistsToUse.forEach(st => {
      const normalizedId = normalizeStylistId(st.id);
      if (normalizedId) {
        stylistIdMap.set(st.id, normalizedId);
        stylistIdMap.set(normalizedId, normalizedId); // Pour les cas où l'ID est déjà normalisé
      }
    });
    
    // Créer une map des noms par ID (pour récupérer les vrais noms)
    const stylistNameMap = new Map<string, string>();
    stylistsToUse.forEach(st => {
      stylistNameMap.set(st.id, st.name);
      const normalizedId = normalizeStylistId(st.id);
      if (normalizedId && normalizedId !== st.id) {
        stylistNameMap.set(normalizedId, st.name);
      }
    });
    
    const stylistStats = new Map<string, { appointments: number; revenue: number; name: string }>();
    stylistsToUse.forEach(st => {
      // Stocker uniquement avec l'ID normalisé pour éviter les doublons
      const normalizedId = normalizeStylistId(st.id);
      if (normalizedId) {
        const name = stylistNameMap.get(st.id) || st.name || 'Styliste inconnu';
        stylistStats.set(normalizedId, { appointments: 0, revenue: 0, name });
        // Aussi stocker avec l'ID original au cas où
        stylistStats.set(st.id, { appointments: 0, revenue: 0, name });
      }
    });

    // Debug : vérifier les stylist_id dans les rendez-vous
    const appointmentsWithStylist = currentPeriodAppointments?.filter(apt => apt.stylist_id) || [];
    const appointmentsWithoutStylist = currentPeriodAppointments?.filter(apt => !apt.stylist_id) || [];
    const uniqueStylistIds = [...new Set(appointmentsWithStylist.map(apt => apt.stylist_id))];
    
    console.log('[GET /api/salons/:salonId/reports] 🔍 Analyse rendez-vous pour top stylistes:', {
      totalAppointments: currentPeriodAppointments?.length || 0,
      withStylistId: appointmentsWithStylist.length,
      withoutStylistId: appointmentsWithoutStylist.length,
      uniqueStylistIdsInAppointments: uniqueStylistIds,
      stylistIdsInMap: Array.from(stylistStats.keys()),
    });

    // Utiliser les rendez-vous de la période sélectionnée pour les top stylistes
    // IMPORTANT : Utiliser currentPeriodAppointments qui est basé sur periodStart/periodEnd
    let matchedCount = 0;
    let unmatchedCount = 0;
    currentPeriodAppointments?.forEach(apt => {
      if (!apt.stylist_id) {
        unmatchedCount++;
        return;
      }
      
      // Normaliser l'ID du styliste du rendez-vous
      const normalizedStylistId = normalizeStylistId(apt.stylist_id);
      
      if (!normalizedStylistId) {
        unmatchedCount++;
        return;
      }
      
      // Essayer d'abord avec l'ID normalisé, puis avec l'ID original
      let stats = stylistStats.get(normalizedStylistId);
      let keyToUse = normalizedStylistId;
      
      if (!stats) {
        // Essayer avec l'ID original (non normalisé)
        stats = stylistStats.get(apt.stylist_id);
        if (stats) {
          keyToUse = apt.stylist_id;
        }
      }
      
      if (stats) {
        // Mettre à jour les statistiques
        stats.appointments += 1;
        stats.revenue += servicePriceMap.get(apt.service_id) || 0;
        matchedCount++;
      } else {
        // Si le styliste n'est pas trouvé, essayer de le récupérer depuis la map des noms
        const stylistName = stylistNameMap.get(apt.stylist_id) || stylistNameMap.get(normalizedStylistId);
        if (stylistName) {
          // Créer une nouvelle entrée avec le nom trouvé
          const newKey = normalizedStylistId || apt.stylist_id;
          stylistStats.set(newKey, { appointments: 1, revenue: servicePriceMap.get(apt.service_id) || 0, name: stylistName });
          matchedCount++;
        } else {
          unmatchedCount++;
          console.log('[GET /api/salons/:salonId/reports] ⚠️ Stylist ID non trouvé dans la map:', {
            appointmentId: apt.id,
            stylistId: apt.stylist_id,
            normalizedStylistId,
            availableStylistIds: Array.from(stylistStats.keys()).slice(0, 10), // Limiter pour les logs
            availableNames: Array.from(stylistNameMap.keys()).slice(0, 10),
          });
        }
      }
    });
    
    console.log('[GET /api/salons/:salonId/reports] 📊 Correspondances stylistes:', {
      matched: matchedCount,
      unmatched: unmatchedCount,
      stylistStatsAfterProcessing: Array.from(stylistStats.entries()).map(([id, stats]) => ({
        id,
        name: stats.name,
        appointments: stats.appointments,
        revenue: stats.revenue,
      })),
    });

    const topStylists = Array.from(stylistStats.entries())
      .map(([id, stats]) => {
        // S'assurer que le nom est correct (utiliser la map des noms si disponible)
        // Essayer avec l'ID tel quel, puis avec l'ID normalisé, puis avec l'ID original
        let finalName = stats.name;
        if (!finalName || finalName.trim() === '' || finalName.startsWith('Styliste stylist-')) {
          // Essayer de trouver le nom dans la map
          finalName = stylistNameMap.get(id) || 
                     stylistNameMap.get(normalizeStylistId(id)) ||
                     // Chercher dans tous les stylistes pour trouver l'ID correspondant
                     stylistsToUse.find(st => st.id === id || normalizeStylistId(st.id) === id)?.name ||
                     'Styliste inconnu';
        }
        
        // Si le nom est toujours générique, essayer de le récupérer depuis les stylistes récupérés
        if (finalName.startsWith('Styliste stylist-') || finalName === 'Styliste inconnu') {
          const foundStylist = stylistsFromAppointments.find(st => 
            st.id === id || normalizeStylistId(st.id) === id
          );
          if (foundStylist) {
            finalName = foundStylist.name;
          }
        }
        
        return {
          id,
          name: finalName,
          appointments: stats.appointments,
          revenue: stats.revenue,
          position: 0, // Sera calculé après tri
        };
      })
      .filter(st => st.appointments > 0) // Ne garder que les stylistes avec des rendez-vous dans la période
      .sort((a, b) => b.appointments - a.appointments)
      .slice(0, 5)
      .map((st, index) => ({ ...st, position: index + 1 }));
    
    console.log('[GET /api/salons/:salonId/reports] 👥 Top stylistes calculés:', {
      view,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalStylists: stylistsToUse.length,
      stylistsWithAppointments: topStylists.length,
      topStylists: topStylists.map(st => ({
        id: st.id,
        name: st.name,
        appointments: st.appointments,
        revenue: st.revenue,
      })),
      stylistNameMapSize: stylistNameMap.size,
      stylistNameMapSample: Array.from(stylistNameMap.entries()).slice(0, 3),
    });

    // 10. Services populaires
    const serviceStats = new Map<string, { bookings: number; revenue: number; name: string }>();
    
    // Initialiser avec tous les services qui ont des rendez-vous dans la période sélectionnée
    currentPeriodAppointments?.forEach(apt => {
      if (!serviceStats.has(apt.service_id)) {
        // Récupérer le nom depuis la map ou directement depuis les services
        let serviceName = serviceNameMap.get(apt.service_id);
        if (!serviceName || serviceName === 'Service inconnu') {
          // Si pas trouvé dans la map, chercher directement dans le tableau services
          const service = services?.find(s => s.id === apt.service_id);
          if (service) {
            serviceName = (service as any)?.name || (service as any)?.name || 'Service inconnu';
            // Mettre à jour la map pour les prochaines fois
            if (serviceName && serviceName !== 'Service inconnu') {
              serviceNameMap.set(apt.service_id, serviceName);
            }
          }
        }
        if (!serviceName || serviceName === 'Service inconnu') {
          serviceName = 'Service inconnu';
        }
        serviceStats.set(apt.service_id, { bookings: 0, revenue: 0, name: serviceName });
      }
      const stats = serviceStats.get(apt.service_id);
      if (stats) {
        stats.bookings += 1;
        stats.revenue += servicePriceMap.get(apt.service_id) || 0;
      }
    });

    const popularServices = Array.from(serviceStats.values())
      .filter(s => s.bookings > 0 && s.name !== 'Service inconnu') // Ne garder que les services avec des rendez-vous et un nom valide
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5); // Limiter à 5 services maximum
    
    console.log('[GET /api/salons/:salonId/reports] Services populaires calculés:', popularServices.map(s => ({ name: s.name, bookings: s.bookings })));

    // Calcul des tendances
    const totalAppointments = currentPeriodAppointments?.length || 0;
    const previousPeriodTotal = previousPeriodAppointments?.length || 0;
    const appointmentsTrend = previousPeriodTotal > 0 
      ? ((totalAppointments - previousPeriodTotal) / previousPeriodTotal) * 100 
      : (totalAppointments > 0 ? 100 : 0); // Si pas de période précédente mais des données actuelles, +100%

    const revenueTrend = previousPeriodRevenue > 0 
      ? ((periodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100 
      : (periodRevenue > 0 ? 100 : 0);

    const newClientsCount = newClients?.length || 0;
    const previousPeriodNewClientsCount = previousPeriodNewClients?.length || 0;
    const newClientsTrend = previousPeriodNewClientsCount > 0 
      ? ((newClientsCount - previousPeriodNewClientsCount) / previousPeriodNewClientsCount) * 100 
      : (newClientsCount > 0 ? 100 : 0);

    // Taux de fidélisation : pas de tendance par période (calculé sur tous les clients)
    const retentionTrend = 0;
    
    console.log('[GET /api/salons/:salonId/reports] 📈 Tendances calculées:', {
      totalAppointments,
      previousPeriodTotal,
      appointmentsTrend: Math.round(appointmentsTrend * 10) / 10,
      periodRevenue,
      previousPeriodRevenue,
      revenueTrend: Math.round(revenueTrend * 10) / 10,
      newClientsCount,
      previousPeriodNewClientsCount,
      newClientsTrend: Math.round(newClientsTrend * 10) / 10,
    });

    const reportData = {
      totalAppointments,
      monthlyRevenue: periodRevenue, // Utiliser periodRevenue au lieu de monthlyRevenue
      newClients: newClientsCount,
      retentionRate: Math.round(retentionRate * 10) / 10,
      weeklyData, // Pour compatibilité (vue semaine uniquement, avec clé "day")
      chartData, // Données pour les graphiques selon la vue (avec clé "label")
      view, // Vue actuelle
      topStylists,
      popularServices,
      trends: {
        appointments: Math.round(appointmentsTrend * 10) / 10,
        revenue: Math.round(revenueTrend * 10) / 10,
        newClients: Math.round(newClientsTrend * 10) / 10,
        retention: retentionTrend,
      },
      recentFeedback: [], // À implémenter si vous avez une table de feedback
    };
    
    console.log('[GET /api/salons/:salonId/reports] ✅ Données finales retournées:', {
      view,
      dateParam,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalAppointments,
      periodRevenue,
      newClients: newClientsCount,
      retentionRate: Math.round(retentionRate * 10) / 10,
      appointmentsTrend: Math.round(appointmentsTrend * 10) / 10,
      revenueTrend: Math.round(revenueTrend * 10) / 10,
      newClientsTrend: Math.round(newClientsTrend * 10) / 10,
      chartDataLength: chartData.length,
      chartDataSample: chartData.slice(0, 3),
    });

    return res.json(reportData);
  } catch (e: any) {
    console.error('[GET /api/salons/:salonId/reports] Erreur:', e);
    return res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
});

salonsRouter.get('/check-stylist-schedule-table', async (req: Request, res: Response) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Essayer de faire une requête simple sur la table
    const { data, error } = await supabase
      .from('stylist_schedule')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
        // Table n'existe pas
        const sqlScript = `-- Script SQL complet pour créer la table stylist_schedule
-- Copiez-collez ce script dans Supabase SQL Editor et exécutez-le

CREATE TABLE IF NOT EXISTS public.stylist_schedule (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  stylist_id VARCHAR NOT NULL REFERENCES public.stylistes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(stylist_id, day_of_week)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_stylist_schedule_stylist_id ON public.stylist_schedule(stylist_id);
CREATE INDEX IF NOT EXISTS idx_stylist_schedule_day_of_week ON public.stylist_schedule(day_of_week);

-- Enable Row Level Security (RLS)
ALTER TABLE public.stylist_schedule ENABLE ROW LEVEL SECURITY;

-- Policies pour stylist_schedule
-- Note: Utilisation de ::text pour éviter les erreurs de type entre text et uuid
DROP POLICY IF EXISTS "Allow owners to view stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to view stylist schedule" ON public.stylist_schedule FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id::text = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow owners to insert stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to insert stylist schedule" ON public.stylist_schedule FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id::text = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow owners to update stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to update stylist schedule" ON public.stylist_schedule FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id::text = auth.uid()::text)
);

DROP POLICY IF EXISTS "Allow owners to delete stylist schedule" ON public.stylist_schedule;
CREATE POLICY "Allow owners to delete stylist schedule" ON public.stylist_schedule FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.stylistes 
    JOIN public.salons ON stylistes.salon_id = salons.id 
    WHERE stylistes.id = stylist_schedule.stylist_id 
    AND salons.user_id::text = auth.uid()::text)
);`;

        return res.status(404).json({
          exists: false,
          message: 'La table stylist_schedule n\'existe pas',
          instructions: [
            '1. Allez dans Supabase Dashboard → SQL Editor',
            '2. Ouvrez le fichier: supabase_create_stylist_schedule.sql',
            '3. Copiez-collez tout le contenu dans l\'éditeur SQL',
            '4. Cliquez sur "Run" pour exécuter le script',
            '5. Rechargez cette page'
          ],
          sqlFile: 'supabase_create_stylist_schedule.sql',
          sql: sqlScript
        });
      }
      return res.status(500).json({ error: 'Erreur lors de la vérification', details: error.message });
    }

    // Table existe
    return res.json({
      exists: true,
      message: 'La table stylist_schedule existe et est accessible'
    });
  } catch (e: any) {
    console.error('[GET /api/salons/check-stylist-schedule-table] Erreur:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default salonsRouter;
