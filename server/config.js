// server/config.js
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
export const hasOpenAI = Boolean(OPENAI_API_KEY && OPENAI_API_KEY.length > 10);

// 'off' | 'browser' | 'openai'  — défaut: 'off' (aucune dépense)
const raw = (process.env.VOICE_MODE || "off").toLowerCase();
export const VOICE_MODE = (["off","browser","openai"].includes(raw) ? raw : "off");

export function openAIHeaders() {
  return {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  };
}