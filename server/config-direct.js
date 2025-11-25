// Configuration directe sans dépendance dotenv
import { readFileSync } from 'fs';
import { join } from 'path';

let OPENAI_API_KEY = null;
let OPENAI_ORG_ID = null;
let OPENAI_PROJECT_ID = null;
let VOICE_MODE = null;
let DATABASE_URL = null;

// Charger directement depuis .env
try {
  const envPath = join(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf8');
  
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim().replace(/[^\x20-\x7E]/g, ''); // Supprimer les caractères non-ASCII
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (key === 'OPENAI_API_KEY') OPENAI_API_KEY = value;
        if (key === 'OPENAI_ORG_ID') OPENAI_ORG_ID = value;
        if (key === 'OPENAI_PROJECT_ID') OPENAI_PROJECT_ID = value;
        if (key === 'VOICE_MODE') VOICE_MODE = value;
        if (key === 'DATABASE_URL') DATABASE_URL = value;
      }
    }
  });
  
  console.log("🔧 Configuration directe chargée");
  console.log("🔑 OPENAI_API_KEY:", OPENAI_API_KEY ? "✅ Trouvée" : "❌ Manquante");
  console.log("🎤 VOICE_MODE:", VOICE_MODE || "off");
  console.log("🗄️ DATABASE_URL:", DATABASE_URL ? "✅ Trouvée" : "❌ Manquante");
} catch (error) {
  console.log("⚠️ Erreur chargement .env:", error.message);
}

export { OPENAI_API_KEY, OPENAI_ORG_ID, OPENAI_PROJECT_ID, DATABASE_URL };
export const hasOpenAI = Boolean(OPENAI_API_KEY && OPENAI_API_KEY.length > 10);

// Gestion des modes de voix
const rawVoice = (VOICE_MODE || "off").toLowerCase();
export const VOICE_MODE_CONFIG = (["off","browser","openai"].includes(rawVoice) ? rawVoice : "off");

// En-têtes OpenAI communs
export function openAIHeaders() {
  const headers = {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (OPENAI_ORG_ID) headers["OpenAI-Organization"] = OPENAI_ORG_ID;
  if (OPENAI_PROJECT_ID) headers["OpenAI-Project"] = OPENAI_PROJECT_ID;
  return headers;
}

