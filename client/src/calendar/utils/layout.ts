import { differenceInMinutes } from "date-fns";

export const PX_PER_MINUTE = 1.2;
export const SLOT_MINUTES = 30;
export const COLUMN_GUTTER_PX = 6;

export interface CalendarLayoutInput<T> {
  id: string;
  start: Date;
  end: Date;
  data: T;
}

export interface CalendarLayoutItem<T> {
  id: string;
  data: T;
  startMinutes: number;
  endMinutes: number;
  top: number;
  height: number;
  columnIndex: number;
  columnCount: number;
}

export function minutesSinceDayStart(date: Date, dayStartHour: number): number {
  return date.getHours() * 60 + date.getMinutes() - dayStartHour * 60;
}

export function clampMinutes(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function snapToGrid(value: number, granularity = 0.5): number {
  return Math.round(value / granularity) * granularity;
}

/**
 * Découpe les rendez-vous en clusters qui se chevauchent et leur assigne des colonnes homogènes.
 * Algorithme : tri par heure de début, balayage linéaire pour regrouper les chevauchements,
 * puis partition d'intervalles (interval partitioning) à l'intérieur de chaque cluster.
 */
export function buildEventLayout<T>(
  events: CalendarLayoutInput<T>[],
  startHour: number,
  endHour: number
): CalendarLayoutItem<T>[] {
  if (!events.length) return [];

  const dayStartMinutes = startHour * 60;
  const dayEndMinutes = endHour * 60;

  const sorted = [...events].sort((a, b) => {
    if (a.start.getTime() === b.start.getTime()) {
      const stylistA = (a.data as any)?.stylistId ?? "";
      const stylistB = (b.data as any)?.stylistId ?? "";
      if (stylistA === stylistB) {
        return a.end.getTime() - b.end.getTime();
      }
      return stylistA.localeCompare(stylistB);
    }
    return a.start.getTime() - b.start.getTime();
  });

  const positioned: CalendarLayoutItem<T>[] = [];
  let cluster: Array<{
    input: CalendarLayoutInput<T>;
    startMinutes: number;
    endMinutes: number;
  }> = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (!cluster.length) {
      return;
    }

    const columnEndTimes: number[] = [];
    const assignments: Array<{
      input: CalendarLayoutInput<T>;
      startMinutes: number;
      endMinutes: number;
      columnIndex: number;
    }> = [];

    cluster.forEach((item) => {
      let assignedColumn = columnEndTimes.findIndex((end) => end <= item.startMinutes);
      if (assignedColumn === -1) {
        assignedColumn = columnEndTimes.length;
        columnEndTimes.push(item.endMinutes);
      } else {
        columnEndTimes[assignedColumn] = item.endMinutes;
      }

      assignments.push({
        input: item.input,
        startMinutes: item.startMinutes,
        endMinutes: item.endMinutes,
        columnIndex: assignedColumn,
      });
    });

    const columnCount = columnEndTimes.length || 1;

    assignments.forEach((assignment) => {
      const offsetMinutes = assignment.startMinutes - dayStartMinutes;
      const durationMinutes = Math.max(
        assignment.endMinutes - assignment.startMinutes,
        Math.max(differenceInMinutes(assignment.input.end, assignment.input.start), 5)
      );

      const topPx = snapToGrid(offsetMinutes * PX_PER_MINUTE);
      const heightPx = snapToGrid(durationMinutes * PX_PER_MINUTE);

      positioned.push({
        id: assignment.input.id,
        data: assignment.input.data,
        startMinutes: offsetMinutes,
        endMinutes: offsetMinutes + durationMinutes,
        top: topPx,
        height: Math.max(heightPx, PX_PER_MINUTE * 10),
        columnIndex: assignment.columnIndex,
        columnCount,
      });
    });

    cluster = [];
  };

  sorted.forEach((event) => {
    const startMinutes = clampMinutes(
      minutesSinceDayStart(event.start, startHour) + dayStartMinutes,
      dayStartMinutes,
      dayEndMinutes
    );
    const endMinutes = clampMinutes(
      minutesSinceDayStart(event.end, startHour) + dayStartMinutes,
      dayStartMinutes,
      dayEndMinutes
    );

    if (startMinutes >= clusterEnd) {
      flushCluster();
      clusterEnd = -Infinity;
    }

    cluster.push({
      input: event,
      startMinutes,
      endMinutes: Math.max(endMinutes, startMinutes + 5),
    });
    clusterEnd = Math.max(clusterEnd, endMinutes);
  });

  flushCluster();

  return positioned;
}

