// server/assistant/nlp.js
import * as chrono from "chrono-node";

export function parseDate(text, base = new Date()) {
  try {
    // Parser simple pour les jours de la semaine
    const dayMap = {
      'lundi': 1, 'mardi': 2, 'mercredi': 3, 'jeudi': 4, 
      'vendredi': 5, 'samedi': 6, 'dimanche': 0
    };
    
    const lowerText = text.toLowerCase();
    for (const [dayName, dayNum] of Object.entries(dayMap)) {
      if (lowerText.includes(dayName)) {
        const today = new Date();
        const daysUntil = (dayNum - today.getDay() + 7) % 7;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntil);
        return targetDate.toISOString().slice(0, 10); // YYYY-MM-DD
      }
    }
    
    // Parser pour "demain"
    if (lowerText.includes('demain')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().slice(0, 10);
    }
    
    // Parser pour "aujourd'hui"
    if (lowerText.includes('aujourd\'hui') || lowerText.includes('aujourd hui')) {
      return new Date().toISOString().slice(0, 10);
    }
    
    // Utiliser chrono-node pour les autres cas
    const result = chrono.parse(text, base, { forwardDate: true });
    if (result && result.length > 0) {
      const date = result[0].date();
      if (date) {
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
      }
    }
  } catch (e) {
    console.log('Erreur parseDate:', e);
  }
  return undefined;
}

export function parseTime(text) {
  // Ne pas traiter les contraintes comme des heures
  const lowerText = text.toLowerCase();
  if (lowerText.includes('à partir de') || lowerText.includes('avant')) {
    return undefined;
  }
  
  // Capte "11h", "11:30", "15 h 45", "11 heures"
  const m = lowerText.match(/(\d{1,2})\s*h(?:\s*(\d{2}))?/);
  if (!m) return undefined;
  
  const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const mm = m[2] ? Math.max(0, Math.min(59, parseInt(m[2], 10))) : 0;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function detectService(text) {
  const t = text.toLowerCase();
  const map = ["coupe", "couleur", "coloration", "brushing", "soin", "balayage"];
  const f = map.find(k => t.includes(k));
  if (!f) return undefined;
  return f === "coloration" ? "couleur" : f;
}

export function detectConstraints(text) {
  const t = text.toLowerCase();
  const constraints = {};
  
  const after = /(après|à partir de)\s+(\d{1,2})\s*h/.exec(t);
  if (after) {
    constraints.minHour = Math.min(23, Math.max(0, parseInt(after[2], 10)));
  }
  
  const before = /avant\s+(\d{1,2})\s*h/.exec(t);
  if (before) {
    constraints.maxHour = Math.min(23, Math.max(0, parseInt(before[1], 10)));
  }
  
  return constraints;
}
