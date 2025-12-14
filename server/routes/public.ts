// server/routes/public.ts
import express from "express";
// @ts-ignore - voice-agent.js est un fichier JS avec export default router
import voiceTextRouter from "./voice-agent.js";
import voiceAudio from "./voice-audio.js";
import { createClient } from '@supabase/supabase-js';
// IMPORTANT: En ESM, les imports relatifs TypeScript doivent inclure l'extension .js
import { getValidIntervalsForDay, isSlotValid, TimeSlot } from '../utils/bookingValidation.js';

const publicRouter = express.Router();
// Ne pas utiliser express.json() ici car il est déjà monté globalement dans server/index.ts

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
      const slotStart = buildDateTime(baseDate, label);
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

// Texte: POST /api/voice-agent
// @ts-expect-error - voiceTextRouter est un router Express exporté depuis un fichier JS
publicRouter.use("/voice-agent", voiceTextRouter);

// Audio + config + health: /api/voice-agent/*
publicRouter.use("/voice-agent", voiceAudio);

// Alias pratiques : /api/public-config et /api/health/openai
publicRouter.get("/public-config", async (req, res) => {
  res.json({ voiceMode: "browser" }); // Mode navigateur pour la synthèse vocale
});

publicRouter.get("/health/openai", async (req, res) => {
  try {
    // @ts-ignore - config-direct.js est un fichier JS
    const { hasOpenAI, openAIHeaders } = await import("../config-direct");
    if (!hasOpenAI) return res.status(500).json({ ok: false, reason: "NO_OPENAI_KEY" });
    const fetch = (await import("node-fetch")).default;
    const r = await fetch("https://api.openai.com/v1/models", { headers: openAIHeaders() });
    if (!r.ok) return res.status(r.status).json({ ok: false, reason: await r.text() });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, reason: String(e) });
  }
});

// Route publique pour récupérer les informations du salon unique (horaires + contact)
publicRouter.get("/salon", async (req, res) => {
  // S'assurer que la réponse est toujours en JSON
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[GET /api/public/salon] Configuration Supabase manquante');
      return res.status(500).json({ 
        error: "Configuration Supabase manquante",
        message: "Les variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises"
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Récupérer le salon unique (le plus récent ou le premier)
    // Inclure theme_color pour permettre le chargement du thème même sans authentification
    const { data: salons, error: salonError } = await supabase
      .from('salons')
      .select('id, name, address, phone, email, theme_color')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (salonError) {
      console.error('[GET /api/public/salon] Erreur Supabase:', salonError);
      return res.status(500).json({ error: "Impossible de charger les informations du salon" });
    }
    
    console.log('[GET /api/public/salon] Salons récupérés:', JSON.stringify(salons, null, 2));
    
    if (!salons || salons.length === 0) {
      return res.json({ 
        salon: null, 
        hours: [],
        message: "Aucun salon configuré" 
      });
    }
    
    const salon = salons[0];
    
    // Vérifier que l'ID est bien présent
    if (!salon.id) {
      console.error('[GET /api/public/salon] ❌ ID manquant dans la réponse Supabase:', salon);
      return res.status(500).json({ error: "ID du salon manquant" });
    }
    
    const salonId = salon.id;
    
    console.log('[GET /api/public/salon] Salon trouvé:', { id: salon.id, name: salon.name, salonId });
    
    // Récupérer les horaires - essayer d'abord opening_hours, puis salon_hours
    // IMPORTANT : Récupérer TOUS les créneaux (un jour peut avoir plusieurs créneaux)
    let hours: any[] | null = null;
    let hoursError: any = null;
    
    // Essayer d'abord avec opening_hours (peut avoir plusieurs créneaux par jour)
    const { data: openingHours, error: openingHoursError } = await supabase
      .from('opening_hours')
      .select('day_of_week, open_time, close_time, is_closed')
      .eq('salon_id', salonId)
      .order('day_of_week', { ascending: true })
      .order('open_time', { ascending: true });
    
    if (!openingHoursError && openingHours && openingHours.length > 0) {
      hours = openingHours;
      console.log('[GET /api/public/salon] ✅ Horaires récupérés depuis opening_hours:', hours.length);
    } else {
      // Fallback sur salon_hours si opening_hours n'existe pas ou est vide
      const { data: salonHours, error: salonHoursError } = await supabase
        .from('salon_hours')
        .select('day_of_week, open_time, close_time, is_closed')
        .eq('salon_id', salonId)
        .order('day_of_week', { ascending: true })
        .order('open_time', { ascending: true });
      
      if (!salonHoursError && salonHours) {
        hours = salonHours;
        console.log('[GET /api/public/salon] ✅ Horaires récupérés depuis salon_hours:', hours.length);
      } else {
        hoursError = salonHoursError || openingHoursError;
      }
    }
    
    if (hoursError) {
      console.error('[GET /api/public/salon] Erreur chargement horaires:', hoursError);
      // Retourner le salon même si les horaires échouent
      const responseWithoutHours = {
        salon: {
          id: salon.id,
          name: salon.name,
          address: salon.address,
          phone: salon.phone,
          email: salon.email,
          theme_color: salon.theme_color || null
        },
        hours: []
      };
      console.log('[GET /api/public/salon] Réponse envoyée (sans horaires):', JSON.stringify(responseWithoutHours, null, 2));
      return res.json(responseWithoutHours);
    }
    
    // FORCER l'inclusion de l'ID en PREMIER pour s'assurer qu'il est inclus
    // Inclure theme_color pour permettre le chargement du thème même sans authentification
    const salonResponse: any = {
      id: salon.id || null, // FORCER l'inclusion même si undefined
      name: salon.name,
      address: salon.address,
      phone: salon.phone,
      email: salon.email,
      theme_color: salon.theme_color || null
    };
    
    // Log de débogage
    console.log('[GET /api/public/salon] salon.id value:', salon.id);
    console.log('[GET /api/public/salon] salon.id type:', typeof salon.id);
    console.log('[GET /api/public/salon] salonResponse.id:', salonResponse.id);
    
    const response = {
      salon: salonResponse,
      hours: hours || []
    };
    
    console.log('[GET /api/public/salon] Réponse envoyée:', JSON.stringify(response, null, 2));
    console.log('[GET /api/public/salon] salon.id value:', salon.id);
    console.log('[GET /api/public/salon] salon.id type:', typeof salon.id);
    
    res.json(response);
  } catch (error: any) {
    console.error('[GET /api/public/salon] Erreur inattendue:', error);
    console.error('[GET /api/public/salon] Stack:', error.stack);
    // Toujours renvoyer du JSON même en cas d'erreur
    return res.status(500).json({ 
      error: "Impossible de charger les informations du salon",
      message: "Une erreur interne est survenue"
    });
  }
});

// Route publique pour récupérer les stylistes du salon unique
publicRouter.get("/salon/stylistes", async (req, res) => {
  // S'assurer que la réponse est toujours en JSON
  res.setHeader('Content-Type', 'application/json');
  
  console.log('[GET /api/public/salon/stylistes] Route appelée');
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[GET /api/public/salon/stylistes] Configuration Supabase manquante');
      return res.status(500).json({ 
        error: "Configuration Supabase manquante",
        message: "Les variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises"
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Récupérer le salon unique (le plus récent)
    const { data: salons, error: salonError } = await supabase
      .from('salons')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (salonError) {
      console.error('[GET /api/public/salon/stylistes] Erreur récupération salon:', salonError);
      return res.json([]);
    }
    
    if (!salons || salons.length === 0) {
      console.log('[GET /api/public/salon/stylistes] Aucun salon trouvé');
      return res.json([]);
    }
    
    let salonId = salons[0].id;
    console.log('[GET /api/public/salon/stylistes] Salon ID récupéré:', salonId);
    
    // Récupérer les stylistes actifs du salon avec tous les champs nécessaires
    // Essayer avec les deux formats d'ID (avec et sans préfixe salon-)
    const salonIdsToTry = salonId.startsWith('salon-') 
      ? [salonId, salonId.replace('salon-', '')]
      : [salonId, `salon-${salonId}`];
    
    console.log('[GET /api/public/salon/stylistes] IDs à essayer:', salonIdsToTry);
    
    let stylistes: any[] | null = null;
    let stylistesError: any = null;
    
    // Essayer chaque format d'ID jusqu'à trouver des résultats
    for (const trySalonId of salonIdsToTry) {
      console.log('[GET /api/public/salon/stylistes] Essai avec salon_id:', trySalonId);
      const result = await supabase
        .from('stylistes')
        .select('id, first_name, last_name, email, phone, photo_url, specialties, is_active')
        .eq('salon_id', trySalonId)
        .eq('is_active', true);
      
      if (result.error) {
        console.error('[GET /api/public/salon/stylistes] Erreur avec salon_id', trySalonId, ':', result.error);
        stylistesError = result.error;
        continue;
      }
      
      if (result.data && result.data.length > 0) {
        console.log('[GET /api/public/salon/stylistes] ✅ Stylistes trouvés avec salon_id:', trySalonId, '→', result.data.length);
        stylistes = result.data;
        stylistesError = null;
        break;
      } else {
        console.log('[GET /api/public/salon/stylistes] Aucun styliste avec salon_id:', trySalonId);
      }
    }
    
    if (stylistesError) {
      console.error('[GET /api/public/salon/stylistes] Erreur récupération stylistes:', stylistesError);
      return res.json([]);
    }
    
    console.log('[GET /api/public/salon/stylistes] Stylistes bruts trouvés:', stylistes?.length || 0);
    
    // Retourner les champs avec le format attendu par le frontend
    const result = (stylistes || []).map((st: any) => ({
      id: st.id,
      firstName: st.first_name || '',
      lastName: st.last_name || '',
      name: `${st.first_name || ''} ${st.last_name || ''}`.trim(),
      email: st.email || null,
      phone: st.phone || null,
      photoUrl: st.photo_url || null,
      specialties: st.specialties || [],
      isActive: st.is_active !== false
    })).sort((a: any, b: any) => {
      const nameA = a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim();
      const nameB = b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim();
      return nameA.localeCompare(nameB);
    });
    
    console.log('[GET /api/public/salon/stylistes] Stylistes mappés retournés:', result.length);
    
    res.json(result);
  } catch (error: any) {
    console.error('[GET /api/public/salon/stylistes] Exception inattendue:', error);
    console.error('[GET /api/public/salon/stylistes] Stack:', error.stack);
    // Retourner une liste vide plutôt qu'une erreur pour ne pas casser le frontend
    return res.json([]);
  }
});

// Route publique pour récupérer les rendez-vous (pour la prise de rendez-vous côté client)
publicRouter.get("/salon/appointments", async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error("[GET /api/public/salon/appointments] Configuration Supabase manquante");
      return res.status(500).json({ error: "Configuration Supabase manquante" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Récupérer le salon unique (le plus récent)
    const { data: salons, error: salonError } = await supabase
      .from("salons")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1);

    if (salonError) {
      console.error("[GET /api/public/salon/appointments] Erreur récupération salon:", salonError);
      return res.status(500).json({ error: "Impossible de charger le salon" });
    }

    if (!salons || salons.length === 0) {
      console.warn("[GET /api/public/salon/appointments] Aucun salon configuré");
      return res.json([]);
    }

    const rawSalonId = salons[0].id;
    const salonIdsToTry = rawSalonId.startsWith("salon-")
      ? [rawSalonId, rawSalonId.replace("salon-", "")]
      : [rawSalonId, `salon-${rawSalonId}`];

    const { startDate, endDate } = req.query;

    let query = supabase
      .from("appointments")
      .select("id, salon_id, stylist_id, service_id, appointment_date, duration, status")
      .in("salon_id", salonIdsToTry)
      .neq("status", "cancelled");

    if (startDate) {
      query = query.gte("appointment_date", startDate as string);
    }
    if (endDate) {
      query = query.lte("appointment_date", endDate as string);
    }

    const { data: appointments, error: appointmentsError } = await query.order("appointment_date", { ascending: true });

    if (appointmentsError) {
      console.error("[GET /api/public/salon/appointments] Erreur Supabase:", appointmentsError);
      return res.status(500).json({ error: "Impossible de charger les rendez-vous" });
    }

    const mapped = (appointments || []).map((apt: any) => {
      const startTime = apt.appointment_date ? new Date(apt.appointment_date).toISOString() : null;
      const duration = Number(apt.duration || 30);
      const endTime = startTime ? new Date(new Date(startTime).getTime() + duration * 60000).toISOString() : null;
      return {
        id: apt.id,
        salonId: apt.salon_id,
        stylistId: apt.stylist_id,
        serviceId: apt.service_id,
        startTime,
        endTime,
        duration,
        status: apt.status || "pending"
      };
    });

    res.json(mapped);
  } catch (error: any) {
    console.error("[GET /api/public/salon/appointments] Erreur:", error);
    res.status(500).json({ error: "Impossible de charger les rendez-vous" });
  }
});

// Route publique pour récupérer les dates de fermeture
publicRouter.get("/salon/closed-dates", async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error("[GET /api/public/salon/closed-dates] Configuration Supabase manquante");
      return res.json([]);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const requestedSalonId = typeof req.query.salonId === 'string' ? req.query.salonId : undefined;
    let salonIdsToTry = getSalonIdVariants(requestedSalonId);

    if (salonIdsToTry.length === 0) {
      const { data: salons, error: salonError } = await supabase
        .from("salons")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1);

      if (salonError) {
        console.error("[GET /api/public/salon/closed-dates] Erreur récupération salon:", salonError);
        return res.json([]);
      }

      if (!salons || salons.length === 0) {
        return res.json([]);
      }

      salonIdsToTry = getSalonIdVariants(salons[0].id);
    }

    if (salonIdsToTry.length === 0) {
      return res.json([]);
    }

    const { data: closedDates, error: closedDatesError } = await supabase
      .from("salon_closed_dates")
      .select("id, salon_id, date, start_time, end_time, stylist_id, reason")
      .in("salon_id", salonIdsToTry)
      .order("date", { ascending: true });

    if (closedDatesError) {
      const isMissingTable = closedDatesError.code === '42P01' || closedDatesError.message?.includes('does not exist');
      if (isMissingTable) {
        console.warn("[GET /api/public/salon/closed-dates] Table salon_closed_dates manquante, retour d'une liste vide.");
        return res.json([]);
      }
      console.error("[GET /api/public/salon/closed-dates] Erreur Supabase:", closedDatesError);
      return res.status(500).json({ error: "Impossible de charger les dates de fermeture" });
    }

    res.json(closedDates || []);
  } catch (error: any) {
    console.error("[GET /api/public/salon/closed-dates] Erreur:", error);
    res.json([]);
  }
});

// Route publique pour récupérer les horaires détaillés des stylistes
publicRouter.get("/salon/stylist-hours", async (req, res) => {
  const DAYS = [
    { value: 0 }, { value: 1 }, { value: 2 },
    { value: 3 }, { value: 4 }, { value: 5 }, { value: 6 },
  ];

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error("[GET /api/public/salon/stylist-hours] Configuration Supabase manquante");
      return res.status(500).json({ error: "Configuration Supabase manquante" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: salons, error: salonError } = await supabase
      .from("salons")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1);

    if (salonError) {
      console.error("[GET /api/public/salon/stylist-hours] Erreur récupération salon:", salonError);
      return res.status(500).json({ error: "Impossible de charger le salon" });
    }

    if (!salons || salons.length === 0) {
      return res.json({ hours: {} });
    }

    const rawSalonId = salons[0].id;
    const salonIdsToTry = rawSalonId.startsWith("salon-")
      ? [rawSalonId, rawSalonId.replace("salon-", "")]
      : [rawSalonId, `salon-${rawSalonId}`];

    const { data: stylistList, error: stylistError } = await supabase
      .from("stylistes")
      .select("id, salon_id, is_active")
      .in("salon_id", salonIdsToTry)
      .eq("is_active", true);

    if (stylistError) {
      console.error("[GET /api/public/salon/stylist-hours] Erreur récupération stylistes:", stylistError);
      return res.status(500).json({ error: "Impossible de charger les stylistes" });
    }

    const stylistIds = (stylistList || []).map((stylist: any) => stylist.id);

    if (!stylistIds.length) {
      return res.json({ hours: {} });
    }

    const { data: schedule, error: scheduleError } = await supabase
      .from("stylist_schedule")
      .select("stylist_id, day_of_week, start_time, end_time, is_available")
      .in("stylist_id", stylistIds);

    if (scheduleError) {
      console.error("[GET /api/public/salon/stylist-hours] Erreur:", scheduleError);
      return res.status(500).json({ error: "Impossible de charger les horaires" });
    }

    const grouped: Record<string, any[]> = {};
    stylistIds.forEach((stylistId: string) => {
      grouped[stylistId] = DAYS.map(day => ({
        day_of_week: day.value,
        open_time: null,
        close_time: null,
        is_closed: true,
        slots: [],
      }));
    });

    (schedule || []).forEach((entry: any) => {
      const stylistId = entry.stylist_id;
      if (!grouped[stylistId]) {
        grouped[stylistId] = DAYS.map(day => ({
          day_of_week: day.value,
          open_time: null,
          close_time: null,
          is_closed: true,
          slots: [],
        }));
      }

      const dayIndex = typeof entry.day_of_week === "number" ? entry.day_of_week : 0;
      const dayEntry = grouped[stylistId].find(h => h.day_of_week === dayIndex);

      if (!dayEntry) {
        return;
      }

      if (entry.is_available === false || !entry.start_time || !entry.end_time) {
        dayEntry.is_closed = true;
        dayEntry.slots = [];
        return;
      }

      const start = String(entry.start_time).substring(0, 5);
      const end = String(entry.end_time).substring(0, 5);

      dayEntry.is_closed = false;
      dayEntry.open_time = start;
      dayEntry.close_time = end;
      dayEntry.slots.push({
        openTime: start,
        closeTime: end,
      });
    });

    res.json({ hours: grouped });
  } catch (error: any) {
    console.error("[GET /api/public/salon/stylist-hours] Erreur:", error);
    res.status(500).json({ error: "Impossible de charger les horaires des stylistes" });
  }
});

// Route publique pour récupérer les créneaux disponibles alignés avec la logique backend
publicRouter.get("/salon/availability", async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error("[GET /api/public/salon/availability] Configuration Supabase manquante");
      return res.status(500).json({ error: "Configuration Supabase manquante" });
    }

    const { date, serviceId, stylistId, slotStep } = req.query;

    if (!date || typeof date !== "string") {
      return res.status(400).json({ error: "Le paramètre 'date' est requis (YYYY-MM-DD)" });
    }

    if (!serviceId || typeof serviceId !== "string") {
      return res.status(400).json({ error: "Le paramètre 'serviceId' est requis" });
    }

    const baseDate = parseLocalDate(date);
    if (!baseDate) {
      return res.status(400).json({ error: "Format de date invalide. Utilisez YYYY-MM-DD" });
    }

    const dayOfWeek = baseDate.getDay();
    const slotStepMinutes = Number(slotStep) && Number(slotStep) > 0 ? Number(slotStep) : DEFAULT_SLOT_STEP_MINUTES;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: salons, error: salonError } = await supabase
      .from("salons")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1);

    if (salonError) {
      console.error("[GET /api/public/salon/availability] Erreur récupération salon:", salonError);
      return res.status(500).json({ error: "Impossible de charger le salon" });
    }

    if (!salons || salons.length === 0) {
      return res.status(404).json({ error: "Salon introuvable" });
    }

    const rawSalonId = salons[0].id;
    const salonIdsToTry = rawSalonId.startsWith("salon-")
      ? [rawSalonId, rawSalonId.replace("salon-", "")]
      : [rawSalonId, `salon-${rawSalonId}`];

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, duration")
      .eq("id", serviceId)
      .maybeSingle();

    if (serviceError) {
      console.error("[GET /api/public/salon/availability] Erreur récupération service:", serviceError);
      return res.status(500).json({ error: "Impossible de charger le service" });
    }

    if (!service) {
      return res.status(404).json({ error: "Service introuvable" });
    }

    const serviceDuration = Number(service.duration || 0);
    if (!serviceDuration || Number.isNaN(serviceDuration)) {
      return res.status(400).json({ error: "Le service n'a pas de durée valide" });
    }

    let { data: salonHours, error: salonHoursError } = await supabase
      .from("salon_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .in("salon_id", salonIdsToTry);

    if (salonHoursError || !salonHours || salonHours.length === 0) {
      const { data: openingHours, error: openingHoursError } = await supabase
        .from("opening_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .in("salon_id", salonIdsToTry);

      if (openingHoursError) {
        console.error("[GET /api/public/salon/availability] Erreur récupération horaires salon:", openingHoursError);
        return res.status(500).json({ error: "Impossible de charger les horaires du salon" });
      }

      salonHours = openingHours || [];
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
        console.error("[GET /api/public/salon/availability] Erreur récupération styliste:", stylistError);
        return res.status(500).json({ error: "Impossible de charger le/la coiffeur·euse" });
      }

      if (!stylistData) {
        return res.status(404).json({ error: "Coiffeur·euse introuvable" });
      }

      if (stylistData.is_active === false) {
        return res.status(400).json({ error: "Ce·tte coiffeur·euse n'est pas disponible" });
      }

      const normalizedId = normalizeStylistIdValue(stylistData.id);
      if (!normalizedId) {
        return res.status(400).json({ error: "Identifiant coiffeur·euse invalide" });
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
        console.error("[GET /api/public/salon/availability] Erreur récupération stylistes:", stylistError);
        return res.status(500).json({ error: "Impossible de charger les coiffeur·euse·s" });
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
      return res.json({ date, slots: [] });
    }

    const allStylistVariants = stylistsToCheck.flatMap((stylist) => stylist.variants);

    const { data: stylistSchedules, error: scheduleError } = await supabase
      .from("stylist_schedule")
      .select("stylist_id, day_of_week, start_time, end_time, is_available")
      .in("stylist_id", allStylistVariants)
      .eq("day_of_week", dayOfWeek);

    if (scheduleError && scheduleError.code !== "42P01") {
      console.error("[GET /api/public/salon/availability] Erreur récupération horaires stylistes:", scheduleError);
      return res.status(500).json({ error: "Impossible de charger les horaires des coiffeur·euse·s" });
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
      console.error("[GET /api/public/salon/availability] Erreur récupération rendez-vous:", appointmentsError);
      return res.status(500).json({ error: "Impossible de charger les rendez-vous existants" });
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
      console.error("[GET /api/public/salon/availability] Erreur récupération fermetures:", closedError);
      return res.status(500).json({ error: "Impossible de charger les fermetures" });
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

      if (validIntervals.length === 0) {
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

    res.json({
      date,
      serviceId,
      stylistId: requestedStylist || "none",
      slotIntervalMinutes: slotStepMinutes,
      slots,
    });
  } catch (error: any) {
    console.error("[GET /api/public/salon/availability] Erreur:", error);
    res.status(500).json({ error: "Impossible de charger les créneaux disponibles" });
  }
});

export default publicRouter;