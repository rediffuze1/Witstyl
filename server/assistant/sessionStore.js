// server/assistant/sessionStore.js
import { v4 as uuidv4 } from "uuid";

export const BookingState = {
  id: String,
  step: String, // "NEED_DATE" | "NEED_TIME" | "NEED_SERVICE" | "NEED_PHONE" | "CONFIRM"
  dateISO: String,   // 2025-10-16
  time: String,      // "11:00"
  service: String,   // "soin" | "coupe" | ...
  phone: String,
  constraints: Object, // { minHour?: number; maxHour?: number }
  updatedAt: Number
};

const sessions = new Map();

export function getOrCreateSession(id) {
  const sessId = id || uuidv4();
  let s = sessions.get(sessId);
  if (!s) {
    s = { 
      id: sessId, 
      step: "NEED_DATE", 
      updatedAt: Date.now(),
      constraints: {},
      messages: [] // Historique de conversation pour OpenAI
    };
    sessions.set(sessId, s);
  }
  // S'assurer que messages existe pour les sessions existantes
  if (!s.messages) {
    s.messages = [];
  }
  return s;
}

export function saveSession(s) {
  s.updatedAt = Date.now();
  sessions.set(s.id, s);
}

export function resetSession(id) {
  sessions.delete(id);
}

