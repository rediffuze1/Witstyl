// Palette de couleurs douces et accessibles pour les stylistes
const STYLIST_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Rose
  "#f59e0b", // Ambre
  "#10b981", // Émeraude
  "#3b82f6", // Bleu
  "#ef4444", // Rouge
  "#14b8a6", // Turquoise
  "#f97316", // Orange
  "#a855f7", // Violet foncé
  "#06b6d4", // Cyan
  "#84cc16", // Lime
];

/**
 * Génère une couleur unique pour chaque styliste basée sur son ID
 */
export function getStylistColor(stylistId: string, index: number = 0): string {
  // Utiliser l'index si disponible, sinon générer un hash à partir de l'ID
  if (index >= 0 && index < STYLIST_COLORS.length) {
    return STYLIST_COLORS[index];
  }

  // Sinon, générer un hash simple à partir de l'ID
  let hash = 0;
  for (let i = 0; i < stylistId.length; i++) {
    hash = stylistId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % STYLIST_COLORS.length;
  return STYLIST_COLORS[colorIndex];
}

export interface StylistPalette {
  base: string;
  background: string;
  border: string;
  text: string;
  hover: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (value.length !== 6) return null;

  const bigint = parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function buildPalette(baseColor: string): StylistPalette {
  return {
    base: baseColor,
    background: withAlpha(baseColor, 0.16),
    border: withAlpha(baseColor, 0.55),
    text: withAlpha(baseColor, 0.92),
    hover: withAlpha(baseColor, 0.24),
  };
}

/**
 * Crée une Map des palettes de couleurs pour tous les stylistes
 * Utilise la couleur personnalisée si disponible, sinon génère une couleur
 */
export function createStylistColorMap(
  stylists: Array<{ id: string; color?: string | null }>
): Map<string, StylistPalette> {
  const colorMap = new Map<string, StylistPalette>();
  stylists.forEach((stylist, index) => {
    const color = stylist.color || getStylistColor(stylist.id, index);
    colorMap.set(stylist.id, buildPalette(color));
  });
  return colorMap;
}