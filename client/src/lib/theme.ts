// client/src/lib/theme.ts
// Gestion centrale du thème via CSS variables + localStorage + sync inter-onglets

type ThemeState = {
  primary: string;            // HSL/CSS color string (ex: "hsl(220 14% 96%)" ou "#3b82f6")
  version: number;            // pour migrations si besoin
};

const LS_KEY = "salonpilot.theme.v1";
const DEFAULT_THEME: ThemeState = {
  // Gris foncé (R:90 G:90 B:90)
  primary: "hsl(0 0% 35%)", // gris foncé
  version: 1,
};

// Helpers simples
const parseColor = (c: string) => c.trim();
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const hsl = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;
const hsla = (h: number, s: number, l: number, a: number) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

// Génère des variations pour --accent, etc., à partir de la couleur principale (approx HSL via CSS filters)
function deriveFromPrimary(primaryHsl: string) {
  // Si on a déjà du hsl(), on tente d'en extraire H,S,L
  const m = primaryHsl.match(/hsl[a]?\(([^)]+)\)/i);
  let h = 220, s = 14, l = 96;
  if (m) {
    // support "220 14% 96%" ou "220, 14%, 96%"
    const parts = m[1].replace(/%/g, "").replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (parts.length >= 3) {
      h = Number(parts[0]);
      s = Number(parts[1]);
      l = Number(parts[2]);
    }
  }
  // Variantes
  const accentL = clamp(l - 12, 0, 100);
  const secondaryL = clamp(l + 6, 0, 100);
  const ringS = clamp(s + 20, 0, 100);
  const accent = hsl(h, s, accentL);
  const secondary = hsl(h, s, secondaryL);
  const ring = hsl(h, ringS, l);
  const primaryFg = l > 55 ? "hsl(220 13% 13%)" : "hsl(0 0% 100%)";
  const strong = hsl(h, s, clamp(l - 18));
  const soft = hsl(h, Math.max(18, s - 20), clamp(l + 14));
  const softer = hsl(h, Math.max(12, s - 28), clamp(l + 24));
  const glow = hsla(h, clamp(s + 5, 0, 100), clamp(l + 20, 0, 100), 0.4);
  // Gradient avec couleur de référence pour landing page (135deg comme spécifié)
  const gradient = `linear-gradient(135deg, ${hsl(h, s, clamp(l, 0, 100))}, color-mix(in srgb, ${hsl(h, s, clamp(l, 0, 100))} 85%, #A855F7))`;
  const glassBg = hsla(h, Math.max(8, s - 40), clamp(l + 48, 0, 100), 0.8);
  const glassBorder = hsla(h, Math.max(12, s - 25), clamp(l + 16, 0, 100), 0.55);
  const glassHighlight = hsla(h, Math.max(15, s - 18), clamp(l + 60, 0, 100), 0.65);

  return {
    accent,
    secondary,
    ring,
    primaryFg,
    strong,
    soft,
    softer,
    glow,
    gradient,
    glassBg,
    glassBorder,
    glassHighlight,
    base: hsl(h, s, l),
  };
}

function setCssVars(primary: string) {
  const root = document.documentElement;
  const p = parseColor(primary);
  const d = deriveFromPrimary(p);

  // Extraire H, S, L pour les variables séparées (nécessaire pour la landing page)
  const m = p.match(/hsl[a]?\(([^)]+)\)/i);
  let h = 255, s = 82, l = 60; // Valeurs par défaut (violet)
  if (m) {
    const parts = m[1].replace(/%/g, "").replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (parts.length >= 3) {
      h = Number(parts[0]);
      s = Number(parts[1]);
      l = Number(parts[2]);
    }
  }

  root.style.setProperty("--primary", p);
  root.style.setProperty("--primary-foreground", d.primaryFg);
  root.style.setProperty("--accent", d.accent);
  root.style.setProperty("--secondary", d.secondary);
  root.style.setProperty("--ring", d.ring);
  root.style.setProperty("--brand-color", d.base);
  root.style.setProperty("--brand-color-strong", d.strong);
  root.style.setProperty("--brand-color-soft", d.soft);
  root.style.setProperty("--brand-color-softer", d.softer);
  root.style.setProperty("--brand-gradient", d.gradient);
  root.style.setProperty("--brand-glow", d.glow);
  root.style.setProperty("--glass-bg", d.glassBg);
  root.style.setProperty("--glass-border", d.glassBorder);
  root.style.setProperty("--glass-highlight", d.glassHighlight);

  // Variables HSL séparées pour la landing page (format requis par le composant)
  root.style.setProperty("--brand-h", String(h));
  root.style.setProperty("--brand-s", `${s}%`);
  root.style.setProperty("--brand-l", `${l}%`);
  root.style.setProperty("--brand", `${h} ${s}% ${l}%`);
  root.style.setProperty("--brand-soft", `${h} ${s}% 96%`);
  root.style.setProperty("--brand-strong", `${h} ${s}% ${clamp(l - 8, 0, 100)}%`);

  // Optionnel : bordures/input alignés à la teinte
  // root.style.setProperty("--border", `color-mix(in srgb, ${p} 25%, hsl(220 13% 91%))`);
  // root.style.setProperty("--input", `color-mix(in srgb, ${p} 25%, hsl(220 13% 91%))`);
}

function read(): ThemeState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_THEME };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_THEME, ...parsed };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

function write(state: ThemeState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

export const Theme = {
  init() {
    const state = read();
    setCssVars(state.primary);
    // Sync inter-onglets
    window.addEventListener("storage", (e) => {
      if (e.key === LS_KEY && e.newValue) {
        try {
          const s = JSON.parse(e.newValue) as ThemeState;
          setCssVars(s.primary);
        } catch {}
      }
    });
  },
  get(): ThemeState {
    return read();
  },
  apply(primary: string) {
    const state = read();
    const next = { ...state, primary: parseColor(primary) };
    write(next);
    setCssVars(next.primary);
  },
  resetAllPreferences() {
    // Tu peux, ici, aussi clear d'autres préférences si vous en avez.
    localStorage.removeItem(LS_KEY);
    write({ ...DEFAULT_THEME }); // remet le gris clair
    setCssVars(DEFAULT_THEME.primary);
  },
};
