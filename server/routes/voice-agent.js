// server/routes/voice-agent.js
import express from "express";
import fetch from "node-fetch";
import { hasOpenAI, openAIHeaders, OPENAI_API_KEY } from "../config-direct.js";
import { getOrCreateSession, saveSession, resetSession } from "../assistant/sessionStore.js";
import { parseDate, parseTime, detectService, detectConstraints } from "../assistant/nlp.js";
import { nextReply, proposeTimeOptions, formatRecap, renderService, renderDateTime } from "../assistant/replies.js";
import { supabaseAdmin } from "../supabaseService.js";

const router = express.Router();

// Cache pour les informations du salon (éviter de les charger à chaque requête)
let salonCache = {
  data: null,
  services: null,
  hours: null,
  lastFetch: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fonction pour invalider le cache (appelée après mise à jour des horaires)
export function invalidateSalonCache() {
  salonCache.lastFetch = 0;
  salonCache.hours = null;
  console.log("[voice-agent] Cache invalidé pour mise à jour des horaires");
}

// Fonction pour charger les informations du salon
async function loadSalonInfo() {
  const now = Date.now();
  // Utiliser le cache si encore valide
  if (salonCache.data && (now - salonCache.lastFetch) < CACHE_TTL) {
    console.log("[voice-agent] 📦 Utilisation du cache (valide jusqu'à", new Date(salonCache.lastFetch + CACHE_TTL).toISOString(), ")");
    return salonCache;
  }

  console.log("[voice-agent] 🔄 Chargement des informations du salon depuis la base de données...");

  try {
    // Récupérer le salon le plus récent (même logique que /api/public/salon)
    const { data: salonsData, error: salonError } = await supabaseAdmin
      .from('salons')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (salonError) {
      console.error("[voice-agent] ❌ Erreur récupération salon:", salonError);
      return { data: null, services: null, hours: null, lastFetch: now };
    }

    if (!salonsData || salonsData.length === 0) {
      console.warn("[voice-agent] ⚠️ Aucun salon trouvé dans la base de données");
      return { data: null, services: null, hours: null, lastFetch: now };
    }

    const salon = salonsData[0];
    const salonId = salon.id;
    console.log("[voice-agent] ✅ Salon trouvé:", salon.name, "(ID:", salonId, ")");

    // Récupérer les services du salon
    const { data: services, error: servicesError } = await supabaseAdmin
      .from('services')
      .select('name, description, price, duration')
      .eq('salon_id', salonId)
      .eq('is_active', true);
    
    if (servicesError) {
      console.warn("[voice-agent] ⚠️ Erreur récupération services:", servicesError);
    } else {
      console.log("[voice-agent] ✅ Services récupérés:", services?.length || 0);
    }

    // Récupérer les horaires d'ouverture
    // Utiliser la même logique que /api/public/salon : d'abord opening_hours, puis fallback sur salon_hours
    let hours = null;
    let hoursError = null;
    
    // Essayer d'abord avec opening_hours (peut avoir plusieurs créneaux par jour)
    const { data: openingHours, error: openingHoursError } = await supabaseAdmin
      .from('opening_hours')
      .select('day_of_week, open_time, close_time, is_closed')
      .eq('salon_id', salonId)
      .order('day_of_week', { ascending: true })
      .order('open_time', { ascending: true });
    
    if (!openingHoursError && openingHours && openingHours.length > 0) {
      hours = openingHours;
      console.log("[voice-agent] ✅ Horaires récupérés depuis opening_hours:", hours.length);
    } else {
      // Fallback sur salon_hours si opening_hours n'existe pas ou est vide
      const { data: salonHours, error: salonHoursError } = await supabaseAdmin
        .from('salon_hours')
        .select('day_of_week, open_time, close_time, is_closed')
        .eq('salon_id', salonId)
        .order('day_of_week', { ascending: true })
        .order('open_time', { ascending: true });
      
      if (!salonHoursError && salonHours) {
        hours = salonHours;
        console.log("[voice-agent] ✅ Horaires récupérés depuis salon_hours:", hours.length);
      } else {
        hoursError = salonHoursError || openingHoursError;
        if (hoursError) {
          console.warn("[voice-agent] ⚠️ Erreur chargement horaires:", hoursError);
        }
      }
    }

    salonCache = {
      data: salon,
      services: services || [],
      hours: hours || [],
      lastFetch: now
    };

    console.log("[voice-agent] ✅ Cache mis à jour:", {
      salonName: salon.name,
      servicesCount: (services || []).length,
      hoursCount: (hours || []).length
    });

    return salonCache;
  } catch (error) {
    console.error("[voice-agent] Erreur chargement salon:", error);
    return { data: null, services: null, hours: null, lastFetch: now };
  }
}

// POST /api/voice-agent
router.post("/", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  
  console.log(`[voice-agent] 📥 [${requestId}] Requête reçue:`, {
    method: req.method,
    path: req.path,
    hasBody: !!req.body,
    messageLength: req.body?.message?.length || 0,
    sessionId: req.body?.sessionId || 'none',
  });
  
  try {
    const { message, sessionId } = req.body || {};
    if (!message) {
      console.error(`[voice-agent] ❌ [${requestId}] Message manquant`);
      return res.status(400).json({ error: "BAD_REQUEST", message: "message manquant" });
    }

    const s = getOrCreateSession(sessionId);
    const text = String(message).trim();

    // Ajouter le message utilisateur à l'historique
    if (!s.messages) s.messages = [];
    s.messages.push({ role: "user", content: text });

    // Garder seulement les 10 derniers messages pour le contexte
    if (s.messages.length > 20) {
      s.messages = s.messages.slice(-20);
    }

    // commandes rapides
    if (/^(stop|annuler)$/i.test(text)) {
      resetSession(s.id);
      return res.json({ reply: "C'est noté, j'annule. N'hésitez pas si besoin plus tard.", sessionId: s.id });
    }

    // --- EXTRACTION "ONE-SHOT" (ordre libre) ---
    const newly = { date: false, time: false, service: false };

    // contraintes (à partir de 15h / avant 18h)
    const c = detectConstraints(text);
    s.constraints = { ...(s.constraints || {}), ...c };

    // service (coupe, soin, …)
    const svc = detectService(text);
    if (svc && !s.service) { s.service = svc; newly.service = true; }

    // date (jeudi, demain, 12 octobre…)
    if (!s.dateISO) {
      const d = parseDate(text, new Date());
      if (d) { s.dateISO = d; newly.date = true; s.step = "NEED_TIME"; }
    }

    // time (11h, 15h30…)
    if (s.dateISO && !s.time) {
      const t = parseTime(text);
      if (t) { s.time = t; newly.time = true; }
    }

    // téléphone si donné spontanément
    if (!s.phone) {
      const m = text.replace(/\s+/g, "").match(/(?:\+?\d{2})?\d{9,12}/);
      if (m) s.phone = m[0];
    }

    // Construire le contexte de réservation pour l'IA
    const bookingContext = {
      service: s.service ? renderService(s.service) : null,
      date: s.dateISO ? s.dateISO.split("-").reverse().join("/") : null,
      time: s.time || null,
      phone: s.phone || null,
      missingInfo: []
    };
    
    if (!bookingContext.service) bookingContext.missingInfo.push("prestation");
    if (!bookingContext.date) bookingContext.missingInfo.push("date");
    if (!bookingContext.time) bookingContext.missingInfo.push("heure");
    if (!bookingContext.phone) bookingContext.missingInfo.push("téléphone");

    // FORCER l'utilisation d'OpenAI - PAS DE FALLBACK si la clé est disponible
    console.log("[voice-agent] 🔍 Vérification OpenAI - hasOpenAI:", hasOpenAI, "OPENAI_API_KEY:", OPENAI_API_KEY ? "présente (" + OPENAI_API_KEY.substring(0, 10) + "...)" : "manquante");
    
    // Si OpenAI n'est pas disponible, retourner une erreur au lieu d'utiliser le fallback
    if (!hasOpenAI || !OPENAI_API_KEY || OPENAI_API_KEY.length < 10) {
      console.error("[voice-agent] ❌ OpenAI NON DISPONIBLE - Clé API manquante ou invalide");
      return res.status(503).json({ 
        error: "OPENAI_UNAVAILABLE", 
        message: "Le service IA n'est pas disponible. Veuillez configurer OPENAI_API_KEY dans le fichier .env" 
      });
    }
    
    // OpenAI est disponible - FORCER son utilisation
    console.log("[voice-agent] ✅ FORCE utilisation d'OpenAI pour générer une réponse conversationnelle");
    
    // Charger les informations du salon
    const salonInfo = await loadSalonInfo();
    
    // Log pour déboguer
    console.log("[voice-agent] 📊 Informations salon chargées:", {
      hasSalon: !!salonInfo.data,
      salonName: salonInfo.data?.name || "N/A",
      servicesCount: salonInfo.services?.length || 0,
      hoursCount: salonInfo.hours?.length || 0
    });
    
    // Construire les informations sur les services disponibles
    let servicesList = "Aucun service configuré";
    if (salonInfo.services && salonInfo.services.length > 0) {
      servicesList = salonInfo.services.map(s => 
        `- ${s.name}${s.description ? ` (${s.description})` : ''}${s.price ? ` - ${s.price}€` : ''}${s.duration ? ` - ${s.duration}min` : ''}`
      ).join('\n');
    }

    // Construire les horaires d'ouverture
    // Grouper les horaires par jour pour gérer les multiples créneaux (ex: 08h30-12h00, 13h00-18h30)
    let hoursInfo = "Horaires non spécifiés";
    if (salonInfo.hours && salonInfo.hours.length > 0) {
      const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      
      // Grouper les horaires par jour
      const hoursByDay = {};
      salonInfo.hours
        .filter(h => !h.is_closed && h.open_time && h.close_time)
        .forEach(h => {
          const dayKey = h.day_of_week;
          if (!hoursByDay[dayKey]) {
            hoursByDay[dayKey] = [];
          }
          hoursByDay[dayKey].push(`${h.open_time} - ${h.close_time}`);
        });
      
      // Formater chaque jour avec tous ses créneaux
      const hoursText = Object.keys(hoursByDay)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(dayKey => {
          const dayName = dayNames[parseInt(dayKey)] || `Jour ${dayKey}`;
          const slots = hoursByDay[dayKey].join(', ');
          return `${dayName}: ${slots}`;
        })
        .join('\n');
      
      if (hoursText) {
        hoursInfo = hoursText;
      }
    }

    // Construire le prompt système avec les informations de l'entreprise
    const salonName = salonInfo.data?.name || "notre salon";
    const salonAddress = salonInfo.data?.address || "";
    const salonPhone = salonInfo.data?.phone || "";
    const salonEmail = salonInfo.data?.email || "";
    
    // Log pour vérifier que les données sont bien présentes
    console.log("[voice-agent] 📝 Données pour le prompt:", {
      salonName,
      hasAddress: !!salonAddress,
      hasPhone: !!salonPhone,
      hasEmail: !!salonEmail,
      servicesListLength: servicesList.length,
      hoursInfoLength: hoursInfo.length
    });
    
    const systemPrompt = `Tu es une réceptionniste IA professionnelle et chaleureuse pour le salon "${salonName}".

INFORMATIONS SUR LE SALON:
${salonName ? `- Nom du salon: ${salonName}` : ''}
${salonAddress ? `- Adresse: ${salonAddress}` : ''}
${salonPhone ? `- Téléphone: ${salonPhone}` : ''}
${salonEmail ? `- Email: ${salonEmail}` : ''}

SERVICES DISPONIBLES:
${servicesList}

HORAIRES D'OUVERTURE:
${hoursInfo}

Ton rôle est d'aider les clients à prendre rendez-vous de manière naturelle et conversationnelle.
Tu dois aussi répondre aux questions sur le salon, ses services, ses horaires et ses coordonnées.

INFORMATIONS SUR LA RÉSERVATION ACTUELLE:
${bookingContext.service ? `- Prestation: ${bookingContext.service}` : '- Prestation: non spécifiée'}
${bookingContext.date ? `- Date: ${bookingContext.date}` : '- Date: non spécifiée'}
${bookingContext.time ? `- Heure: ${bookingContext.time}` : '- Heure: non spécifiée'}
${bookingContext.phone ? `- Téléphone: ${bookingContext.phone}` : '- Téléphone: non spécifié'}

${bookingContext.missingInfo.length > 0 ? `INFORMATIONS MANQUANTES: ${bookingContext.missingInfo.join(", ")}` : 'TOUTES LES INFORMATIONS SONT COMPLÈTES'}

INSTRUCTIONS:
- Réponds de manière naturelle, chaleureuse et professionnelle en français
- Si le client pose une question sur le salon (nom, adresse, téléphone, services, horaires), réponds directement avec les informations disponibles ci-dessus
- Accuse réception des informations que le client vient de donner pour un rendez-vous
- Si des informations manquent pour compléter une réservation, demande-les de manière naturelle (ne liste pas)
- Si tu viens de recevoir une information, confirme-la brièvement
- Utilise les noms de services disponibles quand tu parles des prestations
- Respecte les horaires d'ouverture du salon
- Reste concis (1-3 phrases maximum)
- Sois cohérente avec les messages précédents de la conversation
- Si toutes les informations sont complètes, propose une confirmation`;

    // Construire les messages pour OpenAI
    const messages = [
      { role: "system", content: systemPrompt }
    ];
    
    // Ajouter l'historique de conversation (limité aux 16 derniers messages)
    const previousMessages = s.messages.slice(0, -1); // Tous sauf le dernier (le dernier user vient d'être ajouté)
    const recentMessages = previousMessages.slice(-16); // 8 échanges (user + assistant)
    messages.push(...recentMessages);
    
    // Ajouter le message utilisateur actuel
    messages.push({ role: "user", content: text });

    // Générer la réponse avec OpenAI - FORCER son utilisation, pas de fallback
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        console.log("[voice-agent] Envoi requête OpenAI avec", messages.length, "messages" + (retryCount > 0 ? ` (tentative ${retryCount + 1}/${maxRetries + 1})` : ""));
        
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: openAIHeaders(),
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.7,
            max_tokens: 250,
            messages: messages
          }),
        });

        // Vérifier le statut HTTP
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Erreur inconnue" }));
          console.error("[voice-agent] ❌ Erreur HTTP OpenAI:", response.status, errorData);
          
          // Si erreur 401/403, la clé est invalide - ne pas réessayer
          if (response.status === 401 || response.status === 403) {
            return res.status(503).json({ 
              error: "OPENAI_AUTH_ERROR", 
              message: "Clé API OpenAI invalide. Veuillez vérifier OPENAI_API_KEY dans le fichier .env" 
            });
          }
          
          // Autres erreurs - réessayer si possible
          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Backoff exponentiel
            continue;
          }
          
          throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        
        // Vérifier la structure de la réponse
        if (!data?.choices || !data.choices[0]?.message?.content) {
          console.error("[voice-agent] ❌ Format de réponse OpenAI invalide:", JSON.stringify(data));
          
          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
          
          throw new Error("Format de réponse OpenAI invalide");
        }

        const aiReply = data.choices[0].message.content.trim();
        
        if (aiReply && aiReply.length > 0) {
          console.log("[voice-agent] ✅ Réponse OpenAI générée:", aiReply.substring(0, 100));
          // Ajouter la réponse de l'IA à l'historique
          s.messages.push({ role: "assistant", content: aiReply });
          saveSession(s);
          return res.json({ reply: aiReply, sessionId: s.id });
        } else {
          console.warn("[voice-agent] ⚠️ Réponse OpenAI vide");
          
          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
          
          throw new Error("Réponse OpenAI vide");
        }
      } catch (error) {
        console.error("[voice-agent] ❌ Erreur OpenAI (tentative " + (retryCount + 1) + "):", error.message || error);
        
        // Dernière tentative échouée - retourner une erreur au lieu du fallback
        if (retryCount >= maxRetries) {
          console.error("[voice-agent] ❌ ÉCHEC DÉFINITIF OpenAI après", maxRetries + 1, "tentatives");
          return res.status(503).json({ 
            error: "OPENAI_ERROR", 
            message: "Erreur lors de la génération de la réponse. Veuillez réessayer plus tard.",
            details: error.message
          });
        }
        
        // Réessayer
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    // Ne devrait jamais arriver ici, mais sécurité
    return res.status(503).json({ 
      error: "OPENAI_ERROR", 
      message: "Impossible de générer une réponse. Veuillez réessayer plus tard." 
    });

  } catch (e) {
    const duration = Date.now() - startTime;
    console.error(`[voice-agent] ❌ [${requestId}] Erreur inattendue après ${duration}ms:`, {
      message: e.message,
      stack: e.stack?.split('\n').slice(0, 5).join('\n'),
    });
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "SERVER_ERROR",
        message: "Une erreur interne est survenue. Veuillez réessayer plus tard.",
        requestId: requestId,
      });
    }
  }
});

export default router;