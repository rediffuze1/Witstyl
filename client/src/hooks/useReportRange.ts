import { useState, useCallback, useMemo } from "react";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  format,
} from "date-fns";
import { fr } from "date-fns/locale";

export type ReportGranularity = "day" | "week" | "month" | "year";

export interface ReportRange {
  startDate: Date; // Borne inférieure inclusive (00:00:00.000)
  endDate: Date; // Borne supérieure inclusive (23:59:59.999)
  granularity: ReportGranularity;
  referenceDate: Date; // Date de référence pour la navigation
}

export interface UseReportRangeReturn {
  range: ReportRange;
  setGranularity: (granularity: ReportGranularity) => void;
  shiftPeriod: (direction: -1 | 1) => void;
  goToToday: () => void;
  setReferenceDate: (date: Date) => void;
  displayLabel: string;
}

/**
 * Hook pour gérer l'état de période des rapports
 * 
 * Règles de calcul des périodes :
 * - day  : [startOfDay, endOfDay] - Jour complet (00:00:00.000 à 23:59:59.999)
 * - week : [startOfISOWeek (lundi), endOfISOWeek (dimanche)] - Semaine ISO (lundi à dimanche)
 * - month: [startOfMonth, endOfMonth] - Mois complet
 * 
 * Fuseau horaire : Les dates sont calculées dans le fuseau local du navigateur.
 * Les dates sont ensuite converties en ISO pour l'API, qui les interprète en UTC.
 * 
 * Bornes : Inclusives/inclusives [startDate, endDate]
 * - startDate : 00:00:00.000 (inclus)
 * - endDate : 23:59:59.999 (inclus)
 */
export function useReportRange(
  initialGranularity: ReportGranularity = "week"
): UseReportRangeReturn {
  const [granularity, setGranularityState] =
    useState<ReportGranularity>(initialGranularity);
  const [referenceDate, setReferenceDateState] = useState<Date>(new Date());

  // Calculer startDate et endDate selon la granularité
  const range = useMemo<ReportRange>(() => {
    let startDate: Date;
    let endDate: Date;

    if (granularity === "day") {
      // Jour : du début à la fin du jour
      startDate = startOfDay(referenceDate);
      endDate = endOfDay(referenceDate);
    } else if (granularity === "week") {
      // Semaine ISO : lundi à dimanche
      // weekStartsOn: 1 = lundi (ISO standard)
      startDate = startOfWeek(referenceDate, { weekStartsOn: 1 });
      endDate = endOfWeek(referenceDate, { weekStartsOn: 1 });
      // S'assurer que endDate est à 23:59:59.999 pour inclusion complète
      endDate.setHours(23, 59, 59, 999);
    } else if (granularity === "month") {
      startDate = startOfMonth(referenceDate);
      endDate = endOfMonth(referenceDate);
      // S'assurer que endDate est à 23:59:59.999 pour inclusion complète
      endDate.setHours(23, 59, 59, 999);
    } else {
      // year
      startDate = startOfYear(referenceDate);
      endDate = endOfYear(referenceDate);
      endDate.setHours(23, 59, 59, 999);
    }

    return {
      startDate,
      endDate,
      granularity,
      referenceDate,
    };
  }, [granularity, referenceDate]);

  // Changer la granularité
  const setGranularity = useCallback((newGranularity: ReportGranularity) => {
    setGranularityState(newGranularity);
    // La période sera recalculée automatiquement via useMemo
  }, []);

  // Décaler la période (Précédent/Suivant)
  const shiftPeriod = useCallback(
    (direction: -1 | 1) => {
      setReferenceDateState((current) => {
        if (granularity === "day") {
          return direction === 1 ? addDays(current, 1) : subDays(current, 1);
        } else if (granularity === "week") {
          return direction === 1 ? addWeeks(current, 1) : subWeeks(current, 1);
        } else if (granularity === "month") {
          return direction === 1
            ? addMonths(current, 1)
            : subMonths(current, 1);
        } else {
          return direction === 1
            ? addYears(current, 1)
            : subYears(current, 1);
        }
      });
    },
    [granularity]
  );

  // Aller à aujourd'hui
  const goToToday = useCallback(() => {
    setReferenceDateState(new Date());
  }, []);

  // Définir une date de référence spécifique
  const setReferenceDate = useCallback((date: Date) => {
    setReferenceDateState(date);
  }, []);

  // Label d'affichage de la période
  const displayLabel = useMemo(() => {
    if (granularity === "day") {
      return format(referenceDate, "EEEE d MMMM yyyy", { locale: fr });
    } else if (granularity === "week") {
      const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
      return `Semaine du ${format(weekStart, "d MMMM", { locale: fr })} au ${format(weekEnd, "d MMMM yyyy", { locale: fr })}`;
    } else if (granularity === "month") {
      return format(referenceDate, "MMMM yyyy", { locale: fr });
    } else {
      return format(referenceDate, "yyyy", { locale: fr });
    }
  }, [granularity, referenceDate]);

  return {
    range,
    setGranularity,
    shiftPeriod,
    goToToday,
    setReferenceDate,
    displayLabel,
  };
}
