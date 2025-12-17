# Fix Chatbot IA en Production

## A) Cause racine

**En production Vercel, `config-direct.js` lisait uniquement depuis un fichier `.env` local qui n'existe pas. Les variables d'environnement Vercel (`process.env.OPENAI_API_KEY`) n'étaient pas utilisées, causant une erreur 503 "OPENAI_UNAVAILABLE".**

## B) Fichiers modifiés

1. `server/config-direct.js` - Correction pour utiliser `process.env` en priorité (Vercel) puis fallback `.env` (local)
2. `client/src/components/floating-chatbot.tsx` - Amélioration gestion d'erreur avec logs détaillés
3. `server/routes/voice-agent.js` - Ajout logs de diagnostic avec requestId

## C) Code exact modifié

### 1. `server/config-direct.js`

```javascript
// Configuration directe sans dépendance dotenv
// PRIORITÉ: process.env (production Vercel) > .env local (développement)
import { readFileSync } from 'fs';
import { join } from 'path';

let OPENAI_API_KEY = null;
let OPENAI_ORG_ID = null;
let OPENAI_PROJECT_ID = null;
let VOICE_MODE = null;
let DATABASE_URL = null;

// PRIORITÉ 1: Charger depuis process.env (production Vercel)
OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim() || null;
OPENAI_ORG_ID = process.env.OPENAI_ORG_ID?.trim() || null;
OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID?.trim() || null;
VOICE_MODE = process.env.VOICE_MODE?.trim() || null;
DATABASE_URL = process.env.DATABASE_URL?.trim() || null;

// PRIORITÉ 2: Fallback sur .env local (développement uniquement)
if (!OPENAI_API_KEY || !DATABASE_URL) {
  try {
    const envPath = join(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim().replace(/[^\x20-\x7E]/g, '');
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          if (key === 'OPENAI_API_KEY' && !OPENAI_API_KEY) OPENAI_API_KEY = value;
          if (key === 'OPENAI_ORG_ID' && !OPENAI_ORG_ID) OPENAI_ORG_ID = value;
          if (key === 'OPENAI_PROJECT_ID' && !OPENAI_PROJECT_ID) OPENAI_PROJECT_ID = value;
          if (key === 'VOICE_MODE' && !VOICE_MODE) VOICE_MODE = value;
          if (key === 'DATABASE_URL' && !DATABASE_URL) DATABASE_URL = value;
        }
      }
    });
  } catch (error) {
    if (process.env.VERCEL) {
      console.log("🔧 Configuration depuis process.env (Vercel)");
    } else {
      console.log("⚠️ Erreur chargement .env:", error.message);
    }
  }
}

console.log("🔧 Configuration chargée");
console.log("🔑 OPENAI_API_KEY:", OPENAI_API_KEY ? `✅ Trouvée (${OPENAI_API_KEY.substring(0, 10)}...)` : "❌ Manquante");
console.log("🎤 VOICE_MODE:", VOICE_MODE || "off");
console.log("🗄️ DATABASE_URL:", DATABASE_URL ? "✅ Trouvée" : "❌ Manquante");
console.log("🌍 Environnement:", process.env.VERCEL ? "Vercel (production)" : "Local (développement)");

export { OPENAI_API_KEY, OPENAI_ORG_ID, OPENAI_PROJECT_ID, DATABASE_URL };
export const hasOpenAI = Boolean(OPENAI_API_KEY && OPENAI_API_KEY.length > 10);

// ... reste du fichier inchangé
```

### 2. `client/src/components/floating-chatbot.tsx` (extrait modifié)

```typescript
try {
  const requestUrl = "/api/voice-agent";
  console.log('[FloatingChatbot] 📤 Envoi message:', { message: message.trim().substring(0, 50), sessionId: getSessionId() });
  
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // Inclure les cookies pour la session
    body: JSON.stringify({ 
      message: message.trim(), 
      sessionId: getSessionId()
    }),
  });

  console.log('[FloatingChatbot] 📥 Réponse reçue:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    url: requestUrl,
  });

  let aiResponse = "Désolé, j'ai eu un souci. Comment puis-je vous aider ?";
  
  if (response.ok) {
    try {
      const data = await response.json();
      aiResponse = data.reply || data.message || "Bonjour ! Comment puis-je vous aider ?";
      console.log('[FloatingChatbot] ✅ Réponse IA reçue:', aiResponse.substring(0, 100));
    } catch (parseError) {
      console.error('[FloatingChatbot] ❌ Erreur parsing JSON:', parseError);
      const text = await response.text();
      console.error('[FloatingChatbot] ❌ Réponse texte brute:', text.substring(0, 200));
      aiResponse = "Désolé, je rencontre un problème technique. Pouvez-vous réessayer ?";
    }
  } else {
    // Erreur HTTP avec gestion détaillée
    console.error('[FloatingChatbot] ❌ Erreur API:', {
      status: response.status,
      statusText: response.statusText,
      url: requestUrl,
    });
    
    let errorData = {};
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        errorData = await response.json();
      } else {
        const text = await response.text();
        console.error('[FloatingChatbot] ❌ Réponse non-JSON:', text.substring(0, 200));
        errorData = { message: text.substring(0, 100) };
      }
    } catch (parseError) {
      console.error('[FloatingChatbot] ❌ Erreur parsing erreur:', parseError);
    }
    
    console.error('[FloatingChatbot] ❌ Détails erreur:', errorData);
    
    // Message d'erreur plus spécifique selon le code
    if (response.status === 503) {
      aiResponse = errorData.message || "Le service IA est temporairement indisponible. Veuillez réessayer dans quelques instants.";
    } else if (response.status === 500) {
      aiResponse = "Une erreur serveur est survenue. Veuillez réessayer plus tard.";
    } else {
      aiResponse = "Désolé, je rencontre un problème technique. Pouvez-vous réessayer ?";
    }
  }
  // ... reste du code
```

### 3. `server/routes/voice-agent.js` (extrait modifié)

```javascript
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
    // ... reste du code
    
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
```

## D) Checklist Vercel

### Variables d'environnement à vérifier/ajouter

**Cursor ne peut pas le faire automatiquement. Voici exactement quoi ajouter :**

1. **Ouvrir Vercel Dashboard** → Projet `Witstyl` → Settings → Environment Variables

2. **Vérifier/Ajouter ces variables :**

   - `OPENAI_API_KEY` (OBLIGATOIRE)
     - Valeur : Votre clé API OpenAI (commence par `sk-...`)
     - Environnements : Production, Preview, Development
   
   - `OPENAI_ORG_ID` (optionnel)
     - Valeur : Votre Organization ID OpenAI si vous en avez un
     - Environnements : Production, Preview, Development
   
   - `OPENAI_PROJECT_ID` (optionnel)
     - Valeur : Votre Project ID OpenAI si vous en avez un
     - Environnements : Production, Preview, Development

3. **Après ajout/modification :**
   - Cliquer sur "Save"
   - **Redeployer** : Deployments → Latest → "Redeploy" (ou attendre le prochain push)

### Vérification CORS

CORS est déjà configuré dans `server/index.ts` pour autoriser :
- `https://witstyl.vercel.app`
- `https://*.vercel.app` (tous les previews)

**Aucune action requise** si la config actuelle est correcte.

## E) Tests

### Test local

```bash
# 1. Vérifier que .env contient OPENAI_API_KEY
cat .env | grep OPENAI_API_KEY

# 2. Démarrer le serveur local
npm run dev

# 3. Ouvrir http://localhost:5173
# 4. Ouvrir le chatbot (bouton flottant)
# 5. Envoyer un message de test
# 6. Vérifier la console navigateur (F12) pour les logs
# 7. Vérifier les logs serveur pour voir "[voice-agent] ✅ Réponse OpenAI générée"
```

### Test production (après déploiement)

1. **Attendre le déploiement Vercel** (2-5 minutes après push)

2. **Ouvrir https://witstyl.vercel.app**

3. **Ouvrir la console navigateur** (F12 → Console)

4. **Ouvrir le chatbot** (bouton flottant en bas à droite)

5. **Envoyer un message de test** (ex: "Bonjour")

6. **Vérifier les logs console :**
   - `[FloatingChatbot] 📤 Envoi message:` doit apparaître
   - `[FloatingChatbot] 📥 Réponse reçue:` avec `status: 200, ok: true`
   - `[FloatingChatbot] ✅ Réponse IA reçue:` avec le texte de la réponse

7. **Si erreur :**
   - Vérifier les logs Vercel : Dashboard → Deployments → Latest → Logs
   - Chercher `[voice-agent]` pour voir les logs serveur
   - Vérifier que `OPENAI_API_KEY` est bien présente dans les logs : `🔑 OPENAI_API_KEY: ✅ Trouvée (sk-...)`

8. **Vérifier Network tab (F12 → Network) :**
   - Requête `POST /api/voice-agent` doit avoir `Status: 200`
   - Response doit contenir `{"reply": "...", "sessionId": "..."}`

## Résumé des corrections

✅ **Correction principale** : `config-direct.js` utilise maintenant `process.env` en priorité (compatible Vercel)

✅ **Amélioration logs** : Logs détaillés côté frontend et backend pour diagnostic

✅ **Gestion d'erreur** : Messages d'erreur plus spécifiques selon le code HTTP

✅ **CORS** : Déjà configuré correctement

✅ **Route** : `/api/voice-agent` est bien exposée via `api/index.ts` → `server/index.ts`

## Prochaines étapes

1. **Commit et push** les modifications
2. **Vérifier/Ajouter** `OPENAI_API_KEY` dans Vercel Environment Variables
3. **Redeployer** si nécessaire
4. **Tester** en production selon la checklist ci-dessus

