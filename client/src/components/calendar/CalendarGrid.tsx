import { parseISO } from "date-fns";
import type { Appointment } from "@shared/schema";
import DayColumn from "./DayColumn";
import type { StylistPalette } from "./stylistColors";

type EnrichedAppointment = Appointment & {
  client?: { firstName: string; lastName: string; email?: string };
  stylist?: { firstName: string; lastName: string };
  service?: { name: string; price?: number; duration?: number };
};

interface CalendarGridProps {
  day: Date;
  appointments: EnrichedAppointment[];
  daySlots: Array<{ openTime: string; closeTime: string }> | null;
  closures?: Array<{ startTime: string; endTime: string; label?: string; isSalonWide?: boolean; stylistName?: string }> | null;
  startHour: number;
  endHour: number;
  stylistColors: Map<string, StylistPalette>;
  onAppointmentClick: (appointment: EnrichedAppointment) => void;
  onSlotClick: (date: Date, time: string) => void;
  isClosed: boolean;
}

export default function CalendarGrid({
  day,
  appointments,
  daySlots,
  closures,
  startHour,
  endHour,
  stylistColors,
  onAppointmentClick,
  onSlotClick,
  isClosed,
}: CalendarGridProps) {
  const dayAppointments = appointments.filter((appointment) => {
    const start = parseISO(appointment.startTime);
    return (
      start.getFullYear() === day.getFullYear() &&
      start.getMonth() === day.getMonth() &&
      start.getDate() === day.getDate()
    );
  });

  return (
    <DayColumn
      day={day}
      appointments={dayAppointments}
      daySlots={daySlots}
      closures={closures}
      startHour={startHour}
      endHour={endHour}
      stylistPalettes={stylistColors}
      onAppointmentClick={onAppointmentClick}
      onSlotClick={onSlotClick}
      isClosed={isClosed}
    />
  );
}
