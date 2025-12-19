/**
 * Router public isolé - 100% DB-free
 * N'importe AUCUN module qui touche la DB, session store, ou pg
 * Utilise uniquement Supabase REST (createClient)
 */

import express from "express";
import { createClient } from '@supabase/supabase-js';
// IMPORTANT: En ESM, les imports relatifs TypeScript doivent inclure l'extension .js
import { getValidIntervalsForDay, isSlotValid, TimeSlot } from '../utils/bookingValidation.js';

const publicRouter = express.Router();

const DEFAULT_SLOT_STEP_MINUTES = 15;

const normalizeStylistIdValue = (stylistId?: string | null) => {
  if (!stylistId) {
    return null;
  }
  return stylistId.replace(/^stylist-/, "").toLowerCase();
};

const getStylistIdVariants = (stylistId?: string | null): string[] => {
  const variants = new Set<string>();
  if (stylistId) {
    variants.add(stylistId);
    if (stylistId.startsWith("stylist-")) {
      variants.add(stylistId.substring(8));
    } else {
      variants.add(`stylist-${stylistId}`);
    }
  }
  const normalized = normalizeStylistIdValue(stylistId);
  if (normalized) {
    variants.add(normalized);
    variants.add(`stylist-${normalized}`);
  }
  return Array.from(variants).filter(Boolean);
};

const getSalonIdVariants = (salonId?: string | null): string[] => {
  if (!salonId || typeof salonId !== 'string') {
    return [];
  }
  const trimmed = salonId.trim();
  if (!trimmed) {
    return [];
  }
  const variants = new Set<string>();
  variants.add(trimmed);
  if (trimmed.startsWith("salon-")) {
    variants.add(trimmed.substring(6));
  } else {
    variants.add(`salon-${trimmed}`);
  }
  return Array.from(variants);
};

const parseLocalDate = (dateStr: string) => {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const buildDateTime = (baseDate: Date, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

const addMinutes = (date: Date, minutes: number) => {
  return new Date(date.getTime() + minutes * 60000);
};

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const generateSlotsFromIntervals = (
  baseDate: Date,
  intervals: TimeSlot[],
  durationMinutes: number,
  stepMinutes: number
) => {
  const slots: { label: string; start: Date; end: Date }[] = [];

  intervals.forEach((interval) => {
    const startMinutes = timeToMinutes(interval.start);
    const endMinutes = timeToMinutes(interval.end);

    for (
      let current = startMinutes;
      current + durationMinutes <= endMinutes;
      current += stepMinutes
    ) {
      const labelHours = Math.floor(current / 60);
      const labelMinutes = current % 60;
      const label = `${String(labelHours).padStart(2, "0")}:${String(labelMinutes).padStart(2, "0")}`;

      const start = buildDateTime(baseDate, interval.start);
      const slotStart = addMinutes(start, current - startMinutes);
      const slotEnd = addMinutes(slotStart, durationMinutes);

      slots.push({ label, start: slotStart, end: slotEnd });
    }
  });

  return slots;
};

const hasAppointmentConflict = (appointments: any[], start: Date, end: Date) => {
  if (!appointments || appointments.length === 0) {
    return false;
  }

  return appointments.some((apt) => {
    if (!apt) {
      return false;
    }
    const appointmentStart = new Date(apt.appointment_date || apt.startTime);
    if (Number.isNaN(appointmentStart.getTime())) {
      return false;
    }
    const durationMinutes = apt.duration ? Number(apt.duration) : 30;
    const appointmentEnd = new Date(appointmentStart.getTime() + durationMinutes * 60000);
    return start < appointmentEnd && end > appointmentStart;
  });
};

// Route publique pour récupérer les informations du salon unique (horaires + contact)
publicRouter.get("/salon", async (req, res) => {
  console.log('[PUBLIC] hit GET /api/public/salon');
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[PUBLIC] Configuration Supabase manquante');
      return res.status(500).json({ 
        error: "Configuration Supabase manquante",
        message: "Les variables d'environnement SUPABASE_URL et SUPABASE_ANON_KEY sont requises"
      });
    }

    // Utiliser uniquement Supabase REST (pas de DB directe)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });
    
    const { data: salons, error: salonError } = await supabase
      .from('salons')
      .select('id, name, address, phone, email, theme_color')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (salonError) {
      console.error('[PUBLIC] Erreur Supabase:', salonError);
      return res.status(500).json({ error: "Impossible de charger les informations du salon" });
    }
    
    if (!salons || salons.length === 0) {
      return res.json({ 
        salon: null, 
        hours: [],
        message: "Aucun salon configuré" 
      });
    }
    
    const salon = salons[0];
    const salonId = salon.id;
    
    // Récupérer les horaires
    const { data: hours, error: hoursError } = await supabase
      .from('salon_hours')
      .select('*')
      .eq('salon_id', salonId);
    
    if (hoursError) {
      console.error('[PUBLIC] Erreur récupération horaires:', hoursError);
    }
    
    return res.json({
      salon: {
        id: salon.id,
        name: salon.name,
        address: salon.address,
        phone: salon.phone,
        email: salon.email,
        theme_color: salon.theme_color,
      },
      hours: hours || [],
    });
  } catch (error: any) {
    console.error('[PUBLIC] Erreur inattendue:', error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route publique pour récupérer les stylistes
publicRouter.get("/salon/stylistes", async (req, res) => {
  console.log('[PUBLIC] hit GET /api/public/salon/stylistes');
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: "Configuration Supabase manquante" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });
    
    // Récupérer le salon unique
    const { data: salons } = await supabase
      .from('salons')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!salons) {
      return res.json([]); // Retourner un tableau vide, pas un objet
    }
    
    let salonId = salons.id;
    console.log('[PUBLIC] Salon ID récupéré:', salonId);
    
    // Essayer avec les deux formats d'ID (avec et sans préfixe salon-)
    const salonIdsToTry = salonId.startsWith('salon-') 
      ? [salonId, salonId.replace('salon-', '')]
      : [salonId, `salon-${salonId}`];
    
    console.log('[PUBLIC] IDs à essayer:', salonIdsToTry);
    
    let stylistes: any[] | null = null;
    let stylistesError: any = null;
    
    // Essayer chaque format d'ID jusqu'à trouver des résultats
    for (const trySalonId of salonIdsToTry) {
      console.log('[PUBLIC] Essai avec salon_id:', trySalonId);
      
      // D'abord essayer sans filtre is_active pour voir tous les stylistes
      let result = await supabase
        .from('stylistes')
        .select('id, first_name, last_name, email, phone, photo_url, specialties, is_active')
        .eq('salon_id', trySalonId);
      
      if (result.error) {
        console.error('[PUBLIC] Erreur avec salon_id', trySalonId, ':', result.error);
        stylistesError = result.error;
        continue;
      }
      
      if (result.data && result.data.length > 0) {
        console.log('[PUBLIC] ✅ Stylistes trouvés avec salon_id:', trySalonId, '→', result.data.length);
        stylistes = result.data;
        stylistesError = null;
        break;
      } else {
        console.log('[PUBLIC] Aucun styliste avec salon_id:', trySalonId);
      }
    }
    
    if (stylistesError) {
      console.error('[PUBLIC] Erreur récupération stylistes:', stylistesError);
      return res.json([]);
    }
    
    if (!stylistes || stylistes.length === 0) {
      console.log('[PUBLIC] Aucun styliste trouvé pour ce salon');
      return res.json([]);
    }
    
    console.log('[PUBLIC] Stylistes bruts trouvés:', stylistes.length);
    
    // Mapper les données au format attendu par le frontend
    // Filtrer uniquement les stylistes actifs dans le mapping
    const result = (stylistes || [])
      .filter((st: any) => st.is_active !== false) // Filtrer les inactifs
      .map((st: any) => ({
        id: st.id,
        firstName: st.first_name || '',
        lastName: st.last_name || '',
        name: `${st.first_name || ''} ${st.last_name || ''}`.trim(),
        email: st.email || null,
        phone: st.phone || null,
        photoUrl: st.photo_url || null,
        specialties: st.specialties || [],
        isActive: st.is_active !== false
      }));
    
    console.log('[PUBLIC] Stylistes mappés retournés:', result.length);
    
    return res.json(result); // Retourner un tableau directement
  } catch (error: any) {
    console.error('[PUBLIC] Erreur inattendue:', error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route publique pour récupérer les créneaux disponibles
publicRouter.get("/salon/availability", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[PUBLIC] [${requestId}] hit GET /api/public/salon/availability`, req.query);
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error(`[PUBLIC] [${requestId}] Configuration Supabase manquante`);
      return res.status(500).json({ 
        success: false,
        error: "SLOTS_FETCH_FAILED",
        message: "Configuration Supabase manquante"
      });
    }

    const { date, serviceId, stylistId, slotStep } = req.query;

    if (!date || typeof date !== "string") {
      console.error(`[PUBLIC] [${requestId}] Paramètre date manquant`);
      return res.status(400).json({ 
        success: false,
        error: "BAD_REQUEST",
        message: "Le paramètre 'date' est requis (YYYY-MM-DD)" 
      });
    }

    if (!serviceId || typeof serviceId !== "string") {
      console.error(`[PUBLIC] [${requestId}] Paramètre serviceId manquant`);
      return res.status(400).json({ 
        success: false,
        error: "BAD_REQUEST",
        message: "Le paramètre 'serviceId' est requis" 
      });
    }

    const baseDate = parseLocalDate(date);
    if (!baseDate) {
      console.error(`[PUBLIC] [${requestId}] Format de date invalide:`, date);
      return res.status(400).json({ 
        success: false,
        error: "BAD_REQUEST",
        message: "Format de date invalide. Utilisez YYYY-MM-DD" 
      });
    }

    const dayOfWeek = baseDate.getDay();
    const slotStepMinutes = Number(slotStep) && Number(slotStep) > 0 ? Number(slotStep) : DEFAULT_SLOT_STEP_MINUTES;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });

    const { data: salons, error: salonError } = await supabase
      .from("salons")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1);

    if (salonError) {
      console.error(`[PUBLIC] [${requestId}] Erreur récupération salon:`, salonError);
      return res.status(500).json({ 
        success: false,
        error: "SLOTS_FETCH_FAILED",
        message: "Impossible de charger le salon"
      });
    }

    if (!salons || salons.length === 0) {
      console.error(`[PUBLIC] [${requestId}] Aucun salon trouvé`);
      return res.status(404).json({ 
        success: false,
        error: "BAD_REQUEST",
        message: "Salon introuvable" 
      });
    }

    const rawSalonId = salons[0].id;
    const salonIdsToTry = rawSalonId.startsWith("salon-")
      ? [rawSalonId, rawSalonId.replace("salon-", "")]
      : [rawSalonId, `salon-${rawSalonId}`];

    console.log(`[PUBLIC] [${requestId}] Salon ID:`, rawSalonId, 'Variants:', salonIdsToTry);

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, duration")
      .eq("id", serviceId)
      .maybeSingle();

    if (serviceError) {
      console.error(`[PUBLIC] [${requestId}] Erreur récupération service:`, serviceError);
      return res.status(500).json({ 
        success: false,
        error: "SLOTS_FETCH_FAILED",
        message: "Impossible de charger le service"
      });
    }

    if (!service) {
      console.error(`[PUBLIC] [${requestId}] Service introuvable:`, serviceId);
      return res.status(404).json({ 
        success: false,
        error: "BAD_REQUEST",
        message: "Service introuvable" 
      });
    }

    const serviceDuration = Number(service.duration || 0);
    if (!serviceDuration || Number.isNaN(serviceDuration)) {
      console.error(`[PUBLIC] [${requestId}] Durée de service invalide:`, service.duration);
      return res.status(400).json({ 
        success: false,
        error: "BAD_REQUEST",
        message: "Le service n'a pas de durée valide" 
      });
    }

    console.log(`[PUBLIC] [${requestId}] Service trouvé:`, serviceId, 'Durée:', serviceDuration, 'min');

    let { data: salonHours, error: salonHoursError } = await supabase
      .from("salon_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .in("salon_id", salonIdsToTry);

    console.log(`[PUBLIC] [${requestId}] Horaires salon récupérés:`, salonHours?.length || 0, salonHoursError ? `Erreur: ${salonHoursError.message}` : 'OK');

    if (salonHoursError || !salonHours || salonHours.length === 0) {
      const { data: openingHours, error: openingHoursError } = await supabase
        .from("opening_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .in("salon_id", salonIdsToTry);

      if (openingHoursError) {
        console.error(`[PUBLIC] [${requestId}] Erreur récupération horaires salon:`, openingHoursError);
        salonHours = [];
      } else {
        salonHours = openingHours || [];
        console.log(`[PUBLIC] [${requestId}] Horaires opening_hours récupérés:`, salonHours.length);
      }
    }

    let stylistsToCheck: { originalId: string; normalizedId: string; variants: string[] }[] = [];
    const requestedStylist = typeof stylistId === "string" ? stylistId : "";

    if (requestedStylist && requestedStylist !== "none") {
      const stylistVariants = getStylistIdVariants(requestedStylist);
      const { data: stylistData, error: stylistError } = await supabase
        .from("stylistes")
        .select("id, is_active")
        .in("id", stylistVariants)
        .maybeSingle();

      if (stylistError) {
        console.error(`[PUBLIC] [${requestId}] Erreur récupération styliste:`, stylistError);
        return res.status(500).json({ 
          success: false,
          error: "SLOTS_FETCH_FAILED",
          message: "Impossible de charger le/la coiffeur·euse"
        });
      }

      if (!stylistData) {
        console.error(`[PUBLIC] [${requestId}] Styliste introuvable:`, requestedStylist);
        return res.status(404).json({ 
          success: false,
          error: "BAD_REQUEST",
          message: "Coiffeur·euse introuvable" 
        });
      }

      if (stylistData.is_active === false) {
        console.error(`[PUBLIC] [${requestId}] Styliste inactif:`, requestedStylist);
        return res.status(400).json({ 
          success: false,
          error: "BAD_REQUEST",
          message: "Ce·tte coiffeur·euse n'est pas disponible" 
        });
      }

      const normalizedId = normalizeStylistIdValue(stylistData.id);
      if (!normalizedId) {
        return res.status(400).json({ 
          success: false,
          error: "BAD_REQUEST",
          message: "Identifiant coiffeur·euse invalide" 
        });
      }

      stylistsToCheck = [
        {
          originalId: stylistData.id,
          normalizedId,
          variants: getStylistIdVariants(stylistData.id),
        },
      ];
    } else {
      const { data: stylistData, error: stylistError } = await supabase
        .from("stylistes")
        .select("id, is_active")
        .in("salon_id", salonIdsToTry)
        .eq("is_active", true);

      if (stylistError) {
        console.error(`[PUBLIC] [${requestId}] Erreur récupération stylistes:`, stylistError);
        return res.status(500).json({ 
          success: false,
          error: "SLOTS_FETCH_FAILED",
          message: "Impossible de charger les coiffeur·euse·s"
        });
      }

      stylistsToCheck = (stylistData || [])
        .filter((stylist: any) => stylist?.id)
        .map((stylist: any) => ({
          originalId: stylist.id,
          normalizedId: normalizeStylistIdValue(stylist.id)!,
          variants: getStylistIdVariants(stylist.id),
        }))
        .filter((stylist) => stylist.normalizedId);
    }

    if (!stylistsToCheck.length) {
      console.log(`[PUBLIC] [${requestId}] Aucun styliste à vérifier`);
      return res.json({ 
        success: true,
        date, 
        slots: [],
        error: "Aucun coiffeur·euse disponible pour le moment"
      });
    }

    console.log(`[PUBLIC] [${requestId}] ${stylistsToCheck.length} styliste(s) à vérifier pour le jour ${dayOfWeek}`);

    const allStylistVariants = stylistsToCheck.flatMap((stylist) => stylist.variants);

    const { data: stylistSchedules, error: scheduleError } = await supabase
      .from("stylist_schedule")
      .select("stylist_id, day_of_week, start_time, end_time, is_available")
      .in("stylist_id", allStylistVariants)
      .eq("day_of_week", dayOfWeek);

    console.log(`[PUBLIC] [${requestId}] Horaires stylistes récupérés:`, stylistSchedules?.length || 0, scheduleError ? `Erreur: ${scheduleError.message}` : 'OK');

    if (scheduleError && scheduleError.code !== "42P01") {
      console.error(`[PUBLIC] [${requestId}] Erreur récupération horaires stylistes:`, scheduleError);
    }

    const scheduleMap = new Map<string, any[]>();
    if (stylistSchedules) {
      stylistSchedules.forEach((entry: any) => {
        const normalized = normalizeStylistIdValue(entry.stylist_id);
        if (!normalized) {
          return;
        }
        if (!scheduleMap.has(normalized)) {
          scheduleMap.set(normalized, []);
        }
        scheduleMap.get(normalized)!.push({
          day_of_week: entry.day_of_week,
          start_time: entry.start_time,
          end_time: entry.end_time,
          is_available: entry.is_available !== false,
        });
      });
    }

    const dayStart = new Date(baseDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(baseDate);
    dayEnd.setHours(23, 59, 59, 999);

    const { data: appointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select("id, stylist_id, appointment_date, duration, status")
      .in("stylist_id", allStylistVariants)
      .neq("status", "cancelled")
      .gte("appointment_date", dayStart.toISOString())
      .lte("appointment_date", dayEnd.toISOString());

    if (appointmentsError) {
      console.error(`[PUBLIC] [${requestId}] Erreur récupération rendez-vous:`, appointmentsError);
      // Ne pas bloquer, continuer sans vérifier les conflits
      console.warn(`[PUBLIC] [${requestId}] Continuation sans vérification des conflits de rendez-vous`);
    }

    const appointmentMap = new Map<string, any[]>();
    (appointments || []).forEach((apt: any) => {
      const normalized = normalizeStylistIdValue(apt.stylist_id);
      if (!normalized) {
        return;
      }
      if (!appointmentMap.has(normalized)) {
        appointmentMap.set(normalized, []);
      }
      appointmentMap.get(normalized)!.push(apt);
    });

    let closedDates: any[] | null = null;
    let closedError: any = null;
    
    // Essayer d'abord avec stylist_id
    let closedQuery = await supabase
      .from("salon_closed_dates")
      .select("date, start_time, end_time, stylist_id")
      .in("salon_id", salonIdsToTry)
      .eq("date", date);

    // Si la colonne stylist_id n'existe pas (erreur 42703), réessayer sans
    if (closedQuery.error && closedQuery.error.code === "42703") {
      const retryQuery = await supabase
        .from("salon_closed_dates")
        .select("date, start_time, end_time")
        .in("salon_id", salonIdsToTry)
        .eq("date", date);
      closedDates = retryQuery.data;
      closedError = retryQuery.error;
    } else {
      closedDates = closedQuery.data;
      closedError = closedQuery.error;
    }

    if (closedError) {
      console.error(`[PUBLIC] [${requestId}] Erreur récupération fermetures:`, closedError);
      // Ne pas bloquer, continuer sans vérifier les fermetures
    }

    const globalClosedWindows: { start: Date | null; end: Date | null }[] = [];
    const stylistClosedMap = new Map<string, { start: Date | null; end: Date | null }[]>();

    (closedDates || []).forEach((entry: any) => {
      const start = entry.start_time ? buildDateTime(baseDate, entry.start_time.substring(0, 5)) : null;
      const end = entry.end_time ? buildDateTime(baseDate, entry.end_time.substring(0, 5)) : null;

      if (!entry.stylist_id) {
        globalClosedWindows.push({ start, end });
      } else {
        const normalized = normalizeStylistIdValue(entry.stylist_id);
        if (!normalized) {
          return;
        }
        if (!stylistClosedMap.has(normalized)) {
          stylistClosedMap.set(normalized, []);
        }
        stylistClosedMap.get(normalized)!.push({ start, end });
      }
    });

    const aggregatedSlots = new Map<string, Set<string>>();
    const now = new Date();
    const isToday = baseDate.toDateString() === now.toDateString();

    for (const stylist of stylistsToCheck) {
      const stylistAppointments = appointmentMap.get(stylist.normalizedId) || [];
      const stylistSchedulesForDay =
        scheduleMap.has(stylist.normalizedId) && scheduleMap.get(stylist.normalizedId)
          ? scheduleMap.get(stylist.normalizedId)
          : scheduleMap.size === 0
            ? []
            : null;

      const validIntervals = getValidIntervalsForDay(
        salonHours as any,
        stylistSchedulesForDay as any,
        dayOfWeek
      );

      console.log(`[PUBLIC] [${requestId}] Styliste ${stylist.originalId}: ${validIntervals.length} intervalles valides`);

      if (validIntervals.length === 0) {
        console.log(`[PUBLIC] [${requestId}] Styliste ${stylist.originalId}: Aucun intervalle valide, salonHours:`, salonHours?.length || 0, 'stylistSchedules:', stylistSchedulesForDay?.length || 0);
        continue;
      }

      const stylistSlots = generateSlotsFromIntervals(baseDate, validIntervals, serviceDuration, slotStepMinutes);
      if (!stylistSlots.length) {
        continue;
      }

      const stylistClosedWindows = [
        ...(globalClosedWindows || []),
        ...(stylistClosedMap.get(stylist.normalizedId) || []),
      ];

      for (const slot of stylistSlots) {
        if (isToday && slot.start <= now) {
          continue;
        }

        if (!isSlotValid(slot.start, serviceDuration, validIntervals)) {
          continue;
        }

        const inClosedWindow = stylistClosedWindows.some((window) => {
          if (!window.start && !window.end) {
            return true;
          }
          const start = window.start || buildDateTime(baseDate, "00:00");
          const end = window.end || buildDateTime(baseDate, "23:59");
          return slot.start < end && slot.end > start;
        });

        if (inClosedWindow) {
          continue;
        }

        const hasConflict = hasAppointmentConflict(stylistAppointments, slot.start, slot.end);
        if (hasConflict) {
          continue;
        }

        if (!aggregatedSlots.has(slot.label)) {
          aggregatedSlots.set(slot.label, new Set<string>());
        }
        aggregatedSlots.get(slot.label)!.add(stylist.originalId);
      }
    }

    const slots = Array.from(aggregatedSlots.entries())
      .sort((a, b) => timeToMinutes(a[0]) - timeToMinutes(b[0]))
      .map(([time, stylistIds]) => ({
        time,
        stylistIds: Array.from(stylistIds),
      }));

    console.log(`[PUBLIC] [${requestId}] Résultat: ${slots.length} créneaux générés pour ${date}`, {
      serviceId,
      stylistId: requestedStylist || "none",
      salonHoursCount: salonHours?.length || 0,
      stylistsCount: stylistsToCheck.length,
      appointmentsCount: appointments?.length || 0,
      slotsCount: slots.length
    });

    res.json({
      success: true,
      date,
      serviceId,
      stylistId: requestedStylist || "none",
      slotIntervalMinutes: slotStepMinutes,
      slots,
    });
  } catch (error: any) {
    console.error(`[PUBLIC] [${requestId}] Erreur inattendue:`, error);
    console.error(`[PUBLIC] [${requestId}] Stack:`, error.stack);
    res.status(500).json({ 
      success: false,
      error: "SLOTS_FETCH_FAILED",
      message: "Impossible de charger les créneaux disponibles"
    });
  }
});

export default publicRouter;

