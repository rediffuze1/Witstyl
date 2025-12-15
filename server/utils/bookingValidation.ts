/**
 * Utilitaires pour valider les créneaux de rendez-vous
 * 
 * RÈGLE MÉTIER : Un créneau est accepté s'il rentre entièrement dans au moins un intervalle valide
 * (intersection des horaires salon et coiffeur·euse) pour ce jour.
 * Sinon, une erreur métier explicite est renvoyée.
 */

export interface TimeSlot {
  start: string; // Format "HH:mm"
  end: string; // Format "HH:mm"
}

export interface SalonHours {
  day_of_week: number;
  open_time?: string | null;
  close_time?: string | null;
  is_closed: boolean;
}

export interface StylistSchedule {
  day_of_week: number;
  start_time?: string | null;
  end_time?: string | null;
  is_available: boolean;
}

/**
 * Convertit une heure en format "HH:mm" ou "HH:mm:ss" en minutes depuis minuit
 */
function timeToMinutes(timeStr: string): number {
  // Gérer les formats "HH:mm" et "HH:mm:ss"
  const parts = timeStr.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  return hours * 60 + minutes;
}

/**
 * Convertit des minutes depuis minuit en format "HH:mm"
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Calcule l'intersection entre deux intervalles de temps
 */
function intersectTimeSlots(slot1: TimeSlot, slot2: TimeSlot): TimeSlot | null {
  const start1 = timeToMinutes(slot1.start);
  const end1 = timeToMinutes(slot1.end);
  const start2 = timeToMinutes(slot2.start);
  const end2 = timeToMinutes(slot2.end);

  const intersectionStart = Math.max(start1, start2);
  const intersectionEnd = Math.min(end1, end2);

  if (intersectionStart < intersectionEnd) {
    return {
      start: minutesToTime(intersectionStart),
      end: minutesToTime(intersectionEnd),
    };
  }

  return null;
}

/**
 * Calcule tous les intervalles valides (intersection salon × styliste) pour un jour donné
 */
export function getValidIntervalsForDay(
  salonHours: SalonHours[],
  stylistSchedules: StylistSchedule[] | null,
  dayOfWeek: number
): TimeSlot[] {
  console.log(`[getValidIntervalsForDay] Calcul des intervalles valides pour jour ${dayOfWeek}`);
  console.log(`[getValidIntervalsForDay] Horaires salon reçus:`, salonHours);
  console.log(`[getValidIntervalsForDay] Horaires styliste reçus:`, stylistSchedules);
  
  // Récupérer les horaires du salon pour ce jour
  const salonDayHours = salonHours.filter(h => h.day_of_week === dayOfWeek && !h.is_closed);
  console.log(`[getValidIntervalsForDay] Horaires salon filtrés pour jour ${dayOfWeek}:`, salonDayHours);
  
  if (salonDayHours.length === 0) {
    console.log(`[getValidIntervalsForDay] ❌ Salon fermé ce jour`);
    return []; // Salon fermé ce jour
  }

  // Récupérer les horaires du styliste pour ce jour
  const safeStylistSchedules = stylistSchedules || [];
  const stylistDaySchedules = safeStylistSchedules.filter(s => 
    s.day_of_week === dayOfWeek && 
    s.is_available !== false && 
    s.start_time && 
    s.end_time
  );
  console.log(`[getValidIntervalsForDay] Horaires styliste filtrés pour jour ${dayOfWeek}:`, stylistDaySchedules);

  // Si le styliste n'a pas d'horaires spécifiques, utiliser uniquement les horaires du salon
  // MAIS seulement si stylistSchedules est un tableau vide (pas null)
  // Si stylistSchedules est null, cela signifie qu'on n'a pas pu récupérer les horaires, donc on doit être plus strict
  if (stylistDaySchedules.length === 0) {
    // Si stylistSchedules était null (erreur de récupération), on ne peut pas utiliser les horaires salon
    // car on ne sait pas si le styliste a des horaires spécifiques ou non
    if (stylistSchedules === null) {
      console.log(`[getValidIntervalsForDay] ⚠️ Impossible de déterminer les horaires du styliste (stylistSchedules est null)`);
      return []; // Rejeter par sécurité
    }
    
    // Si stylistSchedules est un tableau vide, le styliste n'a pas d'horaires spécifiques
    // On peut utiliser les horaires du salon
    console.log(`[getValidIntervalsForDay] ℹ️ Aucun horaire styliste spécifique, utilisation des horaires salon uniquement`);
    const intervals = salonDayHours
      .filter(h => h.open_time && h.close_time)
      .map(h => {
        const openTime = typeof h.open_time === 'string' ? h.open_time : String(h.open_time || '');
        const closeTime = typeof h.close_time === 'string' ? h.close_time : String(h.close_time || '');
        const interval = {
          start: openTime.substring(0, 5),
          end: closeTime.substring(0, 5),
        };
        console.log(`[getValidIntervalsForDay]   Intervalle salon: ${interval.start}-${interval.end}`);
        return interval;
      });
    console.log(`[getValidIntervalsForDay] ✅ Intervalles finaux (salon uniquement):`, intervals);
    return intervals;
  }

  // Calculer l'intersection pour chaque paire salon × styliste
  const validIntervals: TimeSlot[] = [];

    salonDayHours.forEach(salonSlot => {
      if (!salonSlot.open_time || !salonSlot.close_time) return;

        const openTime = typeof salonSlot.open_time === 'string' ? salonSlot.open_time : String(salonSlot.open_time || '');
        const closeTime = typeof salonSlot.close_time === 'string' ? salonSlot.close_time : String(salonSlot.close_time || '');

      const salonTimeSlot: TimeSlot = {
        start: openTime.substring(0, 5),
        end: closeTime.substring(0, 5),
      };

      stylistDaySchedules.forEach(stylistSlot => {
        if (!stylistSlot.start_time || !stylistSlot.end_time) return;

        const startTime = typeof stylistSlot.start_time === 'string' ? stylistSlot.start_time : String(stylistSlot.start_time || '');
        const endTime = typeof stylistSlot.end_time === 'string' ? stylistSlot.end_time : String(stylistSlot.end_time || '');

        const stylistTimeSlot: TimeSlot = {
          start: startTime.substring(0, 5),
          end: endTime.substring(0, 5),
        };

      console.log(`[getValidIntervalsForDay]   Calcul intersection: salon ${salonTimeSlot.start}-${salonTimeSlot.end} × styliste ${stylistTimeSlot.start}-${stylistTimeSlot.end}`);
      const intersection = intersectTimeSlots(salonTimeSlot, stylistTimeSlot);
      if (intersection) {
        console.log(`[getValidIntervalsForDay]   ✅ Intersection trouvée: ${intersection.start}-${intersection.end}`);
        validIntervals.push(intersection);
      } else {
        console.log(`[getValidIntervalsForDay]   ❌ Pas d'intersection`);
      }
    });
  });

  // Fusionner les intervalles qui se chevauchent ou se touchent
  if (validIntervals.length === 0) {
    return [];
  }

  // Trier par heure de début
  validIntervals.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  // Fusionner les intervalles contigus
  const merged: TimeSlot[] = [];
  let current = { ...validIntervals[0] };

  for (let i = 1; i < validIntervals.length; i++) {
    const currentEnd = timeToMinutes(current.end);
    const nextStart = timeToMinutes(validIntervals[i].start);

    if (nextStart <= currentEnd) {
      // Les intervalles se chevauchent ou se touchent, fusionner
      const nextEnd = timeToMinutes(validIntervals[i].end);
      if (nextEnd > currentEnd) {
        current.end = validIntervals[i].end;
      }
    } else {
      // Nouvel intervalle séparé
      merged.push(current);
      current = { ...validIntervals[i] };
    }
  }

  merged.push(current);
  console.log(`[getValidIntervalsForDay] ✅ Intervalles finaux (après fusion):`, merged);
  return merged;
}

/**
 * Valide qu'un créneau de rendez-vous est entièrement inclus dans au moins un intervalle valide
 * 
 * IMPORTANT : Cette fonction utilise les méthodes locales (getHours, getMinutes) pour extraire
 * les heures de la date, car les horaires du salon et du styliste sont stockés en heure locale.
 * 
 * @param appointmentStartTime - Date/heure de début du rendez-vous (peut être en UTC ou local)
 * @param durationMinutes - Durée du rendez-vous en minutes
 * @param validIntervals - Liste des intervalles valides pour ce jour (en heure locale)
 * @returns true si le créneau est valide, false sinon
 */
export function isSlotValid(
  appointmentStartTime: Date,
  durationMinutes: number,
  validIntervals: TimeSlot[]
): boolean {
  // Utiliser les méthodes locales pour obtenir les heures/minutes dans le fuseau horaire local
  // Cela garantit que la comparaison se fait avec les horaires du salon/styliste qui sont en heure locale
  const appointmentHour = appointmentStartTime.getHours(); // Heure locale
  const appointmentMinute = appointmentStartTime.getMinutes(); // Minute locale
  const appointmentStartMinutes = appointmentHour * 60 + appointmentMinute;
  
  // IMPORTANT: Calculer l'heure de fin en ajoutant la durée directement aux minutes
  // Ne pas utiliser appointmentEndTime.getHours() car cela pourrait donner des valeurs incorrectes
  // si la date dépasse minuit (ex: 23:30 + 30 min = 00:00 le lendemain)
  const appointmentEndMinutes = appointmentStartMinutes + durationMinutes;
  
  // Pour l'affichage, calculer l'heure de fin en gérant le cas où on dépasse minuit
  const appointmentEndHour = appointmentEndMinutes >= 1440 
    ? Math.floor((appointmentEndMinutes % 1440) / 60) 
    : Math.floor(appointmentEndMinutes / 60);
  const appointmentEndMin = appointmentEndMinutes % 60;
  
  // Pour la validation, utiliser appointmentEndMinutes directement (en minutes depuis minuit)
  // Si on dépasse minuit, on considère que c'est invalide (le RDV ne peut pas se terminer le lendemain)
  const appointmentEndMinutesForValidation = appointmentEndMinutes >= 1440 ? 1440 : appointmentEndMinutes;
  
  console.log(`[isSlotValid] Créneau à valider: ${String(appointmentHour).padStart(2, '0')}:${String(appointmentMinute).padStart(2, '0')} (${appointmentStartMinutes} min) - ${String(appointmentEndHour).padStart(2, '0')}:${String(appointmentEndMin).padStart(2, '0')} (${appointmentEndMinutesForValidation} min)`);
  console.log(`[isSlotValid] Durée du rendez-vous: ${durationMinutes} minutes`);
  console.log(`[isSlotValid] Intervalles valides:`, validIntervals.map(i => `${i.start}-${i.end}`));

  if (validIntervals.length === 0) {
    console.log(`[isSlotValid] ❌ Aucun intervalle valide disponible`);
    return false;
  }

  // Vérifier que le rendez-vous est entièrement inclus dans au moins un intervalle valide
  const isValid = validIntervals.some(interval => {
    const intervalStart = timeToMinutes(interval.start);
    const intervalEnd = timeToMinutes(interval.end);

    console.log(`[isSlotValid]   Vérification intervalle ${interval.start}-${interval.end} (${intervalStart}-${intervalEnd} min)`);
    console.log(`[isSlotValid]     Début RDV (${appointmentStartMinutes}) >= Début intervalle (${intervalStart}) ? ${appointmentStartMinutes >= intervalStart}`);
    console.log(`[isSlotValid]     Fin RDV (${appointmentEndMinutesForValidation}) <= Fin intervalle (${intervalEnd}) ? ${appointmentEndMinutesForValidation <= intervalEnd}`);

    // Le rendez-vous doit être complètement inclus dans l'intervalle
    // Utiliser appointmentEndMinutesForValidation pour éviter les problèmes de dépassement de minuit
    const result = appointmentStartMinutes >= intervalStart && appointmentEndMinutesForValidation <= intervalEnd;
    if (result) {
      console.log(`[isSlotValid]   ✅ Créneau valide dans l'intervalle ${interval.start}-${interval.end}`);
    } else {
      console.log(`[isSlotValid]   ❌ Créneau invalide pour l'intervalle ${interval.start}-${interval.end}`);
      if (appointmentEndMinutesForValidation > intervalEnd) {
        const overflowMinutes = appointmentEndMinutesForValidation - intervalEnd;
        const overflowHours = Math.floor(overflowMinutes / 60);
        const overflowMins = overflowMinutes % 60;
        console.log(`[isSlotValid]     ⚠️ Le rendez-vous dépasse de ${overflowHours}h${overflowMins}min l'heure de fermeture`);
      }
      if (appointmentStartMinutes < intervalStart) {
        const underflowMinutes = intervalStart - appointmentStartMinutes;
        const underflowHours = Math.floor(underflowMinutes / 60);
        const underflowMins = underflowMinutes % 60;
        console.log(`[isSlotValid]     ⚠️ Le rendez-vous commence ${underflowHours}h${underflowMins}min avant l'ouverture`);
      }
    }
    return result;
  });

  if (!isValid) {
    console.log(`[isSlotValid] ❌ Créneau invalide`);
  }

  return isValid;
}

/**
 * Formate une liste d'intervalles pour l'affichage dans un message d'erreur
 */
export function formatIntervals(intervals: TimeSlot[]): string {
  return intervals.map(i => `${i.start}-${i.end}`).join(', ');
}

