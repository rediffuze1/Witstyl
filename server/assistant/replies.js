// server/assistant/replies.js

export function nextReply(s) {
  // message contextuel selon ce qui manque
  if (!s.dateISO) {
    return s.service
      ? `Parfait pour ${renderService(s.service)}. Quel jour vous arrange ? (ex : jeudi, demain)`
      : `Quel jour vous arrange ? (ex : jeudi, demain)`;
  }
  if (!s.time) {
    return proposeTimeOptions(s);
  }
  if (!s.service) {
    return `Très bien pour ${renderDateTime(s)}. Quelle prestation souhaitez-vous ? (coupe, couleur, brushing, soin, balayage)`;
  }
  if (!s.phone) {
    return `Parfait, il me manque juste un numéro de téléphone pour confirmer.`;
  }
  return `Je récapitule : ${formatRecap(s)}. Je confirme ?`;
}

export function renderService(svc) {
  if (!svc) return "la prestation choisie";
  const map = {
    soin: "un soin",
    coupe: "une coupe",
    couleur: "une couleur",
    brushing: "un brushing",
    balayage: "un balayage",
  };
  return map[svc] || `un ${svc}`;
}

export function renderDateTime(s) {
  const d = s.dateISO ? s.dateISO.split("-").reverse().join("/") : "?";
  return s.time ? `${d} à ${s.time}` : d;
}

export function formatRecap(s) {
  const d = s.dateISO ? s.dateISO.split("-").reverse().join("/") : "?";
  const svc = renderService(s.service);
  return `${d}${s.time ? " à " + s.time : ""} pour ${svc}`;
}

export function proposeTimeOptions(s) {
  // Dispos d'exemple. Filtrées par minHour/maxHour si présents.
  const base = [9, 10.5, 14, 15.5, 17];
  const { minHour, maxHour } = s.constraints || {};
  const kept = base.filter(h => {
    const okMin = minHour == null || h >= minHour;
    const okMax = maxHour == null || h <= maxHour;
    return okMin && okMax;
  });
  const label = (h) => {
    const hh = Math.floor(h);
    const mm = (h - hh) > 0 ? "30" : "00";
    return `${String(hh).padStart(2, "0")}h${mm}`;
  };

  if (!kept.length) {
    return `Je n'ai plus de créneau compatible ce jour-là. Voulez-vous essayer un autre horaire ou un autre jour ?`;
  }

  const intro = s.service
    ? `Pour ${renderService(s.service)}, `
    : "";
  return `${intro}j'ai des créneaux : ${kept.map(label).join(", ")}. Lequel vous arrange ?`;
}