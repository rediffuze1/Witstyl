// server/routes/voice-agent.js
import express from "express";

const router = express.Router();

// Base de données simple en mémoire pour les rendez-vous
let appointments = [];
let currentConversation = {};

// Fonction pour analyser l'intention du message
function analyzeIntent(message, history) {
  const msg = message.toLowerCase();
  
  // Intentions principales
  const intents = {
    greeting: /^(bonjour|salut|hello|bonsoir)/i,
    appointment: /(rendez-vous|rdv|réserver|prendre|planifier)/i,
    service: /(coupe|couper|coloration|couleur|balayage|brushing|soin|masque|traitement)/i,
    time: /(demain|aujourd'hui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|semaine|prochaine|suivante)/i,
    hour: /(\d{1,2}h|\d{1,2}:\d{2}|\d{1,2}\s*(h|heures?))/i,
    confirmation: /(oui|d'accord|parfait|ok|confirmé|valider)/i,
    cancellation: /(annuler|annulation|supprimer)/i,
    modification: /(changer|modifier|décaler|reporter)/i,
    contact: /(nom|téléphone|tél|numéro|contact|coordonnées)/i,
    stylist: /(sarah|marie|styliste|coiffeur|coiffeuse)/i
  };
  
  const detectedIntents = [];
  for (const [intent, pattern] of Object.entries(intents)) {
    if (pattern.test(msg)) {
      detectedIntents.push(intent);
    }
  }
  
  return detectedIntents;
}

// Fonction pour extraire les informations du message
function extractInfo(message) {
  const msg = message.toLowerCase();
  const info = {};
  
  // Services
  if (msg.includes('coupe') || msg.includes('couper')) info.service = 'coupe';
  else if (msg.includes('coloration') || msg.includes('couleur') || msg.includes('balayage')) info.service = 'coloration';
  else if (msg.includes('brushing') || msg.includes('coiffage')) info.service = 'brushing';
  else if (msg.includes('soin') || msg.includes('masque') || msg.includes('traitement')) info.service = 'soin';
  
  // Jours
  if (msg.includes('lundi')) info.day = 'lundi';
  else if (msg.includes('mardi')) info.day = 'mardi';
  else if (msg.includes('mercredi')) info.day = 'mercredi';
  else if (msg.includes('jeudi')) info.day = 'jeudi';
  else if (msg.includes('vendredi')) info.day = 'vendredi';
  else if (msg.includes('samedi')) info.day = 'samedi';
  else if (msg.includes('dimanche')) info.day = 'dimanche';
  else if (msg.includes('demain')) info.day = 'demain';
  else if (msg.includes('aujourd\'hui')) info.day = 'aujourd\'hui';
  else if (msg.includes('semaine prochaine') || msg.includes('semaine suivante') || msg.includes('semaine d\'après')) info.day = 'semaine prochaine';
  
  // Heures
  const hourMatch = msg.match(/(\d{1,2})h?(\d{2})?/);
  if (hourMatch) {
    const hour = hourMatch[1];
    const minutes = hourMatch[2] || '00';
    info.hour = `${hour}h${minutes}`;
  }
  
  // Stylistes
  if (msg.includes('sarah')) info.stylist = 'Sarah';
  else if (msg.includes('marie')) info.stylist = 'Marie';
  
  return info;
}

// Fonction pour générer une réponse intelligente
function generateResponse(message, history, sessionId) {
  const intents = analyzeIntent(message, history);
  const info = extractInfo(message);
  
  // Initialiser la conversation si nécessaire
  if (!currentConversation[sessionId]) {
    currentConversation[sessionId] = {
      step: 'greeting',
      service: null,
      day: null,
      hour: null,
      stylist: null,
      name: null,
      phone: null
    };
  }
  
  const conv = currentConversation[sessionId];
  
  // Mettre à jour les informations de la conversation
  if (info.service) conv.service = info.service;
  if (info.day) conv.day = info.day;
  if (info.hour) conv.hour = info.hour;
  if (info.stylist) conv.stylist = info.stylist;
  
  // Logique de conversation intelligente
  if (intents.includes('greeting') || conv.step === 'greeting') {
    conv.step = 'service';
    return "Bonjour ! Je suis votre réceptionniste IA. Je serais ravie de vous aider à prendre un rendez-vous. Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
  }
  
  if (intents.includes('appointment') && !conv.service) {
    conv.step = 'service';
    return "Parfait ! Je vais vous aider à prendre un rendez-vous. Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
  }
  
  if (intents.includes('service') || conv.step === 'service') {
    if (!conv.service && !intents.includes('service')) {
      return "Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
    }
    
    conv.step = 'day';
    const serviceText = {
      'coupe': 'une coupe',
      'coloration': 'une coloration',
      'brushing': 'un brushing',
      'soin': 'un soin'
    };
    
    return `Très bien pour ${serviceText[conv.service] || 'cette prestation'} ! Pour quel jour souhaitez-vous votre rendez-vous ? J'ai des disponibilités du lundi au samedi.`;
  }
  
  if (intents.includes('time') || conv.step === 'day') {
    if (!conv.day && !intents.includes('time')) {
      return "Pour quel jour souhaitez-vous votre rendez-vous ? J'ai des disponibilités du lundi au samedi.";
    }
    
    conv.step = 'hour';
    
    // Générer des créneaux selon le jour
    const slots = generateTimeSlots(conv.day, conv.service);
    return `Parfait pour ${conv.day} ! J'ai des créneaux disponibles : ${slots.join(', ')}. Lequel vous convient le mieux ?`;
  }
  
  if (intents.includes('hour') || conv.step === 'hour') {
    if (!conv.hour && !intents.includes('hour')) {
      const slots = generateTimeSlots(conv.day, conv.service);
      return `Quel horaire préférez-vous ? J'ai : ${slots.join(', ')}.`;
    }
    
    conv.step = 'contact';
    return `Excellent ! ${conv.hour || 'cet horaire'} pour ${conv.day}, c'est parfait. Pour finaliser votre rendez-vous, pouvez-vous me donner votre prénom et votre numéro de téléphone ?`;
  }
  
  if (intents.includes('contact') || conv.step === 'contact') {
    // Extraire nom et téléphone du message
    const nameMatch = message.match(/(?:je m'appelle|mon nom est|je suis)\s+([a-zA-Z\s]+)/i);
    const phoneMatch = message.match(/(\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/);
    
    if (nameMatch) conv.name = nameMatch[1].trim();
    if (phoneMatch) conv.phone = phoneMatch[1];
    
    if (!conv.name || !conv.phone) {
      if (!conv.name) return "Pouvez-vous me donner votre prénom ?";
      if (!conv.phone) return "Et votre numéro de téléphone pour la confirmation ?";
    }
    
    // Confirmer le rendez-vous
    conv.step = 'confirmed';
    const appointment = {
      id: Date.now(),
      service: conv.service,
      day: conv.day,
      hour: conv.hour,
      stylist: conv.stylist,
      name: conv.name,
      phone: conv.phone,
      date: new Date()
    };
    
    appointments.push(appointment);
    
    return `Parfait ${conv.name} ! Votre rendez-vous est confirmé : ${conv.service} le ${conv.day} à ${conv.hour}. Vous recevrez un SMS de rappel 24h avant. Avez-vous d'autres questions ?`;
  }
  
  if (intents.includes('confirmation')) {
    if (conv.step === 'confirmed') {
      return "Merci beaucoup ! N'hésitez pas à nous rappeler si vous avez besoin de modifier votre rendez-vous. À bientôt !";
    }
    return "Parfait ! Continuons avec votre réservation.";
  }
  
  if (intents.includes('cancellation')) {
    return "Je comprends. Votre rendez-vous a été annulé. N'hésitez pas à nous rappeler quand vous souhaitez reprendre un rendez-vous.";
  }
  
  if (intents.includes('modification')) {
    return "Bien sûr ! Je peux modifier votre rendez-vous. Quel nouveau créneau préférez-vous ?";
  }
  
  // Réponse par défaut contextuelle
  if (conv.step === 'service') {
    return "Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
  } else if (conv.step === 'day') {
    return "Pour quel jour souhaitez-vous votre rendez-vous ?";
  } else if (conv.step === 'hour') {
    const slots = generateTimeSlots(conv.day, conv.service);
    return `Quel horaire préférez-vous ? J'ai : ${slots.join(', ')}.`;
  } else if (conv.step === 'contact') {
    return "Pour finaliser, pouvez-vous me donner votre prénom et votre numéro de téléphone ?";
  }
  
  return "Je ne suis pas sûr de comprendre. Pouvez-vous reformuler votre demande ? Je peux vous aider à prendre un rendez-vous pour une coupe, coloration, brushing ou soin.";
}

// Fonction pour générer des créneaux horaires
function generateTimeSlots(day, service) {
  const baseSlots = ['9h00', '10h30', '14h00', '15h30', '17h00'];
  
  if (service === 'coloration') {
    return ['9h00', '14h00']; // Créneaux plus longs
  } else if (service === 'soin') {
    return ['10h30', '15h30'];
  }
  
  return baseSlots;
}

// POST /api/voice-agent
router.post("/", async (req, res) => {
  try {
    const { message, history } = req.body || {};
    
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "BAD_REQUEST", message: "message manquant" });
    }

    // Générer un ID de session simple basé sur l'IP et l'historique
    const sessionId = req.ip || 'default';
    
    // Analyser l'historique pour comprendre le contexte
    const context = analyzeConversationHistory(history || []);
    
    // Générer une réponse intelligente avec le contexte
    const reply = generateContextualResponse(message, context, sessionId);

    res.json({ reply });
  } catch (e) {
    console.error("[voice-agent] error:", e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// Fonction pour analyser l'historique de conversation
function analyzeConversationHistory(history) {
  const context = {
    hasGreeting: false,
    hasService: false,
    hasDay: false,
    hasHour: false,
    hasContact: false,
    service: null,
    day: null,
    hour: null,
    stylist: null
  };
  
  // Analyser chaque message de l'historique
  for (const msg of history) {
    if (msg.role === 'user') {
      const intents = analyzeIntent(msg.content, []);
      const info = extractInfo(msg.content);
      
      if (intents.includes('greeting')) context.hasGreeting = true;
      if (intents.includes('service') || info.service) {
        context.hasService = true;
        context.service = info.service || context.service;
      }
      if (intents.includes('time') || info.day) {
        context.hasDay = true;
        context.day = info.day || context.day;
      }
      if (intents.includes('hour') || info.hour) {
        context.hasHour = true;
        context.hour = info.hour || context.hour;
      }
      if (info.stylist) context.stylist = info.stylist;
    }
  }
  
  return context;
}

// Fonction pour générer une réponse contextuelle
function generateContextualResponse(message, context, sessionId) {
  const intents = analyzeIntent(message, []);
  const info = extractInfo(message);
  
  // Mettre à jour le contexte avec les nouvelles informations
  if (info.service) context.service = info.service;
  if (info.day) context.day = info.day;
  if (info.hour) context.hour = info.hour;
  if (info.stylist) context.stylist = info.stylist;
  
  // Vérifier si le message contient des informations complètes
  if (context.service && context.day && context.hour) {
    return `Parfait ! Je vois que vous souhaitez ${context.service} le ${context.day} à ${context.hour}. Pour finaliser votre rendez-vous, pouvez-vous me donner votre prénom et votre numéro de téléphone ?`;
  }
  
  if (context.service && context.day) {
    const slots = generateTimeSlots(context.day, context.service);
    return `Très bien pour ${context.service} le ${context.day} ! J'ai des créneaux disponibles : ${slots.join(', ')}. Lequel vous convient le mieux ?`;
  }
  
  if (context.service) {
    return `Très bien pour ${context.service} ! Pour quel jour souhaitez-vous votre rendez-vous ? J'ai des disponibilités du lundi au samedi.`;
  }
  
  // Logique de conversation contextuelle
  if (intents.includes('greeting') || (!context.hasGreeting && !context.hasService)) {
    context.hasGreeting = true;
    return "Bonjour ! Je suis votre réceptionniste IA. Je serais ravie de vous aider à prendre un rendez-vous. Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
  }
  
  if (intents.includes('appointment') && !context.hasService) {
    return "Parfait ! Je vais vous aider à prendre un rendez-vous. Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
  }
  
  if (intents.includes('service') || (!context.hasService && !context.hasDay)) {
    if (!context.service && !intents.includes('service')) {
      return "Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
    }
    
    context.hasService = true;
    const serviceText = {
      'coupe': 'une coupe',
      'coloration': 'une coloration',
      'brushing': 'un brushing',
      'soin': 'un soin'
    };
    
    return `Très bien pour ${serviceText[context.service] || 'cette prestation'} ! Pour quel jour souhaitez-vous votre rendez-vous ? J'ai des disponibilités du lundi au samedi.`;
  }
  
  if (intents.includes('time') || (!context.hasDay && !context.hasHour)) {
    if (!context.day && !intents.includes('time')) {
      return "Pour quel jour souhaitez-vous votre rendez-vous ? J'ai des disponibilités du lundi au samedi.";
    }
    
    context.hasDay = true;
    
    // Générer des créneaux selon le jour
    const slots = generateTimeSlots(context.day, context.service);
    const dayText = context.day || 'ce jour';
    return `Parfait pour ${dayText} ! J'ai des créneaux disponibles : ${slots.join(', ')}. Lequel vous convient le mieux ?`;
  }
  
  if (intents.includes('hour') || (!context.hasHour && !context.hasContact)) {
    if (!context.hour && !intents.includes('hour')) {
      const slots = generateTimeSlots(context.day, context.service);
      return `Quel horaire préférez-vous ? J'ai : ${slots.join(', ')}.`;
    }
    
    context.hasHour = true;
    return `Excellent ! ${context.hour || 'cet horaire'} pour ${context.day}, c'est parfait. Pour finaliser votre rendez-vous, pouvez-vous me donner votre prénom et votre numéro de téléphone ?`;
  }
  
  if (intents.includes('contact') || context.hasHour) {
    // Extraire nom et téléphone du message
    const nameMatch = message.match(/(?:je m'appelle|mon nom est|je suis)\s+([a-zA-Z\s]+)/i);
    const phoneMatch = message.match(/(\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/);
    
    if (nameMatch || phoneMatch) {
      const appointment = {
        id: Date.now(),
        service: context.service,
        day: context.day,
        hour: context.hour,
        stylist: context.stylist,
        name: nameMatch ? nameMatch[1].trim() : 'Client',
        phone: phoneMatch ? phoneMatch[1] : 'Non fourni',
        date: new Date()
      };
      
      appointments.push(appointment);
      
      return `Parfait ! Votre rendez-vous est confirmé : ${context.service} le ${context.day} à ${context.hour}. Vous recevrez un SMS de rappel 24h avant. Avez-vous d'autres questions ?`;
    }
    
    return "Pour finaliser, pouvez-vous me donner votre prénom et votre numéro de téléphone ?";
  }
  
  if (intents.includes('confirmation')) {
    return "Merci beaucoup ! N'hésitez pas à nous rappeler si vous avez besoin de modifier votre rendez-vous. À bientôt !";
  }
  
  if (intents.includes('cancellation')) {
    return "Je comprends. Votre rendez-vous a été annulé. N'hésitez pas à nous rappeler quand vous souhaitez reprendre un rendez-vous.";
  }
  
  if (intents.includes('modification')) {
    return "Bien sûr ! Je peux modifier votre rendez-vous. Quel nouveau créneau préférez-vous ?";
  }
  
  // Réponse par défaut contextuelle
  if (!context.hasService) {
    return "Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
  } else if (!context.hasDay) {
    return "Pour quel jour souhaitez-vous votre rendez-vous ?";
  } else if (!context.hasHour) {
    const slots = generateTimeSlots(context.day, context.service);
    return `Quel horaire préférez-vous ? J'ai : ${slots.join(', ')}.`;
  } else {
    return "Pour finaliser, pouvez-vous me donner votre prénom et votre numéro de téléphone ?";
  }
}

export default router;