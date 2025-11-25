import { useCallback, useMemo } from "react";
import { parseISO } from "date-fns";
import type { Appointment } from "@shared/schema";

import CalendarEvent from "./CalendarEvent";
import CalendarTooltip from "./CalendarTooltip";
import {
  COLUMN_GUTTER_PX,
  PX_PER_MINUTE,
  SLOT_MINUTES,
  buildEventLayout,
  snapToGrid,
  type CalendarLayoutInput,
  type CalendarLayoutItem,
} from "@/calendar/utils/layout";
import type { StylistPalette } from "./stylistColors";

type EnrichedAppointment = Appointment & {
  client?: { firstName: string; lastName: string; email?: string };
  stylist?: { firstName: string; lastName: string };
  service?: { name: string; price?: number; duration?: number };
};

interface DayColumnProps {
  day: Date;
  appointments: EnrichedAppointment[];
  daySlots: Array<{ openTime: string; closeTime: string }> | null;
  closures?: Array<{ startTime: string; endTime: string; label?: string; isSalonWide?: boolean; stylistName?: string }> | null;
  startHour: number;
  endHour: number;
  stylistPalettes: Map<string, StylistPalette>;
  onAppointmentClick: (appointment: EnrichedAppointment) => void;
  onSlotClick: (day: Date, time: string) => void;
  isClosed: boolean;
}

const HALF_HOUR_HEIGHT = SLOT_MINUTES * PX_PER_MINUTE;
const HOUR_HEIGHT = 60 * PX_PER_MINUTE;

export default function DayColumn({
  day,
  appointments,
  daySlots,
  closures,
  startHour,
  endHour,
  stylistPalettes,
  onAppointmentClick,
  onSlotClick,
  isClosed,
}: DayColumnProps) {
  const dayHeight = useMemo(() => (endHour - startHour) * 60 * PX_PER_MINUTE, [endHour, startHour]);
  const closurePanelWidth = closures && closures.length > 0 ? 140 : 0;

  const layoutInputs = useMemo<CalendarLayoutInput<EnrichedAppointment>[]>(() => {
    return appointments.map((appointment) => ({
      id: appointment.id,
      start: parseISO(appointment.startTime),
      end: parseISO(appointment.endTime),
      data: appointment,
    }));
  }, [appointments]);

  const layoutItems = useMemo(() => {
    return buildEventLayout(layoutInputs, startHour, endHour);
  }, [layoutInputs, startHour, endHour]);

  const handleColumnClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isClosed) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      if (closurePanelWidth > 0 && offsetX > rect.width - closurePanelWidth) {
        return;
      }
      const offsetY = event.clientY - rect.top;
      const minutesFromStart = offsetY / PX_PER_MINUTE;
      const snappedMinutes = snapToGrid(minutesFromStart, SLOT_MINUTES);
      const totalMinutes = startHour * 60 + snappedMinutes;
      const hour = Math.floor(totalMinutes / 60);
      const minute = Math.round(totalMinutes % 60);
      const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

      // Empêcher la création si le créneau est dans une fermeture partielle
      const isWithinClosure = closures?.some((closure) => {
        const [startH, startM] = closure.startTime.split(":").map(Number);
        const [endH, endM] = closure.endTime.split(":").map(Number);
        const closureStart = startH * 60 + startM;
        const closureEnd = endH * 60 + endM;
        const clickedMinutes = hour * 60 + minute;
        return clickedMinutes >= closureStart && clickedMinutes < closureEnd;
      });
      if (isWithinClosure) {
        return;
      }

      onSlotClick(day, time);
    },
    [closurePanelWidth, closures, day, isClosed, onSlotClick, startHour]
  );

  if (isClosed) {
    return (
      <div
        className="relative border-r border-border/40 bg-muted/40 text-muted-foreground"
        style={{ height: `${dayHeight}px` }}
      >
        <div className="absolute inset-0 flex items-center justify-center px-3 text-sm font-medium text-center">
          Salon fermé
        </div>
      </div>
    );
  }

  const renderEvent = (layout: CalendarLayoutItem<EnrichedAppointment>) => {
    const appointment = layout.data;
    const palette = stylistPalettes.get(appointment.stylistId) ?? {
      base: "#6366f1",
      background: "rgba(99, 102, 241, 0.16)",
      border: "rgba(99, 102, 241, 0.45)",
      text: "#1f2937",
      hover: "rgba(99, 102, 241, 0.22)",
    };

    const totalGutter = (layout.columnCount - 1) * COLUMN_GUTTER_PX;
    const width =
      layout.columnCount === 1
        ? "100%"
        : `calc((100% - ${totalGutter}px) / ${layout.columnCount})`;
    const left =
      layout.columnCount === 1
        ? "0px"
        : `calc(${layout.columnIndex} * ((100% - ${totalGutter}px) / ${layout.columnCount} + ${COLUMN_GUTTER_PX}px))`;

    return (
      <div
        key={appointment.id}
        className="absolute"
        style={{
          top: `${layout.top}px`,
          height: `${layout.height}px`,
          left,
          width,
        }}
      >
        <CalendarTooltip appointment={appointment}>
          <CalendarEvent
            appointment={appointment}
            palette={palette}
            ariaLabel={buildAriaLabel(appointment)}
            onActivate={() => onAppointmentClick(appointment)}
          />
        </CalendarTooltip>
      </div>
    );
  };

  return (
    <div
      className="relative border-r border-border/40 bg-background"
      style={{ height: `${dayHeight}px`, paddingRight: closurePanelWidth ? `${closurePanelWidth + 8}px` : undefined }}
      onClick={handleColumnClick}
      role="presentation"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to bottom, rgba(148, 163, 184, 0.25) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: `100% ${HOUR_HEIGHT}px, 100% ${HALF_HOUR_HEIGHT}px`,
          backgroundRepeat: "repeat",
        }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0"
        style={{ right: closurePanelWidth ? `${closurePanelWidth + 8}px` : 0 }}
      >
        {layoutItems.map((layout) => renderEvent(layout))}
      </div>

      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {daySlots?.map((slot, index) => {
          const [startH, startM] = slot.openTime.split(":").map(Number);
          const [endH, endM] = slot.closeTime.split(":").map(Number);
          const slotStartMinutes = startH * 60 + startM - startHour * 60;
          const slotEndMinutes = endH * 60 + endM - startHour * 60;
          const clampedStart = Math.max(slotStartMinutes, 0);
          const clampedEnd = Math.min(slotEndMinutes, (endHour - startHour) * 60);
          const top = snapToGrid(clampedStart * PX_PER_MINUTE);
          const height = snapToGrid(Math.max(clampedEnd - clampedStart, SLOT_MINUTES) * PX_PER_MINUTE);

          return (
            <div
              key={`${slot.openTime}-${slot.closeTime}-${index}`}
              className="absolute left-0 right-0 rounded-md border border-dashed border-primary/20 bg-primary/5"
              style={{
                top: `${top}px`,
                height: `${height}px`,
              }}
            />
          );
        })}
      </div>

      {/* Fermetures partielles */}
      <div className="absolute inset-0 pointer-events-none flex items-start justify-end pr-1 gap-2" aria-hidden="true">
        {closures?.map((closure, index) => {
          const [startH, startM] = closure.startTime.split(":").map(Number);
          const [endH, endM] = closure.endTime.split(":").map(Number);
          const startMinutes = startH * 60 + startM - startHour * 60;
          const endMinutes = endH * 60 + endM - startHour * 60;
          const clampedStart = Math.max(startMinutes, 0);
          const clampedEnd = Math.min(endMinutes, (endHour - startHour) * 60);
          if (clampedEnd <= clampedStart) return null;
          const top = snapToGrid(clampedStart * PX_PER_MINUTE);
          const height = snapToGrid((clampedEnd - clampedStart) * PX_PER_MINUTE);

          return (
            <div
              key={`closure-${index}-${closure.startTime}-${closure.endTime}`}
              className="absolute rounded-md border text-muted-foreground text-xs font-medium w-[120px]"
              style={{
                top: `${top}px`,
                height: `${height}px`,
                right: "4px",
                borderColor: "rgba(148, 163, 184, 0.6)",
                backgroundColor: "rgba(148, 163, 184, 0.25)",
                backgroundImage: `
                  repeating-linear-gradient(
                    45deg,
                    rgba(148, 163, 184, 0.4) 0px,
                    rgba(148, 163, 184, 0.4) 6px,
                    transparent 6px,
                    transparent 12px
                  )
                `,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.4rem",
                textAlign: "center",
              }}
            >
              <span className="leading-tight">
                {closure.label || "Fermeture"}
                <br />
                <span className="text-[11px] font-normal text-foreground">
                  {closure.stylistName ? `Coiffeur·euse: ${closure.stylistName}` : "Salon entier"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildAriaLabel(appointment: EnrichedAppointment): string {
  const client = appointment.client
    ? `${appointment.client.firstName} ${appointment.client.lastName}`
    : "Client inconnu";
  const service = appointment.service?.name ?? "Service inconnu";
  const stylist = appointment.stylist
    ? `${appointment.stylist.firstName} ${appointment.stylist.lastName}`
    : "Coiffeur·euse inconnu·e";
  const startTime = new Date(appointment.startTime);
  const endTime = new Date(appointment.endTime);
  const formatTime = (date: Date) =>
    `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  return `${client} – ${service} – ${formatTime(startTime)} à ${formatTime(endTime)} – ${stylist}`;
}

