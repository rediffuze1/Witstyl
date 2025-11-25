import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, User, Scissors } from "lucide-react";
import { type Appointment } from "@shared/schema";
import { forwardRef, useCallback } from "react";
import type { StylistPalette } from "./stylistColors";
import { PX_PER_MINUTE } from "@/calendar/utils/layout";

type EnrichedAppointment = Appointment & {
  client?: { firstName: string; lastName: string; email?: string };
  stylist?: { firstName: string; lastName: string };
  service?: { name: string };
};

interface CalendarEventProps {
  appointment: EnrichedAppointment;
  palette: StylistPalette;
  ariaLabel: string;
  onActivate?: () => void;
}

const CalendarEvent = forwardRef<HTMLDivElement, CalendarEventProps>(function CalendarEvent(
  { appointment, palette, ariaLabel, onActivate },
  ref
) {
  const startTime = new Date(appointment.startTime);
  const endTime = new Date(appointment.endTime);
  const durationMinutes = Math.max(
    Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)),
    1
  );

  const clientName = appointment.client
    ? `${appointment.client.firstName} ${appointment.client.lastName}`
    : "Client inconnu";
  const stylistName = appointment.stylist
    ? `${appointment.stylist.firstName} ${appointment.stylist.lastName}`
    : "Coiffeur·euse inconnu·e";
  const serviceName = appointment.service?.name ?? "Service inconnu";
  const timeLabel = `${format(startTime, "HH:mm", { locale: fr })} – ${format(endTime, "HH:mm", {
    locale: fr,
  })}`;

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      onActivate?.();
    },
    [onActivate]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        onActivate?.();
      }
    },
    [onActivate]
  );

  // Calculer la hauteur minimale nécessaire pour afficher tous les détails
  // Nom du client: ~20px, Service: ~20px, Styliste: ~20px, Horaires: ~30px, padding: ~20px
  // Total approximatif: ~110px minimum pour tout afficher
  const MIN_HEIGHT_FOR_DETAILS = 110; // pixels
  const MIN_HEIGHT_FOR_SERVICE = 70; // pixels minimum pour afficher service
  
  // Calculer la hauteur basée sur la durée
  // PX_PER_MINUTE = 1.2 (30 min = 36px), donc 1 min = 1.2px
  const eventHeight = durationMinutes * PX_PER_MINUTE;
  
  // Déterminer ce qu'on peut afficher selon la hauteur
  const canShowFullDetails = eventHeight >= MIN_HEIGHT_FOR_DETAILS;
  const canShowService = eventHeight >= MIN_HEIGHT_FOR_SERVICE;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group flex h-full w-full select-none flex-col justify-between rounded-lg border text-left shadow-sm outline-none transition-colors motion-safe:duration-150 motion-safe:ease-out hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none overflow-hidden"
      style={{
        backgroundColor: palette.background,
        borderColor: palette.border,
        color: palette.text,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
      }}
    >
      {canShowFullDetails ? (
        <>
          <div className="flex flex-col gap-1.5 p-2.5 flex-1 min-h-0">
            <div className="text-sm font-semibold leading-tight text-slate-900 truncate">{clientName}</div>
            {canShowService && (
              <>
                <div className="flex items-center gap-1.5 text-xs text-slate-700">
                  <Scissors className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
                  <span className="truncate">{serviceName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs italic text-slate-600">
                  <User className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                  <span className="truncate">{stylistName}</span>
                </div>
              </>
            )}
          </div>
          <div
            className="flex items-center gap-1.5 border-t px-2.5 py-1.5 text-xs font-medium text-slate-700 flex-shrink-0"
            style={{ borderColor: palette.border }}
          >
            <Clock className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
            <span className="truncate">
              {timeLabel} · {durationMinutes} min
            </span>
          </div>
        </>
      ) : (
        // Pour les très petits rendez-vous, n'afficher que le nom du client
        <div className="flex items-center justify-center h-full px-2.5">
          <div className="text-xs font-semibold text-slate-900 truncate w-full text-center">
            {clientName}
          </div>
        </div>
      )}
    </div>
  );
});

export default CalendarEvent;