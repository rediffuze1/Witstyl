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
  const accent = `hsl(${h} ${s}% ${accentL}%)`;
  const secondary = `hsl(${h} ${s}% ${secondaryL}%)`;
  const ring = `hsl(${h} ${ringS}% ${l}%)`;
  const primaryFg = l > 55 ? "hsl(220 13% 13%)" : "hsl(0 0% 100%)";

  return { accent, secondary, ring, primaryFg };
}

function setCssVars(primary: string) {
  const root = document.documentElement;
  const p = parseColor(primary);
  const d = deriveFromPrimary(p);

  root.style.setProperty("--primary", p);
  root.style.setProperty("--primary-foreground", d.primaryFg);
  root.style.setProperty("--accent", d.accent);
  root.style.setProperty("--secondary", d.secondary);
  root.style.setProperty("--ring", d.ring);

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
