import { type Stylist } from "@shared/schema";
import type { StylistPalette } from "./stylistColors";

interface CalendarLegendProps {
  stylists: Stylist[];
  stylistColors: Map<string, StylistPalette>;
}

export default function CalendarLegend({ stylists, stylistColors }: CalendarLegendProps) {
  if (!stylists || stylists.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-card rounded-lg border shadow-sm">
      <span className="text-sm font-medium text-muted-foreground">Légende:</span>
      {stylists.map((stylist) => {
        const palette = stylistColors.get(stylist.id);
        const baseColor = palette?.base ?? "#6366f1";
        const name = `${stylist.firstName} ${stylist.lastName}`;
        return (
          <div key={stylist.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: baseColor }}
            />
            <span className="text-xs text-muted-foreground">{name}</span>
          </div>
        );
      })}
    </div>
  );
}


