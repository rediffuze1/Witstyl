import 'dotenv/config';
import { randomUUID } from 'crypto';
import { printEnvStatus } from './env-check.js';
import { normalizeClosedDateRecord } from './utils/closed-dates.js';
import { notificationService } from './core/notifications/index.js';
import { cancelAppointment } from './core/appointments/AppointmentService.js';
import { buildNotificationContext } from './core/notifications/utils.js';
import { getValidIntervalsForDay, isSlotValid, formatIntervals } from './utils/bookingValidation.js';

// Vérification des variables d'environnement au démarrage
// En mode Vercel, on skip cette vérification pour éviter les erreurs au démarrage
if (!process.env.VERCEL) {
  printEnvStatus();
}

// Extension du type Session pour inclure les données utilisateur et client
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      salonId?: string; // ID du salon associé à l'utilisateur
    };
    client?: {
      clientId: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  }
}

// Extension du type Request pour inclure req.user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        phone?: string;
        salonId?: string;
        userType?: 'owner' | 'client';
      };
    }
  }
}

import express, { type Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
// @ts-ignore - Import d'un fichier JS depuis TS
import { hasOpenAI } from "./config-direct.js";

// Fonction de logging (déplacée depuis vite.ts pour éviter l'import statique)
function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}
import { SalonAuthService, ClientAuthService, supabaseAdmin } from "./supabaseService.js";
import { healthRouter } from "./routes/health.js";
import { setupClientAuth } from "./clientAuth.js";
import session from "express-session";
import publicRouter from "./routes/public.js";
import salonsRouter from "./routes/salons.js";
// @ts-ignore - voice-agent.js est un fichier JS avec export default router
import voiceTextRouter from "./routes/voice-agent.js";
import resendWebhookRouter from "./routes/resend-webhook.js";
import { createClient } from '@supabase/supabase-js';

type StylistRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
};

type StylistScheduleRow = {
  stylist_id: string;
  day_of_week: number;
  start_time?: string | null;
  end_time?: string | null;
  is_available?: boolean | null;
};

function buildSalonIdCandidates(rawId: string | null | undefined): string[] {
  if (!rawId) {
    return [];
  }
  return rawId.startsWith('salon-')
    ? [rawId, rawId.substring(6)]
    : [rawId, `salon-${rawId}`];
}

function normalizeStylistIdValue(stylistId?: string | null): string {
  if (!stylistId) {
    return '';
  }
  return stylistId.startsWith('stylist-') ? stylistId.substring(8) : stylistId;
}

function getStylistIdVariants(stylistId?: string | null): string[] {
  const variants = new Set<string>();
  if (stylistId) {
    variants.add(stylistId);
  }
  const normalized = normalizeStylistIdValue(stylistId);
  if (normalized) {
    variants.add(normalized);
  }
  return Array.from(variants).filter(Boolean);
}

function hasAppointmentConflict(
  appointments: any[] | undefined,
  requestedStart: Date,
  requestedEnd: Date
): boolean {
  if (!appointments || appointments.length === 0) {
    return false;
  }
  return appointments.some((appointment) => {
    if (!appointment) {
      return false;
    }
    const appointmentStart = new Date(appointment.appointment_date || appointment.startTime);
    const durationMinutes = appointment.duration ? Number(appointment.duration) : 30;
    const appointmentEnd = new Date(appointmentStart.getTime() + durationMinutes * 60000);
    
    // Vérifier le chevauchement: deux créneaux se chevauchent si:
    // requestedStart < appointmentEnd ET requestedEnd > appointmentStart
    const overlaps = requestedStart < appointmentEnd && requestedEnd > appointmentStart;
    
    if (overlaps) {
      console.log(`[hasAppointmentConflict] ⚠️ CHEVAUCHEMENT DÉTECTÉ:`);
      console.log(`[hasAppointmentConflict] ⚠️   Rendez-vous existant: ${appointmentStart.toISOString()} - ${appointmentEnd.toISOString()}`);
      console.log(`[hasAppointmentConflict] ⚠️   Créneau demandé: ${requestedStart.toISOString()} - ${requestedEnd.toISOString()}`);
    }
    
    return overlaps;
  });
}

async function findAvailableStylistForSlot(options: {
  supabase: any;
  salonIdCandidates: string[];
  dayOfWeek: number;
  salonDayHours: any[];
  appointmentStart: Date;
  appointmentEnd: Date;
  duration: number;
}) {
  const { supabase, salonIdCandidates, dayOfWeek, salonDayHours, appointmentStart, appointmentEnd, duration } = options;
  
  if (!salonIdCandidates || salonIdCandidates.length === 0) {
    return null;
  }

  const { data: stylistList, error: stylistError } = await supabase
    .from('stylistes')
    .select('id, first_name, last_name')
    .in('salon_id', salonIdCandidates)
    .eq('is_active', true);
  
  if (stylistError) {
    console.error('[findAvailableStylistForSlot] ❌ Erreur récupération stylistes:', stylistError);
    return null;
  }
  
  if (!stylistList || stylistList.length === 0) {
    console.warn('[findAvailableStylistForSlot] ⚠️ Aucun·e coiffeur·euse actif·ve trouvé·e pour le salon', salonIdCandidates);
    return null;
  }
  
  const stylists = (stylistList as StylistRow[]).map((stylist) => {
    const normalizedId = normalizeStylistIdValue(stylist.id);
    return {
      originalId: stylist.id,
      normalizedId,
      firstName: stylist.first_name || '',
      lastName: stylist.last_name || '',
    };
  }).filter((stylist) => stylist.normalizedId);
  
  if (stylists.length === 0) {
    return null;
  }

  const normalizedIds = stylists.map((stylist) => stylist.normalizedId);

  // Charger les horaires du jour pour tous les stylistes
  // IMPORTANT: Utiliser tous les variants d'ID pour être sûr de récupérer les horaires
  const scheduleMap = new Map<string, StylistScheduleRow[]>();
  try {
    // Collecter tous les variants d'ID pour tous les stylistes
    const allStylistIdVariantsForSchedule = new Set<string>();
    for (const stylist of stylists) {
      if (stylist.originalId) {
        const variants = getStylistIdVariants(stylist.originalId);
        variants.forEach(v => allStylistIdVariantsForSchedule.add(v));
      }
    }
    
    const scheduleIdFilters = Array.from(allStylistIdVariantsForSchedule).filter(Boolean);
    
    if (scheduleIdFilters.length > 0) {
      console.log(`[findAvailableStylistForSlot] 🔍 Récupération horaires avec ${scheduleIdFilters.length} variants d'ID:`, scheduleIdFilters);
      
      const { data: schedules, error: schedulesError } = await supabase
        .from('stylist_schedule')
        .select('stylist_id, day_of_week, start_time, end_time, is_available')
        .in('stylist_id', scheduleIdFilters)
        .eq('day_of_week', dayOfWeek);
      
      if (schedulesError) {
        if (schedulesError.code !== '42P01' && schedulesError.code !== 'PGRST116') {
          console.warn('[findAvailableStylistForSlot] ⚠️ Erreur récupération horaires stylistes:', schedulesError);
        }
      } else if (schedules) {
        console.log(`[findAvailableStylistForSlot] 🔍 ${schedules.length} horaires trouvés pour ce jour`);
        
        schedules.forEach((schedule: StylistScheduleRow) => {
          if (!schedule || schedule.is_available === false) {
            return;
          }
          
          // Normaliser l'ID et trouver le styliste correspondant
          const normalized = normalizeStylistIdValue(schedule.stylist_id);
          if (!normalized) {
            return;
          }
          
          // Trouver le styliste correspondant dans notre liste
          const matchingStylist = stylists.find(s => {
            const variants = getStylistIdVariants(s.originalId);
            return variants.includes(schedule.stylist_id) || s.normalizedId === normalized;
          });
          
          if (!matchingStylist) {
            return;
          }
          
          if (!scheduleMap.has(matchingStylist.normalizedId)) {
            scheduleMap.set(matchingStylist.normalizedId, []);
          }
          scheduleMap.get(matchingStylist.normalizedId)!.push(schedule);
        });
        
        // Log pour debug
        scheduleMap.forEach((scheds, stylistId) => {
          const stylist = stylists.find(s => s.normalizedId === stylistId);
          const stylistName = stylist ? `${stylist.firstName} ${stylist.lastName}`.trim() : stylistId;
          console.log(`[findAvailableStylistForSlot] 🔍 ${stylistName}: ${scheds.length} horaire(s) trouvé(s)`, scheds.map((s: any) => `${s.start_time}-${s.end_time}`));
        });
      }
    }
  } catch (error) {
    console.warn('[findAvailableStylistForSlot] ⚠️ Exception récupération horaires stylistes:', error);
  }

  // Charger les rendez-vous existants pour vérifier les conflits
  // IMPORTANT: Utiliser tous les variants d'ID pour chaque styliste pour être sûr de récupérer tous les rendez-vous
  const dayStart = new Date(appointmentStart);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(appointmentStart);
  dayEnd.setHours(23, 59, 59, 999);

  const appointmentsMap = new Map<string, any[]>();
  try {
    // Collecter tous les variants d'ID pour tous les stylistes
    const allStylistIdVariants = new Set<string>();
    for (const stylist of stylists) {
      if (stylist.normalizedId) {
        const variants = getStylistIdVariants(stylist.originalId);
        variants.forEach(v => allStylistIdVariants.add(v));
      }
    }
    
    const stylistIdFilters = Array.from(allStylistIdVariants).filter(Boolean);
    
    if (stylistIdFilters.length > 0) {
      console.log(`[findAvailableStylistForSlot] 🔍 Récupération des rendez-vous avec ${stylistIdFilters.length} variants d'ID:`, stylistIdFilters);
      
      const { data: dayAppointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('stylist_id, appointment_date, duration, status')
        .in('stylist_id', stylistIdFilters)
        .neq('status', 'cancelled')
        .gte('appointment_date', dayStart.toISOString())
        .lte('appointment_date', dayEnd.toISOString());
      
      if (appointmentsError) {
        console.warn('[findAvailableStylistForSlot] ⚠️ Erreur récupération rendez-vous du jour:', appointmentsError);
      } else if (dayAppointments) {
        console.log(`[findAvailableStylistForSlot] 🔍 ${dayAppointments.length} rendez-vous trouvés pour ce jour`);
        dayAppointments.forEach((appointment: any) => {
          // Normaliser l'ID du styliste du rendez-vous pour le mapper correctement
          const normalizedAppointmentStylistId = normalizeStylistIdValue(appointment?.stylist_id);
          if (!normalizedAppointmentStylistId) {
            return;
          }
          
          // Trouver le styliste correspondant dans notre liste
          const matchingStylist = stylists.find(s => s.normalizedId === normalizedAppointmentStylistId);
          if (!matchingStylist) {
            return;
          }
          
          if (!appointmentsMap.has(matchingStylist.normalizedId)) {
            appointmentsMap.set(matchingStylist.normalizedId, []);
          }
          appointmentsMap.get(matchingStylist.normalizedId)!.push(appointment);
        });
        
        // Log pour debug
        appointmentsMap.forEach((apps, stylistId) => {
          console.log(`[findAvailableStylistForSlot] 🔍 Styliste ${stylistId}: ${apps.length} rendez-vous existants`);
        });
      }
    }
  } catch (error) {
    console.warn('[findAvailableStylistForSlot] ⚠️ Exception récupération rendez-vous du jour:', error);
  }

  // Collecter tous les stylistes disponibles avec leurs horaires de début
  const availableStylists: Array<{
    stylist: typeof stylists[0];
    earliestStartTime: number; // En minutes depuis minuit
    stylistName: string;
  }> = [];

  for (const stylist of stylists) {
    if (!stylist?.normalizedId) {
      continue;
    }
    const stylistName = `${stylist.firstName} ${stylist.lastName}`.trim();
    console.log(`[findAvailableStylistForSlot] 🔍 Vérification styliste: ${stylistName} (${stylist.normalizedId})`);
    
    const stylistSchedule = scheduleMap.get(stylist.normalizedId) || [];
    console.log(`[findAvailableStylistForSlot] 🔍   Horaires styliste récupérés:`, stylistSchedule);
    
    const validIntervals = getValidIntervalsForDay(
      (salonDayHours || []) as any,
      stylistSchedule as any,
      dayOfWeek
    );
    
    console.log(`[findAvailableStylistForSlot] 🔍   Intervalles valides calculés:`, validIntervals);
    
    if (validIntervals.length === 0) {
      console.log(`[findAvailableStylistForSlot] ❌ ${stylistName}: Aucun intervalle valide, styliste exclu`);
      continue;
    }

    const slotIsValid = isSlotValid(new Date(appointmentStart), duration, validIntervals);
    console.log(`[findAvailableStylistForSlot] 🔍   Créneau valide pour ${stylistName}? ${slotIsValid}`);
    console.log(`[findAvailableStylistForSlot] 🔍   Créneau demandé: ${appointmentStart.toISOString()} (durée: ${duration} min)`);
    
    if (!slotIsValid) {
      console.log(`[findAvailableStylistForSlot] ❌ ${stylistName}: Créneau invalide (hors horaires), styliste exclu`);
      continue;
    }

    const stylistAppointments = appointmentsMap.get(stylist.normalizedId) || [];
    console.log(`[findAvailableStylistForSlot] 🔍 Vérification conflit pour ${stylist.normalizedId}:`);
    console.log(`[findAvailableStylistForSlot] 🔍   Créneau demandé: ${appointmentStart.toISOString()} - ${appointmentEnd.toISOString()}`);
    console.log(`[findAvailableStylistForSlot] 🔍   ${stylistAppointments.length} rendez-vous existants pour ce styliste`);
    
    const hasConflict = hasAppointmentConflict(stylistAppointments, appointmentStart, appointmentEnd);
    if (hasConflict) {
      console.log(`[findAvailableStylistForSlot] ❌ CONFLIT DÉTECTÉ pour ${stylist.normalizedId}`);
      stylistAppointments.forEach((apt: any) => {
        const aptStart = new Date(apt.appointment_date);
        const aptEnd = new Date(aptStart.getTime() + (apt.duration || 30) * 60000);
        console.log(`[findAvailableStylistForSlot] ❌   Rendez-vous existant: ${aptStart.toISOString()} - ${aptEnd.toISOString()} (durée: ${apt.duration} min)`);
        console.log(`[findAvailableStylistForSlot] ❌   Chevauchement: ${aptStart < appointmentEnd && aptEnd > appointmentStart}`);
      });
      continue;
    } else {
      console.log(`[findAvailableStylistForSlot] ✅ Aucun conflit pour ${stylist.normalizedId}`);
    }

    // Calculer l'heure de début la plus tôt dans les horaires de travail du styliste
    let earliestStartTime = Infinity;
    for (const interval of validIntervals) {
      const [startHour, startMin] = interval.start.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      if (startMinutes < earliestStartTime) {
        earliestStartTime = startMinutes;
      }
    }

    console.log(`[findAvailableStylistForSlot] ✅ ${stylistName}: Styliste disponible pour ce créneau`);
    console.log(`[findAvailableStylistForSlot] ✅   Heure de début la plus tôt: ${Math.floor(earliestStartTime / 60)}:${String(earliestStartTime % 60).padStart(2, '0')}`);
    
    availableStylists.push({
      stylist,
      earliestStartTime,
      stylistName: stylistName || stylist.originalId,
    });
  }

  // Si aucun styliste disponible, retourner null
  if (availableStylists.length === 0) {
    console.log(`[findAvailableStylistForSlot] ❌ Aucun styliste disponible pour ce créneau`);
    return null;
  }

  // Trier par heure de début la plus tôt (le styliste qui commence le plus tôt dans la journée)
  availableStylists.sort((a, b) => a.earliestStartTime - b.earliestStartTime);

  console.log(`[findAvailableStylistForSlot] 📋 Stylistes disponibles triés:`);
  availableStylists.forEach((s, idx) => {
    const timeStr = `${Math.floor(s.earliestStartTime / 60)}:${String(s.earliestStartTime % 60).padStart(2, '0')}`;
    console.log(`[findAvailableStylistForSlot]   ${idx + 1}. ${s.stylistName} (début: ${timeStr})`);
  });

  // Retourner le styliste qui commence le plus tôt
  const selected = availableStylists[0];
  console.log(`[findAvailableStylistForSlot] ✅ Styliste sélectionné: ${selected.stylistName} (ID: ${selected.stylist.originalId})`);
  return { 
    stylistId: selected.stylist.originalId, 
    stylistName: selected.stylistName 
  };
}

const app = express();

// Middleware de logging pour toutes les requêtes (avant les routes)
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl}`);
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

  // Configuration CORS pour développement local et production
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:5001', // Serveur principal
      'http://localhost:5173', // Vite dev server
      'http://localhost:3000',  // Alternative
      'https://localhost:5001',
      'https://localhost:5173',
      'https://localhost:3000',
      'https://witstyl.vercel.app', // Production Vercel
      'https://*.vercel.app', // Tous les sous-domaines Vercel
    ];
    
    // Ajouter l'URL de Replit si elle existe
    if (process.env.REPLIT_URL) {
      allowedOrigins.push(process.env.REPLIT_URL);
    }
    
    // En production, accepter toutes les origines Vercel
    if (process.env.NODE_ENV === 'production' && origin && origin.includes('vercel.app')) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      return next();
    }
    
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      // Fallback vers localhost:5001 pour le développement local
      res.header('Access-Control-Allow-Origin', 'http://localhost:5001');
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

// 👉 Middleware de session pour l'authentification client
// Configuration adaptée pour Vercel (HTTPS) et développement local (HTTP)
const isVercel = !!process.env.VERCEL;
const isProduction = process.env.NODE_ENV === 'production';
const isHTTPS = isVercel || isProduction;

app.use(session({
  secret: process.env.SESSION_SECRET || 'witstyl-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isHTTPS, // true sur Vercel/HTTPS, false en dev local
    httpOnly: true, // Sécuriser les cookies
    sameSite: isHTTPS ? 'lax' : 'lax', // 'lax' fonctionne bien sur Vercel (même domaine)
    maxAge: 24 * 60 * 60 * 1000, // 24 heures
    path: '/', // Le cookie est disponible pour tous les chemins
    // Ne pas spécifier de domaine pour que le cookie fonctionne sur tous les domaines
    domain: undefined
  },
  name: 'connect.sid', // Nom explicite du cookie de session
  // Sur Vercel, MemoryStore ne persiste pas entre les invocations
  // Mais les cookies signés permettent de maintenir la session si les cookies sont correctement envoyés
  // Note: Pour une vraie persistance, il faudrait utiliser un store externe (Redis, Supabase, etc.)
  // Pour l'instant, on utilise les cookies signés qui fonctionnent si secure et sameSite sont correctement configurés
}));

// 👉 Routes de santé
app.use("/api/health", healthRouter);

// ============================================
// ROUTE DE VÉRIFICATION SALON (TRÈS TÔT - AVANT TOUT)
// ============================================
// Route pour vérifier/créer le salon après login
// DOIT être définie AVANT setupClientAuth et autres routers
app.post('/api/auth/verify-salon', async (req, res) => {
  console.log('[VERIFY] ⚡⚡⚡ Route /api/auth/verify-salon appelée!');
  console.log('[VERIFY] Original URL:', req.originalUrl);
  console.log('[VERIFY] Path:', req.path);
  console.log('[VERIFY] Session ID:', req.sessionID);
  console.log('[VERIFY] Headers cookie:', req.headers.cookie ? 'présents' : 'absents');
  console.log('[VERIFY] req.session existe?', !!req.session);
  console.log('[VERIFY] req.session.user existe?', !!req.session?.user);
  
  try {
    const userSession = req.session?.user;
    
    // Log sécurisé de la session (éviter les erreurs de sérialisation)
    try {
      console.log('[VERIFY] userSession complète:', JSON.stringify(userSession, null, 2));
    } catch (serializeError) {
      console.log('[VERIFY] userSession (sans sérialisation):', {
        id: userSession?.id,
        email: userSession?.email,
        firstName: userSession?.firstName,
        lastName: userSession?.lastName,
        salonId: userSession?.salonId
      });
    }
    
    if (!userSession) {
      console.warn('[VERIFY] ❌ Aucune session utilisateur trouvée');
      console.warn('[VERIFY] req.session:', req.session ? 'existe' : 'n\'existe pas');
      console.warn('[VERIFY] req.sessionID:', req.sessionID);
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }
    
    if (!userSession.id) {
      console.error('[VERIFY] ❌ userSession.id est manquant');
      console.error('[VERIFY] userSession:', {
        hasId: !!userSession.id,
        hasEmail: !!userSession.email,
        keys: Object.keys(userSession)
      });
      return res.status(400).json({ error: 'Session utilisateur invalide' });
    }
    
    console.log('🔍 [VERIFY] Vérification salon pour user:', userSession.id);
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[VERIFY] ❌ Configuration Supabase manquante');
      console.error('[VERIFY] SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
      console.error('[VERIFY] SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✅' : '❌');
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }
    
    console.log('[VERIFY] ✅ Configuration Supabase OK');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Vérifier si le salon existe (chercher par user_id d'abord, puis par ID du salon)
    console.log('[VERIFY] 🔎 Recherche du salon avec user_id:', userSession.id);
    
    let existingSalon = null;
    let fetchError = null;
    
    try {
      // 1. Chercher par user_id exact
      const result = await supabase
        .from('salons')
        .select('*')
        .eq('user_id', userSession.id)
        .limit(1)
        .maybeSingle();
      
      existingSalon = result.data;
      fetchError = result.error;
      
      // 2. Si pas trouvé, chercher par ID du salon (format salon-{userId})
      if (!existingSalon && !fetchError) {
        const salonIdSearch = `salon-${userSession.id}`;
        console.log('[VERIFY] 🔎 Recherche alternative par salon ID:', salonIdSearch);
        
        const altResult = await supabase
          .from('salons')
          .select('*')
          .eq('id', salonIdSearch)
          .maybeSingle();
        
        if (altResult.data) {
          existingSalon = altResult.data;
          console.log('[VERIFY] ✅ Salon trouvé par ID (mais user_id invalide):', existingSalon.user_id);
          
          // Si le salon a un user_id invalide (dev-user, test, etc.), le réparer
          const invalidUserIds = ['dev-user', 'test', 'admin', 'user'];
          const needsRepair = invalidUserIds.includes(existingSalon.user_id) || 
                             existingSalon.user_id.length < 10;
          
          if (needsRepair) {
            console.log('[VERIFY] 🔧 Réparation automatique du salon: user_id invalide détecté');
            const { data: repairedSalon, error: repairError } = await supabase
              .from('salons')
              .update({ user_id: userSession.id })
              .eq('id', existingSalon.id)
              .select()
              .single();
            
            if (repairError) {
              console.error('[VERIFY] ❌ Erreur lors de la réparation:', repairError);
            } else if (repairedSalon) {
              console.log('[VERIFY] ✅ Salon réparé avec succès');
              existingSalon = repairedSalon;
            }
          }
        }
      }
      
      if (fetchError) {
        console.error('[VERIFY] ❌ Erreur recherche salon:', JSON.stringify(fetchError, null, 2));
        console.error('[VERIFY] Code:', fetchError.code);
        console.error('[VERIFY] Message:', fetchError.message);
        console.error('[VERIFY] Details:', fetchError.details);
        // Si l'erreur est "PGRST116" (aucune ligne trouvée), ce n'est pas grave, on continue
        if (fetchError.code !== 'PGRST116') {
          console.error('[VERIFY] ❌ Erreur critique lors de la recherche du salon');
          return res.status(500).json({ 
            error: 'Erreur lors de la recherche du salon',
            details: fetchError.message || 'Erreur inconnue',
            code: fetchError.code
          });
        }
        console.log('[VERIFY] ℹ️ Aucun salon trouvé (erreur PGRST116 - normal)');
      }
    } catch (queryException: any) {
      console.error('[VERIFY] ❌ Exception lors de la requête Supabase:', queryException);
      console.error('[VERIFY] Stack:', queryException.stack);
      return res.status(500).json({ 
        error: 'Erreur lors de la connexion à la base de données',
        details: queryException.message || 'Exception inconnue'
      });
    }
    
    // Si le salon existe déjà, le retourner
    if (existingSalon) {
      console.log('✅ [VERIFY] Salon existe déjà:', existingSalon.id);
      console.log('[VERIFY] Détails salon:', {
        id: existingSalon.id,
        name: existingSalon.name,
        user_id: existingSalon.user_id
      });
      
      // Normaliser le salonId pour le retour
      const normalizeSalonId = (id: string | undefined | null): string => {
        if (!id) return '';
        const strId = String(id);
        return strId.startsWith('salon-') ? strId.slice(6) : strId;
      };
      
      const normalizedId = normalizeSalonId(existingSalon.id);
      console.log('[VERIFY] SalonId normalisé:', normalizedId);
      
      // Mettre à jour la session avec le salonId normalisé
      try {
        if (req.session && req.session.user) {
          req.session.user = {
            ...req.session.user,
            salonId: normalizedId
          };
          console.log('[VERIFY] ✅ Session mise à jour avec salonId:', normalizedId);
        }
      } catch (sessionError: any) {
        console.warn('[VERIFY] ⚠️ Erreur lors de la mise à jour de la session:', sessionError.message);
        // Ne pas bloquer si la session ne peut pas être mise à jour
      }
      
      return res.json({ 
        success: true,
        salon: { ...existingSalon, id: normalizedId }, 
        created: false 
      });
    }
    
    console.log('⚠️ [VERIFY] Salon introuvable, création automatique...');
    console.log('[VERIFY] User ID pour création:', userSession.id);
    
    // Créer le salon s'il n'existe pas
    // Utiliser le format salon-{userId} comme dans l'inscription
    const salonId = `salon-${userSession.id}`;
    console.log('[VERIFY] SalonId à créer:', salonId);
    
    const salonData = {
      id: salonId,
      user_id: userSession.id,
      name: 'Mon Salon', // Nom par défaut
      address: '',
      phone: '',
      email: userSession.email || '',
      created_at: new Date().toISOString()
    };
    
    console.log('[VERIFY] Données salon à insérer:', salonData);
    
    let newSalon = null;
    let createError = null;
    
    try {
      const insertResult = await supabase
        .from('salons')
        .insert(salonData)
        .select()
        .single();
      
      newSalon = insertResult.data;
      createError = insertResult.error;
      
      if (createError) {
        console.error('❌ [VERIFY] Erreur création salon:', JSON.stringify(createError, null, 2));
        console.error('[VERIFY] Code:', createError.code);
        console.error('[VERIFY] Message:', createError.message);
        console.error('[VERIFY] Details:', createError.details);
        console.error('[VERIFY] Hint:', createError.hint);
        
        // Si l'erreur est "duplicate key" (23505), le salon existe peut-être déjà
        if (createError.code === '23505') {
          console.log('[VERIFY] ⚠️ Salon existe peut-être déjà, tentative de récupération...');
          // Essayer de récupérer le salon existant
          const retryResult = await supabase
            .from('salons')
            .select('*')
            .eq('id', salonId)
            .maybeSingle();
          
          if (retryResult.data) {
            console.log('[VERIFY] ✅ Salon trouvé après erreur de duplication');
            const normalizeSalonId = (id: string | undefined | null): string => {
              if (!id) return '';
              const strId = String(id);
              return strId.startsWith('salon-') ? strId.slice(6) : strId;
            };
            const normalizedId = normalizeSalonId(retryResult.data.id);
            
            try {
              if (req.session && req.session.user) {
                req.session.user = {
                  ...req.session.user,
                  salonId: normalizedId
                };
              }
            } catch (sessionError: any) {
              console.warn('[VERIFY] ⚠️ Erreur mise à jour session:', sessionError.message);
            }
            
            return res.json({ 
              success: true,
              salon: { ...retryResult.data, id: normalizedId }, 
              created: false 
            });
          }
        }
        
        return res.status(500).json({ 
          error: 'Erreur lors de la création du salon',
          details: createError.message || 'Erreur inconnue',
          code: createError.code
        });
      }
    } catch (insertException: any) {
      console.error('[VERIFY] ❌ Exception lors de l\'insertion:', insertException);
      console.error('[VERIFY] Stack:', insertException.stack);
      return res.status(500).json({ 
        error: 'Erreur lors de la création du salon',
        details: insertException.message || 'Exception inconnue'
      });
    }
    
    if (!newSalon) {
      console.error('❌ [VERIFY] Aucun salon retourné après insertion');
      return res.status(500).json({ error: 'Le salon n\'a pas pu être créé' });
    }
    
    console.log('✅ [VERIFY] Salon créé automatiquement:', newSalon.id);
    console.log('[VERIFY] Détails salon créé:', {
      id: newSalon.id,
      name: newSalon.name,
      user_id: newSalon.user_id
    });
    
    // Normaliser le salonId pour le retour
    const normalizeSalonId = (id: string | undefined | null): string => {
      if (!id) return '';
      const strId = String(id);
      return strId.startsWith('salon-') ? strId.slice(6) : strId;
    };
    
    const normalizedId = normalizeSalonId(newSalon.id);
    console.log('[VERIFY] SalonId normalisé:', normalizedId);
    
    // Mettre à jour la session avec le salonId normalisé
    try {
      if (req.session && req.session.user) {
        req.session.user = {
          ...req.session.user,
          salonId: normalizedId
        };
        console.log('[VERIFY] ✅ Session mise à jour avec salonId:', normalizedId);
      }
    } catch (sessionError: any) {
      console.warn('[VERIFY] ⚠️ Erreur lors de la mise à jour de la session:', sessionError.message);
      // Ne pas bloquer si la session ne peut pas être mise à jour
    }
    
    res.json({ 
      success: true,
      salon: { ...newSalon, id: normalizedId }, 
      created: true 
    });
  } catch (error: any) {
    console.error('❌ [VERIFY] Exception non gérée:', error);
    console.error('[VERIFY] Stack:', error.stack);
    console.error('[VERIFY] Message:', error.message);
    res.status(500).json({ 
      error: error.message || 'Erreur lors de la vérification du salon',
      type: error.name || 'UnknownError'
    });
  }
});
console.log('[SERVER] ✅✅✅ Route /api/auth/verify-salon montée TRÈS TÔT (ligne ~118) à', new Date().toISOString());

// Routes d'authentification client (AVANT les routes publiques)
setupClientAuth(app);

// ============================================
// MIDDLEWARE CATCH-ALL POUR DEBUG (TRÈS TÔT DANS LA CHAÎNE)
// ============================================
app.use((req, res, next) => {
  if (req.method === 'PUT' && req.path.includes('/salons') && req.path.includes('/hours')) {
    console.log('[CATCH-ALL DEBUG] 🔍🔍🔍 PUT /api/salons/:salonId/hours détectée');
    console.log('[CATCH-ALL DEBUG] 🔍 Path:', req.path);
    console.log('[CATCH-ALL DEBUG] 🔍 URL:', req.url);
    console.log('[CATCH-ALL DEBUG] 🔍 Original URL:', req.originalUrl);
  }
  next();
});

// Middleware pour attacher req.user depuis req.session avec récupération automatique du salonId
app.use(async (req, res, next) => {
  const userSession = req.session?.user;
  if (userSession) {
    let salonId = userSession.salonId;
    
    console.log('[AUTH MIDDLEWARE] Décodé:', {
      id: userSession.id,
      email: userSession.email,
      salonId: userSession.salonId
    });
    console.log('[AUTH MIDDLEWARE] userType=owner, salonId=', userSession.salonId);
    
    // Si salonId n'est pas dans la session, le récupérer depuis la base de données
    if (!salonId) {
      console.log('[AUTH MIDDLEWARE] salonId manquant dans la session, récupération depuis DB...');
      console.log('[AUTH MIDDLEWARE] Recherche salon pour userId:', userSession.id);
      try {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          
          // Chercher d'abord avec user_id
          const { data: salon, error: salonError } = await supabase
            .from('salons')
            .select('id, name, user_id')
            .eq('user_id', userSession.id)
            .limit(1)
            .maybeSingle();
          
          if (salonError) {
            console.error('[AUTH MIDDLEWARE] ❌ Erreur recherche salon:', salonError);
          }
          
          if (salon) {
            salonId = salon.id;
            console.log('[AUTH MIDDLEWARE] ✅ Salon trouvé:', {
              id: salon.id,
              name: salon.name,
              user_id: salon.user_id
            });
            
            // Mettre à jour la session avec le salonId trouvé
            if (req.session && req.session.user) {
              req.session.user = {
                ...req.session.user,
                salonId: salonId
              };
              console.log('[AUTH MIDDLEWARE] ✅ SalonId mis à jour dans la session:', salonId);
            }
          } else {
            console.warn('[AUTH MIDDLEWARE] ⚠️ Aucun salon trouvé pour userId:', userSession.id);
            // Debug: lister tous les salons pour comprendre
            const { data: allSalons } = await supabase
              .from('salons')
              .select('id, name, user_id')
              .limit(10);
            console.warn('[AUTH MIDDLEWARE] Salons existants en base:', allSalons);
          }
        } else {
          console.warn('[AUTH MIDDLEWARE] ⚠️ Configuration Supabase manquante');
        }
      } catch (error) {
        console.error('[AUTH MIDDLEWARE] ❌ Erreur lors de la récupération du salonId:', error);
        if (error instanceof Error) {
          console.error('[AUTH MIDDLEWARE] Stack:', error.stack);
        }
      }
    }
    
    // Helper de normalisation (identique à routes/salons.ts)
    const normalizeSalonId = (id: string | undefined | null): string => {
      if (!id) return '';
      const strId = String(id);
      return strId.startsWith('salon-') ? strId.slice(6) : strId;
    };
    
    // Normaliser salonId pour retirer le préfixe "salon-" si présent
    // Le salonId doit être l'UUID brut sans préfixe
    let normalizedSalonId = salonId;
    if (salonId && typeof salonId === 'string' && salonId.startsWith('salon-')) {
      normalizedSalonId = normalizeSalonId(salonId);
      console.log('[AUTH MIDDLEWARE] ⚠️ Préfixe "salon-" détecté et retiré:', salonId, '→', normalizedSalonId);
    }
    
    // Forcer les IDs en string pour comparaison
    const userIdStr = String(userSession.id || '');
    const salonIdStr = normalizedSalonId ? normalizeSalonId(String(normalizedSalonId)) : '';
    
    req.user = {
      id: userIdStr,
      email: userSession.email || '',
      firstName: userSession.firstName || '',
      lastName: userSession.lastName || '',
      phone: userSession.phone || '',
      salonId: salonIdStr || undefined, // UUID brut sans préfixe, ou undefined si absent
      userType: 'owner' as const
    };
    
    // S'assurer que req.user.id et req.user.salonId sont bien des strings normalisées
    req.user.id = String(req.user.id);
    if (req.user.salonId != null) {
      req.user.salonId = normalizeSalonId(String(req.user.salonId));
    }
    
    console.log('[AUTH OK]', {
      id: req.user.id,
      userType: req.user.userType,
      salonId: req.user.salonId
    });
  }
  next();
});

// ============================================
// MIDDLEWARE DE DEBUG POUR /api/auth/*
// ============================================
app.use('/api/auth', (req, res, next) => {
  console.log(`[DEBUG AUTH] ${req.method} ${req.path} - Original URL: ${req.originalUrl}`);
  if (req.path === '/verify-salon' && req.method === 'POST') {
    console.log('[DEBUG] 🔍 Requête POST /api/auth/verify-salon interceptée par middleware debug');
    console.log('[DEBUG] 🔍 Path:', req.path);
    console.log('[DEBUG] 🔍 Method:', req.method);
    console.log('[DEBUG] 🔍 Original URL:', req.originalUrl);
  }
  next();
});

// ============================================
// ROUTER SALONS (GET/PUT /api/salons/:salonId/hours)
// ============================================
// IMPORTANT: Ce router DOIT être monté AVANT publicRouter pour éviter les conflits
app.use('/api/salons', salonsRouter);
console.log('[SERVER] ✅ Router /api/salons monté à', new Date().toISOString());
console.log('[SERVER] ✅ Routes disponibles: GET /api/salons/:salonId/hours, PUT /api/salons/:salonId/hours');

// ============================================
// ROUTE GOOGLE REVIEWS (STUB)
// ============================================
// Route stub pour /api/reviews/google qui renvoie une liste vide
// Cette route sera implémentée plus tard avec l'intégration Google Reviews API
app.get('/api/reviews/google', (req, res) => {
  console.log('[GET /api/reviews/google] Route appelée (stub)');
  // Retourner une réponse vide pour éviter les 404
  res.json({
    reviews: [],
    averageRating: 0,
    totalReviews: 0,
  });
});

// 👉 Routes publiques (après les routes spécifiques)
app.use("/api/public", publicRouter);
console.log('[SERVER] ✅ Router /api/public monté à', new Date().toISOString());
console.log('[SERVER] ✅ Routes publiques disponibles: GET /api/public/salon, GET /api/public/salon/stylistes, GET /api/public/salon/appointments, GET /api/public/salon/closed-dates, GET /api/public/salon/stylist-hours, GET /api/public/salon/availability');

// Route directe pour /api/voice-agent (compatibilité avec le frontend)
// @ts-ignore - voiceTextRouter est un router Express exporté depuis un fichier JS
app.use("/api/voice-agent", voiceTextRouter);

// Route webhook Resend pour les événements email
app.use("/api/notifications/resend", resendWebhookRouter);
console.log('[SERVER] ✅ Router /api/notifications/resend monté');
console.log('[SERVER] ✅ Route webhook disponible: POST /api/notifications/resend/webhook');

// Route de développement : Simuler l'ouverture d'email (pour tester sans webhook)
(async () => {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const devSimulateRouter = await import('./routes/dev-simulate-email-opened.js');
      app.use("/api/dev", devSimulateRouter.default);
      console.log('[SERVER] ✅ Route dev disponible: POST /api/dev/simulate-email-opened');
    } catch (error: any) {
      console.warn('[SERVER] ⚠️  Impossible de charger la route dev simulate:', error.message);
    }
  }
})();
console.log('[SERVER] ✅ Route /api/voice-agent montée directement');


// Middleware de debug pour toutes les requêtes API vers /api/salons
app.use((req, res, next) => {
  if (req.path.startsWith('/api/salons')) {
    console.log('[DEBUG] 🔍 Requête vers /api/salons interceptée:', req.method, req.path, req.url);
    console.log('[DEBUG] 🔍 Original URL:', req.originalUrl);
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

log("Starting with Supabase authentication integration");

// Routes d'authentification pour les propriétaires de salon
app.get('/api/auth/user', async (req, res) => {
  // S'assurer que la réponse est toujours en JSON
  res.setHeader('Content-Type', 'application/json');
  
  try {
    // Vérifier que les variables d'environnement Supabase sont configurées
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('[GET /api/auth/user] ❌ Variables d\'environnement Supabase manquantes');
      return res.status(200).json({
        authenticated: false,
        user: null,
        userType: null,
      });
    }

    // Debug: vérifier la session
    const hasSession = !!req.session;
    const sessionId = req.sessionID;
    const userSession = req.session?.user;
    const clientSession = req.session?.client;
    
    console.log('[GET /api/auth/user] Vérification session:', {
      hasSession,
      sessionId,
      hasUserSession: !!userSession,
      hasClientSession: !!clientSession,
      cookies: req.headers.cookie ? 'présents' : 'absents'
    });
    
    if (!userSession && !clientSession) {
      console.log('[GET /api/auth/user] Aucune session détectée');
      // Retourner 200 avec authenticated: false au lieu de 401
      return res.status(200).json({ 
        authenticated: false,
        user: null,
        userType: null
      });
    }

    // Si c'est une session client
    if (clientSession) {
      try {
        console.log('[GET /api/auth/user] Session client détectée:', clientSession.clientId);
        // Récupérer les données client depuis Supabase
        const { data: client, error } = await supabaseAdmin
          .from('clients')
          .select('*')
          .eq('id', clientSession.clientId)
          .single();

        if (error || !client) {
          console.error('[GET /api/auth/user] Client non trouvé en base:', clientSession.clientId, error);
          return res.status(200).json({ 
            authenticated: false,
            user: null,
            userType: null
          });
        }

        console.log('[GET /api/auth/user] Client trouvé, retour des données');
        return res.json({
          authenticated: true,
          userType: 'client',
          user: {
            id: client.id,
            email: client.email,
            firstName: client.first_name,
            lastName: client.last_name,
            phone: client.phone
          },
          profile: {
            id: client.id,
            firstName: client.first_name,
            lastName: client.last_name,
            email: client.email,
            phone: client.phone,
            notes: client.notes,
            preferredStylistId: client.preferred_stylist_id,
            sex: client.sex || null
          }
        });
      } catch (clientError: any) {
        console.error('[GET /api/auth/user] Erreur lors de la récupération client:', clientError);
        return res.status(200).json({
          authenticated: false,
          user: null,
          userType: null,
        });
      }
    }

    // Si c'est une session propriétaire de salon
    if (userSession) {
      try {
        // Récupérer les données utilisateur depuis Supabase
        const { data: user, error } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', userSession.id)
          .single();

      if (error || !user) {
        console.log('Utilisateur non trouvé en base:', userSession.id);
        return res.status(200).json({ 
          authenticated: false,
          user: null,
          userType: null
        });
      }

      // Récupérer le salon de l'utilisateur pour obtenir le salonId
      let salonId = userSession.salonId;
      console.log('[GET /api/auth/user] salonId depuis session:', salonId);
      console.log('[GET /api/auth/user] userSession complète:', JSON.stringify(userSession, null, 2));
      
      if (!salonId) {
        // Si salonId n'est pas dans la session, le récupérer depuis la base
        console.log('[GET /api/auth/user] ⚠️ salonId manquant dans session, récupération depuis DB...');
        console.log('[GET /api/auth/user] Recherche salon pour userId:', userSession.id);
        
        // Chercher d'abord avec user_id
        const { data: salon, error: salonError } = await supabaseAdmin
          .from('salons')
          .select('id, name, user_id')
          .eq('user_id', userSession.id)
          .limit(1)
          .maybeSingle();
        
        if (salonError) {
          console.error('[GET /api/auth/user] ❌ Erreur récupération salon:', salonError);
          console.error('[GET /api/auth/user] Code erreur:', salonError.code);
          console.error('[GET /api/auth/user] Message erreur:', salonError.message);
        }
        
        if (salon) {
          salonId = salon.id;
          console.log('[GET /api/auth/user] ✅ Salon trouvé:', {
            id: salon.id,
            name: salon.name,
            user_id: salon.user_id
          });
        } else {
          // Si aucun salon n'est trouvé, chercher avec l'ID préfixé "salon-{userId}"
          const prefixedId = `salon-${userSession.id}`;
          console.log('[GET /api/auth/user] Aucun salon trouvé avec user_id, recherche avec ID préfixé:', prefixedId);
          
          const { data: salonByPrefixedId, error: prefixedError } = await supabaseAdmin
            .from('salons')
            .select('id, name, user_id')
            .eq('id', prefixedId)
            .limit(1)
            .maybeSingle();
          
          if (prefixedError) {
            console.error('[GET /api/auth/user] ❌ Erreur recherche salon préfixé:', prefixedError);
          }
          
          if (salonByPrefixedId) {
            salonId = salonByPrefixedId.id;
            console.log('[GET /api/auth/user] ✅ Salon trouvé avec ID préfixé:', {
              id: salonByPrefixedId.id,
              name: salonByPrefixedId.name,
              user_id: salonByPrefixedId.user_id
            });
          } else {
            console.warn('[GET /api/auth/user] ⚠️ Aucun salon trouvé pour userId:', userSession.id);
            // Debug: lister tous les salons pour comprendre
            const { data: allSalons } = await supabaseAdmin
              .from('salons')
              .select('id, name, user_id')
              .limit(10);
            console.warn('[GET /api/auth/user] Salons existants en base:', allSalons);
          }
        }
        
        // Mettre à jour la session avec le salonId trouvé (garder l'ID tel quel, pas de normalisation ici)
        if (salonId && req.session && req.session.user) {
          req.session.user = {
            ...req.session.user,
            salonId: salonId // Garder l'ID tel quel (avec ou sans préfixe)
          };
          console.log('[GET /api/auth/user] ✅ SalonId mis à jour dans la session:', salonId);
        } else if (!salonId) {
          console.error('[GET /api/auth/user] ❌ Impossible de mettre à jour la session: salonId manquant');
        }
      }
      
      // Normaliser salonId pour le frontend
      // Si le salonId est "salon-{userId}", utiliser l'UUID brut de l'utilisateur comme salonId
      // car la route PUT /api/salons/:salonId/hours attend un UUID brut (elle normalise déjà)
      let normalizedSalonId = salonId;
      
      if (salonId && typeof salonId === 'string') {
        // Si l'ID commence par "salon-" et se termine par l'userId, c'est un ID préfixé
        // Utiliser l'UUID brut de l'utilisateur comme salonId pour le frontend
        if (salonId.startsWith('salon-') && salonId.endsWith(userSession.id)) {
          normalizedSalonId = userSession.id; // Utiliser l'UUID brut de l'utilisateur
          console.log('[GET /api/auth/user] SalonId préfixé détecté, utilisation UUID brut:', salonId, '→', normalizedSalonId);
        } else if (salonId.startsWith('salon-')) {
          // Sinon, retirer juste le préfixe "salon-"
          normalizedSalonId = salonId.slice('salon-'.length);
          console.log('[GET /api/auth/user] Préfixe "salon-" retiré:', salonId, '→', normalizedSalonId);
        }
      }

      console.log('[GET /api/auth/user] ✅ Retour utilisateur avec salonId:', normalizedSalonId || 'null');
      console.log('[GET /api/auth/user] Type de salonId:', typeof normalizedSalonId);
      console.log('[GET /api/auth/user] Value finale salonId:', normalizedSalonId);

      // Helper de normalisation (identique)
      const normalizeSalonIdForAuth = (id: string | undefined | null): string => {
        if (!id) return '';
        const strId = String(id);
        return strId.startsWith('salon-') ? strId.slice(6) : strId;
      };
      
      // Construire l'objet user avec salonId (renvoyer null au lieu de undefined pour que ce soit sérialisé en JSON)
      // Forcer tous les IDs en string et normaliser
      const userIdStr = String(user.id || '');
      const salonIdNormalized = normalizedSalonId ? normalizeSalonIdForAuth(String(normalizedSalonId)) : null;
      
      const userResponse = {
        id: String(userIdStr),
        email: user.email || '',
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        phone: user.phone || '',
        salonId: salonIdNormalized ? String(salonIdNormalized) : null // UUID brut sans préfixe, ou null si absent
      };
      
      console.log('[GET /api/auth/user] 🔍 Objet user final:', JSON.stringify(userResponse, null, 2));
      console.log('[GET /api/auth/user] 🔍 salonId dans userResponse:', userResponse.salonId);

      return res.json({
        authenticated: true,
        userType: 'owner',
        user: {
          id: String(userResponse.id),
          email: userResponse.email,
          firstName: userResponse.firstName,
          lastName: userResponse.lastName,
          phone: userResponse.phone,
          userType: 'owner' as const,
          salonId: userResponse.salonId ? String(userResponse.salonId) : null
        },
        profile: {
          id: userIdStr,
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          email: user.email || '',
          phone: user.phone || ''
        }
      });
      } catch (userError: any) {
        console.error('[GET /api/auth/user] Erreur lors de la récupération utilisateur:', userError);
        return res.status(200).json({
          authenticated: false,
          user: null,
          userType: null,
        });
      }
    }

    // Si on arrive ici, c'est qu'il y a une session mais qu'on n'a pas pu la traiter
    return res.status(200).json({
      authenticated: false,
      user: null,
      userType: null,
    });
  } catch (error: any) {
    console.error("[GET /api/auth/user] Erreur inattendue:", error);
    console.error("[GET /api/auth/user] Stack:", error.stack);
    // Toujours renvoyer du JSON, même en cas d'erreur
    return res.status(200).json({ 
      authenticated: false,
      user: null,
      userType: null
    });
  }
});

app.put('/api/auth/user', express.json(), async (req, res) => {
  console.log('[PUT /api/auth/user] 📝 Mise à jour utilisateur');
  console.log('[PUT /api/auth/user] Body reçu:', JSON.stringify(req.body, null, 2));
  
  try {
    // Vérifier la session utilisateur
    const userSession = req.session?.user;
    
    console.log('[PUT /api/auth/user] Session utilisateur:', {
      hasSession: !!userSession,
      userId: userSession?.id,
      currentFirstName: userSession?.firstName
    });
    
    if (!userSession) {
      console.warn('[PUT /api/auth/user] ❌ Aucune session utilisateur');
      return res.status(401).json({ message: "Non authentifié" });
    }

    if (!userSession.id) {
      console.error('[PUT /api/auth/user] ❌ userSession.id manquant');
      return res.status(400).json({ message: "Session utilisateur invalide" });
    }

    // Préparer les champs à mettre à jour
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Mettre à jour seulement les champs fournis dans la requête
    if (req.body.firstName !== undefined) {
      updateData.first_name = String(req.body.firstName).trim();
      console.log('[PUT /api/auth/user] ✅ Prénom à mettre à jour:', updateData.first_name);
    }
    if (req.body.lastName !== undefined) {
      updateData.last_name = String(req.body.lastName).trim();
      console.log('[PUT /api/auth/user] ✅ Nom à mettre à jour:', updateData.last_name);
    }
    if (req.body.phone !== undefined) {
      updateData.phone = req.body.phone ? String(req.body.phone).trim() : null;
      console.log('[PUT /api/auth/user] ✅ Téléphone à mettre à jour:', updateData.phone);
    }

    if (Object.keys(updateData).length === 1) {
      // Seulement updated_at, aucun champ à mettre à jour
      console.warn('[PUT /api/auth/user] ⚠️ Aucun champ à mettre à jour');
      return res.status(400).json({ message: "Aucun champ à mettre à jour" });
    }

    console.log('[PUT /api/auth/user] 📤 Mise à jour Supabase:', {
      userId: userSession.id,
      updateData
    });

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userSession.id)
      .select()
      .single();

    if (error) {
      console.error('[PUT /api/auth/user] ❌ Erreur Supabase:', JSON.stringify(error, null, 2));
      throw new Error(`Erreur de mise à jour: ${error.message}`);
    }

    if (!data) {
      console.error('[PUT /api/auth/user] ❌ Aucune donnée retournée par Supabase');
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    console.log('[PUT /api/auth/user] ✅ Données mises à jour:', {
      id: data.id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email
    });

    // Mettre à jour la session après la mise à jour de l'utilisateur
    const updatedSessionUser = {
      id: data.id,
      email: data.email || userSession.email,
      firstName: data.first_name || userSession.firstName,
      lastName: data.last_name || userSession.lastName,
      phone: data.phone || userSession.phone,
      salonId: userSession.salonId // Préserver le salonId
    };

    req.session!.user = updatedSessionUser;

    // Sauvegarder explicitement la session
    await new Promise<void>((resolve, reject) => {
      req.session!.save((err) => {
        if (err) {
          console.error('[PUT /api/auth/user] ⚠️ Erreur sauvegarde session:', err);
          reject(err);
        } else {
          console.log('[PUT /api/auth/user] ✅ Session sauvegardée');
          resolve();
        }
      });
    });

    const responseData = {
      id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone
    };

    console.log('[PUT /api/auth/user] ✅ Réponse envoyée:', responseData);
    res.json(responseData);
  } catch (error: any) {
    console.error('[PUT /api/auth/user] ❌ Exception:', error);
    console.error('[PUT /api/auth/user] Stack:', error.stack);
    res.status(500).json({ 
      message: error.message || "Erreur de mise à jour",
      error: error.message 
    });
  }
});

// Route de refresh token pour gérer les 401
app.post('/api/auth/refresh', async (req, res) => {
  try {
    // Vérifier si une session existe
    if (!req.session || !req.session.user) {
      return res.status(401).json({ 
        error: 'Session non trouvée',
        authenticated: false 
      });
    }

    // Vérifier que la session est toujours valide en interrogeant Supabase
    const userSession = req.session.user;
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(userSession.id);

    if (userError || !user) {
      // Session invalide, détruire la session
      req.session.destroy(() => {});
      return res.status(401).json({ 
        error: 'Session invalide',
        authenticated: false 
      });
    }

    // Session valide, retourner succès
    res.json({ 
      success: true,
      authenticated: true,
      user: {
        id: userSession.id,
        email: userSession.email,
        firstName: userSession.firstName,
        lastName: userSession.lastName,
        salonId: userSession.salonId
      }
    });
  } catch (error: any) {
    console.error('[POST /api/auth/refresh] Erreur:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur lors du refresh token',
      authenticated: false 
    });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    // Détruire la session
    req.session?.destroy((err) => {
      if (err) {
        console.error("Erreur lors de la destruction de la session:", err);
        return res.status(500).json({ message: "Erreur lors de la déconnexion" });
      }
      
      res.json({ success: true });
    });
  } catch (error: any) {
    console.error("Erreur lors de la déconnexion:", error);
    res.status(500).json({ message: error.message || "Erreur de déconnexion" });
  }
});

// Endpoint de santé pour debug d'authentification
app.get('/api/health/auth', (req, res) => {
  const hasSession = !!req.session;
  const hasUserSession = !!req.session?.user;
  const hasClientSession = !!req.session?.client;
  const hasAuthHeader = !!req.headers.authorization;
  const cookies = req.headers.cookie || 'No cookies';
  
  res.json({
    timestamp: new Date().toISOString(),
    session: {
      id: req.sessionID,
      exists: hasSession,
      hasUser: hasUserSession,
      hasClient: hasClientSession
    },
    headers: {
      hasAuthHeader,
      cookies: cookies.substring(0, 100) + (cookies.length > 100 ? '...' : ''),
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...'
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT || 5001
    },
    // Diagnostic spécifique pour l'authentification
    auth: {
      hasCookie: !!req.headers.cookie,
      hasAuthHeader: !!req.headers.authorization,
      sessionCookie: req.headers.cookie?.includes('connect.sid') || false
    }
  });
});

// Routes d'authentification salon
app.post('/api/salon/register', express.json(), async (req, res) => {
  try {
    // Normaliser l'email en minuscules avant l'enregistrement
    if (req.body.email) {
      req.body.email = req.body.email.trim().toLowerCase();
      console.log('[salon/register] Email normalisé:', req.body.email);
    }
    const result = await SalonAuthService.registerOwner(req.body);
    res.json(result);
  } catch (error: any) {
    console.error("Error creating salon account:", error);
    res.status(500).json({ message: error.message || "Failed to create salon account" });
  }
});

app.post('/api/salon/login', express.json(), async (req, res) => {
  // S'assurer que la réponse est toujours en JSON
  res.setHeader('Content-Type', 'application/json');
  
  try {
    // Vérifier que les variables d'environnement Supabase sont configurées
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('[salon/login] ❌ Variables d\'environnement Supabase manquantes');
      return res.status(500).json({
        success: false,
        code: 'CONFIGURATION_ERROR',
        message: 'Configuration serveur incomplète. Veuillez contacter le support.',
      });
    }

    const { email, password } = req.body;
    
    // Validation des données d'entrée
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        code: 'MISSING_CREDENTIALS',
        message: 'Email et mot de passe requis',
      });
    }
    
    // Normaliser l'email en minuscules
    const normalizedEmail = email ? email.trim().toLowerCase() : email;
    console.log('🔍 Debug /api/salon/login - Attempting login for:', email, '→', normalizedEmail);
    
    // Appeler le service d'authentification
    let result;
    try {
      result = await SalonAuthService.loginOwner(normalizedEmail, password);
    } catch (authError: any) {
      // Gérer les erreurs d'authentification avec des codes spécifiques
      const errorMessage = authError.message || 'Erreur de connexion';
      
      if (errorMessage.includes('Email ou mot de passe incorrect')) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Email ou mot de passe incorrect.',
        });
      }
      
      if (errorMessage.includes('email n\'a pas été confirmé')) {
        return res.status(403).json({
          success: false,
          code: 'EMAIL_NOT_CONFIRMED',
          message: 'Votre email n\'a pas été confirmé. Vérifiez votre boîte mail.',
        });
      }
      
      // Autres erreurs d'authentification
      console.error('[salon/login] Erreur d\'authentification:', authError);
      return res.status(401).json({
        success: false,
        code: 'AUTH_ERROR',
        message: errorMessage,
      });
    }
    
    if (!result || !result.user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_ERROR',
        message: 'Erreur de connexion: Utilisateur non trouvé',
      });
    }
    
    // Récupérer le salonId depuis result.salon ou depuis la DB si absent
    let salonId = result.salon?.id;
    console.log('[salon/login] salonId depuis result.salon:', salonId);
    
    // Si salonId n'est pas dans result.salon, le récupérer depuis la DB
    if (!salonId && result.user?.id) {
      console.log('[salon/login] Récupération salon depuis DB pour userId:', result.user.id);
      try {
        const { data: salon, error: salonError } = await supabaseAdmin
          .from('salons')
          .select('id, name')
          .eq('user_id', result.user.id)
          .limit(1)
          .maybeSingle();
        
        if (salonError) {
          console.error('[salon/login] Erreur récupération salon:', salonError);
        } else if (salon) {
          salonId = salon.id;
          console.log('[salon/login] ✅ Salon trouvé en DB:', salon.name || salon.id);
        } else {
          console.warn('[salon/login] ⚠️ Aucun salon trouvé pour userId:', result.user.id);
        }
      } catch (error) {
        console.error('[salon/login] Erreur lors de la récupération salon:', error);
        // Ne pas échouer le login si on ne peut pas récupérer le salon
      }
    }
    
    // Normaliser salonId pour retirer le préfixe "salon-" si présent
    let normalizedSalonId = salonId;
    if (salonId && salonId.startsWith('salon-')) {
      normalizedSalonId = salonId.slice('salon-'.length);
      console.log('[salon/login] ⚠️ Préfixe "salon-" retiré:', salonId, '→', normalizedSalonId);
    }
    
    // Créer la session utilisateur avec le salonId normalisé
    if (!req.session) {
      console.error('[salon/login] ❌ Session non disponible');
      return res.status(500).json({
        success: false,
        code: 'SESSION_ERROR',
        message: 'Erreur de session. Veuillez réessayer.',
      });
    }
    
    req.session.user = {
      id: result.user.id,
      email: result.user.email || normalizedEmail,
      firstName: result.user.firstName || '',
      lastName: result.user.lastName || '',
      phone: result.user.phone,
      salonId: normalizedSalonId || undefined, // UUID brut sans préfixe
    };
    
    console.log('[salon/login] ✅ SalonId attaché à la session:', normalizedSalonId || 'undefined');
    
    // Sauvegarder explicitement la session AVANT de répondre
    try {
      await new Promise<void>((resolve, reject) => {
        req.session!.save((err) => {
          if (err) {
            console.error("[salon/login] Erreur lors de la sauvegarde de la session:", err);
            reject(err);
          } else {
            console.log("[salon/login] ✅ Session sauvegardée pour user:", result.user.id);
            console.log("[salon/login] Session ID:", req.sessionID);
            console.log("[salon/login] Cookie sera envoyé avec:", {
              secure: isHTTPS,
              sameSite: isHTTPS ? 'lax' : 'lax',
              httpOnly: true,
              maxAge: 24 * 60 * 60 * 1000,
            });
            resolve();
          }
        });
      });
    } catch (sessionError: any) {
      console.error('[salon/login] Erreur lors de la sauvegarde de la session:', sessionError);
      return res.status(500).json({
        success: false,
        code: 'SESSION_SAVE_ERROR',
        message: 'Erreur lors de la sauvegarde de la session. Veuillez réessayer.',
      });
    }
    
    console.log('✅ Debug /api/salon/login - Session created and saved:', req.sessionID);
    console.log('✅ Debug /api/salon/login - User session:', req.session?.user);
    console.log('✅ Debug /api/salon/login - Cookie config:', {
      secure: isHTTPS,
      sameSite: 'lax',
      httpOnly: true,
      isVercel,
      isProduction,
    });
    
    // La session Express devrait déjà avoir défini le cookie via le middleware session
    // Mais on vérifie que le cookie est bien dans les headers
    const setCookieHeader = res.getHeader('Set-Cookie');
    if (setCookieHeader) {
      console.log('✅ Debug /api/salon/login - Set-Cookie header présent:', Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader);
    } else {
      console.warn('⚠️ Debug /api/salon/login - Set-Cookie header absent!');
    }
    
    return res.json({
      success: true,
      user: result.user,
      salon: result.salon || null,
    });
  } catch (error: any) {
    // Catch toutes les erreurs non prévues
    console.error("❌ Error logging in salon owner (unexpected):", error);
    console.error("❌ Error stack:", error.stack);
    
    // S'assurer qu'on renvoie toujours du JSON même en cas d'erreur inattendue
    return res.status(500).json({ 
      success: false,
      code: 'SERVER_ERROR',
      message: 'Une erreur interne est survenue. Veuillez réessayer plus tard.',
    });
  }
});

// Changement de mot de passe pour les propriétaires de salon
app.post('/api/auth/change-password', express.json(), async (req, res) => {
  try {
    // Vérifier la session utilisateur
    const userSession = req.session?.user;
    
    if (!userSession) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Mot de passe actuel et nouveau mot de passe requis" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
    }

    // Vérifier le mot de passe actuel en tentant une connexion
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: userSession.email,
      password: currentPassword
    });

    if (authError || !authData.user) {
      return res.status(400).json({ message: "Mot de passe actuel incorrect" });
    }

    // Changer le mot de passe
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userSession.id,
      { password: newPassword }
    );

    if (updateError) {
      throw new Error(`Erreur lors du changement de mot de passe: ${updateError.message}`);
    }

    res.json({ success: true, message: "Mot de passe changé avec succès" });
  } catch (error: any) {
    console.error("Erreur changement mot de passe:", error);
    res.status(500).json({ message: error.message || "Erreur lors du changement de mot de passe" });
  }
});

// Changement de mot de passe pour les clients
app.post('/api/client/change-password', express.json(), async (req, res) => {
  try {
    // Vérifier la session client
    const clientSession = req.session?.client;
    
    if (!clientSession) {
      return res.status(401).json({ message: "Client non authentifié" });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Mot de passe actuel et nouveau mot de passe requis" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
    }

    // Pour les clients, nous devons vérifier le mot de passe actuel
    // et mettre à jour dans la table clients (puisque les clients n'utilisent pas Supabase Auth)
    
    // Récupérer le client depuis la base de données
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientSession.clientId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ message: "Client non trouvé" });
    }

    // Vérifier le mot de passe actuel (si vous avez un champ password dans la table clients)
    // Pour l'instant, nous allons simplement mettre à jour le mot de passe
    // Note: Dans une vraie application, vous devriez hasher les mots de passe
    
    // Hasher le nouveau mot de passe (utiliser la même fonction que clientAuth.ts)
    const crypto = require('crypto');
    const hashPassword = (password: string) => crypto.createHash('sha256').update(password).digest('hex');
    
    const { error: updateError } = await supabaseAdmin
      .from('clients')
      .update({ 
        password_hash: hashPassword(newPassword),
        updated_at: new Date().toISOString()
      })
      .eq('id', clientSession.clientId);

    if (updateError) {
      throw new Error(`Erreur lors du changement de mot de passe: ${updateError.message}`);
    }

    res.json({ success: true, message: "Mot de passe changé avec succès" });
  } catch (error: any) {
    console.error("Erreur changement mot de passe client:", error);
    res.status(500).json({ message: error.message || "Erreur lors du changement de mot de passe" });
  }
});

// Réinitialisation de mot de passe pour les propriétaires de salon
app.post('/api/auth/reset-password', express.json(), async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email et nouveau mot de passe requis" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
    }

    // Normaliser l'email en minuscules
    const normalizedEmail = email.trim().toLowerCase();
    console.log('[auth/reset-password] Email normalisé:', email, '→', normalizedEmail);

    // Vérifier que l'utilisateur existe dans Supabase Auth
    const { data: users, error: searchError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (searchError) {
      throw new Error(`Erreur lors de la recherche de l'utilisateur: ${searchError.message}`);
    }

    // Rechercher l'utilisateur avec email normalisé (insensible à la casse)
    const user = users.users.find(u => u.email && u.email.toLowerCase() === normalizedEmail);
    
    if (!user) {
      return res.status(404).json({ message: "Aucun compte trouvé avec cet email" });
    }

    // Changer le mot de passe
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      throw new Error(`Erreur lors de la réinitialisation du mot de passe: ${updateError.message}`);
    }

    res.json({ success: true, message: "Mot de passe réinitialisé avec succès" });
  } catch (error: any) {
    console.error("Erreur réinitialisation mot de passe:", error);
    res.status(500).json({ message: error.message || "Erreur lors de la réinitialisation du mot de passe" });
  }
});

    // Mock salon + services storage in-memory for preview mode
const previewSalon = { 
  id: 'preview-salon', 
  userId: 'dev-user', 
  name: 'Salon Preview',
  address: '',
  phone: '',
  email: ''
};
    let previewServices: any[] = [];
let previewStylists: any[] = [];
let previewClients: any[] = [];
let previewAppointments: any[] = [];

    // Fonction pour charger le salon depuis Supabase
    const loadSalonFromSupabase = async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/salons?select=*`, {
            headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
            }
          });
          const data = await response.json();
          if (data && data.length > 0) {
            Object.assign(previewSalon, data[0]);
          }
        } catch (error) {
          console.error('Erreur lors du chargement du salon depuis Supabase:', error);
        }
      }
    };

// Charger les données au démarrage
loadSalonFromSupabase();

// Routes salon
app.get('/api/salon', async (req, res) => {
  try {
    // Vérifier la session utilisateur
    const userSession = req.session?.user;
    
    if (!userSession) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    // Récupérer le salon de l'utilisateur depuis Supabase
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    
    console.log('🔍 Debug /api/salon - User Session:', userSession ? `Found: ${userSession.id}` : 'Not found');
    console.log('🔍 Debug /api/salon - SUPABASE_URL:', SUPABASE_URL ? 'Present' : 'Missing');
    console.log('🔍 Debug /api/salon - SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Present' : 'Missing');
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        console.log('🔍 Debug /api/salon - Fetching salon for user:', userSession.id);
        const response = await fetch(`${SUPABASE_URL}/rest/v1/salons?user_id=eq.${userSession.id}&select=*`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'resolution=merge-duplicates'
          }
        });
        const data = await response.json();
        console.log('🔍 Debug /api/salon - Supabase response:', data);
        if (data && data.length > 0) {
          return res.json(data[0]);
        }
      } catch (error) {
        console.error('Erreur lors du chargement du salon depuis Supabase:', error);
      }
    }

    // Si aucun salon n'est trouvé, retourner null au lieu du preview
    // Le frontend devra créer le salon via PUT /api/salon
    console.log('🔍 Debug /api/salon - Aucun salon trouvé pour cet utilisateur');
    return res.json(null);
  } catch (error: any) {
    console.error("Erreur récupération salon:", error);
    res.status(500).json({ message: "Erreur lors de la récupération du salon" });
  }
    });

    app.put('/api/salon', express.json(), async (req, res) => {
      try {
        const userSession = req.session?.user;
        
        if (!userSession) {
          return res.status(401).json({ message: "Non authentifié" });
        }

        const body = req.body || {};
        Object.assign(previewSalon, body);
        
        // Sauvegarder en base de données si Supabase est disponible
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          
          // Récupérer le salon de l'utilisateur
          const { data: salons, error: salonError } = await supabase
            .from('salons')
            .select('id')
            .eq('user_id', userSession.id)
            .limit(1)
            .single();

          if (!salonError && salons) {
            // Mettre à jour le salon existant
            const updateData: any = {
              name: body.name || previewSalon.name,
              address: body.address || previewSalon.address || '',
              phone: body.phone || previewSalon.phone || '',
              email: body.email || previewSalon.email || '',
              updated_at: new Date().toISOString()
            };
            
            // Ajouter theme_color si fourni
            if (body.theme_color !== undefined) {
              updateData.theme_color = body.theme_color;
            }
            
            const { data: updatedSalon, error: updateError } = await supabase
              .from('salons')
              .update(updateData)
              .eq('id', salons.id)
              .select()
              .single();

            if (updateError) {
              console.error('Erreur lors de la mise à jour du salon:', updateError);
              return res.status(500).json({ message: "Erreur lors de la mise à jour du salon" });
            } else {
              console.log('✅ Salon mis à jour avec succès, ID:', updatedSalon?.id);
              if (updatedSalon) {
                return res.json(updatedSalon);
              }
            }
          } else {
            // Créer un nouveau salon si n'existe pas
            // Utiliser le même format d'ID que lors de l'inscription : salon-{userId}
            const salonId = `salon-${userSession.id}`;
            const insertData: any = {
              id: salonId,
              user_id: userSession.id,
              name: body.name || previewSalon.name,
              address: body.address || previewSalon.address || '',
              phone: body.phone || previewSalon.phone || '',
              email: body.email || previewSalon.email || '',
            };
            
            // Ajouter theme_color si fourni
            if (body.theme_color !== undefined) {
              insertData.theme_color = body.theme_color;
            }
            
            const { data: newSalon, error: insertError } = await supabase
              .from('salons')
              .insert(insertData)
              .select()
              .single();

            if (insertError) {
              console.error('Erreur lors de la création du salon:', insertError);
              return res.status(500).json({ message: "Erreur lors de la création du salon" });
            }

            if (newSalon) {
              console.log('✅ Salon créé avec succès, ID:', newSalon.id);
              return res.json(newSalon);
            }
          }
        }
        
        // Si on arrive ici, on retourne le salon preview (fallback)
        res.json(previewSalon);
      } catch (error: any) {
        console.error('Erreur sauvegarde salon:', error);
        res.status(500).json({ message: error.message || "Erreur lors de la sauvegarde du salon" });
      }
    });


// Route pour récupérer les horaires d'ouverture (publique - utilisée par la landing page)
app.get('/api/salon/hours', async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ message: "Configuration Supabase manquante" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Essayer d'abord de récupérer le salon de l'utilisateur connecté s'il existe
    const userSession = req.session?.user;
    let salonId: string | null = null;
    let salonName: string | null = null;
    
    if (userSession) {
      // Récupérer le salon de l'utilisateur connecté
      const { data: userSalon, error: userSalonError } = await supabase
        .from('salons')
      .select('id, name')
            .eq('user_id', userSession.id)
            .limit(1)
            .maybeSingle();
          
      if (!userSalonError && userSalon) {
        salonId = userSalon.id;
        salonName = userSalon.name;
      }
    }
    
    // Si aucun salon trouvé pour l'utilisateur, récupérer le salon le plus récent
    if (!salonId) {
      const { data: latestSalon, error: latestSalonError } = await supabase
      .from('salons')
      .select('id, name')
        .order('created_at', { ascending: false })
      .limit(1)
        .maybeSingle();
      
      if (!latestSalonError && latestSalon) {
        salonId = latestSalon.id;
        salonName = latestSalon.name;
      }
    }
    
    if (!salonId) {
      return res.json({ hours: [], salon: null });
    }

    // Récupérer les horaires
    const { data: hours, error: hoursError } = await supabase
      .from('salon_hours')
      .select('day_of_week, open_time, close_time, is_closed')
      .eq('salon_id', salonId)
      .order('day_of_week', { ascending: true });

    if (hoursError) {
      console.error('Erreur récupération horaires:', hoursError);
      return res.json({ hours: [], salon: { id: salonId, name: salonName || 'Salon' } });
    }

    // Mapping inverse pour l'affichage
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    // Fonction pour formater l'heure (enlever les secondes si présentes)
    const formatTime = (time: string | null): string | null => {
      if (!time) return null;
      // Si le format est "HH:MM:SS", ne garder que "HH:MM"
      return time.substring(0, 5);
    };
    
    const formattedHours = (hours || []).map(h => ({
      dayOfWeek: h.day_of_week,
      dayName: dayNames[h.day_of_week] || `Jour ${h.day_of_week}`,
      openTime: formatTime(h.open_time),
      closeTime: formatTime(h.close_time),
      isClosed: h.is_closed
    }));

    res.json({ 
      hours: formattedHours, 
      salon: { id: salonId, name: salonName || 'Salon' } 
    });
  } catch (error: any) {
    console.error('Erreur récupération horaires:', error);
    res.status(500).json({ message: error.message || "Erreur lors de la récupération des horaires" });
  }
});

// Routes services
app.get('/api/services', async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data, error } = await supabase.from('services').select('*');
      if (error) throw error;
      res.json(data);
    } else {
      res.json(previewServices);
    }
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ message: 'Failed to fetch services' });
  }
});

// Route pour obtenir les services d'un salon spécifique (pour la page publique de réservation)
app.get('/api/salons/:salonId/services', async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Essayer avec l'ID normalisé, puis avec l'ID préfixé
      const rawSalonId = req.params.salonId;
      const normalizedId = rawSalonId.startsWith('salon-') ? rawSalonId.substring(6) : rawSalonId;
      const prefixedId = rawSalonId.startsWith('salon-') ? rawSalonId : `salon-${rawSalonId}`;
      
      // Chercher les services avec les deux formats d'ID
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .or(`salon_id.eq.${normalizedId},salon_id.eq.${prefixedId},salon_id.eq.${rawSalonId}`);
      
      if (error) {
        console.error('[GET /api/salons/:salonId/services] Erreur Supabase:', error);
        return res.status(500).json({ message: 'Failed to fetch services' });
      }
      
      // Normaliser les données pour le client
      const normalizedData = (data || []).map((service: any) => ({
        id: service.id,
        name: service.name,
        description: service.description || '',
        durationMinutes: service.duration || service.duration_minutes || 0,
        duration: service.duration || service.duration_minutes || 0,
        price: service.price || 0,
        tags: service.tags || [],
        salonId: service.salon_id
      }));
      
      console.log(`[GET /api/salons/:salonId/services] ✅ ${normalizedData.length} services trouvés pour salonId: ${rawSalonId}`);
      res.json(normalizedData);
    } else {
      res.json(previewServices);
    }
  } catch (error) {
    console.error('[GET /api/salons/:salonId/services] Erreur:', error);
    res.status(500).json({ message: 'Failed to fetch services' });
  }
});

app.post('/api/services', express.json(), async (req, res) => {
  const body = req.body || {};
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      const serviceData = {
        id: `service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        salon_id: body.salonId || previewSalon.id,
        name: body.name,
        description: body.description || '',
        price: Number(body.price || 0),
        duration: Number(body.duration || 0),
        buffer_before: Number(body.breakBefore || 0),
        buffer_after: Number(body.breakAfter || 0),
        requires_deposit: Boolean(body.depositRequired || false),
        tags: Array.isArray(body.tags) ? body.tags : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('services')
        .insert([serviceData])
        .select()
        .single();
      
      if (error) {
        console.error('Erreur lors de la création du service:', error);
        return res.status(500).json({ message: "Erreur lors de la création du service" });
      }
      
      // Mapper les données de retour vers le format attendu par le client
      const mappedData = {
        id: data.id,
        salonId: data.salon_id,
        name: data.name,
        description: data.description,
        price: data.price,
        duration: data.duration,
        breakBefore: data.buffer_before,
        breakAfter: data.buffer_after,
        depositRequired: data.requires_deposit,
        tags: data.tags || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      
      // Mettre à jour le cache mémoire
      previewServices.push(mappedData);
      
      return res.json(mappedData);
    }
  } catch (error) {
    console.error('Erreur lors de la création du service:', error);
    return res.status(500).json({ message: "Erreur interne du serveur" });
  }
  
  // Fallback mémoire si Supabase n'est pas configuré
  const newService = {
    id: Math.random().toString(36).slice(2),
    salonId: previewSalon.id,
    name: body.name,
    description: body.description ?? "",
    duration: Number(body.duration ?? 0),
    price: Number(body.price ?? 0),
    breakBefore: Number(body.breakBefore ?? 0),
    breakAfter: Number(body.breakAfter ?? 0),
    depositRequired: Boolean(body.depositRequired ?? false),
    tags: body.tags ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  previewServices.push(newService);
  res.json(newService);
});

app.put('/api/services/:id', express.json(), async (req, res) => {
  const serviceId = req.params.id;
  const body = req.body || {};
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Vérifier d'abord si le service existe
      const { data: existingService, error: fetchError } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();
      
      if (fetchError) {
        console.error('Erreur lors de la récupération du service:', fetchError);
        return res.status(404).json({ message: "Service not found" });
      }
      
      // Préparer les données de mise à jour
      const updateData = {
        name: body.name,
        description: body.description || '',
        price: Number(body.price || 0),
        duration: Number(body.duration || 0),
        buffer_before: Number(body.breakBefore || 0),
        buffer_after: Number(body.breakAfter || 0),
        requires_deposit: Boolean(body.depositRequired || false),
        tags: Array.isArray(body.tags) ? body.tags : [],
        updated_at: new Date().toISOString()
      };
      
      // Mettre à jour le service
      const { data, error: updateError } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', serviceId)
        .select()
        .single();
      
      if (updateError) {
        console.error('Erreur lors de la mise à jour du service:', updateError);
        return res.status(500).json({ message: "Erreur lors de la mise à jour" });
      }
      
      // Mapper les données de retour
      const mappedData = {
        id: data.id,
        salonId: data.salon_id,
        name: data.name,
        description: data.description,
        price: data.price,
        duration: data.duration,
        breakBefore: data.buffer_before,
        breakAfter: data.buffer_after,
        depositRequired: data.requires_deposit,
        tags: data.tags || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      
      // Mettre à jour le cache mémoire
      const serviceIndex = previewServices.findIndex(s => s.id === serviceId);
      if (serviceIndex >= 0) {
        previewServices[serviceIndex] = mappedData;
      }
      
      return res.json(mappedData);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du service:', error);
    return res.status(500).json({ message: "Erreur interne du serveur" });
  }
  
  // Fallback mémoire si Supabase n'est pas configuré
  const serviceIndex = previewServices.findIndex(s => s.id === serviceId);
  if (serviceIndex >= 0) {
    previewServices[serviceIndex] = { 
      ...previewServices[serviceIndex], 
      ...body, 
      updatedAt: new Date().toISOString() 
    };
    res.json(previewServices[serviceIndex]);
  } else {
    res.status(404).json({ message: "Service not found" });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  const serviceId = req.params.id;
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Supprimer le service dans Supabase
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);
      
      if (error) {
        console.error('Erreur lors de la suppression du service:', error);
        return res.status(500).json({ message: "Erreur lors de la suppression" });
      }
      
      // Mettre à jour le cache mémoire
      const serviceIndex = previewServices.findIndex(s => s.id === serviceId);
      if (serviceIndex >= 0) {
        previewServices.splice(serviceIndex, 1);
      }
      
      return res.json({ success: true });
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du service:', error);
    return res.status(500).json({ message: "Erreur lors de la suppression" });
  }
  
  // Fallback mémoire
  const serviceIndex = previewServices.findIndex(s => s.id === serviceId);
  if (serviceIndex >= 0) {
    previewServices.splice(serviceIndex, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ message: "Service not found" });
  }
});

// Routes stylists
app.get('/api/stylists', async (_req, res) => {
      try {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
          const resp = await fetch(`${SUPABASE_URL}/rest/v1/stylistes?salon_id=eq.${previewSalon.id}&select=*`, {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
        }
          });
          const data = await resp.json();
      if (data && Array.isArray(data)) {
        previewStylists = data.map(stylist => ({
          id: stylist.id,
          salonId: stylist.salon_id,
          firstName: stylist.first_name,
          lastName: stylist.last_name,
          email: stylist.email,
          phone: stylist.phone,
          specialties: stylist.specialties || [],
          isActive: stylist.is_active !== false,
          createdAt: stylist.created_at,
          updatedAt: stylist.updated_at
        }));
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des stylistes:', error);
      }
      res.json(previewStylists);
    });

app.post('/api/stylists', express.json(), async (req, res) => {
  const body = req.body || {};
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      const stylistData = {
        id: `stylist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        salon_id: previewSalon.id,
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email || '',
        phone: body.phone || '',
        photo_url: body.photoUrl || '',
        specialties: body.specialties || [],
        is_active: body.isActive ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('stylistes')
        .insert([stylistData])
        .select()
        .single();
      
      if (error) {
        console.error('Erreur lors de la création du styliste:', error);
        return res.status(500).json({ message: "Erreur lors de la création du styliste" });
      }
      
      // Mapper les données de retour vers le format attendu par le client
      const mappedData = {
        id: data.id,
        salonId: data.salon_id,
        firstName: data.first_name,
        lastName: data.last_name,
        name: `${data.first_name} ${data.last_name}`,
        email: data.email,
        phone: data.phone,
        photoUrl: data.photo_url,
        specialties: data.specialties || [],
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      
      // Mettre à jour le cache mémoire
      previewStylists.push(mappedData);
      
      return res.json(mappedData);
    }
  } catch (error) {
    console.error('Erreur lors de la création du styliste:', error);
    return res.status(500).json({ message: "Erreur interne du serveur" });
  }
  
  // Fallback mémoire si Supabase n'est pas configuré
  const newStylist = {
    id: Math.random().toString(36).slice(2),
    salonId: previewSalon.id,
    firstName: body.firstName,
    lastName: body.lastName,
    name: `${body.firstName} ${body.lastName}`,
    email: body.email || '',
    phone: body.phone || '',
    photoUrl: body.photoUrl || '',
    specialties: body.specialties || [],
    isActive: body.isActive ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  previewStylists.push(newStylist);
  res.json(newStylist);
});

app.put('/api/stylists/:id', express.json(), async (req, res) => {
  const stylistId = req.params.id;
  const body = req.body || {};
  
  console.log(`[PUT /api/stylists/:id] Requête reçue: stylistId=${stylistId}, body=`, JSON.stringify(body, null, 2));
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Préparer les données de mise à jour
      const updateData: any = {
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email || '',
        phone: body.phone || '',
        photo_url: body.photoUrl || '',
        specialties: body.specialties || [],
        is_active: body.isActive ?? true,
        updated_at: new Date().toISOString()
      };
      
      // Ajouter la couleur si fournie (même si c'est une chaîne vide, on la sauvegarde)
      if (body.color !== undefined && body.color !== null) {
        updateData.color = body.color || null; // Permettre les chaînes vides
        console.log(`[PUT /api/stylists/:id] ✅ Couleur à mettre à jour: ${body.color}`);
      } else {
        console.log(`[PUT /api/stylists/:id] ⚠️ Couleur non fournie dans body.color`);
      }
      
      console.log(`[PUT /api/stylists/:id] 📝 Données de mise à jour:`, JSON.stringify(updateData, null, 2));
      
      // Mettre à jour le styliste
      const { data, error: updateError } = await supabase
        .from('stylistes')
        .update(updateData)
        .eq('id', stylistId)
        .select()
        .single();
      
      if (updateError) {
        console.error('[PUT /api/stylists/:id] ❌ Erreur lors de la mise à jour du styliste:', updateError);
        return res.status(500).json({ message: "Erreur lors de la mise à jour", details: updateError.message });
      }
      
      console.log(`[PUT /api/stylists/:id] ✅ Données mises à jour depuis Supabase:`, JSON.stringify(data, null, 2));
      
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
      
      console.log(`[PUT /api/stylists/:id] ✅ Données mappées retournées:`, JSON.stringify(mappedData, null, 2));
      
      // Mettre à jour le cache mémoire
      const stylistIndex = previewStylists.findIndex(s => s.id === stylistId);
      if (stylistIndex >= 0) {
        previewStylists[stylistIndex] = mappedData;
      }
      
      return res.json(mappedData);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du styliste:', error);
    return res.status(500).json({ message: "Erreur interne du serveur" });
  }
  
  // Fallback mémoire
  const stylistIndex = previewStylists.findIndex(s => s.id === stylistId);
  if (stylistIndex >= 0) {
    previewStylists[stylistIndex] = { 
      ...previewStylists[stylistIndex], 
      ...body, 
      updatedAt: new Date().toISOString() 
    };
    res.json(previewStylists[stylistIndex]);
  } else {
    res.status(404).json({ message: "Stylist not found" });
  }
});

app.delete('/api/stylists/:id', async (req, res) => {
  const stylistId = req.params.id;
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Vérifier d'abord si le styliste existe
      const { data: stylist, error: fetchError } = await supabase
        .from('stylistes')
        .select('*')
        .eq('id', stylistId)
        .single();
      
      if (fetchError) {
        console.error('Erreur lors de la récupération du styliste:', fetchError);
        return res.status(404).json({ message: "Stylist not found" });
      }
      
      // Supprimer le styliste
      const { error: deleteError } = await supabase
        .from('stylistes')
        .delete()
        .eq('id', stylistId);
      
      if (deleteError) {
        console.error('Erreur lors de la suppression du styliste:', deleteError);
        return res.status(500).json({ message: "Erreur lors de la suppression" });
      }
      
      // Mettre à jour le cache mémoire
      const stylistIndex = previewStylists.findIndex(s => s.id === stylistId);
      if (stylistIndex >= 0) {
        previewStylists.splice(stylistIndex, 1);
      }
      
      return res.json({ success: true, message: "Stylist deleted successfully" });
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du styliste:', error);
    return res.status(500).json({ message: "Erreur interne du serveur" });
  }
  
  // Fallback mémoire si Supabase n'est pas configuré
  const stylistIndex = previewStylists.findIndex(s => s.id === stylistId);
  if (stylistIndex >= 0) {
    previewStylists.splice(stylistIndex, 1);
    return res.json({ success: true, message: "Stylist deleted from memory" });
  } else {
    return res.status(404).json({ message: "Stylist not found" });
  }
});

// Route générale pour les stylistes (fallback)
app.get('/api/stylistes', async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data, error } = await supabase.from('stylistes').select('*');
      if (error) throw error;
      
      // Mapper les données de Supabase vers le format attendu par le client
      const mappedData = data.map(stylist => ({
        id: stylist.id,
        salonId: stylist.salon_id,
        firstName: stylist.first_name,
        lastName: stylist.last_name,
        name: `${stylist.first_name} ${stylist.last_name}`,
        email: stylist.email,
        phone: stylist.phone,
        photoUrl: stylist.photo_url,
        specialties: stylist.specialties,
        isActive: stylist.is_active,
        color: stylist.color || null, // Inclure la couleur
        createdAt: stylist.created_at,
        updatedAt: stylist.updated_at
      }));
      
      res.json(mappedData);
    } else {
      res.json(previewStylists);
    }
  } catch (error) {
    console.error('Error fetching stylists:', error);
    res.status(500).json({ message: 'Failed to fetch stylists' });
  }
});

// Routes avec salonId pour la compatibilité avec l'interface
// NOTE: La route PUT /api/salons/:salonId/stylistes/:stylistId est définie dans server/routes/salons.ts
app.get('/api/salons/:salonId/stylistes', async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Normaliser le salonId (retirer le préfixe "salon-" si présent)
      const normalizeSalonId = (id: string): string => {
        if (!id) return '';
        return id.startsWith('salon-') ? id.substring(6) : id;
      };
      
      const rawSalonId = req.params.salonId;
      const normalizedSalonId = normalizeSalonId(rawSalonId);
      
      console.log(`[GET /api/salons/:salonId/stylistes] salonId: ${rawSalonId} → normalized: ${normalizedSalonId}`);
      
      // Vérifier si l'utilisateur est un owner/manager
      const isOwner = req.user?.userType === 'owner';
      
      // Construire la requête - essayer avec les deux formats d'ID
      const salonIdsToTry = [normalizedSalonId, rawSalonId, `salon-${normalizedSalonId}`];
      let query = supabase
        .from('stylistes')
        .select('*')
        .in('salon_id', salonIdsToTry);
      
      // Si ce n'est pas un owner (client ou non authentifié), filtrer uniquement les stylistes actifs
      if (!isOwner) {
        query = query.eq('is_active', true);
        console.log('[STYLISTES API] Filtrage des stylistes actifs pour client/public');
      } else {
        console.log('[STYLISTES API] Affichage de tous les stylistes pour owner');
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('[STYLISTES API] Erreur Supabase:', error);
        throw error;
      }
      
      console.log(`[STYLISTES API] Données brutes reçues de Supabase:`, JSON.stringify(data?.slice(0, 1), null, 2));
      
      // Mapper les données de Supabase vers le format attendu par le client
      const mappedData = data.map(stylist => {
        const mapped = {
          id: stylist.id,
          salonId: stylist.salon_id,
          firstName: stylist.first_name,
          lastName: stylist.last_name,
          name: `${stylist.first_name} ${stylist.last_name}`,
          email: stylist.email,
          phone: stylist.phone,
          photoUrl: stylist.photo_url,
          specialties: stylist.specialties,
          isActive: stylist.is_active,
          color: stylist.color || null, // S'assurer que color est inclus même si null
          createdAt: stylist.created_at,
          updatedAt: stylist.updated_at
        };
        return mapped;
      });
      
      console.log(`[STYLISTES API] Retour de ${mappedData.length} styliste(s) pour salon ${req.params.salonId} (${isOwner ? 'owner' : 'client/public'})`);
      console.log(`[STYLISTES API] Exemple de données mappées:`, JSON.stringify(mappedData[0], null, 2));
      
      res.json(mappedData);
    } else {
      // En mode preview, filtrer les stylistes inactifs si ce n'est pas un owner
      const isOwner = req.user?.userType === 'owner';
      const filteredStylists = isOwner 
        ? previewStylists 
        : previewStylists.filter((s: any) => s.isActive !== false);
      
      console.log(`[STYLISTES API] Mode preview: retour de ${filteredStylists.length} styliste(s) (${isOwner ? 'owner' : 'client/public'})`);
      
      res.json(filteredStylists);
    }
  } catch (error) {
    console.error('Error fetching stylists:', error);
    res.status(500).json({ message: 'Failed to fetch stylists' });
  }
});

// Route pour rechercher la disponibilité parmi tous les stylistes d'un salon
app.get('/api/salons/:salonId/availability', async (req, res) => {
  try {
    const { salonId } = req.params;
    const { date, duration } = req.query;

    if (!date || !duration) {
      return res.status(400).json({ message: "date et duration sont requis" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ message: "Configuration Supabase manquante" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Récupérer tous les stylistes actifs du salon
    const { data: stylists, error: stylistsError } = await supabase
      .from('stylistes')
      .select('id, first_name, last_name')
      .eq('salon_id', salonId)
      .eq('is_active', true);

    if (stylistsError || !stylists || stylists.length === 0) {
      return res.json([]);
    }

    // Date de recherche
    const searchDate = new Date(date as string);
    const serviceDuration = parseInt(duration as string, 10);
    const startOfDay = new Date(searchDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(searchDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Récupérer tous les rendez-vous du jour pour tous les stylistes
    const stylistIds = stylists.map(s => s.id);
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('stylist_id, appointment_date, duration')
      .in('stylist_id', stylistIds)
      .gte('appointment_date', startOfDay.toISOString())
      .lte('appointment_date', endOfDay.toISOString())
      .eq('status', 'confirmed');

    if (appointmentsError) {
      console.error('Erreur récupération rendez-vous:', appointmentsError);
    }

    // Horaires d'ouverture par défaut (9h-18h)
    const defaultStartHour = 9;
    const defaultEndHour = 18;
    const slotDuration = 15; // Durée d'un créneau en minutes (quart d'heure)
    const allSlots: Array<{ startTime: string; stylistId: string }> = [];

    // Générer les créneaux pour chaque styliste
    for (const stylist of stylists) {
      // Filtrer les rendez-vous de ce styliste
      const stylistAppointments = (appointments || []).filter(apt => apt.stylist_id === stylist.id);
      
      // Générer tous les créneaux possibles de la journée
      for (let hour = defaultStartHour; hour < defaultEndHour; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const slotStart = new Date(searchDate);
          slotStart.setHours(hour, minute, 0, 0);
          
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration);

          // Vérifier si le créneau chevauche avec un rendez-vous existant
          const isAvailable = !stylistAppointments.some(apt => {
            const aptStart = new Date(apt.appointment_date);
            const aptEnd = new Date(aptStart);
            aptEnd.setMinutes(aptEnd.getMinutes() + (apt.duration || 30));
            
            return (slotStart < aptEnd && slotEnd > aptStart);
          });

          // Vérifier que le créneau est dans le futur
          if (isAvailable && slotStart > new Date()) {
            allSlots.push({
              startTime: slotStart.toISOString(),
              stylistId: stylist.id
            });
          }
        }
      }
    }

    // Trier par date/heure (le plus proche en premier)
    allSlots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    res.json(allSlots);
  } catch (error: any) {
    console.error('Erreur recherche disponibilité salon:', error);
    res.status(500).json({ message: "Erreur lors de la recherche de disponibilité" });
  }
});

// Route pour rechercher la disponibilité d'un styliste spécifique
app.get('/api/salons/:salonId/stylistes/:stylistId/availability', async (req, res) => {
  try {
    const { stylistId } = req.params;
    const { date, duration } = req.query;

    if (!date || !duration) {
      return res.status(400).json({ message: "date et duration sont requis" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ message: "Configuration Supabase manquante" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Date de recherche
    const searchDate = new Date(date as string);
    const serviceDuration = parseInt(duration as string, 10);
    const startOfDay = new Date(searchDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(searchDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Récupérer les rendez-vous du jour pour ce styliste
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('appointment_date, duration')
      .eq('stylist_id', stylistId)
      .gte('appointment_date', startOfDay.toISOString())
      .lte('appointment_date', endOfDay.toISOString())
      .eq('status', 'confirmed');

    if (appointmentsError) {
      console.error('Erreur récupération rendez-vous:', appointmentsError);
    }

    // Horaires d'ouverture par défaut (9h-18h)
    const defaultStartHour = 9;
    const defaultEndHour = 18;
    const slotDuration = 15; // Durée d'un créneau en minutes (quart d'heure)
    const availableSlots: string[] = [];

    // Générer tous les créneaux possibles de la journée
    for (let hour = defaultStartHour; hour < defaultEndHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const slotStart = new Date(searchDate);
        slotStart.setHours(hour, minute, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration);

        // Vérifier si le créneau chevauche avec un rendez-vous existant
        const isAvailable = !(appointments || []).some((apt: any) => {
          const aptStart = new Date(apt.appointment_date);
          const aptEnd = new Date(aptStart);
          aptEnd.setMinutes(aptEnd.getMinutes() + (apt.duration || 30));
          
          return (slotStart < aptEnd && slotEnd > aptStart);
        });

        // Vérifier que le créneau est dans le futur
        if (isAvailable && slotStart > new Date()) {
          availableSlots.push(slotStart.toISOString());
        }
      }
    }

    res.json(availableSlots);
  } catch (error: any) {
    console.error('Erreur recherche disponibilité styliste:', error);
    res.status(500).json({ message: "Erreur lors de la recherche de disponibilité" });
  }
});

app.post('/api/salons/:salonId/stylistes', express.json(), async (req, res) => {
  const body = req.body || {};
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const row = {
        id: `stylist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        salon_id: req.params.salonId,
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email || '',
        phone: body.phone || '',
        photo_url: body.photoUrl || '',
        specialties: body.specialties || [],
        is_active: body.isActive ?? true,
        color: body.color || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data, error } = await supabase.from('stylistes').insert([row]).select().single();
      if (error) throw error;
      
      // Mapper les données de retour vers le format attendu par le client
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
        color: data.color,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      
      res.json(mappedData);
    } else {
      const newStylist = {
        id: `stylist-${previewStylists.length + 1}`,
        salonId: req.params.salonId,
        firstName: body.firstName,
        lastName: body.lastName,
        name: `${body.firstName} ${body.lastName}`,
        email: body.email || '',
        phone: body.phone || '',
        photoUrl: body.photoUrl || '',
        specialties: body.specialties || [],
        isActive: body.isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      previewStylists.push(newStylist);
      res.json(newStylist);
    }
  } catch (error) {
    console.error('Error adding stylist:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ 
      message: 'Failed to add stylist',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
  }
});

// Routes clients
app.get('/api/clients', async (req, res) => {
      try {
        // Récupérer le salonId depuis l'utilisateur connecté
        const user = req.user;
        const salonId = user?.salonId || req.session?.user?.salonId;
        
        console.log('[GET /api/clients] Utilisateur:', user ? 'authentifié' : 'non authentifié');
        console.log('[GET /api/clients] salonId depuis req.user:', user?.salonId);
        console.log('[GET /api/clients] salonId depuis session:', req.session?.user?.salonId);
        console.log('[GET /api/clients] salonId final utilisé:', salonId);
        
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
        if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          
          // Récupérer le salon_id de l'utilisateur connecté depuis la table salons
          let targetSalonId = salonId;
          
          console.log('[GET /api/clients] Récupération du salon depuis la base de données...');
          try {
            // Récupérer le salon de l'utilisateur connecté via user_id
            const userSession = req.session?.user;
            if (userSession?.id) {
              const { data: salonRecord, error: salonError } = await supabase
                .from('salons')
                .select('id')
                .eq('user_id', userSession.id)
                .limit(1)
                .maybeSingle();
              
              if (salonError) {
                console.error('[GET /api/clients] Erreur récupération salon:', salonError);
              } else if (salonRecord) {
                targetSalonId = salonRecord.id;
                console.log('[GET /api/clients] ✅ Salon ID récupéré depuis la DB pour user_id:', userSession.id, '→', targetSalonId);
              } else {
                console.warn('[GET /api/clients] ⚠️ Aucun salon trouvé dans la DB pour user_id:', userSession.id);
                // Fallback: utiliser le salonId de la session si disponible
                if (salonId) {
                  targetSalonId = salonId;
                  console.log('[GET /api/clients] Utilisation du salonId de la session:', targetSalonId);
                }
              }
            } else {
              console.warn('[GET /api/clients] ⚠️ Aucun userSession.id disponible');
              if (salonId) {
                targetSalonId = salonId;
                console.log('[GET /api/clients] Utilisation du salonId de la session:', targetSalonId);
              }
            }
          } catch (salonError) {
            console.error('[GET /api/clients] Erreur récupération salon:', salonError);
            if (salonId) {
              targetSalonId = salonId;
            }
          }
          
          console.log('[GET /api/clients] Salon ID final utilisé pour la requête:', targetSalonId);
          
          // Vérifier que targetSalonId est défini
          if (!targetSalonId) {
            return res.status(400).json({ error: 'Salon ID non trouvé. Veuillez vous connecter.' });
          }
          
          // Normaliser le salonId pour essayer plusieurs formats
          const normalizeSalonId = (id: string): string => {
            if (!id) return '';
            return id.startsWith('salon-') ? id.substring(6) : id;
          };
          
          const normalizedSalonId = normalizeSalonId(targetSalonId);
          const salonIdsToTry = [targetSalonId, normalizedSalonId, `salon-${normalizedSalonId}`];
          
          // Utiliser le client Supabase pour récupérer les clients
          let clients: any[] = [];
          let clientsError: any = null;
          
          for (const testSalonId of salonIdsToTry) {
            const { data: clientsData, error: error } = await supabase
              .from('clients')
              .select('id, salon_id, first_name, last_name, email, phone, notes, owner_notes, preferred_stylist_id, created_at, updated_at')
              .eq('salon_id', testSalonId);
            
            if (error) {
              console.error(`[GET /api/clients] Erreur avec salon_id ${testSalonId}:`, error);
              clientsError = error;
              continue;
            }
            
            if (clientsData && clientsData.length > 0) {
              clients = clientsData;
              console.log(`[GET /api/clients] ✅ ${clients.length} clients trouvés avec salon_id: ${testSalonId}`);
              break;
            }
          }
          
          if (clientsError && clients.length === 0) {
            console.error('[GET /api/clients] Erreur récupération clients:', clientsError);
            return res.status(500).json({ error: 'Erreur lors de la récupération des clients' });
          }
          
          // Mapper les données pour correspondre au format attendu par le client
          const mappedClients = clients.map((client: any) => ({
            id: client.id,
            salonId: client.salon_id,
            firstName: client.first_name,
            lastName: client.last_name,
            email: client.email,
            phone: client.phone,
            notes: client.notes,
            ownerNotes: client.owner_notes,
            preferredStylistId: client.preferred_stylist_id,
            createdAt: client.created_at,
            updatedAt: client.updated_at,
          }));
          
          console.log(`[GET /api/clients] ✅ Retour de ${mappedClients.length} client(s)`);
          return res.json(mappedClients);
        } else {
          console.warn('[GET /api/clients] ⚠️ Configuration Supabase manquante');
          return res.json(previewClients);
        }
      } catch (error) {
        console.error('[GET /api/clients] ❌ Erreur lors du chargement des clients:', error);
        return res.status(500).json({ error: 'Erreur lors du chargement des clients' });
      }
    });

app.post('/api/clients', express.json(), async (req, res) => {
  const body = req.body || {};
  
  // Variables d'environnement déclarées au début
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Vérifier si le client existe déjà par email
      if (body.email) {
        const { data: existingClients, error: checkError } = await supabase
          .from('clients')
          .select('id, salon_id, first_name, last_name, email, phone, notes, preferred_stylist_id, created_at, updated_at')
          .ilike('email', body.email.toLowerCase().trim())
          .limit(1);
        
        if (checkError) {
          console.error('Erreur lors de la vérification du client existant:', checkError);
        } else if (existingClients && existingClients.length > 0) {
          // Client existe déjà, le retourner
          const existingClient = existingClients[0];
          const mappedData = {
            id: existingClient.id,
            salonId: existingClient.salon_id,
            firstName: existingClient.first_name,
            lastName: existingClient.last_name,
            email: existingClient.email,
            phone: existingClient.phone || body.phone || '',
            notes: existingClient.notes,
            ownerNotes: null, // Colonne peut ne pas exister
            preferredStylistId: existingClient.preferred_stylist_id,
            createdAt: existingClient.created_at,
            updatedAt: existingClient.updated_at
          };
          
          // Mettre à jour les informations si nécessaire
          const updateData: any = {
            updated_at: new Date().toISOString()
          };
          
          if (body.phone && !existingClient.phone) {
            updateData.phone = body.phone;
          }
          if (body.firstName && existingClient.first_name !== body.firstName) {
            updateData.first_name = body.firstName;
          }
          if (body.lastName && existingClient.last_name !== body.lastName) {
            updateData.last_name = body.lastName;
          }
          
          if (Object.keys(updateData).length > 1) {
            await supabase
              .from('clients')
              .update(updateData)
              .eq('id', existingClient.id);
          }
          
          return res.json(mappedData);
        }
      }
      
      // Tenter d'ajouter la colonne owner_notes si elle n'existe pas (via RPC)
      try {
        const { error: addColumnError } = await supabase.rpc('add_owner_notes_column');
        if (!addColumnError) {
          console.log('[POST /api/clients] ✅ Colonne owner_notes ajoutée via RPC');
          // Attendre un peu pour que PostgREST mette à jour son cache
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.warn('[POST /api/clients] ⚠️ Fonction RPC add_owner_notes_column non disponible:', addColumnError.message);
        }
      } catch (rpcError: any) {
        console.warn('[POST /api/clients] ⚠️ Erreur lors de l\'appel RPC add_owner_notes_column:', rpcError.message);
      }
      
      // Créer un nouveau client (sans owner_notes car la colonne peut ne pas exister)
      const clientData: any = {
        id: `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        salon_id: body.salonId || previewSalon.id,
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email ? body.email.toLowerCase().trim() : '',
        phone: body.phone || '',
        preferred_stylist_id: body.preferredStylistId || null,
        notes: body.notes || null, // Notes internes (JSON pour sex, etc.)
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Variables d'environnement pour les différentes méthodes
      const DATABASE_URL = process.env.DATABASE_URL;
      
      // Méthode 1: Essayer avec une connexion directe à Postgres si disponible (contourne PostgREST)
      if (DATABASE_URL) {
        try {
          const { Client } = await import('pg');
          const pgClient = new Client({ 
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false } // Pour les certificats auto-signés Supabase
          });
          await pgClient.connect();
          
          // Vérifier si la colonne owner_notes existe, sinon l'ajouter
          try {
            const checkColumnQuery = `
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = 'clients' AND column_name = 'owner_notes';
            `;
            const columnCheck = await pgClient.query(checkColumnQuery);
            
            if (columnCheck.rows.length === 0) {
              console.log('[POST /api/clients] ⚠️ Colonne owner_notes manquante, tentative d\'ajout automatique...');
              const addColumnQuery = `
                ALTER TABLE "clients"
                ADD COLUMN IF NOT EXISTS "owner_notes" text;
                COMMENT ON COLUMN "clients"."owner_notes" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';
              `;
              await pgClient.query(addColumnQuery);
              console.log('[POST /api/clients] ✅ Colonne owner_notes ajoutée automatiquement');
              
              // Attendre un peu pour que PostgREST mette à jour son cache de schéma
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (columnError: any) {
            console.warn('[POST /api/clients] ⚠️ Impossible de vérifier/ajouter la colonne owner_notes:', columnError.message);
            // Continuer quand même avec l'insertion
          }
          
          const insertQuery = `
            INSERT INTO clients (id, salon_id, first_name, last_name, email, phone, notes, preferred_stylist_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, salon_id, first_name, last_name, email, phone, notes, preferred_stylist_id, created_at, updated_at
          `;
          
          const result = await pgClient.query(insertQuery, [
            clientData.id,
            clientData.salon_id,
            clientData.first_name,
            clientData.last_name,
            clientData.email,
            clientData.phone,
            clientData.notes,
            clientData.preferred_stylist_id,
            clientData.created_at,
            clientData.updated_at
          ]);
          
          await pgClient.end();
          
          if (result.rows && result.rows.length > 0) {
            const insertedClient = result.rows[0];
            const mappedData = {
              id: insertedClient.id,
              salonId: insertedClient.salon_id,
              firstName: insertedClient.first_name,
              lastName: insertedClient.last_name,
              email: insertedClient.email,
              phone: insertedClient.phone || '',
              notes: insertedClient.notes,
              ownerNotes: null,
              preferredStylistId: insertedClient.preferred_stylist_id,
              createdAt: insertedClient.created_at,
              updatedAt: insertedClient.updated_at
            };
            previewClients.push(mappedData);
            console.log('[POST /api/clients] ✅ Client créé via connexion Postgres directe');
            return res.json(mappedData);
          }
        } catch (pgError: any) {
          console.warn('[POST /api/clients] Erreur avec connexion Postgres directe, essai méthode REST:', pgError.message);
          // Continuer avec la méthode REST
        }
      }
      
      // Méthode 2: Utiliser une fonction RPC pour insérer le client (contourne PostgREST)
      if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        try {
          // Essayer d'utiliser la fonction RPC insert_client_without_owner_notes si elle existe
          const { data: rpcData, error: rpcError } = await supabase.rpc('insert_client_without_owner_notes', {
            p_id: clientData.id,
            p_salon_id: clientData.salon_id,
            p_first_name: clientData.first_name,
            p_last_name: clientData.last_name,
            p_email: clientData.email,
            p_phone: clientData.phone,
            p_notes: clientData.notes,
            p_preferred_stylist_id: clientData.preferred_stylist_id,
            p_created_at: clientData.created_at,
            p_updated_at: clientData.updated_at
          });
          
          if (!rpcError && rpcData) {
            console.log('[POST /api/clients] ✅ Client créé via RPC insert_client_without_owner_notes');
            const mappedData = {
              id: rpcData.id,
              salonId: rpcData.salon_id,
              firstName: rpcData.first_name,
              lastName: rpcData.last_name,
              email: rpcData.email,
              phone: rpcData.phone || '',
              notes: rpcData.notes,
              ownerNotes: null,
              preferredStylistId: rpcData.preferred_stylist_id,
              createdAt: rpcData.created_at,
              updatedAt: rpcData.updated_at
            };
            previewClients.push(mappedData);
            return res.json(mappedData);
          } else {
            console.warn('[POST /api/clients] RPC insert_client_without_owner_notes non disponible ou erreur:', rpcError?.message);
          }
        } catch (rpcError: any) {
          console.warn('[POST /api/clients] Erreur avec RPC, essai REST API:', rpcError.message);
        }
      }
      
      // Méthode 3: Utiliser l'API REST de Supabase directement avec fetch (contourne PostgREST)
      if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        try {
          // Utiliser l'API REST directement avec Prefer: return=minimal pour éviter la validation du schéma
          const restUrl = `${SUPABASE_URL}/rest/v1/clients`;
          const restResponse = await fetch(restUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Prefer': 'return=minimal' // Ne retourne rien, évite la validation du schéma
            },
            body: JSON.stringify(clientData)
          });
          
          // Même si la réponse n'est pas OK (peut être 204 ou 201), vérifier si le client a été créé
          if (restResponse.status === 204 || restResponse.status === 201 || restResponse.status === 200) {
            console.log('[POST /api/clients] ✅ Insertion via REST API réussie (status:', restResponse.status, ')');
            
            // Attendre un peu pour que l'insertion se termine
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Vérifier si le client a été créé
            const { data: createdClient, error: fetchError } = await supabase
              .from('clients')
              .select('id, salon_id, first_name, last_name, email, phone, notes, preferred_stylist_id, created_at, updated_at')
              .eq('id', clientData.id)
              .maybeSingle();
            
            if (createdClient) {
              const mappedData = {
                id: createdClient.id,
                salonId: createdClient.salon_id,
                firstName: createdClient.first_name,
                lastName: createdClient.last_name,
                email: createdClient.email,
                phone: createdClient.phone || '',
                notes: createdClient.notes,
                ownerNotes: null,
                preferredStylistId: createdClient.preferred_stylist_id,
                createdAt: createdClient.created_at,
                updatedAt: createdClient.updated_at
              };
              previewClients.push(mappedData);
              console.log('[POST /api/clients] ✅ Client créé via REST API');
              return res.json(mappedData);
            }
          } else {
            const errorText = await restResponse.text();
            console.warn('[POST /api/clients] REST API retourné status:', restResponse.status, 'error:', errorText);
          }
        } catch (restError: any) {
          console.warn('[POST /api/clients] Erreur avec REST API, fallback vers Supabase client:', restError.message);
        }
      }
      
      // Méthode 4: Fallback vers Supabase client (avec gestion d'erreur owner_notes)
      // Ignorer l'erreur et vérifier si le client a été créé quand même
      const { error: insertError } = await supabase
        .from('clients')
        .insert([clientData]);
      
      // Toujours vérifier si le client a été créé (même en cas d'erreur)
      // Attendre un peu pour que l'insertion se termine (si elle a été exécutée)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: createdClient, error: fetchError } = await supabase
        .from('clients')
        .select('id, salon_id, first_name, last_name, email, phone, notes, preferred_stylist_id, created_at, updated_at')
        .eq('id', clientData.id)
        .maybeSingle();
      
      if (createdClient) {
        // Client créé avec succès (même si une erreur a été retournée)
        const mappedData = {
          id: createdClient.id,
          salonId: createdClient.salon_id,
          firstName: createdClient.first_name,
          lastName: createdClient.last_name,
          email: createdClient.email,
          phone: createdClient.phone || '',
          notes: createdClient.notes,
          ownerNotes: null,
          preferredStylistId: createdClient.preferred_stylist_id,
          createdAt: createdClient.created_at,
          updatedAt: createdClient.updated_at
        };
        previewClients.push(mappedData);
        console.log('[POST /api/clients] ✅ Client créé via Supabase client (malgré erreur owner_notes)');
        return res.json(mappedData);
      }
      
      // Si l'erreur est liée à owner_notes et le client n'a pas été créé, essayer plusieurs fois
      if (insertError) {
        const errorText = insertError.message || String(insertError);
        if (errorText.includes('owner_notes') || errorText.includes('PGRST204') || insertError.code === 'PGRST204') {
          console.warn('[POST /api/clients] ⚠️ Erreur owner_notes détectée, tentatives multiples...');
          
          // Essayer plusieurs fois avec des délais croissants
          for (let attempt = 1; attempt <= 3; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            
            const { data: retryClient } = await supabase
              .from('clients')
              .select('id, salon_id, first_name, last_name, email, phone, notes, preferred_stylist_id, created_at, updated_at')
              .eq('id', clientData.id)
              .maybeSingle();
            
            if (retryClient) {
              console.log(`[POST /api/clients] ✅ Client créé après tentative ${attempt}`);
              const mappedData = {
                id: retryClient.id,
                salonId: retryClient.salon_id,
                firstName: retryClient.first_name,
                lastName: retryClient.last_name,
                email: retryClient.email,
                phone: retryClient.phone || '',
                notes: retryClient.notes,
                ownerNotes: null,
                preferredStylistId: retryClient.preferred_stylist_id,
                createdAt: retryClient.created_at,
                updatedAt: retryClient.updated_at
              };
              previewClients.push(mappedData);
              return res.json(mappedData);
            }
          }
          
          // Si le client n'existe toujours pas après plusieurs tentatives, retourner une erreur avec instructions
          console.error('[POST /api/clients] ❌ Client non créé après plusieurs tentatives');
          return res.status(500).json({ 
            message: "Erreur lors de la création du client : colonne owner_notes manquante",
            error: "La colonne 'owner_notes' n'existe pas dans la table 'clients' de votre base de données Supabase.",
            instructions: [
              "1. Allez dans votre projet Supabase : https://supabase.com/dashboard",
              "2. Ouvrez le SQL Editor (menu de gauche)",
              "3. Créez une nouvelle requête",
              "4. Copiez et collez le script SQL suivant :",
              "",
              "ALTER TABLE \"clients\" ADD COLUMN IF NOT EXISTS \"owner_notes\" text;",
              "COMMENT ON COLUMN \"clients\".\"owner_notes\" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';",
              "",
              "5. Cliquez sur Run (ou appuyez sur Cmd/Ctrl + Enter)",
              "6. Vérifiez que le message de succès s'affiche",
              "7. Réessayez de créer un client"
            ].join("\n"),
            sqlScript: "ALTER TABLE \"clients\" ADD COLUMN IF NOT EXISTS \"owner_notes\" text;\nCOMMENT ON COLUMN \"clients\".\"owner_notes\" IS 'Notes privées visibles uniquement par le propriétaire du salon (post-it)';",
            details: errorText
          });
        }
        
        console.error('Erreur lors de l\'insertion du client:', insertError);
        return res.status(500).json({ 
          message: "Erreur lors de la création du client",
          error: errorText,
          details: insertError
        });
      }
      
      // Si pas d'erreur mais client non trouvé, retourner les données insérées
      const mappedData = {
        id: clientData.id,
        salonId: clientData.salon_id,
        firstName: clientData.first_name,
        lastName: clientData.last_name,
        email: clientData.email,
        phone: clientData.phone || '',
        notes: clientData.notes,
        ownerNotes: null,
        preferredStylistId: clientData.preferred_stylist_id,
        createdAt: clientData.created_at,
        updatedAt: clientData.updated_at
      };
      
      // Mettre à jour le cache mémoire
      previewClients.push(mappedData);
      
      return res.json(mappedData);
    }
  } catch (error: any) {
    console.error('Erreur lors de la création du client:', error);
    return res.status(500).json({ 
      message: "Erreur interne du serveur",
      error: error?.message || String(error)
    });
  }
  
  // Fallback mémoire si Supabase n'est pas configuré
  const newClient = {
    id: Math.random().toString(36).slice(2),
    salonId: previewSalon.id,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email || '',
    phone: body.phone || '',
    notes: body.notes || '',
    preferredStylistId: body.preferredStylistId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  previewClients.push(newClient);
  res.json(newClient);
});

app.put('/api/clients/:id', express.json(), async (req, res) => {
  const clientId = req.params.id;
  const body = req.body || {};
  
  console.log('[PUT /api/clients/:id] Données reçues:', body);
  console.log('[PUT /api/clients/:id] ownerNotes reçu:', body.ownerNotes);
  
  try {
    const now = new Date().toISOString();
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const row = {
        salon_id: previewSalon.id,
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email || '',
        phone: body.phone || '',
        preferred_stylist_id: body.preferredStylistId || null,
        notes: body.notes || null, // Notes internes (JSON pour sex, etc.)
        owner_notes: body.ownerNotes !== undefined ? (body.ownerNotes || null) : null, // Notes privées visibles uniquement par le owner
        updated_at: now
      };
      
      console.log('[PUT /api/clients/:id] Données à envoyer à Supabase:', row);
      
      // Utiliser Supabase Admin Client pour la mise à jour (plus fiable)
      const { createClient } = await import('@supabase/supabase-js');
      const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (SUPABASE_SERVICE_KEY) {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        
        const { data: updatedClientData, error: updateError } = await supabaseAdmin
          .from('clients')
          .update({
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            phone: row.phone,
            preferred_stylist_id: row.preferred_stylist_id,
            notes: row.notes,
            owner_notes: row.owner_notes,
            updated_at: row.updated_at
          })
          .eq('id', clientId)
          .select('id, salon_id, first_name, last_name, email, phone, notes, owner_notes, preferred_stylist_id, created_at, updated_at')
          .single();
        
        if (updateError) {
          console.error('[PUT /api/clients/:id] ❌ Erreur Supabase:', updateError);
          console.error('[PUT /api/clients/:id] Code erreur:', updateError.code);
          console.error('[PUT /api/clients/:id] Message:', updateError.message);
          console.error('[PUT /api/clients/:id] Détails:', updateError.details);
          
          // Si la colonne n'existe pas, essayer sans owner_notes
          if (updateError.code === '42703' || updateError.code === 'PGRST204' || updateError.message?.includes('owner_notes') || updateError.message?.includes('does not exist') || updateError.message?.includes('column') && updateError.message?.includes('owner_notes')) {
            console.warn('[PUT /api/clients/:id] ⚠️ Colonne owner_notes inexistante dans la base de données!');
            console.warn('[PUT /api/clients/:id] Exécutez: ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_notes text;');
            console.log('[PUT /api/clients/:id] Tentative de sauvegarde sans owner_notes...');
            const { data: retryData, error: retryError } = await supabaseAdmin
              .from('clients')
              .update({
                first_name: row.first_name,
                last_name: row.last_name,
                email: row.email,
                phone: row.phone,
                preferred_stylist_id: row.preferred_stylist_id,
                notes: row.notes,
                updated_at: row.updated_at
              })
              .eq('id', clientId)
              .select('id, salon_id, first_name, last_name, email, phone, notes, preferred_stylist_id, created_at, updated_at')
              .single();
            
            if (retryError) {
              console.error('[PUT /api/clients/:id] ❌ Erreur même sans owner_notes:', retryError);
              return res.status(500).json({ 
                message: "Erreur lors de la mise à jour du client",
                error: retryError.message,
                hint: "La colonne owner_notes n'existe pas dans la base de données. Exécutez dans Supabase SQL Editor: ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_notes text;"
              });
            }
            
            console.warn('[PUT /api/clients/:id] ⚠️ Client mis à jour SANS owner_notes (colonne inexistante)');
            
            const retryClient = {
              id: retryData.id,
              salonId: retryData.salon_id,
              firstName: retryData.first_name,
              lastName: retryData.last_name,
              email: retryData.email,
              phone: retryData.phone,
              notes: retryData.notes,
              ownerNotes: null, // Colonne inexistante
              preferredStylistId: retryData.preferred_stylist_id,
              createdAt: retryData.created_at,
              updatedAt: retryData.updated_at
            };
            
            const clientIndex = previewClients.findIndex(c => c.id === clientId);
            if (clientIndex >= 0) {
              previewClients[clientIndex] = retryClient;
            }
            
            return res.json(retryClient);
          }
          
          return res.status(500).json({ 
            message: "Erreur lors de la mise à jour du client",
            error: updateError.message
          });
        }
        
        if (updatedClientData) {
          const updatedClient = {
            id: updatedClientData.id,
            salonId: updatedClientData.salon_id,
            firstName: updatedClientData.first_name,
            lastName: updatedClientData.last_name,
            email: updatedClientData.email,
            phone: updatedClientData.phone,
            notes: updatedClientData.notes,
            ownerNotes: updatedClientData.owner_notes || null,
            preferredStylistId: updatedClientData.preferred_stylist_id,
            createdAt: updatedClientData.created_at,
            updatedAt: updatedClientData.updated_at
          };
          
          console.log('[PUT /api/clients/:id] ✅ Client mis à jour avec succès');
          console.log('[PUT /api/clients/:id] ownerNotes sauvegardé:', updatedClient.ownerNotes);
          
          const clientIndex = previewClients.findIndex(c => c.id === clientId);
          if (clientIndex >= 0) {
            previewClients[clientIndex] = updatedClient;
          }
          
          return res.json(updatedClient);
        }
      }
      
      // Fallback avec fetch si Supabase Admin n'est pas disponible
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(row)
      });
      
      console.log('[PUT /api/clients/:id] Réponse Supabase status:', resp.status);
      
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error('[PUT /api/clients/:id] Erreur Supabase:', errorText);
        
        // Si l'erreur indique que la colonne n'existe pas
        if (errorText.includes('owner_notes') || errorText.includes('column') || errorText.includes('42703') || errorText.includes('PGRST204')) {
          console.warn('[PUT /api/clients/:id] ⚠️ Colonne owner_notes inexistante!');
          return res.status(400).json({
            message: "La colonne 'owner_notes' n'existe pas dans la base de données",
            error: errorText,
            hint: "Exécutez dans Supabase SQL Editor: ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_notes text;"
          });
        }
        
        return res.status(500).json({ 
          message: "Erreur lors de la mise à jour du client",
          error: errorText
        });
      }
      
      if (resp.ok) {
        let data;
        try {
          const responseText = await resp.text();
          if (!responseText || responseText.trim() === '') {
            console.warn('[PUT /api/clients/:id] Réponse Supabase vide, récupération depuis Supabase Admin...');
            // Si la réponse est vide, essayer de récupérer les données depuis Supabase Admin
            const { createClient } = await import('@supabase/supabase-js');
            const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (SUPABASE_SERVICE_KEY) {
              const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
              const { data: clientData, error: fetchError } = await supabaseAdmin
                .from('clients')
                .select('id, salon_id, first_name, last_name, email, phone, notes, preferred_stylist_id, created_at, updated_at')
                .eq('id', clientId)
                .single();
              
              if (fetchError) {
                return res.status(500).json({ message: "Erreur lors de la récupération du client", error: fetchError.message });
              }
              
              data = [{
                ...clientData,
                owner_notes: null // Colonne inexistante
              }];
            } else {
              return res.status(500).json({ message: "Réponse Supabase vide et service key non disponible" });
            }
          } else {
            data = JSON.parse(responseText);
          }
        } catch (parseError: any) {
          console.error('[PUT /api/clients/:id] Erreur parsing JSON:', parseError);
          return res.status(500).json({
            message: "Erreur lors de la lecture de la réponse",
            error: parseError.message,
            hint: "La colonne owner_notes n'existe peut-être pas. Exécutez: ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_notes text;"
          });
        }
        
        if (data && Array.isArray(data) && data.length > 0) {
          const updatedClient = {
            id: data[0].id,
            salonId: data[0].salon_id,
            firstName: data[0].first_name,
            lastName: data[0].last_name,
            email: data[0].email,
            phone: data[0].phone,
            notes: data[0].notes,
            ownerNotes: data[0].owner_notes || null,
            preferredStylistId: data[0].preferred_stylist_id,
            createdAt: data[0].created_at,
            updatedAt: data[0].updated_at
          };
          
          const clientIndex = previewClients.findIndex(c => c.id === clientId);
          if (clientIndex >= 0) {
            previewClients[clientIndex] = updatedClient;
          }
          
          return res.json(updatedClient);
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du client:', error);
  }
  
  // Fallback mémoire
  const clientIndex = previewClients.findIndex(c => c.id === clientId);
  if (clientIndex >= 0) {
    previewClients[clientIndex] = { 
      ...previewClients[clientIndex], 
      ...body, 
      updatedAt: new Date().toISOString() 
    };
    res.json(previewClients[clientIndex]);
  } else {
    res.status(404).json({ message: "Client not found" });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  const clientId = req.params.id;
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Vérifier d'abord si le client existe
      const { data: client, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (fetchError) {
        console.error('Erreur lors de la récupération du client:', fetchError);
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Supprimer le client
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      
      if (deleteError) {
        console.error('Erreur lors de la suppression du client:', deleteError);
        return res.status(500).json({ message: "Erreur lors de la suppression" });
      }
      
      // Mettre à jour le cache mémoire
      const clientIndex = previewClients.findIndex(c => c.id === clientId);
      if (clientIndex >= 0) {
        previewClients.splice(clientIndex, 1);
      }
      
      return res.json({ success: true, message: "Client deleted successfully" });
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du client:', error);
    return res.status(500).json({ message: "Erreur interne du serveur" });
  }
  
  // Fallback mémoire si Supabase n'est pas configuré
  const clientIndex = previewClients.findIndex(c => c.id === clientId);
  if (clientIndex >= 0) {
    previewClients.splice(clientIndex, 1);
    return res.json({ success: true, message: "Client deleted from memory" });
  } else {
    return res.status(404).json({ message: "Client not found" });
  }
});

// Routes appointments
app.get('/api/appointments', (_req, res) => {
  res.json(previewAppointments);
});

interface NormalizedClientInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

const buildNormalizedClientInfo = (
  rawClientInfo?: any,
  sessionClient?: any
): NormalizedClientInfo | null => {
  const normalized: NormalizedClientInfo = {};

  console.log('[buildNormalizedClientInfo] 📞 TRACE DU NUMÉRO:');
  console.log('[buildNormalizedClientInfo] 📞   rawClientInfo?.phone:', rawClientInfo?.phone || '(vide ou undefined)');
  console.log('[buildNormalizedClientInfo] 📞   sessionClient?.phone:', sessionClient?.phone || '(vide ou undefined)');
  console.log('[buildNormalizedClientInfo] 📞   rawClientInfo?.phone ?? sessionClient?.phone:', (rawClientInfo?.phone ?? sessionClient?.phone) || '(vide)');

  const applyValue = (
    field: keyof NormalizedClientInfo,
    value?: string | null,
    options?: { lowerCase?: boolean }
  ) => {
    if (typeof value !== 'string') {
      console.log(`[buildNormalizedClientInfo] 📞   applyValue(${field}): valeur n'est pas une string, type:`, typeof value);
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      console.log(`[buildNormalizedClientInfo] 📞   applyValue(${field}): valeur vide après trim`);
      return;
    }
    normalized[field] = options?.lowerCase ? trimmed.toLowerCase() : trimmed;
    console.log(`[buildNormalizedClientInfo] 📞   applyValue(${field}): valeur assignée:`, normalized[field]);
  };

  applyValue('firstName', rawClientInfo?.firstName ?? sessionClient?.firstName);
  applyValue('lastName', rawClientInfo?.lastName ?? sessionClient?.lastName);
  applyValue('email', rawClientInfo?.email ?? sessionClient?.email, { lowerCase: true });
  applyValue('phone', rawClientInfo?.phone ?? sessionClient?.phone);

  console.log('[buildNormalizedClientInfo] 📞   normalized.phone (final):', normalized.phone || '(vide)');
  console.log('[buildNormalizedClientInfo] 📞   normalized (complet):', JSON.stringify(normalized, null, 2));

  return Object.keys(normalized).length > 0 ? normalized : null;
};

app.post('/api/appointments', express.json(), async (req, res) => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[POST /api/appointments] 🆕 CRÉATION D\'UN NOUVEAU RENDEZ-VOUS');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const body = req.body || {};
  const rawClientInfo = body.clientInfo && typeof body.clientInfo === 'object' ? body.clientInfo : null;
  
  console.log('[POST /api/appointments] Body reçu:', JSON.stringify(body, null, 2));
  console.log('[POST /api/appointments] clientId (body):', body.clientId);
  
  // Vérifier la session client pour obtenir le vrai clientId
  const clientSession = req.session?.client;
  let finalClientId = body.clientId;
  const normalizedClientInfo = buildNormalizedClientInfo(rawClientInfo, clientSession);
  
  // Si une session client existe, utiliser le clientId de la session (plus sûr)
  if (clientSession?.clientId) {
    console.log('[POST /api/appointments] ✅ Session client détectée, utilisation du clientId de la session');
    finalClientId = clientSession.clientId;
    
    // Vérifier que le clientId du body correspond à la session (sécurité)
    if (body.clientId && body.clientId !== clientSession.clientId) {
      console.warn('[POST /api/appointments] ⚠️ ATTENTION: clientId du body ne correspond pas à la session!');
      console.warn('[POST /api/appointments] ⚠️ body.clientId:', body.clientId);
      console.warn('[POST /api/appointments] ⚠️ session.clientId:', clientSession.clientId);
      console.warn('[POST /api/appointments] ⚠️ Utilisation du clientId de la session pour sécurité');
    }
  } else {
    console.log('[POST /api/appointments] ⚠️ Aucune session client, utilisation du clientId du body');
  }
  
  console.log('[POST /api/appointments] 🔍 clientId final utilisé:', finalClientId);
  console.log('[POST /api/appointments] 🔍 clientId type:', typeof finalClientId);
  console.log('[POST /api/appointments] 🔍 clientId length:', finalClientId?.length);
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Récupérer la durée du service
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('duration, price')
        .eq('id', body.serviceId)
        .maybeSingle();
      
      if (serviceError || !service) {
        console.error('[POST /api/appointments] Erreur récupération service:', serviceError);
        return res.status(400).json({ error: 'Service non trouvé' });
      }
      
      // Utiliser la durée du body si fournie, sinon celle du service
      // La durée du body peut être différente si le service a été modifié
      const duration = body.duration ? Number(body.duration) : (service.duration || 30);
      
      // Valider que startTime est fourni et valide
      if (!body.startTime) {
        console.error('[POST /api/appointments] ❌ startTime manquant dans le body');
        return res.status(400).json({ error: 'Date et heure de début manquantes', details: 'Le champ startTime est requis' });
      }
      
      const appointmentDate = new Date(body.startTime);
      if (isNaN(appointmentDate.getTime())) {
        console.error('[POST /api/appointments] ❌ startTime invalide:', body.startTime);
        return res.status(400).json({ error: 'Date et heure invalides', details: `La date/heure fournie "${body.startTime}" n'est pas valide` });
      }
      
      const appointmentStartTime = appointmentDate;
      const appointmentEndTime = new Date(appointmentStartTime.getTime() + duration * 60000);
      const dayOfWeek = appointmentStartTime.getDay();
      
      console.log('[POST /api/appointments] 🔍 Date/heure validée:');
      console.log('[POST /api/appointments] 🔍   startTime (body):', body.startTime);
      console.log('[POST /api/appointments] 🔍   appointmentDate:', appointmentDate.toISOString());
      console.log('[POST /api/appointments] 🔍   dayOfWeek:', dayOfWeek);
      
      // Définir salonIdForQuery une seule fois au début pour qu'il soit accessible partout
      const salonIdForQuery = body.salonId || previewSalon.id;
      const salonIdCandidates = buildSalonIdCandidates(salonIdForQuery);
      
      // Valider et obtenir un stylist_id valide
      let finalStylistId = body.stylistId && body.stylistId !== "none" ? body.stylistId : '';
      const stylistPreference = body.stylistPreference || (finalStylistId ? "specific" : "none");
      const userSelectedNoPreference = stylistPreference === "none";
      
      // Initialiser les variants du stylistId tôt pour qu'ils soient disponibles partout
      let normalizedFinalStylistId = finalStylistId ? normalizeStylistIdValue(finalStylistId) : '';
      let stylistIdVariantFilters = finalStylistId ? getStylistIdVariants(finalStylistId) : [];
      
      if (!userSelectedNoPreference) {
        if (!finalStylistId) {
          console.error('[POST /api/appointments] ❌ stylistId manquant alors qu\'un styliste spécifique est requis');
          return res.status(400).json({ error: 'Styliste non sélectionné' });
        }
        
        // Vérifier que le stylistId fourni existe et est actif
        // Essayer avec les variants d'ID (avec et sans préfixe)
        const stylistIdVariants = getStylistIdVariants(finalStylistId);
        let stylist: any = null;
        let stylistError: any = null;
        
        for (const variantId of stylistIdVariants) {
          if (!variantId) continue;
          
          const { data: foundStylist, error: error } = await supabase
            .from('stylistes')
            .select('id, first_name, last_name, is_active')
            .eq('id', variantId)
            .maybeSingle();
          
          if (foundStylist && !error) {
            stylist = foundStylist;
            finalStylistId = foundStylist.id; // Utiliser l'ID trouvé
            console.log('[POST /api/appointments] ✅ Styliste trouvé avec variant:', variantId, '→ ID réel:', foundStylist.id);
            break;
          }
          
          if (error && error.code !== 'PGRST116') {
            stylistError = error;
          }
        }
        
        if (stylistError && !stylist) {
          console.error('[POST /api/appointments] Erreur vérification styliste:', stylistError);
          return res.status(500).json({ error: 'Erreur lors de la vérification du styliste', details: stylistError.message });
        }
        
        if (!stylist) {
          console.error('[POST /api/appointments] ❌ Styliste non trouvé avec aucun variant:', stylistIdVariants);
          return res.status(400).json({ error: 'Styliste non trouvé', details: `Le styliste avec l'ID ${finalStylistId} n'existe pas` });
        }
        
        if (stylist.is_active === false) {
          console.warn('[POST /api/appointments] ⚠️ Styliste inactif, recherche d\'un styliste actif...');
          
          // Essayer avec les variants d'ID du salon
          let activeStylists: any[] | null = null;
          let activeError: any = null;
          
          for (const salonIdVariant of salonIdCandidates) {
            const { data: stylists, error: error } = await supabase
              .from('stylistes')
              .select('id, first_name, last_name')
              .eq('salon_id', salonIdVariant)
              .eq('is_active', true)
              .limit(1);
            
            if (stylists && stylists.length > 0 && !error) {
              activeStylists = stylists;
              break;
            }
            
            if (error && error.code !== 'PGRST116') {
              activeError = error;
            }
          }
          
          if (activeError || !activeStylists || activeStylists.length === 0) {
            return res.status(400).json({ error: 'Le styliste sélectionné n\'est pas actif et aucun autre styliste n\'est disponible' });
          }
          
          finalStylistId = activeStylists[0].id;
          console.log('[POST /api/appointments] ✅ Styliste actif auto-assigné:', activeStylists[0].first_name, activeStylists[0].last_name);
          
          // Mettre à jour les variants après l'auto-assignment
          normalizedFinalStylistId = normalizeStylistIdValue(finalStylistId);
          stylistIdVariantFilters = getStylistIdVariants(finalStylistId);
        }
      }
      
      // VÉRIFIER LES CHEVAUCHEMENTS AVANT DE CRÉER LE RENDEZ-VOUS
      
      console.log('[POST /api/appointments] 🔍 Vérification des chevauchements...');
      console.log('[POST /api/appointments] 🔍   Début:', appointmentStartTime.toISOString());
      console.log('[POST /api/appointments] 🔍   Fin:', appointmentEndTime.toISOString());
      console.log('[POST /api/appointments] 🔍   Durée:', duration, 'minutes');
      console.log('[POST /api/appointments] 🔍   Styliste:', finalStylistId);
      
      // Récupérer tous les rendez-vous confirmés du styliste pour la journée
      // On récupère une plage plus large pour être sûr de ne rien manquer
      const dayStart = new Date(appointmentStartTime);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(appointmentStartTime);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Récupérer tous les rendez-vous du styliste pour la journée (tous statuts sauf cancelled)
      // On exclut seulement les rendez-vous annulés car ils libèrent le créneau
      // Note: Si on est en mode "sans préférence", on ne vérifie pas encore les chevauchements car on n'a pas encore sélectionné le styliste
      let existingAppointments: any[] = [];
      if (!userSelectedNoPreference && stylistIdVariantFilters.length > 0) {
        const { data: appointments, error: checkError } = await supabase
          .from('appointments')
          .select('id, appointment_date, duration, status, stylist_id')
          .in('stylist_id', stylistIdVariantFilters.filter(Boolean))
          .neq('status', 'cancelled')
          .gte('appointment_date', dayStart.toISOString())
          .lte('appointment_date', dayEnd.toISOString());
        
        if (checkError) {
          console.error('[POST /api/appointments] ❌ Erreur lors de la vérification des chevauchements:', checkError);
          return res.status(500).json({ error: 'Erreur lors de la vérification de la disponibilité', details: checkError.message });
        }
        
        existingAppointments = appointments || [];
      }
      
      // VALIDATION DES HORAIRES : Calculer l'intersection salon × styliste
      // Un créneau est accepté s'il rentre entièrement dans au moins un intervalle valide
      // (intersection des horaires salon et coiffeur·euse) pour ce jour.
      // Sinon, une erreur métier explicite est renvoyée.
      
      // IMPORTANT : appointmentStartTime est une Date JavaScript qui peut être en UTC ou local
      // On utilise getDay(), getHours(), getMinutes() qui retournent les valeurs dans le fuseau horaire local
      // Cela garantit la cohérence avec les horaires du salon/styliste qui sont stockés en heure locale
      console.log('[POST /api/appointments] 🔍 Date/heure reçue (ISO):', body.startTime);
      console.log('[POST /api/appointments] 🔍 Date/heure parsée:', appointmentStartTime.toISOString());
      console.log('[POST /api/appointments] 🔍 Date/heure locale:', appointmentStartTime.toString());
      
      console.log('[POST /api/appointments] 🔍 Vérification des horaires pour jour:', dayOfWeek, `(${['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][dayOfWeek]})`);
      console.log('[POST /api/appointments] 🔍 salonIdForQuery utilisé:', salonIdForQuery);
      console.log('[POST /api/appointments] 🔍 body.salonId:', body.salonId);
      console.log('[POST /api/appointments] 🔍 previewSalon.id:', previewSalon?.id);
      
      // Récupérer les horaires du salon - essayer avec plusieurs formats d'ID
      const possibleHoursSalonIds = [salonIdForQuery];
      if (salonIdForQuery && salonIdForQuery.startsWith('salon-')) {
        possibleHoursSalonIds.push(salonIdForQuery.substring(6)); // Sans préfixe
      } else if (salonIdForQuery) {
        possibleHoursSalonIds.push(`salon-${salonIdForQuery}`); // Avec préfixe
      }
      
      let salonHours: any[] | null = null;
      let salonHoursError: any = null;
      
      for (const testId of possibleHoursSalonIds) {
        console.log(`[POST /api/appointments] 🔍 Essai récupération horaires avec ID: ${testId}`);
        const result = await supabase
          .from('opening_hours')
          .select('day_of_week, open_time, close_time, is_closed')
          .eq('salon_id', testId)
          .eq('day_of_week', dayOfWeek);
        
        salonHours = result.data;
        salonHoursError = result.error;
        
        if (salonHours && salonHours.length > 0 && !salonHoursError) {
          console.log(`[POST /api/appointments] ✅ Horaires trouvés avec ID: ${testId}`, salonHours);
          break;
        } else if (salonHoursError && salonHoursError.code !== 'PGRST116') {
          console.log(`[POST /api/appointments] ⚠️ Erreur avec ID ${testId}:`, salonHoursError.message);
        }
      }
      
      // Si opening_hours n'existe pas ou n'a pas trouvé de résultats, essayer salon_hours
      let salonDayHours = salonHours;
      if ((salonHoursError && (salonHoursError.code === '42P01' || salonHoursError.message?.includes('does not exist'))) || 
          (!salonHours || salonHours.length === 0)) {
        console.log('[POST /api/appointments] 🔍 Essai avec salon_hours...');
        for (const testId of possibleHoursSalonIds) {
          const result = await supabase
            .from('salon_hours')
            .select('day_of_week, open_time, close_time, is_closed')
            .eq('salon_id', testId)
            .eq('day_of_week', dayOfWeek);
          
          if (result.data && result.data.length > 0 && !result.error) {
            salonDayHours = result.data;
            console.log(`[POST /api/appointments] ✅ Horaires trouvés dans salon_hours avec ID: ${testId}`, salonDayHours);
            break;
          }
        }
      }
      
      if (userSelectedNoPreference) {
        const autoStylist = await findAvailableStylistForSlot({
          supabase,
          salonIdCandidates,
          dayOfWeek,
          salonDayHours: salonDayHours || [],
          appointmentStart: appointmentStartTime,
          appointmentEnd: appointmentEndTime,
          duration
        });
        
        if (!autoStylist) {
          console.warn('[POST /api/appointments] ❌ Aucun coiffeur·euse disponible pour ce créneau (mode sans préférences)');
          return res.status(400).json({ error: 'Aucun coiffeur·euse disponible pour ce créneau. Veuillez choisir un autre horaire.' });
        }
        
        finalStylistId = autoStylist.stylistId;
        console.log(`[POST /api/appointments] ✅ Styliste sélectionné automatiquement pour ce créneau: ${autoStylist.stylistName} (${finalStylistId})`);
        
        // Mettre à jour les variants après la sélection automatique
        normalizedFinalStylistId = normalizeStylistIdValue(finalStylistId);
        stylistIdVariantFilters = getStylistIdVariants(finalStylistId);
        
        // Maintenant vérifier les chevauchements pour le styliste sélectionné automatiquement
        const appointmentStylistFiltersAuto = stylistIdVariantFilters.length > 0 ? stylistIdVariantFilters : [finalStylistId];
        const { data: appointmentsAuto, error: checkErrorAuto } = await supabase
          .from('appointments')
          .select('id, appointment_date, duration, status, stylist_id')
          .in('stylist_id', appointmentStylistFiltersAuto.filter(Boolean))
          .neq('status', 'cancelled')
          .gte('appointment_date', dayStart.toISOString())
          .lte('appointment_date', dayEnd.toISOString());
        
        if (checkErrorAuto) {
          console.error('[POST /api/appointments] ❌ Erreur lors de la vérification des chevauchements (auto):', checkErrorAuto);
          return res.status(500).json({ error: 'Erreur lors de la vérification de la disponibilité', details: checkErrorAuto.message });
        }
        
        existingAppointments = appointmentsAuto || [];
      }
      
      // VÉRIFIER LES DATES DE FERMETURE EXCEPTIONNELLES
      const rawSalonId = body.salonId || previewSalon.id;
      const appointmentDateStr = appointmentDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
      
      const possibleSalonIds = [rawSalonId];
      if (rawSalonId && rawSalonId.startsWith('salon-')) {
        possibleSalonIds.push(rawSalonId.substring(6)); // Sans préfixe
      } else if (rawSalonId) {
        possibleSalonIds.push(`salon-${rawSalonId}`); // Avec préfixe
      }
      
      let closedDates: any[] | null = null;
      for (const testId of possibleSalonIds) {
        let datesQuery = supabase
          .from('salon_closed_dates')
          .select('date, start_time, end_time, stylist_id')
          .eq('salon_id', testId)
          .eq('date', appointmentDateStr);
        
        const orClauses = ['stylist_id.is.null'];
        stylistIdVariantFilters.forEach((val) => {
          if (val) {
            orClauses.push(`stylist_id.eq.${val}`);
          }
        });
        datesQuery = datesQuery.or(orClauses.join(','));
        
        const { data: dates, error: closedDatesError } = await datesQuery;
        
        if (dates && dates.length > 0 && !closedDatesError) {
          closedDates = dates.map(normalizeClosedDateRecord);
          break;
        } else if (closedDatesError && closedDatesError.code !== 'PGRST116') {
          console.error('[POST /api/appointments] ❌ Erreur lors de la vérification des dates de fermeture avec ID', testId, ':', closedDatesError);
        }
      }
      
      if (closedDates && closedDates.length > 0) {
        closedDates = closedDates.filter((cd: any) => !cd.stylist_id || stylistIdVariantFilters.includes(cd.stylist_id));
        
        const isCompletelyClosed = closedDates.some((cd: any) => 
          (!cd.start_time && !cd.end_time)
        );
        
        if (isCompletelyClosed) {
          console.warn('[POST /api/appointments] ⚠️ Date de fermeture exceptionnelle détectée:', appointmentDateStr);
          return res.status(400).json({ 
            error: 'Date de fermeture', 
            message: 'Le salon est fermé ce jour-là. Veuillez choisir une autre date.',
            details: 'Cette date est marquée comme date de fermeture exceptionnelle'
          });
        }
        
        for (const closedDate of closedDates) {
          if (closedDate.start_time || closedDate.end_time) {
            const closedStartTime = closedDate.start_time || '00:00';
            const closedEndTime = closedDate.end_time || '23:59';
            
            const [closedStartHour, closedStartMin] = closedStartTime.split(':').map(Number);
            const [closedEndHour, closedEndMin] = closedEndTime.split(':').map(Number);
            
            const closedStart = new Date(appointmentDate);
            closedStart.setHours(closedStartHour, closedStartMin, 0, 0);
            
            const closedEnd = new Date(appointmentDate);
            closedEnd.setHours(closedEndHour, closedEndMin, 0, 0);
            
            if (appointmentStartTime < closedEnd && appointmentEndTime > closedStart) {
              console.warn('[POST /api/appointments] ⚠️ Créneau dans une période de fermeture détecté:', {
                appointmentStart: appointmentStartTime.toISOString(),
                appointmentEnd: appointmentEndTime.toISOString(),
                closedStart: closedStart.toISOString(),
                closedEnd: closedEnd.toISOString(),
              });
              return res.status(400).json({ 
                error: 'Créneau non disponible', 
                message: `Le salon est fermé de ${closedStartTime} à ${closedEndTime} ce jour-là. Veuillez choisir un autre créneau.`,
                details: 'Ce créneau chevauche avec une période de fermeture exceptionnelle'
              });
            }
          }
        }
      }
      
      let stylistSchedules: any[] | null = null;
      if (normalizedFinalStylistId) {
        try {
          // Essayer avec les variants d'ID du styliste
          const stylistIdVariantsForSchedule = getStylistIdVariants(normalizedFinalStylistId);
          console.log(`[POST /api/appointments] 🔍 Recherche horaires styliste pour jour ${dayOfWeek} (${['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][dayOfWeek]})`);
          console.log(`[POST /api/appointments] 🔍 normalizedFinalStylistId: ${normalizedFinalStylistId}`);
          console.log(`[POST /api/appointments] 🔍 Variants d'ID à tester:`, stylistIdVariantsForSchedule);
          let schedulesFound = false;
          
          for (const variantId of stylistIdVariantsForSchedule) {
            if (!variantId) continue;
            
            console.log(`[POST /api/appointments] 🔍 Test avec variant ID: ${variantId}`);
            const { data: schedules, error: scheduleError } = await supabase
              .from('stylist_schedule')
              .select('day_of_week, start_time, end_time, is_available')
              .eq('stylist_id', variantId)
              .eq('day_of_week', dayOfWeek);
            
            if (scheduleError && scheduleError.code !== 'PGRST116' && scheduleError.code !== '42P01') {
              console.error(`[POST /api/appointments] ⚠️ Erreur avec variant ${variantId}:`, scheduleError);
            } else if (schedules && schedules.length > 0) {
              stylistSchedules = schedules;
              schedulesFound = true;
              console.log(`[POST /api/appointments] ✅ Horaires styliste trouvés avec variant ID: ${variantId}`, stylistSchedules);
              break;
            } else {
              console.log(`[POST /api/appointments] ⚠️ Aucun horaire trouvé avec variant ${variantId} pour le jour ${dayOfWeek}`);
            }
          }
          
          if (!schedulesFound) {
            // Vérifier si le styliste a des horaires pour d'autres jours (pour savoir s'il devrait en avoir)
            // Si oui, cela signifie qu'il a des horaires spécifiques mais pas pour ce jour
            // Si non, cela signifie qu'il n'a pas d'horaires spécifiques du tout
            console.log(`[POST /api/appointments] 🔍 Aucun horaire trouvé pour le jour ${dayOfWeek}, vérification des autres jours...`);
            console.log(`[POST /api/appointments] 🔍 Variants d'ID testés:`, stylistIdVariantsForSchedule);
            
            // Essayer une requête plus large pour voir tous les horaires du styliste
            let allSchedulesFound = false;
            for (const variantId of stylistIdVariantsForSchedule) {
              if (!variantId) continue;
              
              const { data: allSchedules, error: allSchedulesError } = await supabase
                .from('stylist_schedule')
                .select('day_of_week, start_time, end_time, is_available')
                .eq('stylist_id', variantId);
              
              if (allSchedules && allSchedules.length > 0 && !allSchedulesError) {
                console.log(`[POST /api/appointments] ✅ Horaires trouvés pour le styliste (variant ${variantId}):`, allSchedules);
                allSchedulesFound = true;
                
                // Vérifier si le styliste a des horaires pour ce jour spécifique
                const daySchedules = allSchedules.filter((s: any) => s.day_of_week === dayOfWeek);
                if (daySchedules.length > 0) {
                  // Les horaires existent mais n'ont pas été trouvés avec la requête précédente
                  // Cela peut arriver si dayOfWeek n'est pas correct
                  console.warn(`[POST /api/appointments] ⚠️ Horaires trouvés pour le jour ${dayOfWeek} mais pas avec la requête initiale!`);
                  console.warn(`[POST /api/appointments] ⚠️ dayOfWeek utilisé: ${dayOfWeek}, horaires trouvés:`, daySchedules);
                  stylistSchedules = daySchedules;
                  schedulesFound = true;
                  break;
                }
                break;
              }
            }
            
            if (!schedulesFound) {
              if (allSchedulesFound) {
                // Le styliste a des horaires pour d'autres jours, donc il a des horaires spécifiques
                // Mais pas pour ce jour = il n'est pas disponible ce jour
                console.warn(`[POST /api/appointments] ⚠️ Le styliste a des horaires spécifiques mais pas pour le jour ${dayOfWeek}`);
                const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
                return res.status(400).json({ 
                  error: `Créneau indisponible pour ce coiffeur·euse. Le ou la coiffeur·euse n'est pas disponible le ${dayNames[dayOfWeek]}` 
                });
              } else {
                // Le styliste n'a pas d'horaires spécifiques du tout
                // Dans ce cas, on utilise les horaires du salon (fallback)
                console.log('[POST /api/appointments] ℹ️ Le styliste n\'a pas d\'horaires spécifiques. Utilisation des horaires du salon.');
                stylistSchedules = []; // Tableau vide = utiliser uniquement les horaires du salon
              }
            }
          }
          
          console.log('[POST /api/appointments] 🔍 Horaires styliste finaux:', stylistSchedules);
        } catch (scheduleException: any) {
          console.warn('[POST /api/appointments] ⚠️ Exception lors de la récupération des horaires styliste:', scheduleException);
          // En cas d'exception, continuer sans horaires styliste (utiliser horaires salon)
          stylistSchedules = [];
        }
      } else {
        console.warn('[POST /api/appointments] ⚠️ Impossible de normaliser l\'ID du styliste pour la récupération des horaires');
        stylistSchedules = [];
      }
      
      // Calculer les intervalles valides (intersection salon × styliste, ou salon uniquement si "Sans préférences")
      console.log(`[POST /api/appointments] 🔍 Calcul des intervalles valides:`);
      console.log(`[POST /api/appointments] 🔍   Horaires salon:`, salonDayHours);
      console.log(`[POST /api/appointments] 🔍   Horaires styliste:`, stylistSchedules);
      console.log(`[POST /api/appointments] 🔍   Jour de la semaine: ${dayOfWeek}`);
      
      const validIntervals = getValidIntervalsForDay(
        (salonDayHours || []) as any,
        (stylistSchedules || []) as any, // Tableau vide si "Sans préférences"
        dayOfWeek
      );
      
      console.log(`[POST /api/appointments] 🔍 Intervalles valides calculés:`, validIntervals);
      if (stylistSchedules && stylistSchedules.length > 0) {
        console.log(`[POST /api/appointments] ✅ Le styliste a des horaires spécifiques. Les intervalles valides sont l'intersection salon × styliste.`);
      } else {
        console.log(`[POST /api/appointments] ℹ️ Le styliste n'a pas d'horaires spécifiques. Utilisation des horaires salon uniquement.`);
      }
      
      if (validIntervals.length === 0) {
        const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        const isSalonClosed = !salonDayHours || salonDayHours.length === 0 || salonDayHours.every((h: any) => h.is_closed);
        const isStylistUnavailable = stylistSchedules && stylistSchedules.length > 0 && stylistSchedules.every((s: any) => s.is_available === false);
        
        if (isSalonClosed) {
          console.warn(`[POST /api/appointments] ❌ Le salon est fermé le ${dayNames[dayOfWeek]}`);
          return res.status(400).json({ 
            error: `Créneau indisponible. Le salon est fermé le ${dayNames[dayOfWeek]}` 
          });
        } else if (isStylistUnavailable) {
          console.warn(`[POST /api/appointments] ❌ Le styliste n'est pas disponible le ${dayNames[dayOfWeek]}`);
          return res.status(400).json({ 
            error: `Créneau indisponible pour ce coiffeur·euse. Le ou la coiffeur·euse n'est pas disponible le ${dayNames[dayOfWeek]}` 
          });
        } else {
          console.warn(`[POST /api/appointments] ❌ Aucun intervalle valide trouvé pour ce jour`);
          return res.status(400).json({ 
            error: `Aucun créneau disponible pour ce coiffeur·euse ce jour-là.` 
          });
        }
      }
      
      // Valider que le rendez-vous est dans un intervalle valide
      const appointmentHour = appointmentStartTime.getHours();
      const appointmentMinute = appointmentStartTime.getMinutes();
      const appointmentEndHour = appointmentEndTime.getHours();
      const appointmentEndMinute = appointmentEndTime.getMinutes();
      
      console.log(`[POST /api/appointments] 🔍 Validation du créneau:`);
      console.log(`[POST /api/appointments] 🔍   Début: ${String(appointmentHour).padStart(2, '0')}:${String(appointmentMinute).padStart(2, '0')}`);
      console.log(`[POST /api/appointments] 🔍   Fin: ${String(appointmentEndHour).padStart(2, '0')}:${String(appointmentEndMinute).padStart(2, '0')}`);
      console.log(`[POST /api/appointments] 🔍   Durée: ${duration} min`);
      
      const isValid = isSlotValid(appointmentStartTime, duration, validIntervals);
      
      if (!isValid) {
        const intervalsStr = formatIntervals(validIntervals);
        const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        console.warn(`[POST /api/appointments] ❌ Le créneau (${String(appointmentHour).padStart(2, '0')}:${String(appointmentMinute).padStart(2, '0')} - ${String(appointmentEndHour).padStart(2, '0')}:${String(appointmentEndMinute).padStart(2, '0')}) n'est pas valide. Intervalles disponibles: ${intervalsStr}`);
        return res.status(400).json({ 
          error: `Ce créneau ne permet pas de terminer le service avant la fermeture. Créneaux disponibles: ${intervalsStr}` 
        });
      }
      
      console.log(`[POST /api/appointments] ✅ Le créneau est valide`);
      
      // Vérifier s'il y a des chevauchements
      const hasConflict = (existingAppointments || []).some((apt: any) => {
        const aptStart = new Date(apt.appointment_date);
        const aptEnd = new Date(aptStart.getTime() + (apt.duration || 30) * 60000);
        
        // Vérifier si les créneaux se chevauchent
        // Chevauchement si: aptStart < appointmentEndTime ET aptEnd > appointmentStartTime
        const overlaps = aptStart < appointmentEndTime && aptEnd > appointmentStartTime;
        
        if (overlaps) {
          console.warn('[POST /api/appointments] ⚠️ CHEVAUCHEMENT DÉTECTÉ:');
          console.warn('[POST /api/appointments] ⚠️   Rendez-vous existant:', apt.id);
          console.warn('[POST /api/appointments] ⚠️   Début existant:', aptStart.toISOString());
          console.warn('[POST /api/appointments] ⚠️   Fin existante:', aptEnd.toISOString());
          console.warn('[POST /api/appointments] ⚠️   Nouveau début:', appointmentStartTime.toISOString());
          console.warn('[POST /api/appointments] ⚠️   Nouvelle fin:', appointmentEndTime.toISOString());
        }
        
        return overlaps;
      });
      
      if (hasConflict) {
        console.error('[POST /api/appointments] ❌ IMPOSSIBLE DE CRÉER LE RENDEZ-VOUS: Chevauchement détecté!');
        return res.status(409).json({ 
          error: 'Créneau non disponible', 
          message: 'Ce créneau chevauche avec un rendez-vous existant pour ce styliste. Veuillez choisir un autre créneau.',
          details: 'Le styliste a déjà un rendez-vous à ce créneau'
        });
      }
      
      console.log('[POST /api/appointments] ✅ Aucun chevauchement détecté, création du rendez-vous...');
      
      // Vérifier que finalStylistId est défini
      if (!finalStylistId) {
        console.error('[POST /api/appointments] ❌ finalStylistId n\'est pas défini avant la création');
        return res.status(500).json({ 
          error: 'Erreur interne du serveur', 
          details: 'Le styliste n\'a pas pu être déterminé' 
        });
      }
      
      // Vérifier que finalClientId est défini
      if (!finalClientId) {
        console.error('[POST /api/appointments] ❌ finalClientId n\'est pas défini avant la création');
        return res.status(400).json({ 
          error: 'Client non identifié', 
          details: 'Impossible de déterminer le client pour ce rendez-vous' 
        });
      }
      
      // Mettre à jour les informations client si elles ont été fournies dans le formulaire
      if (normalizedClientInfo) {
        console.log('[POST /api/appointments] 📞 MISE À JOUR CLIENT - normalizedClientInfo.phone:', normalizedClientInfo.phone || '(vide)');
        const clientUpdateData: Record<string, string> = {};
        if (normalizedClientInfo.firstName) {
          clientUpdateData.first_name = normalizedClientInfo.firstName;
        }
        if (normalizedClientInfo.lastName) {
          clientUpdateData.last_name = normalizedClientInfo.lastName;
        }
        if (normalizedClientInfo.email) {
          clientUpdateData.email = normalizedClientInfo.email;
        }
        if (normalizedClientInfo.phone) {
          console.log('[POST /api/appointments] 📞   ✅ Ajout du numéro dans clientUpdateData:', normalizedClientInfo.phone);
          clientUpdateData.phone = normalizedClientInfo.phone;
        } else {
          console.log('[POST /api/appointments] 📞   ⚠️ Pas de numéro dans normalizedClientInfo, pas de mise à jour du numéro');
        }
        
        if (Object.keys(clientUpdateData).length > 0) {
          clientUpdateData.updated_at = new Date().toISOString();
          console.log('[POST /api/appointments] 📞   📝 Données à mettre à jour:', JSON.stringify(clientUpdateData, null, 2));
          const { error: clientUpdateError, data: clientUpdateDataResult } = await supabase
            .from('clients')
            .update(clientUpdateData)
            .eq('id', finalClientId)
            .select('phone');
          
          if (clientUpdateError) {
            console.warn('[POST /api/appointments] ⚠️ Impossible de mettre à jour les informations du client:', clientUpdateError.message);
          } else {
            console.log('[POST /api/appointments] 📞   ✅ Client mis à jour avec succès');
            if (clientUpdateDataResult && clientUpdateDataResult.length > 0) {
              console.log('[POST /api/appointments] 📞   📋 Numéro dans la DB après mise à jour:', clientUpdateDataResult[0].phone || '(vide)');
            }
          }
        } else {
          console.log('[POST /api/appointments] 📞   ⚠️ Aucune donnée à mettre à jour');
        }
      } else {
        console.log('[POST /api/appointments] 📞   ⚠️ normalizedClientInfo est null/undefined, pas de mise à jour du client');
      }
      
      console.log('[POST /api/appointments] 🔍 Données finales avant création:');
      console.log('[POST /api/appointments] 🔍   finalStylistId:', finalStylistId);
      console.log('[POST /api/appointments] 🔍   finalClientId:', finalClientId);
      console.log('[POST /api/appointments] 🔍   serviceId:', body.serviceId);
      console.log('[POST /api/appointments] 🔍   appointmentDate:', appointmentDate.toISOString());
      
      // Vérifier que salonId est défini
      const salonIdForInsert = body.salonId || previewSalon?.id || salonIdForQuery;
      if (!salonIdForInsert) {
        console.error('[POST /api/appointments] ❌ salonId n\'est pas défini avant la création');
        return res.status(500).json({ 
          error: 'Erreur interne du serveur', 
          details: 'Le salon n\'a pas pu être déterminé' 
        });
      }
      
      // Créer le rendez-vous dans Supabase
      // Note: La table appointments utilise appointment_date et duration, pas start_time/end_time
      // S'assurer que toutes les valeurs sont définies et non null
      // IMPORTANT: La table utilise uuid('id') avec defaultRandom(), donc on doit utiliser un UUID valide
      const appointmentData: any = {
        id: randomUUID(), // UUID valide pour la base de données
        salon_id: salonIdForInsert,
        client_id: finalClientId, // Utiliser le clientId de la session si disponible
        stylist_id: finalStylistId, // Utiliser le stylistId validé
        service_id: body.serviceId,
        appointment_date: appointmentDate.toISOString(),
        duration: duration,
        status: body.status || 'confirmed',
        notes: body.notes || null, // Utiliser null au lieu de chaîne vide pour les notes
      };
      
      // Validation finale des données avant insertion
      if (!appointmentData.salon_id || !appointmentData.client_id || !appointmentData.stylist_id || !appointmentData.service_id) {
        console.error('[POST /api/appointments] ❌ Données incomplètes avant insertion:');
        console.error('[POST /api/appointments] ❌   salon_id:', appointmentData.salon_id);
        console.error('[POST /api/appointments] ❌   client_id:', appointmentData.client_id);
        console.error('[POST /api/appointments] ❌   stylist_id:', appointmentData.stylist_id);
        console.error('[POST /api/appointments] ❌   service_id:', appointmentData.service_id);
        return res.status(500).json({ 
          error: 'Erreur interne du serveur', 
          details: 'Données incomplètes pour la création du rendez-vous' 
        });
      }
      
      console.log('[POST /api/appointments] Données du rendez-vous:', JSON.stringify(appointmentData, null, 2));
      console.log('[POST /api/appointments] client_id dans appointmentData:', appointmentData.client_id);
      console.log('[POST /api/appointments] client_id type:', typeof appointmentData.client_id);
      
      console.log('[POST /api/appointments] 🔍 Tentative d\'insertion dans Supabase...');
      console.log('[POST /api/appointments] 🔍   appointmentData complet:', JSON.stringify(appointmentData, null, 2));
      
      const { data: newAppointment, error: insertError } = await supabase
        .from('appointments')
        .insert([appointmentData])
        .select()
        .single();
      
      if (insertError) {
        console.error('[POST /api/appointments] ❌ Erreur Supabase lors de l\'insertion:');
        console.error('[POST /api/appointments] ❌   Code:', insertError.code);
        console.error('[POST /api/appointments] ❌   Message:', insertError.message);
        console.error('[POST /api/appointments] ❌   Details:', insertError.details);
        console.error('[POST /api/appointments] ❌   Hint:', insertError.hint);
        console.error('[POST /api/appointments] ❌   Données tentées:', JSON.stringify(appointmentData, null, 2));
        
        // Vérifier si c'est une erreur de contrainte
        if (insertError.code === '23503') {
          return res.status(400).json({ 
            error: 'Erreur de référence', 
            details: 'Une référence (client, styliste, service ou salon) n\'existe pas dans la base de données',
            hint: insertError.hint || insertError.message
          });
        }
        
        if (insertError.code === '23505') {
          return res.status(409).json({ 
            error: 'Rendez-vous déjà existant', 
            details: 'Un rendez-vous avec cet ID existe déjà',
            hint: insertError.hint || insertError.message
          });
        }
        
        return res.status(500).json({ 
          error: 'Erreur lors de la création du rendez-vous', 
          details: insertError.message || 'Erreur inconnue lors de l\'insertion',
          code: insertError.code,
          hint: insertError.hint
        });
      }
      
      console.log('[POST /api/appointments] Rendez-vous créé avec succès:', JSON.stringify(newAppointment, null, 2));
      console.log('[POST /api/appointments] ✅ client_id dans le rendez-vous créé:', newAppointment?.client_id);
      console.log('[POST /api/appointments] ✅ client_id type:', typeof newAppointment?.client_id);
      
      // Vérifier immédiatement si on peut récupérer ce rendez-vous
      const { data: verifyAppointment, error: verifyError } = await supabase
        .from('appointments')
        .select('id, client_id, appointment_date, status')
        .eq('client_id', finalClientId) // Utiliser le clientId final
        .eq('id', newAppointment.id)
        .single();
      
      console.log('[POST /api/appointments] 🔍 Vérification immédiate - Rendez-vous trouvé:', verifyAppointment ? 'OUI' : 'NON');
      if (verifyAppointment) {
        console.log('[POST /api/appointments] 🔍 client_id dans la vérification:', verifyAppointment.client_id);
        console.log('[POST /api/appointments] 🔍 client_id correspond:', verifyAppointment.client_id === finalClientId);
      }
      if (verifyError) {
        console.error('[POST /api/appointments] ❌ Erreur vérification:', verifyError);
      }
      
      // Vérification supplémentaire : essayer de récupérer tous les rendez-vous de ce client
      const { data: allClientAppointments, error: allError } = await supabase
        .from('appointments')
        .select('id, client_id, appointment_date, status')
        .eq('client_id', finalClientId)
        .order('appointment_date', { ascending: false })
        .limit(5);
      
      console.log('[POST /api/appointments] 🔍 Total rendez-vous pour ce client:', allClientAppointments?.length || 0);
      if (allClientAppointments && allClientAppointments.length > 0) {
        console.log('[POST /api/appointments] 🔍 Derniers rendez-vous du client:', JSON.stringify(allClientAppointments, null, 2));
        const justCreated = allClientAppointments.find((apt: any) => apt.id === newAppointment.id);
        console.log('[POST /api/appointments] 🔍 Rendez-vous créé trouvé dans la liste:', justCreated ? 'OUI' : 'NON');
      }
      if (allError) {
        console.error('[POST /api/appointments] ❌ Erreur récupération tous rendez-vous:', allError);
      }
      
      // Calculer endTime à partir de appointment_date + duration
      const startTime = new Date(newAppointment.appointment_date);
      const endTime = new Date(startTime.getTime() + (newAppointment.duration || duration) * 60000);
      
      // Mapper pour le format attendu par le frontend
      const mappedAppointment = {
        id: newAppointment.id,
        salonId: newAppointment.salon_id,
        clientId: newAppointment.client_id,
        stylistId: newAppointment.stylist_id,
        serviceId: newAppointment.service_id,
        startTime: newAppointment.appointment_date,
        endTime: endTime.toISOString(),
        status: newAppointment.status || 'scheduled',
        notes: newAppointment.notes || null,
        totalAmount: service.price || 0,
        createdAt: newAppointment.created_at,
        updatedAt: newAppointment.updated_at,
      };
      
      console.log('[POST /api/appointments] ✅ Rendez-vous créé:', mappedAppointment.id);
      
      // Envoyer les notifications de confirmation avec la nouvelle logique optimisée
      try {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[POST /api/appointments] 📧 ENVOI DES NOTIFICATIONS OPTIMISÉES');
        console.log('═══════════════════════════════════════════════════════════════');
        
        const appointmentDate = new Date(newAppointment.appointment_date);
        const createdAt = new Date(newAppointment.created_at || new Date());
        
        const { sendAppointmentCreationNotifications } = await import('./core/notifications/optimizedNotificationService.js');
        const notificationResult = await sendAppointmentCreationNotifications(
          newAppointment.id,
          appointmentDate,
          createdAt
        );
        
        console.log('[POST /api/appointments] 📊 Résultat des notifications:');
        console.log(`  📧 Email envoyé: ${notificationResult.emailSent ? '✅' : '❌'}`);
        console.log(`  📱 SMS envoyé: ${notificationResult.smsSent ? '✅' : '❌'}`);
        console.log(`  ⏭️  Skip reminder SMS: ${notificationResult.skipReminderSms ? '✅' : '❌'}`);
        if (notificationResult.errors.length > 0) {
          console.warn(`  ⚠️  Erreurs: ${notificationResult.errors.join(', ')}`);
        }
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
      } catch (notificationError: any) {
        // Ne pas faire échouer la création du rendez-vous si les notifications échouent
        console.error('[POST /api/appointments] ❌ Erreur lors de l\'envoi des notifications:', notificationError);
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
        // Le rendez-vous est quand même créé, on continue
      }
      
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[POST /api/appointments] ✅ RENDEZ-VOUS CRÉÉ AVEC SUCCÈS');
      console.log('[POST /api/appointments] 📋 ID:', mappedAppointment.id);
      console.log('[POST /api/appointments] 📅 Date:', mappedAppointment.startTime);
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      
      return res.json(mappedAppointment);
    } else {
      // Fallback vers mémoire si Supabase n'est pas configuré
      const newAppointment = {
        id: Math.random().toString(36).slice(2),
        salonId: previewSalon.id,
        clientId: body.clientId,
        stylistId: body.stylistId,
        serviceId: body.serviceId,
        startTime: body.startTime,
        endTime: body.endTime,
        status: body.status || 'pending',
        channel: body.channel || 'form',
        depositAmount: body.depositAmount || 0,
        totalAmount: body.totalAmount || 0,
        paymentStatus: body.paymentStatus || 'pending',
        notes: body.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      previewAppointments.push(newAppointment);
      return res.json(newAppointment);
    }
  } catch (error: any) {
    console.error('[POST /api/appointments] ❌ Erreur inattendue:', error);
    console.error('[POST /api/appointments] ❌ Type d\'erreur:', error?.constructor?.name);
    console.error('[POST /api/appointments] ❌ Message:', error?.message);
    console.error('[POST /api/appointments] ❌ Stack trace:', error?.stack);
    console.error('[POST /api/appointments] ❌ Body reçu:', JSON.stringify(req.body, null, 2));
    console.error('[POST /api/appointments] ❌ Code d\'erreur:', error?.code);
    console.error('[POST /api/appointments] ❌ Détails:', error?.details);
    
    // Si c'est une erreur Supabase, inclure plus de détails
    if (error?.code || error?.hint || error?.details) {
      console.error('[POST /api/appointments] ❌ Erreur Supabase détectée:', {
        code: error.code,
        message: error.message,
        hint: error.hint,
        details: error.details
      });
    }
    
    return res.status(500).json({ 
      error: 'Erreur interne du serveur', 
      details: error?.message || 'Une erreur inattendue s\'est produite',
      code: error?.code,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

app.put('/api/appointments/:id', express.json(), async (req, res) => {
  const appointmentId = req.params.id;
  const body = req.body || {};
  
  console.log('[PUT /api/appointments/:id] Mise à jour du rendez-vous:', appointmentId);
  console.log('[PUT /api/appointments/:id] Données reçues:', JSON.stringify(body, null, 2));
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Vérifier d'abord si le rendez-vous existe
      const { data: existingAppointment, error: fetchError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .maybeSingle();
      
      if (fetchError) {
        console.error('[PUT /api/appointments/:id] Erreur lors de la récupération du rendez-vous:', fetchError);
        return res.status(500).json({ error: 'Erreur lors de la vérification du rendez-vous', details: fetchError.message });
      }
      
      if (!existingAppointment) {
        console.log('[PUT /api/appointments/:id] Rendez-vous non trouvé:', appointmentId);
        return res.status(404).json({ error: 'Rendez-vous non trouvé', message: "Appointment not found" });
      }
      
      // Préparer les données de mise à jour
      // Mapper les champs du body vers les colonnes de la base de données
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      // Mapper les champs si fournis
      if (body.clientId !== undefined) updateData.client_id = body.clientId;
      if (body.stylistId !== undefined) updateData.stylist_id = body.stylistId;
      if (body.serviceId !== undefined) updateData.service_id = body.serviceId;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.notes !== undefined) updateData.notes = body.notes || null;
      
      // Gérer la date/heure
      if (body.startTime !== undefined) {
        updateData.appointment_date = new Date(body.startTime).toISOString();
      }
      
      // Gérer la durée
      if (body.duration !== undefined) {
        updateData.duration = Number(body.duration);
      } else if (body.serviceId && body.serviceId !== existingAppointment.service_id) {
        // Si le service change, récupérer la durée du nouveau service
        const { data: service, error: serviceError } = await supabase
          .from('services')
          .select('duration')
          .eq('id', body.serviceId)
          .maybeSingle();
        
        if (!serviceError && service) {
          updateData.duration = service.duration || existingAppointment.duration;
        }
      }
      
      // Vérifier les chevauchements si la date/heure ou le styliste change
      if ((body.startTime !== undefined || body.stylistId !== undefined) && body.startTime) {
        const appointmentStartTime = new Date(body.startTime);
        const duration = updateData.duration || existingAppointment.duration || 30;
        const appointmentEndTime = new Date(appointmentStartTime.getTime() + duration * 60000);
        const finalStylistId = body.stylistId || existingAppointment.stylist_id;
        
        // Récupérer les rendez-vous du styliste pour la journée (sauf celui qu'on modifie)
        const dayStart = new Date(appointmentStartTime);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(appointmentStartTime);
        dayEnd.setHours(23, 59, 59, 999);
        
        const { data: conflictingAppointments, error: checkError } = await supabase
          .from('appointments')
          .select('id, appointment_date, duration')
          .eq('stylist_id', finalStylistId)
          .neq('id', appointmentId) // Exclure le rendez-vous qu'on modifie
          .neq('status', 'cancelled')
          .gte('appointment_date', dayStart.toISOString())
          .lte('appointment_date', dayEnd.toISOString());
        
        if (checkError) {
          console.error('[PUT /api/appointments/:id] Erreur lors de la vérification des chevauchements:', checkError);
        } else if (conflictingAppointments) {
          const hasConflict = conflictingAppointments.some((apt: any) => {
            const aptStart = new Date(apt.appointment_date);
            const aptEnd = new Date(aptStart.getTime() + (apt.duration || 30) * 60000);
            return aptStart < appointmentEndTime && aptEnd > appointmentStartTime;
          });
          
          if (hasConflict) {
            console.warn('[PUT /api/appointments/:id] ⚠️ Chevauchement détecté!');
            return res.status(409).json({ 
              error: 'Créneau non disponible', 
              message: 'Ce créneau chevauche avec un rendez-vous existant pour ce styliste. Veuillez choisir un autre créneau.',
              details: 'Le styliste a déjà un rendez-vous à ce créneau'
            });
          }
        }
        
        // VÉRIFIER LES HORAIRES SPÉCIFIQUES DU STYLISTE
        const dayOfWeek = appointmentStartTime.getDay(); // 0 = dimanche, 1 = lundi, etc.
        console.log('[PUT /api/appointments/:id] 🔍 Vérification des horaires du styliste pour jour:', dayOfWeek);
        
        const { data: stylistSchedule, error: scheduleError } = await supabase
          .from('stylist_schedule')
          .select('day_of_week, start_time, end_time, is_available')
          .eq('stylist_id', finalStylistId)
          .eq('day_of_week', dayOfWeek)
          .single();
        
        if (scheduleError && scheduleError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('[PUT /api/appointments/:id] ❌ Erreur lors de la récupération des horaires du styliste:', scheduleError);
          // Ne pas bloquer si la table n'existe pas ou si aucune ligne n'est trouvée
        } else if (stylistSchedule) {
          console.log('[PUT /api/appointments/:id] 📅 Horaire styliste trouvé:', stylistSchedule);
          
          // Si le styliste est marqué comme indisponible ce jour-là
          if (stylistSchedule.is_available === false) {
            const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
            console.warn(`[PUT /api/appointments/:id] ❌ Le styliste n'est pas disponible le ${dayNames[dayOfWeek]}`);
            return res.status(409).json({ 
              error: `Le styliste n'est pas disponible le ${dayNames[dayOfWeek]}` 
            });
          }
          
          // Vérifier que l'heure du rendez-vous est dans les horaires du styliste
          if (stylistSchedule.start_time && stylistSchedule.end_time) {
            const appointmentHour = appointmentStartTime.getHours();
            const appointmentMinute = appointmentStartTime.getMinutes();
            const appointmentTimeMinutes = appointmentHour * 60 + appointmentMinute;
            
            // Parser les horaires du styliste (format TIME ou HH:MM)
            const stylistStart = stylistSchedule.start_time.toString().substring(0, 5); // "HH:MM"
            const stylistEnd = stylistSchedule.end_time.toString().substring(0, 5);
            
            const [startHour, startMin] = stylistStart.split(':').map(Number);
            const [endHour, endMin] = stylistEnd.split(':').map(Number);
            
            const stylistStartMinutes = startHour * 60 + startMin;
            const stylistEndMinutes = endHour * 60 + endMin;
            
            // Vérifier que le rendez-vous commence dans les horaires du styliste
            // ET que le rendez-vous se termine dans les horaires du styliste
            const appointmentEndTimeMinutes = appointmentTimeMinutes + duration;
            
            if (appointmentTimeMinutes < stylistStartMinutes || appointmentEndTimeMinutes > stylistEndMinutes) {
              console.warn(`[PUT /api/appointments/:id] ❌ Le rendez-vous (${appointmentHour}:${String(appointmentMinute).padStart(2, '0')}) n'est pas dans les horaires du styliste (${stylistStart} - ${stylistEnd})`);
              return res.status(409).json({ 
                error: `Le rendez-vous n'est pas dans les horaires du styliste (${stylistStart} - ${stylistEnd})` 
              });
            }
            
            console.log(`[PUT /api/appointments/:id] ✅ Le rendez-vous est dans les horaires du styliste (${stylistStart} - ${stylistEnd})`);
          }
        } else {
          console.log('[PUT /api/appointments/:id] ℹ️ Aucun horaire spécifique trouvé pour ce styliste, utilisation des horaires du salon');
        }
      }
      
      console.log('[PUT /api/appointments/:id] Données de mise à jour:', JSON.stringify(updateData, null, 2));
      
      // Mettre à jour le rendez-vous dans Supabase
      const { data: updatedAppointment, error: updateError } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId)
        .select()
        .single();
      
      if (updateError) {
        console.error('[PUT /api/appointments/:id] Erreur lors de la mise à jour:', updateError);
        return res.status(500).json({ error: 'Erreur lors de la mise à jour du rendez-vous', details: updateError.message });
      }
      
      // Mettre à jour le cache mémoire si le rendez-vous y existe
      const appointmentIndex = previewAppointments.findIndex(a => a.id === appointmentId);
      if (appointmentIndex >= 0) {
        previewAppointments[appointmentIndex] = { 
          ...previewAppointments[appointmentIndex], 
          ...body, 
          updatedAt: new Date().toISOString() 
        };
      }
      
      // Calculer endTime pour la réponse
      const startTime = updatedAppointment.appointment_date;
      const endTime = new Date(new Date(startTime).getTime() + (updatedAppointment.duration || 30) * 60000);
      
      // Mapper pour le format attendu par le frontend
      const mappedAppointment = {
        id: updatedAppointment.id,
        salonId: updatedAppointment.salon_id,
        clientId: updatedAppointment.client_id,
        stylistId: updatedAppointment.stylist_id,
        serviceId: updatedAppointment.service_id,
        startTime: updatedAppointment.appointment_date,
        endTime: endTime.toISOString(),
        status: updatedAppointment.status || 'scheduled',
        notes: updatedAppointment.notes || null,
        duration: updatedAppointment.duration || 30,
        createdAt: updatedAppointment.created_at,
        updatedAt: updatedAppointment.updated_at,
      };
      
      console.log('[PUT /api/appointments/:id] ✅ Rendez-vous mis à jour avec succès:', appointmentId);
      
      // Envoyer les notifications de modification ou d'annulation
      try {
        const notificationContext = await buildNotificationContext(appointmentId, supabase);
        if (notificationContext) {
          // Déterminer si c'est une annulation ou une modification
          const isCancellation = updatedAppointment.status === 'cancelled' || body.status === 'cancelled';
          
          if (isCancellation) {
            notificationContext.cancellationReason = body.cancellationReason || 'Annulé par le salon';
            console.log('[PUT /api/appointments/:id] 📧 Envoi de la notification d\'annulation...');
            await notificationService.sendBookingCancellation(notificationContext);
          } else {
            // Détecter les changements pour le message de modification
            const changes: string[] = [];
            if (body.startTime && body.startTime !== existingAppointment.appointment_date) {
              changes.push('date/heure');
            }
            if (body.stylistId && body.stylistId !== existingAppointment.stylist_id) {
              changes.push('coiffeur·euse');
            }
            if (body.serviceId && body.serviceId !== existingAppointment.service_id) {
              changes.push('service');
            }
            
            notificationContext.modificationDetails = changes.length > 0 
              ? `Modification de : ${changes.join(', ')}`
              : 'Modification du rendez-vous';
            
            console.log('[PUT /api/appointments/:id] 📧 Envoi de la notification de modification...');
            await notificationService.sendBookingModification(notificationContext);
          }
          console.log('[PUT /api/appointments/:id] ✅ Notification envoyée avec succès');
        } else {
          console.warn('[PUT /api/appointments/:id] ⚠️ Impossible de construire le contexte de notification');
        }
      } catch (notificationError: any) {
        // Ne pas faire échouer la modification si les notifications échouent
        console.error('[PUT /api/appointments/:id] ❌ Erreur lors de l\'envoi des notifications:', notificationError);
        // La modification est quand même effectuée, on continue
      }
      
      return res.json(mappedAppointment);
    } else {
      // Fallback mémoire si Supabase n'est pas configuré
      const appointmentIndex = previewAppointments.findIndex(a => a.id === appointmentId);
      if (appointmentIndex >= 0) {
        previewAppointments[appointmentIndex] = { 
          ...previewAppointments[appointmentIndex], 
          ...body, 
          updatedAt: new Date().toISOString() 
        };
        console.log('[PUT /api/appointments/:id] Rendez-vous mis à jour dans le cache mémoire:', appointmentId);
        return res.json(previewAppointments[appointmentIndex]);
      } else {
        console.log('[PUT /api/appointments/:id] Rendez-vous non trouvé dans le cache:', appointmentId);
        return res.status(404).json({ error: 'Rendez-vous non trouvé', message: "Appointment not found" });
      }
    }
  } catch (error: any) {
    console.error('[PUT /api/appointments/:id] Erreur inattendue:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur', details: error.message });
  }
});

app.delete('/api/appointments/:id', express.json(), async (req, res) => {
  let appointmentId: string;
  try {
    appointmentId = decodeURIComponent(req.params.id);
  } catch (e) {
    // Si le décodage échoue, utiliser l'ID brut
    appointmentId = req.params.id;
  }
  
  console.log('[DELETE /api/appointments/:id] ============================================');
  console.log('[DELETE /api/appointments/:id] Requête DELETE reçue');
  console.log('[DELETE /api/appointments/:id] URL complète:', req.url);
  console.log('[DELETE /api/appointments/:id] ID brut (params):', req.params.id);
  console.log('[DELETE /api/appointments/:id] ID décodé:', appointmentId);
  console.log('[DELETE /api/appointments/:id] User:', req.user?.id || 'NON AUTHENTIFIÉ');
  console.log('[DELETE /api/appointments/:id] Method:', req.method);
  console.log('[DELETE /api/appointments/:id] ============================================');
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[DELETE /api/appointments/:id] ❌ Configuration Supabase manquante');
    return res.status(500).json({ error: 'Configuration serveur incomplète' });
  }
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Vérifier d'abord si le rendez-vous existe (pour debug)
    console.log('[DELETE] 🔍 Vérification de l\'existence du rendez-vous avec ID:', appointmentId);
    const { data: existingAppointment, error: checkError } = await supabase
      .from('appointments')
      .select('id, status, appointment_date')
      .eq('id', appointmentId)
      .maybeSingle();
    
    if (checkError) {
      console.error('[DELETE] ❌ Erreur lors de la vérification:', checkError);
    } else if (!existingAppointment) {
      console.error('[DELETE] ❌ Rendez-vous non trouvé avec ID:', appointmentId);
      // Log les derniers rendez-vous pour debug
      const { data: recent } = await supabase
        .from('appointments')
        .select('id, appointment_date, status')
        .order('created_at', { ascending: false })
        .limit(5);
      console.log('[DELETE] 🔍 Derniers rendez-vous dans la base:', recent?.map(a => ({ id: a.id, date: a.appointment_date, status: a.status })));
      return res.status(404).json({ error: 'Rendez-vous introuvable' });
    } else {
      console.log('[DELETE] ✅ Rendez-vous trouvé:', { id: existingAppointment.id, status: existingAppointment.status, date: existingAppointment.appointment_date });
    }

    const cancellationResult = await cancelAppointment(
      {
        supabase,
        appointmentId,
        cancelledById: req.user?.id || 'manager-dashboard',
        cancelledByRole: 'manager',
        cancellationReason: req.body?.cancellationReason || 'Annulé par le salon',
      },
      { notificationService },
    );

    if (!cancellationResult.success) {
      console.error('[DELETE /api/appointments/:id] ❌ Échec de l\'annulation:', cancellationResult.error);
      return res
        .status(cancellationResult.status || 500)
        .json({ error: cancellationResult.error || "Impossible d'annuler le rendez-vous" });
    }

    // Mettre à jour le cache mémoire si nécessaire
    const appointmentIndex = previewAppointments.findIndex((a) => a.id === appointmentId);
    if (appointmentIndex >= 0) {
      previewAppointments[appointmentIndex] = {
        ...previewAppointments[appointmentIndex],
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      };
    }

    console.log('[DELETE /api/appointments/:id] ✅ Rendez-vous annulé via service unifié:', appointmentId);
    
    return res.json({
      success: true,
      message: 'Rendez-vous annulé avec succès',
      appointment: cancellationResult.appointment,
    });
  } catch (error: any) {
    console.error('[DELETE /api/appointments/:id] Erreur inattendue:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur', details: error.message });
  }
});

// ============================================================================
// ENDPOINTS API POUR LES PARAMÈTRES DE NOTIFICATIONS (OWNER/MANAGER)
// ============================================================================
// 
// Ces endpoints permettent à l'owner/manager de configurer les templates
// de notifications (emails et SMS) ainsi que le délai d'envoi des rappels.
//
// Sécurité: Accessibles uniquement aux owners authentifiés
// ============================================================================

// GET /api/owner/notification-settings
// Récupère les paramètres de notifications pour le salon de l'owner connecté
app.get('/api/owner/notification-settings', async (req, res) => {
  console.log('[GET /api/owner/notification-settings] ✅ Route appelée');
  console.log('[GET /api/owner/notification-settings] req.user:', req.user);
  console.log('[GET /api/owner/notification-settings] req.path:', req.path);
  console.log('[GET /api/owner/notification-settings] req.originalUrl:', req.originalUrl);
  
  try {
    // Vérifier l'authentification owner
    if (!req.user || req.user.userType !== 'owner') {
      console.log('[GET /api/owner/notification-settings] ❌ Non autorisé - req.user:', req.user);
      return res.status(401).json({ error: 'Non autorisé. Connexion owner requise.' });
    }

    let salonId = req.user.salonId;
    if (!salonId) {
      return res.status(400).json({ error: 'Salon ID manquant. Veuillez vérifier votre compte.' });
    }

    // Normaliser le salonId : ajouter le préfixe "salon-" si absent (format attendu par la base)
    if (!salonId.startsWith('salon-')) {
      salonId = `salon-${salonId}`;
    }

    // Valider que le salonId a un format valide (après normalisation)
    // Format attendu: "salon-{uuid}" ou juste "{uuid}"
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const salonIdWithoutPrefix = salonId.replace(/^salon-/, '');
    if (!uuidPattern.test(salonIdWithoutPrefix)) {
      console.error('[GET /api/owner/notification-settings] ❌ Format salonId invalide:', salonId);
      return res.status(400).json({ error: 'Format de Salon ID invalide.' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { createNotificationSettingsRepository } = await import('./core/notifications/NotificationSettingsRepository.js');
    const settingsRepo = createNotificationSettingsRepository(supabase);

    const settings = await settingsRepo.getSettings(salonId);

    return res.json({
      confirmationEmailSubject: settings.confirmationEmailSubject,
      confirmationEmailText: settings.confirmationEmailText,
      confirmationEmailHtml: settings.confirmationEmailHtml, // Généré automatiquement, conservé pour compatibilité
      confirmationSmsText: settings.confirmationSmsText,
      reminderSmsText: settings.reminderSmsText,
      reminderOffsetHours: settings.reminderOffsetHours,
    });
  } catch (error: any) {
    console.error('[GET /api/owner/notification-settings] Erreur:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération des paramètres', details: error.message });
  }
});

// PUT /api/owner/notification-settings
// Met à jour les paramètres de notifications pour le salon de l'owner connecté
app.put('/api/owner/notification-settings', express.json(), async (req, res) => {
  console.log('[PUT /api/owner/notification-settings] Requête reçue');
  console.log('[PUT /api/owner/notification-settings] req.user:', req.user);
  console.log('[PUT /api/owner/notification-settings] req.path:', req.path);
  console.log('[PUT /api/owner/notification-settings] req.originalUrl:', req.originalUrl);
  
  try {
    // Vérifier l'authentification owner
    if (!req.user || req.user.userType !== 'owner') {
      console.log('[PUT /api/owner/notification-settings] ❌ Non autorisé - req.user:', req.user);
      return res.status(401).json({ error: 'Non autorisé. Connexion owner requise.' });
    }

    let salonId = req.user.salonId;
    if (!salonId) {
      return res.status(400).json({ error: 'Salon ID manquant. Veuillez vérifier votre compte.' });
    }

    // Normaliser le salonId : ajouter le préfixe "salon-" si absent (format attendu par la base)
    if (!salonId.startsWith('salon-')) {
      salonId = `salon-${salonId}`;
    }

    // Valider que le salonId a un format valide (après normalisation)
    // Format attendu: "salon-{uuid}" ou juste "{uuid}"
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const salonIdWithoutPrefix = salonId.replace(/^salon-/, '');
    if (!uuidPattern.test(salonIdWithoutPrefix)) {
      console.error('[PUT /api/owner/notification-settings] ❌ Format salonId invalide:', salonId);
      return res.status(400).json({ error: 'Format de Salon ID invalide.' });
    }

    const body = req.body || {};
    
    // Log pour debug - TOUJOURS activé
    console.log('[PUT /api/owner/notification-settings] Body reçu:', {
      confirmationEmailSubject: body.confirmationEmailSubject ? `[${body.confirmationEmailSubject.length} chars] "${body.confirmationEmailSubject}"` : 'NON DÉFINI',
      confirmationEmailText: body.confirmationEmailText ? `[${body.confirmationEmailText.length} chars] "${body.confirmationEmailText.length > 50 ? body.confirmationEmailText.substring(0, 50) + '...' : body.confirmationEmailText}"` : 'NON DÉFINI',
      confirmationSmsText: body.confirmationSmsText ? `[${body.confirmationSmsText.length} chars]` : 'NON DÉFINI',
      keys: Object.keys(body),
    });
    
    // Valider les champs
    const updateData: any = {};
    
    if (body.confirmationEmailSubject !== undefined) {
      if (typeof body.confirmationEmailSubject !== 'string' || body.confirmationEmailSubject.length > 500) {
        return res.status(400).json({ error: 'confirmationEmailSubject doit être une chaîne de moins de 500 caractères' });
      }
      updateData.confirmationEmailSubject = body.confirmationEmailSubject;
      console.log('[PUT /api/owner/notification-settings] confirmationEmailSubject ajouté à updateData:', updateData.confirmationEmailSubject);
    }

    // Accepter confirmationEmailText (nouveau champ texte simple)
    if (body.confirmationEmailText !== undefined) {
      if (typeof body.confirmationEmailText !== 'string' || body.confirmationEmailText.length > 10000) {
        return res.status(400).json({ error: 'confirmationEmailText doit être une chaîne de moins de 10000 caractères' });
      }
      updateData.confirmationEmailText = body.confirmationEmailText;
      // Le HTML sera généré automatiquement par le repository
      console.log('[PUT /api/owner/notification-settings] confirmationEmailText ajouté à updateData:', {
        length: updateData.confirmationEmailText.length,
        preview: updateData.confirmationEmailText.length > 50 ? updateData.confirmationEmailText.substring(0, 50) + '...' : updateData.confirmationEmailText,
      });
    } else {
      console.warn('[PUT /api/owner/notification-settings] ⚠️ confirmationEmailText NON DÉFINI dans le body!');
    }
    
    // Garder confirmationEmailHtml pour compatibilité (mais ne plus l'utiliser directement)
    if (body.confirmationEmailHtml !== undefined) {
      if (typeof body.confirmationEmailHtml !== 'string' || body.confirmationEmailHtml.length > 50000) {
        return res.status(400).json({ error: 'confirmationEmailHtml doit être une chaîne de moins de 50000 caractères' });
      }
      updateData.confirmationEmailHtml = body.confirmationEmailHtml;
    }

    if (body.confirmationSmsText !== undefined) {
      if (typeof body.confirmationSmsText !== 'string' || body.confirmationSmsText.length > 1000) {
        return res.status(400).json({ error: 'confirmationSmsText doit être une chaîne de moins de 1000 caractères' });
      }
      updateData.confirmationSmsText = body.confirmationSmsText;
    }

    if (body.reminderSmsText !== undefined) {
      if (typeof body.reminderSmsText !== 'string' || body.reminderSmsText.length > 1000) {
        return res.status(400).json({ error: 'reminderSmsText doit être une chaîne de moins de 1000 caractères' });
      }
      updateData.reminderSmsText = body.reminderSmsText;
    }

    if (body.reminderOffsetHours !== undefined) {
      const offsetHours = parseInt(body.reminderOffsetHours, 10);
      if (isNaN(offsetHours) || ![12, 24, 48].includes(offsetHours)) {
        return res.status(400).json({ error: 'reminderOffsetHours doit être 12, 24 ou 48' });
      }
      updateData.reminderOffsetHours = offsetHours;
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { createNotificationSettingsRepository } = await import('./core/notifications/NotificationSettingsRepository.js');
    const settingsRepo = createNotificationSettingsRepository(supabase);

    const updatedSettings = await settingsRepo.updateSettings(salonId, updateData);

    return res.json({
      confirmationEmailSubject: updatedSettings.confirmationEmailSubject,
      confirmationEmailText: updatedSettings.confirmationEmailText,
      confirmationEmailHtml: updatedSettings.confirmationEmailHtml, // Généré automatiquement
      confirmationSmsText: updatedSettings.confirmationSmsText,
      reminderSmsText: updatedSettings.reminderSmsText,
      reminderOffsetHours: updatedSettings.reminderOffsetHours,
    });
  } catch (error: any) {
    console.error('[PUT /api/owner/notification-settings] Erreur:', error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres', details: error.message });
  }
});

// ============================================================================
// ENDPOINT POUR ENVOYER UN EMAIL DE TEST
// ============================================================================
// 
// Permet à l'owner/manager d'envoyer un email de test avec les templates actuels
// pour valider visuellement les modifications
// ============================================================================
app.post('/api/owner/notifications/send-test-email', express.json(), async (req, res) => {
  console.log('[POST /api/owner/notifications/send-test-email] ✅ Route appelée');
  console.log('[POST /api/owner/notifications/send-test-email] req.method:', req.method);
  console.log('[POST /api/owner/notifications/send-test-email] req.path:', req.path);
  console.log('[POST /api/owner/notifications/send-test-email] req.originalUrl:', req.originalUrl);
  console.log('[POST /api/owner/notifications/send-test-email] req.user:', req.user);
  
  try {
    // Vérifier l'authentification owner
    if (!req.user || req.user.userType !== 'owner') {
      console.log('[POST /api/owner/notifications/send-test-email] ❌ Non autorisé - req.user:', req.user);
      return res.status(401).json({ error: 'Non autorisé. Connexion owner requise.' });
    }

    let salonId = req.user.salonId;
    if (!salonId) {
      return res.status(400).json({ error: 'Salon ID manquant. Veuillez vérifier votre compte.' });
    }

    // Normaliser le salonId
    if (!salonId.startsWith('salon-')) {
      salonId = `salon-${salonId}`;
    }

    const body = req.body || {};
    const testEmail = body.testEmail?.trim();

    // Récupérer l'email du salon ou de l'owner si testEmail n'est pas fourni
    let emailToUse = testEmail;
    if (!emailToUse) {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Configuration Supabase manquante' });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Essayer de récupérer l'email du salon
      const { data: salon } = await supabase
        .from('salons')
        .select('email')
        .eq('id', salonId)
        .maybeSingle();

      if (salon?.email) {
        emailToUse = salon.email;
      } else {
        // Essayer l'email de l'owner
        const ownerEmail = (req.user as any)?.email;
        if (ownerEmail) {
          emailToUse = ownerEmail;
        } else {
          return res.status(400).json({ 
            error: 'Adresse email de test requise. Veuillez fournir testEmail dans le body ou configurer un email pour le salon.' 
          });
        }
      }
    }

    // Valider le format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToUse)) {
      return res.status(400).json({ error: 'Format d\'email invalide' });
    }

    // Récupérer le nom du salon pour le contexte de test
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: salon } = await supabase
      .from('salons')
      .select('name')
      .eq('id', salonId)
      .maybeSingle();

    const salonName = salon?.name || 'Salon de Test';

    // Envoyer l'email de test via NotificationService
    const { notificationService } = await import('./core/notifications/index.js');
    const result = await notificationService.sendTestConfirmationEmail({
      to: emailToUse,
      salonId,
      salonName,
    });

    // Vérifier si l'envoi a réussi
    if (!result.emailResult.success) {
      console.error('[POST /api/owner/notifications/send-test-email] ❌ Échec de l\'envoi:', result.emailResult.error);
      return res.status(500).json({
        error: 'Échec de l\'envoi de l\'email via Resend',
        details: result.emailResult.error,
        to: emailToUse,
        templates: {
          subjectTemplate: result.subjectTemplate.substring(0, 200) + (result.subjectTemplate.length > 200 ? '...' : ''),
          htmlTemplate: result.htmlTemplate.substring(0, 200) + (result.htmlTemplate.length > 200 ? '...' : ''),
        },
        rendered: {
          subject: result.subjectRendered,
          htmlPreviewFirst200: result.htmlRendered.substring(0, 200) + (result.htmlRendered.length > 200 ? '...' : ''),
        },
      });
    }

    console.log('[POST /api/owner/notifications/send-test-email] ✅ Email envoyé avec succès à', emailToUse);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    return res.json({
      ok: true,
      to: emailToUse,
      templates: {
        subjectTemplate: result.subjectTemplate.substring(0, 200) + (result.subjectTemplate.length > 200 ? '...' : ''),
        htmlTemplate: result.htmlTemplate.substring(0, 200) + (result.htmlTemplate.length > 200 ? '...' : ''),
      },
      rendered: {
        subject: result.subjectRendered,
        htmlPreviewFirst200: result.htmlRendered.substring(0, 200) + (result.htmlRendered.length > 200 ? '...' : ''),
      },
      emailResult: result.emailResult,
    });
  } catch (error: any) {
    console.error('[POST /api/owner/notifications/send-test-email] Erreur:', error);
    return res.status(500).json({ 
      error: 'Erreur lors de l\'envoi de l\'email de test', 
      details: error.message 
    });
  }
});

// Versioning retiré : l'historique des templates reste stocké en base mais n'est
// plus exposé par l'API tant que la fonctionnalité n'est pas utilisée côté UI.

// ============================================================================
// ENDPOINTS POUR TESTER LES NOTIFICATIONS INTELLIGENTES
// ============================================================================
// 
// Ces endpoints permettent de tester manuellement les services de notifications
// intelligentes (Option B et Option C).
//
// Sécurité: Accessibles uniquement aux owners authentifiés
// ============================================================================

// POST /api/owner/notifications/test-confirmation-sms
// Teste l'envoi d'un SMS de confirmation pour un appointment (Option B)
app.post('/api/owner/notifications/test-confirmation-sms', express.json(), async (req, res) => {
  console.log('[POST /api/owner/notifications/test-confirmation-sms] ✅ Route appelée');
  
  try {
    // Vérifier l'authentification owner
    if (!req.user || req.user.userType !== 'owner') {
      console.log('[POST /api/owner/notifications/test-confirmation-sms] ❌ Non autorisé');
      return res.status(401).json({ 
        success: false,
        error: 'Non autorisé. Connexion owner requise.' 
      });
    }

    const body = req.body || {};
    const appointmentId = body.appointmentId?.trim();

    if (!appointmentId) {
      return res.status(400).json({ 
        success: false,
        error: 'appointmentId requis dans le body' 
      });
    }

    const { sendSmsConfirmationIfNeeded } = await import('./core/notifications/smsService.js');
    const result = await sendSmsConfirmationIfNeeded(appointmentId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        metadata: result.metadata,
      });
    }

    console.log('[POST /api/owner/notifications/test-confirmation-sms] ✅ SMS envoyé');

    return res.json({
      success: true,
      message: 'SMS de confirmation envoyé avec succès',
      metadata: result.metadata,
    });
  } catch (error: any) {
    console.error('[POST /api/owner/notifications/test-confirmation-sms] Erreur:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'envoi du SMS de confirmation', 
      details: error.message 
    });
  }
});

// POST /api/owner/notifications/test-reminder-sms
// Teste l'envoi d'un SMS de rappel pour un appointment (Option C)
app.post('/api/owner/notifications/test-reminder-sms', express.json(), async (req, res) => {
  console.log('[POST /api/owner/notifications/test-reminder-sms] ✅ Route appelée');
  
  try {
    // Vérifier l'authentification owner
    if (!req.user || req.user.userType !== 'owner') {
      console.log('[POST /api/owner/notifications/test-reminder-sms] ❌ Non autorisé');
      return res.status(401).json({ 
        success: false,
        error: 'Non autorisé. Connexion owner requise.' 
      });
    }

    const body = req.body || {};
    const appointmentId = body.appointmentId?.trim();

    if (!appointmentId) {
      return res.status(400).json({ 
        success: false,
        error: 'appointmentId requis dans le body' 
      });
    }

    const { sendSmsReminderIfNeeded } = await import('./core/notifications/smsService.js');
    const result = await sendSmsReminderIfNeeded(appointmentId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        shouldRetry: result.shouldRetry,
        retryAt: result.retryAt,
        metadata: result.metadata,
      });
    }

    console.log('[POST /api/owner/notifications/test-reminder-sms] ✅ SMS envoyé');

    return res.json({
      success: true,
      message: 'SMS de rappel envoyé avec succès',
      metadata: result.metadata,
    });
  } catch (error: any) {
    console.error('[POST /api/owner/notifications/test-reminder-sms] Erreur:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'envoi du SMS de rappel', 
      details: error.message 
    });
  }
});

// ============================================================================
// ENDPOINT POUR ENVOYER UN SMS DE TEST
// ============================================================================
// 
// Cet endpoint permet à l'owner de tester l'envoi de SMS via le provider configuré.
// Il accepte un numéro de téléphone et un message de test.
//
// Usage:
//   POST /api/owner/notifications/send-test-sms
//   Body: { "to": "+41791234567", "message": "Message de test" }
//
// Sécurité: Accessible uniquement aux owners authentifiés
// ============================================================================

app.post('/api/owner/notifications/send-test-sms', express.json(), async (req, res) => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[POST /api/owner/notifications/send-test-sms] ✅ Route appelée');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[POST /api/owner/notifications/send-test-sms] req.method:', req.method);
  console.log('[POST /api/owner/notifications/send-test-sms] req.path:', req.path);
  console.log('[POST /api/owner/notifications/send-test-sms] req.originalUrl:', req.originalUrl);
  console.log('[POST /api/owner/notifications/send-test-sms] req.user:', req.user);
  console.log('[POST /api/owner/notifications/send-test-sms] req.body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Vérifier l'authentification owner
    if (!req.user || req.user.userType !== 'owner') {
      console.log('[POST /api/owner/notifications/send-test-sms] ❌ Non autorisé - req.user:', req.user);
      return res.status(401).json({ error: 'Non autorisé. Connexion owner requise.' });
    }

    let salonId = req.user.salonId;
    if (!salonId) {
      return res.status(400).json({ error: 'Salon ID manquant. Veuillez vérifier votre compte.' });
    }

    // Normaliser le salonId
    if (!salonId.startsWith('salon-')) {
      salonId = `salon-${salonId}`;
    }

    const body = req.body || {};
    const testPhone = body.to?.trim();
    const testMessage = body.message?.trim();

    // Valider les champs requis
    if (!testPhone) {
      return res.status(400).json({ 
        error: 'Numéro de téléphone requis. Veuillez fournir "to" dans le body (format E.164, ex: +41791234567).' 
      });
    }

    if (!testMessage) {
      return res.status(400).json({ 
        error: 'Message requis. Veuillez fournir "message" dans le body.' 
      });
    }

    // Valider le format du numéro (format E.164 : commence par + suivi de chiffres)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(testPhone)) {
      return res.status(400).json({ 
        error: 'Format de numéro invalide. Utilisez le format international E.164 (ex: +41791234567).' 
      });
    }

    // Valider la longueur du message (optionnel, mais recommandé)
    if (testMessage.length === 0) {
      return res.status(400).json({ error: 'Le message ne peut pas être vide.' });
    }

    if (testMessage.length > 1600) {
      console.warn('[POST /api/owner/notifications/send-test-sms] ⚠️  Message très long:', testMessage.length, 'caractères');
    }

    // Envoyer le SMS via NotificationService
    console.log('[POST /api/owner/notifications/send-test-sms] 📱 Préparation de l\'envoi SMS');
    console.log('[POST /api/owner/notifications/send-test-sms] 📱 To:', testPhone);
    console.log('[POST /api/owner/notifications/send-test-sms] 📱 Message:', testMessage);
    
    const { notificationService } = await import('./core/notifications/index.js');
    const result = await notificationService.sendSms({
      to: testPhone,
      message: testMessage,
    });
    
    console.log('[POST /api/owner/notifications/send-test-sms] 📊 Résultat:', JSON.stringify(result, null, 2));

    // Vérifier si l'envoi a réussi
    if (!result.success) {
      console.error('[POST /api/owner/notifications/send-test-sms] ❌ Échec de l\'envoi:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Échec de l\'envoi du SMS',
        details: result.error,
        to: testPhone,
        metadata: result.metadata,
      });
    }

    console.log('[POST /api/owner/notifications/send-test-sms] ✅ SMS envoyé avec succès à', testPhone);
    if (result.metadata?.dryRun) {
      console.log('[POST /api/owner/notifications/send-test-sms] ⚠️  Mode DRY RUN : SMS loggé mais pas envoyé');
      console.log('[POST /api/owner/notifications/send-test-sms] 💡 Pour envoyer de vrais SMS, mettez SMS_DRY_RUN=false dans .env');
    }
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    return res.json({
      success: true,
      to: testPhone,
      message: testMessage.substring(0, 100) + (testMessage.length > 100 ? '...' : ''),
      metadata: result.metadata,
    });
  } catch (error: any) {
    console.error('[POST /api/owner/notifications/send-test-sms] Erreur:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'envoi du SMS de test', 
      details: error.message 
    });
  }
});

// ============================================================================
// ENDPOINT POUR ENVOYER LES RAPPELS DE RENDEZ-VOUS
// ============================================================================
// 
// Cet endpoint peut être appelé par un cron job pour envoyer les rappels
// aux clients. Il utilise le reminder_offset_hours configuré pour chaque salon.
//
// Usage (cron):
//   GET /api/notifications/send-reminders
//   (peut être sécurisé avec une clé API si nécessaire)
//
// L'endpoint :
// 1. Récupère tous les rendez-vous confirmés dans les prochaines 48h
// 2. Pour chaque rendez-vous, vérifie si un rappel doit être envoyé
//    (selon reminder_offset_hours du salon)
// 3. Envoie le SMS de rappel si nécessaire
// ============================================================================
app.get('/api/notifications/send-reminders', async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuration Supabase manquante' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { buildNotificationContext } = await import('./core/notifications/utils.js');
    const { createNotificationSettingsRepository } = await import('./core/notifications/NotificationSettingsRepository.js');
    const { subHours } = await import('date-fns');

    // Récupérer tous les rendez-vous confirmés dans les prochaines 48h
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, appointment_date, salon_id, status')
      .eq('status', 'confirmed')
      .gte('appointment_date', now.toISOString())
      .lte('appointment_date', in48Hours.toISOString());

    if (appointmentsError) {
      throw appointmentsError;
    }

    if (!appointments || appointments.length === 0) {
      return res.json({ 
        message: 'Aucun rendez-vous à rappeler',
        processed: 0,
        sent: 0,
        errors: 0,
      });
    }

    const results = {
      processed: 0,
      sent: 0,
      errors: 0,
      details: [] as Array<{ appointmentId: string; status: string; error?: string }>,
    };

    // Traiter chaque rendez-vous
    for (const appointment of appointments) {
      results.processed++;

      try {
        // Construire le contexte de notification
        const notificationContext = await buildNotificationContext(appointment.id, supabase);
        
        if (!notificationContext) {
          results.errors++;
          results.details.push({
            appointmentId: appointment.id,
            status: 'error',
            error: 'Impossible de construire le contexte de notification',
          });
          continue;
        }

        // Récupérer les settings du salon pour obtenir reminder_offset_hours
        const settingsRepo = createNotificationSettingsRepository(supabase);
        const settings = await settingsRepo.getSettings(appointment.salon_id);
        const offsetHours = settings.reminderOffsetHours;

        // Calculer la date/heure d'envoi du rappel
        const appointmentDate = new Date(appointment.appointment_date);
        const reminderSendTime = subHours(appointmentDate, offsetHours);

        // Vérifier si le rappel doit être envoyé maintenant (dans les 30 prochaines minutes)
        const now = new Date();
        const timeDiff = reminderSendTime.getTime() - now.getTime();
        const thirtyMinutes = 30 * 60 * 1000;

        if (timeDiff >= 0 && timeDiff <= thirtyMinutes) {
          // Il est temps d'envoyer le rappel
          await notificationService.sendBookingReminder(notificationContext);
          results.sent++;
          results.details.push({
            appointmentId: appointment.id,
            status: 'sent',
          });
        } else if (timeDiff < 0) {
          // Le rappel aurait dû être envoyé mais est en retard
          // On l'envoie quand même si c'est dans les dernières 2 heures
          const twoHours = 2 * 60 * 60 * 1000;
          if (Math.abs(timeDiff) <= twoHours) {
            await notificationService.sendBookingReminder(notificationContext);
            results.sent++;
            results.details.push({
              appointmentId: appointment.id,
              status: 'sent_late',
            });
          } else {
            results.details.push({
              appointmentId: appointment.id,
              status: 'skipped',
              error: `Rappel en retard de plus de 2h (${Math.round(Math.abs(timeDiff) / (60 * 60 * 1000))}h)`,
            });
          }
        } else {
          // Trop tôt pour envoyer le rappel
          results.details.push({
            appointmentId: appointment.id,
            status: 'too_early',
            error: `Rappel prévu dans ${Math.round(timeDiff / (60 * 60 * 1000))}h`,
          });
        }
      } catch (error: any) {
        results.errors++;
        results.details.push({
          appointmentId: appointment.id,
          status: 'error',
          error: error.message || 'Erreur inconnue',
        });
        console.error(`[Send Reminders] Erreur pour le rendez-vous ${appointment.id}:`, error);
      }
    }

    return res.json({
      message: `Traitement terminé: ${results.sent} rappel(s) envoyé(s), ${results.errors} erreur(s)`,
      ...results,
    });
  } catch (error: any) {
    console.error('[GET /api/notifications/send-reminders] Erreur:', error);
    return res.status(500).json({ 
      error: 'Erreur lors de l\'envoi des rappels',
      details: error.message,
    });
  }
});

// ============================================================================
// ENDPOINT DE TEST POUR LES NOTIFICATIONS
// ============================================================================
// 
// Cet endpoint permet de tester les notifications (SMS et Email) sans créer
// un rendez-vous complet. Utile pour vérifier la configuration des providers.
//
// Usage:
//   POST /api/dev/send-test-notification
//   Body: {
//     "customerPhone": "+41791234567",  // Optionnel
//     "customerEmail": "test@example.com",  // Optionnel
//     "customerName": "Jean Dupont",  // Optionnel
//     "salonName": "Salon Test",  // Optionnel
//     "serviceName": "Coupe",  // Optionnel
//     "stylistName": "Marie Martin"  // Optionnel
//   }
//
// Configuration:
// - SMS_DRY_RUN=true: SMS loggés uniquement (défaut)
// - EMAIL_DRY_RUN=false: Emails réellement envoyés (défaut)
// Les deux flags sont indépendants
// ============================================================================
app.post('/api/dev/send-test-notification', express.json(), async (req, res) => {
  try {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[TEST] 🧪 Appel de l\'endpoint de test de notifications');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const body = req.body || {};
    
    // Valeurs par défaut pour le test
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 1); // Demain
    testDate.setHours(14, 0, 0, 0); // 14h00
    
    const endDate = new Date(testDate);
    endDate.setMinutes(endDate.getMinutes() + 30); // +30 minutes
    
    const notificationContext = {
      bookingId: 'test-booking-' + Date.now(),
      salonId: body.salonId || 'test-salon-id', // Nécessaire pour les templates dynamiques
      clientName: body.customerName || 'Jean Dupont',
      clientEmail: body.customerEmail || 'test@example.com',
      clientPhone: body.customerPhone || '+41791234567',
      serviceName: body.serviceName || 'Coupe de cheveux',
      salonName: body.salonName || 'Salon Test',
      stylistName: body.stylistName || 'Marie Martin',
      startDate: testDate,
      endDate: endDate,
    };
    
    console.log('[TEST] Contexte de notification:');
    console.log(JSON.stringify(notificationContext, null, 2));
    console.log('');
    
    // Vérifier les modes dry-run (SMS et Email séparés)
    const legacyDryRun = process.env.NOTIFICATIONS_DRY_RUN === 'true';
    const smsDryRun = process.env.SMS_DRY_RUN !== undefined
      ? process.env.SMS_DRY_RUN === 'true'
      : legacyDryRun || true;
    const emailDryRun = process.env.EMAIL_DRY_RUN !== undefined
      ? process.env.EMAIL_DRY_RUN === 'true'
      : legacyDryRun || false;
    
    console.log('[TEST] Configuration des notifications:');
    console.log(`[TEST]   📱 SMS: ${smsDryRun ? '⚠️  DRY RUN (log uniquement)' : '✅ ENVOI RÉEL'}`);
    console.log(`[TEST]   📧 Email: ${emailDryRun ? '⚠️  DRY RUN (log uniquement)' : '✅ ENVOI RÉEL'}`);
    console.log('');
    
    // Envoyer les notifications via NotificationService (méthode de test)
    console.log('[TEST] 📧📱 Envoi des notifications de test via NotificationService...');
    const results = await notificationService.testNotification(notificationContext);
    
    // Afficher les templates utilisés
    if (results.templates) {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[TEST] 📋 TEMPLATES UTILISÉS (depuis notification_settings ou defaults)');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[TEST] Sujet email:', results.templates.confirmationEmailSubject.substring(0, 100) + (results.templates.confirmationEmailSubject.length > 100 ? '...' : ''));
      console.log('[TEST] SMS confirmation:', results.templates.confirmationSmsText);
      console.log('[TEST] SMS rappel:', results.templates.reminderSmsText);
      console.log('');
    }
    
    if (results.context) {
      console.log('[TEST] 📝 CONTEXTE DE RENDU:');
      console.log(JSON.stringify(results.context, null, 2));
      console.log('');
    }
    
    if (results.sms) {
      console.log('[TEST] 📱 SMS:');
      console.log('  Template brut:', results.sms.template);
      console.log('  SMS rendu:', results.sms.rendered);
      console.log('  Succès:', results.sms.success);
      if (results.sms.error) {
        console.log('  Erreur:', results.sms.error);
      }
      console.log('');
    }
    
    if (results.email) {
      console.log('[TEST] 📧 EMAIL:');
      console.log('  Template sujet brut:', results.email.subjectTemplate);
      console.log('  Sujet rendu:', results.email.subjectRendered);
      console.log('  Template HTML brut (200 premiers chars):', results.email.htmlTemplate);
      console.log('  HTML rendu (200 premiers chars):', results.email.htmlRendered);
      console.log('  Succès:', results.email.success);
      if (results.email.error) {
        console.log('  Erreur:', results.email.error);
      }
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[TEST] ✅ Test terminé');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    
    // Retourner les résultats
    const allSuccess = (!results.sms || results.sms.success) && (!results.email || results.email.success);
    
    // Construire le message de résultat
    const smsStatus = smsDryRun ? 'DRY RUN (log uniquement)' : 'ENVOI RÉEL';
    const emailStatus = emailDryRun ? 'DRY RUN (log uniquement)' : 'ENVOI RÉEL';
    const message = `SMS: ${smsStatus}, Email: ${emailStatus}`;
    
    return res.status(allSuccess ? 200 : 207).json({
      success: allSuccess,
      configuration: {
        smsDryRun,
        emailDryRun,
      },
      message,
      results: {
        sms: results.sms,
        email: results.email,
      },
      templates: results.templates,
      context: results.context,
      notificationContext,
    });
  } catch (error: any) {
    console.error('[TEST] ❌ Erreur lors du test de notifications:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors du test de notifications',
      details: error.message,
    });
  }
});

// Route de debug pour vérifier que toutes les routes sont bien enregistrées
app.get('/api/debug/routes', (req, res) => {
  const routes: string[] = [];
  app._router?.stack?.forEach((middleware: any) => {
    if (middleware.route) {
      routes.push(`${Object.keys(middleware.route.methods)[0].toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      middleware.handle.stack?.forEach((handler: any) => {
        if (handler.route) {
          routes.push(`${Object.keys(handler.route.methods)[0].toUpperCase()} ${handler.route.path}`);
        }
      });
    }
  });
  // Filtrer pour les routes de notifications
  const notificationRoutes = routes.filter(r => 
    r.includes('notification') || 
    r.includes('notifications') ||
    r.includes('salon') || 
    r.includes('hours')
  );
  res.json({ 
    allRoutes: routes.length,
    notificationRoutes,
    allRoutesList: routes
  });
});

// Middleware 404 pour les routes API non trouvées (après toutes les routes)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && !res.headersSent) {
    console.warn(`[404 Middleware] ${req.method} ${req.originalUrl}`);
    console.warn('[404 Middleware] Path:', req.path);
    console.warn('[404 Middleware] Base URL:', req.baseUrl);
    
    // Si c'est une requête vers /api/salon/login, c'est un problème grave
    if (req.method === 'POST' && req.path === '/api/salon/login') {
      console.error('[404 Middleware] ❌❌❌ CRITIQUE: Requête POST /api/salon/login non interceptée!');
      console.error('[404 Middleware] ❌ La route devrait être définie à la ligne 1534');
      console.error('[404 Middleware] ❌ Vérifiez que le serveur s\'est bien rechargé');
      console.error('[404 Middleware] ❌ Environnement:', process.env.NODE_ENV);
      console.error('[404 Middleware] ❌ Vercel:', process.env.VERCEL);
      return res.status(404).json({ 
        success: false,
        error: "Route /api/salon/login non trouvée",
        message: "La route de login n'a pas été trouvée. Vérifiez la configuration du serveur."
      });
    }
    
    // Si c'est une requête vers /api/auth/verify-salon, c'est un problème grave
    if (req.method === 'POST' && req.path === '/api/auth/verify-salon') {
      console.error('[404 Middleware] ❌❌❌ CRITIQUE: Requête POST /api/auth/verify-salon non interceptée!');
      console.error('[404 Middleware] ❌ La route devrait être définie à la ligne 269');
      console.error('[404 Middleware] ❌ Vérifiez que le serveur s\'est bien rechargé');
    }
    
    // Si c'est une requête vers /api/salons/:salonId/hours, c'est un problème grave
    if (req.method === 'PUT' && req.path.includes('/salons') && req.path.includes('/hours')) {
      console.error('[404 Middleware] ❌❌❌ CRITIQUE: Requête PUT /api/salons/:salonId/hours non interceptée!');
      console.error('[404 Middleware] ❌ Vérifiez que le router salons est bien monté');
    }
    
    // Si c'est une requête vers /api/owner/notification-settings, c'est un problème grave
    if (req.path.includes('/api/owner/notification-settings')) {
      console.error('[404 Middleware] ❌❌❌ CRITIQUE: Requête vers /api/owner/notification-settings non interceptée!');
      console.error('[404 Middleware] ❌ La route devrait être définie aux lignes 5008 et 5048');
      console.error('[404 Middleware] ❌ Vérifiez que le serveur s\'est bien rechargé');
      console.error('[404 Middleware] ❌ req.user:', req.user);
    }
    
    // Si c'est une requête vers /api/owner/notifications/send-test-email, c'est un problème grave
    if (req.path.includes('/api/owner/notifications/send-test-email')) {
      console.error('[404 Middleware] ❌❌❌ CRITIQUE: Requête POST /api/owner/notifications/send-test-email non interceptée!');
      console.error('[404 Middleware] ❌ La route devrait être définie à la ligne 5174');
      console.error('[404 Middleware] ❌ Vérifiez que le serveur s\'est bien rechargé');
      console.error('[404 Middleware] ❌ req.user:', req.user);
      console.error('[404 Middleware] ❌ req.method:', req.method);
    }
    
    // Si c'est une requête DELETE vers /api/appointments/:id, c'est un problème grave
    if (req.method === 'DELETE' && req.path.startsWith('/api/appointments/')) {
      console.error('[404 Middleware] ❌❌❌ CRITIQUE: Requête DELETE /api/appointments/:id non interceptée!');
      console.error('[404 Middleware] ❌ La route devrait être définie à la ligne 5096');
      console.error('[404 Middleware] ❌ Path:', req.path);
      console.error('[404 Middleware] ❌ Original URL:', req.originalUrl);
      console.error('[404 Middleware] ❌ req.user:', req.user);
      console.error('[404 Middleware] ❌ req.method:', req.method);
      console.error('[404 Middleware] ❌ Vérifiez que le serveur s\'est bien rechargé');
    }
    
    return res.status(404).json({ error: "Route non trouvée" });
  }
  next();
});

// Le serveur HTTP n'est créé que dans devServer.ts pour le développement
// Sur Vercel, on n'a pas besoin d'un serveur HTTP car Vercel gère le routing
// En production locale, le serveur sera créé si nécessaire (voir la section de démarrage en bas)
const server = (process.env.NODE_ENV === 'production' && !process.env.VERCEL) ? createServer(app) : null;

// Configuration des cron jobs pour les notifications intelligentes
// (Optionnel: peut être désactivé si vous utilisez Vercel Cron ou cron système)
(async () => {
  if (process.env.ENABLE_CRON_JOBS === 'true') {
    try {
      const cron = await import('node-cron');
      const cronDefault = cron.default;
      
      // Cron job: Vérifier les emails non ouverts et envoyer SMS (Option B)
      // Toutes les heures à la minute 0
      cronDefault.schedule('0 * * * *', async () => {
        try {
          await import('./cron/check-email-opened-and-send-sms.js');
        } catch (error: any) {
          console.error('[Cron] ❌ Erreur lors de l\'exécution du cron job check-email-opened:', error);
        }
      });
      console.log('[SERVER] ✅ Cron job configuré: Vérification email ouvert + SMS (toutes les heures)');
      
      // Cron job: Envoyer les SMS de rappel (Option C)
      // Toutes les heures à la minute 0
      cronDefault.schedule('0 * * * *', async () => {
        try {
          await import('./cron/send-reminder-sms.js');
        } catch (error: any) {
          console.error('[Cron] ❌ Erreur lors de l\'exécution du cron job send-reminder:', error);
        }
      });
      console.log('[SERVER] ✅ Cron job configuré: Envoi SMS de rappel (toutes les heures)');
      console.log('[SERVER] 💡 Pour activer les cron jobs, définissez ENABLE_CRON_JOBS=true dans .env');
    } catch (error: any) {
      console.warn('[SERVER] ⚠️  node-cron non disponible, les cron jobs ne seront pas exécutés automatiquement');
      console.warn('[SERVER] 💡 Installez node-cron: npm install node-cron');
      console.warn('[SERVER] 💡 Ou configurez les cron jobs via Vercel Cron ou votre système');
    }
  } else {
    console.log('[SERVER] ℹ️  Cron jobs désactivés (ENABLE_CRON_JOBS non défini ou false)');
    console.log('[SERVER] 💡 Pour activer, définissez ENABLE_CRON_JOBS=true dans .env');
    console.log('[SERVER] 💡 Ou configurez les cron jobs via Vercel Cron ou votre système');
  }
})().catch((error) => {
  console.error('[SERVER] ❌ Erreur lors de la configuration des cron jobs:', error);
});

// Configuration des fichiers statiques pour production locale uniquement
// Sur Vercel, on ne configure pas les fichiers statiques - Vercel gère le routing
if (process.env.VERCEL) {
  // Sur Vercel, les fichiers statiques sont servis directement par Vercel via vercel.json
  // On ne doit gérer QUE les routes API dans Express
  // Les routes non-API sont gérées par Vercel qui sert index.html pour le routing côté client
  // Donc on ne fait rien ici pour les routes non-API - Vercel les gère
  console.log('[SERVER] ✅ Application Express configurée pour Vercel serverless');
} else if (process.env.NODE_ENV === 'production' && server) {
  // En production locale (pas sur Vercel), servir les fichiers statiques depuis dist/
  const distPath = path.resolve(import.meta.dirname, "..", "dist");
  
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // fall through to index.html on GET if the file doesn't exist
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
    console.log('[SERVER] ✅ Fichiers statiques configurés depuis:', distPath);
  } else {
    console.warn('[SERVER] ⚠️  Dossier dist/ introuvable, les fichiers statiques ne seront pas servis');
  }
}

// Middleware d'erreur global pour éviter les crashes avec finalhandler
// Doit être monté APRÈS tous les autres middlewares et routes
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Si les headers ont déjà été envoyés, ne rien faire
  if (res.headersSent) {
    return next(err);
  }
  
  console.error('[Global Error Handler]', err.message || err);
  if (err.stack && process.env.NODE_ENV !== 'production') {
    console.error('[Global Error Handler] Stack:', err.stack);
  }
  
  // Renvoyer une erreur propre
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Export de l'app Express pour Vercel (serverless)
// Vercel utilisera cet export comme handler
export default app;

// Démarrage du serveur uniquement si on n'est pas sur Vercel
// Vercel détecte automatiquement la présence de VERCEL dans les variables d'environnement
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL && server) {
  const port = parseInt(process.env.PORT || '5001', 10);
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });
}