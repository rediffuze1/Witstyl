/**
 * Router public isolé - 100% DB-free
 * N'importe AUCUN module qui touche la DB, session store, ou pg
 * Utilise uniquement Supabase REST (createClient)
 */

import express from "express";
import { createClient } from '@supabase/supabase-js';
import { getValidIntervalsForDay, isSlotValid, TimeSlot } from '../utils/bookingValidation';

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
      return res.json({ stylistes: [] });
    }
    
    const salonId = salons.id;
    
    // Récupérer les stylistes
    const { data: stylistes, error } = await supabase
      .from('stylistes')
      .select('id, name, specialties')
      .eq('salon_id', salonId);
    
    if (error) {
      console.error('[PUBLIC] Erreur récupération stylistes:', error);
      return res.json({ stylistes: [] });
    }
    
    return res.json({ stylistes: stylistes || [] });
  } catch (error: any) {
    console.error('[PUBLIC] Erreur inattendue:', error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

export default publicRouter;

