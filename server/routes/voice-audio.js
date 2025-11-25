// server/routes/voice-audio.js
import express from "express";

const router = express.Router();

// POST /api/voice-agent/audio - Synthèse vocale simple
router.post("/audio", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "message manquant" });
    }

    // Pour l'instant, on retourne un message indiquant que la synthèse vocale
    // sera gérée côté client avec l'API Web Speech Synthesis
    res.json({ 
      success: true, 
      message: "Synthèse vocale gérée côté client",
      text: message 
    });
  } catch (e) {
    console.error("[voice-audio] error:", e);
    res.status(500).json({ error: "AUDIO_SERVER_ERROR", detail: String(e) });
  }
});

// GET /api/public-config
router.get("/public-config", (_req, res) => {
  res.json({ voiceMode: "browser" }); // Mode navigateur pour la synthèse vocale
});

// GET /api/health/openai
router.get("/health/openai", async (_req, res) => {
  res.json({ ok: true, mode: "local" });
});

export default router;