// server/routes/voice-agent-simple.js - Version simplifiée et fonctionnelle
import express from "express";

const router = express.Router();

// Fonction pour analyser l'intention du message
function analyzeIntent(message) {
  const msg = message.toLowerCase();
  
  const intents = {
    greeting: /^(bonjour|salut|hello|bonsoir)/i,
    appointment: /(rendez-vous|rdv|réserver|prendre|planifier)/i,
    service: /(coupe|couper|coloration|couleur|balayage|brushing|soin|masque|traitement)/i,
    time: /(demain|aujourd'hui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|semaine|prochaine|suivante)/i,
    hour: /(\d{1,2}h|\d{1,2}:\d{2}|\d{1,2}\s*(h|heures?))/i,
    confirmation: /(oui|d'accord|parfait|ok|confirmé|valider)/i,
    contact: /(nom|téléphone|tél|numéro|contact|coordonnées)/i
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
  
  return info;
}

// Fonction pour générer une réponse intelligente
function generateResponse(message, history) {
  const intents = analyzeIntent(message);
  const info = extractInfo(message);
  
  // Analyser l'historique pour comprendre le contexte
  let hasService = false;
  let hasDay = false;
  let hasHour = false;
  let service = null;
  let day = null;
  let hour = null;
  
  // Analyser l'historique
  for (const msg of history) {
    if (msg.role === 'user') {
      const msgInfo = extractInfo(msg.content);
      if (msgInfo.service) { hasService = true; service = msgInfo.service; }
      if (msgInfo.day) { hasDay = true; day = msgInfo.day; }
      if (msgInfo.hour) { hasHour = true; hour = msgInfo.hour; }
    }
  }
  
  // Mettre à jour avec les nouvelles informations
  if (info.service) { hasService = true; service = info.service; }
  if (info.day) { hasDay = true; day = info.day; }
  if (info.hour) { hasHour = true; hour = info.hour; }
  
  // Logique de conversation
  if (intents.includes('greeting') || (!hasService && !hasDay)) {
    return "Bonjour ! Je suis votre réceptionniste IA. Je serais ravie de vous aider à prendre un rendez-vous. Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
  }
  
  if (intents.includes('appointment') && !hasService) {
    return "Parfait ! Je vais vous aider à prendre un rendez-vous. Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
  }
  
  if (intents.includes('service') || (!hasService && !hasDay)) {
    if (!service && !intents.includes('service')) {
      return "Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
    }
    
    const serviceText = {
      'coupe': 'une coupe',
      'coloration': 'une coloration',
      'brushing': 'un brushing',
      'soin': 'un soin'
    };
    
    return `Très bien pour ${serviceText[service] || 'cette prestation'} ! Pour quel jour souhaitez-vous votre rendez-vous ? J'ai des disponibilités du lundi au samedi.`;
  }
  
  if (intents.includes('time') || (!hasDay && !hasHour)) {
    if (!day && !intents.includes('time')) {
      return "Pour quel jour souhaitez-vous votre rendez-vous ? J'ai des disponibilités du lundi au samedi.";
    }
    
    const slots = ['9h00', '10h30', '14h00', '15h30', '17h00'];
    return `Parfait pour ${day} ! J'ai des créneaux disponibles : ${slots.join(', ')}. Lequel vous convient le mieux ?`;
  }
  
  if (intents.includes('hour') || (!hasHour)) {
    if (!hour && !intents.includes('hour')) {
      const slots = ['9h00', '10h30', '14h00', '15h30', '17h00'];
      return `Quel horaire préférez-vous ? J'ai : ${slots.join(', ')}.`;
    }
    
    return `Excellent ! ${hour} pour ${day}, c'est parfait. Pour finaliser votre rendez-vous, pouvez-vous me donner votre prénom et votre numéro de téléphone ?`;
  }
  
  if (intents.includes('contact')) {
    const nameMatch = message.match(/(?:je m'appelle|mon nom est|je suis)\s+([a-zA-Z\s]+)/i);
    const phoneMatch = message.match(/(\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/);
    
    if (nameMatch || phoneMatch) {
      return `Parfait ! Votre rendez-vous est confirmé : ${service} le ${day} à ${hour}. Vous recevrez un SMS de rappel 24h avant. Avez-vous d'autres questions ?`;
    }
    
    return "Pour finaliser, pouvez-vous me donner votre prénom et votre numéro de téléphone ?";
  }
  
  // Réponse par défaut
  if (!hasService) {
    return "Quel type de prestation souhaitez-vous ? Coupe, coloration, brushing ou soin ?";
  } else if (!hasDay) {
    return "Pour quel jour souhaitez-vous votre rendez-vous ?";
  } else if (!hasHour) {
    const slots = ['9h00', '10h30', '14h00', '15h30', '17h00'];
    return `Quel horaire préférez-vous ? J'ai : ${slots.join(', ')}.`;
  } else {
    return "Pour finaliser, pouvez-vous me donner votre prénom et votre numéro de téléphone ?";
  }
}

// POST /api/voice-agent
router.post("/", async (req, res) => {
  try {
    const { message, history } = req.body || {};
    
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "BAD_REQUEST", message: "message manquant" });
    }

    // Générer une réponse intelligente
    const reply = generateResponse(message, history || []);
    
    res.json({ reply });
  } catch (e) {
    console.error("[voice-agent] error:", e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

export default router;

