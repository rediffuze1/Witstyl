/**
 * Utilitaires pour calculer les créneaux disponibles selon les disponibilités des stylistes
 * 
 * Source de vérité unique : les disponibilités définies dans /hours (table stylist_schedule)
 */

export interface TimeSlot {
  openTime: string; // Format "HH:mm"
  closeTime: string; // Format "HH:mm"
}

export interface StylistAvailability {
  day_of_week: number; // 0-6 (dimanche-samedi)
  open_time?: string;
  close_time?: string;
  is_closed: boolean;
  slots?: TimeSlot[];
}

export interface StylistHours {
  [stylistId: string]: StylistAvailability[];
}

/**
 * Récupère les disponibilités d'un styliste pour un jour donné
 */
export function getStylistAvailabilityForDay(
  stylistHours: StylistHours | null | undefined,
  stylistId: string | null | undefined,
  dayOfWeek: number
): StylistAvailability | null {
  if (!stylistHours || !stylistId || stylistId === "none") {
    return null;
  }

  const stylistAvailabilities = stylistHours[stylistId];
  if (!stylistAvailabilities || !Array.isArray(stylistAvailabilities)) {
    return null;
  }

  return stylistAvailabilities.find(av => av.day_of_week === dayOfWeek) || null;
}

/**
 * Vérifie si un styliste est disponible un jour donné
 */
export function isStylistAvailableOnDay(
  stylistHours: StylistHours | null | undefined,
  stylistId: string | null | undefined,
  dayOfWeek: number
): boolean {
  const availability = getStylistAvailabilityForDay(stylistHours, stylistId, dayOfWeek);
  
  // Si pas de disponibilité spécifique, considérer comme disponible (fallback sur horaires salon)
  if (!availability) {
    return true;
  }

  return !availability.is_closed && (availability.slots?.length || 0) > 0;
}

/**
 * Récupère les créneaux horaires disponibles pour un styliste un jour donné
 * Retourne les slots du styliste si disponibles, sinon null (fallback sur horaires salon)
 */
export function getStylistSlotsForDay(
  stylistHours: StylistHours | null | undefined,
  stylistId: string | null | undefined,
  dayOfWeek: number
): TimeSlot[] | null {
  const availability = getStylistAvailabilityForDay(stylistHours, stylistId, dayOfWeek);
  
  if (!availability) {
    return null; // Pas de disponibilité spécifique, utiliser horaires salon
  }

  if (availability.is_closed) {
    return []; // Styliste indisponible ce jour
  }

  return availability.slots || [];
}

/**
 * Vérifie si un créneau horaire est dans les disponibilités d'un styliste
 */
export function isTimeSlotInStylistAvailability(
  timeStr: string, // Format "HH:mm"
  stylistSlots: TimeSlot[] | null,
  serviceDuration: number // en minutes
): boolean {
  // Si pas de slots spécifiques, considérer comme disponible (fallback)
  if (!stylistSlots || stylistSlots.length === 0) {
    return true;
  }

  const [slotHour, slotMin] = timeStr.split(':').map(Number);
  const slotStartMinutes = slotHour * 60 + slotMin;
  const slotEndMinutes = slotStartMinutes + serviceDuration;

  // Vérifier si le créneau chevauche avec au moins un slot disponible
  return stylistSlots.some(slot => {
    const [slotOpenHour, slotOpenMin] = slot.openTime.split(':').map(Number);
    const [slotCloseHour, slotCloseMin] = slot.closeTime.split(':').map(Number);
    
    const slotOpenMinutes = slotOpenHour * 60 + slotOpenMin;
    const slotCloseMinutes = slotCloseHour * 60 + slotCloseMin;

    // Le créneau doit être complètement inclus dans le slot disponible
    return slotStartMinutes >= slotOpenMinutes && slotEndMinutes <= slotCloseMinutes;
  });
}

/**
 * Fusionne les créneaux disponibles de tous les stylistes (pour "Sans préférences")
 * 
 * IMPORTANT : Pour "Sans préférences", on prend l'UNION des disponibilités de tous les stylistes,
 * pas l'intersection. Cela signifie qu'un créneau est disponible si AU MOINS UN styliste est disponible.
 * 
 * Pour chaque styliste :
 * - Si le styliste a des disponibilités spécifiques : on calcule l'intersection salon ∩ styliste
 * - Si le styliste n'a pas de disponibilité spécifique : on considère qu'il est disponible selon les horaires du salon
 * 
 * Ensuite, on fait l'union de toutes ces disponibilités.
 */
export function mergeAllStylistsSlots(
  stylistHours: StylistHours | null | undefined,
  stylistIds: string[],
  dayOfWeek: number,
  salonSlots: TimeSlot[] // Horaires du salon pour le fallback
): TimeSlot[] {
  if (stylistIds.length === 0) {
    return salonSlots; // Si aucun styliste, utiliser horaires salon
  }

  const allValidSlots: TimeSlot[] = [];

  stylistIds.forEach(stylistId => {
    const stylistSlots = getStylistSlotsForDay(stylistHours, stylistId, dayOfWeek);
    
    if (stylistSlots === null) {
      // Pas de disponibilité spécifique : le styliste est disponible selon les horaires du salon
      allValidSlots.push(...salonSlots);
    } else if (stylistSlots.length > 0) {
      // Disponibilité spécifique : calculer l'intersection salon ∩ styliste
      const intersection = intersectSlots(salonSlots, stylistSlots);
      allValidSlots.push(...intersection);
    }
    // Si stylistSlots.length === 0, le styliste est indisponible, on ne l'inclut pas
  });

  // Si aucun styliste n'a de disponibilité, retourner vide
  if (allValidSlots.length === 0) {
    return [];
  }

  // Trier par heure de début
  allValidSlots.sort((a, b) => {
    const [aHour, aMin] = a.openTime.split(':').map(Number);
    const [bHour, bMin] = b.openTime.split(':').map(Number);
    return (aHour * 60 + aMin) - (bHour * 60 + bMin);
  });

  // Fusionner les slots qui se chevauchent ou se touchent (UNION)
  const merged: TimeSlot[] = [];
  let current = { ...allValidSlots[0] };

  for (let i = 1; i < allValidSlots.length; i++) {
    const [currentEndHour, currentEndMin] = current.closeTime.split(':').map(Number);
    const [nextStartHour, nextStartMin] = allValidSlots[i].openTime.split(':').map(Number);
    
    const currentEndMinutes = currentEndHour * 60 + currentEndMin;
    const nextStartMinutes = nextStartHour * 60 + nextStartMin;

    if (nextStartMinutes <= currentEndMinutes) {
      // Les slots se chevauchent ou se touchent, fusionner (prendre le max de la fin)
      const [nextEndHour, nextEndMin] = allValidSlots[i].closeTime.split(':').map(Number);
      const nextEndMinutes = nextEndHour * 60 + nextEndMin;
      
      if (nextEndMinutes > currentEndMinutes) {
        current.closeTime = allValidSlots[i].closeTime;
      }
    } else {
      // Nouveau slot séparé
      merged.push(current);
      current = { ...allValidSlots[i] };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Calcule l'intersection entre les créneaux du salon et les créneaux du styliste
 * Retourne les créneaux valides où le salon ET le styliste sont disponibles
 */
export function intersectSlots(
  salonSlots: TimeSlot[],
  stylistSlots: TimeSlot[] | null
): TimeSlot[] {
  if (!stylistSlots || stylistSlots.length === 0) {
    // Pas de disponibilité spécifique du styliste, utiliser les horaires salon
    return salonSlots;
  }

  const intersections: TimeSlot[] = [];

  salonSlots.forEach(salonSlot => {
    const [salonStartHour, salonStartMin] = salonSlot.openTime.split(':').map(Number);
    const [salonEndHour, salonEndMin] = salonSlot.closeTime.split(':').map(Number);
    const salonStartMinutes = salonStartHour * 60 + salonStartMin;
    const salonEndMinutes = salonEndHour * 60 + salonEndMin;

    stylistSlots.forEach(stylistSlot => {
      const [stylistStartHour, stylistStartMin] = stylistSlot.openTime.split(':').map(Number);
      const [stylistEndHour, stylistEndMin] = stylistSlot.closeTime.split(':').map(Number);
      const stylistStartMinutes = stylistStartHour * 60 + stylistStartMin;
      const stylistEndMinutes = stylistEndHour * 60 + stylistEndMin;

      // Calculer l'intersection
      const intersectionStart = Math.max(salonStartMinutes, stylistStartMinutes);
      const intersectionEnd = Math.min(salonEndMinutes, stylistEndMinutes);

      // Si l'intersection existe (start < end)
      if (intersectionStart < intersectionEnd) {
        const startHour = Math.floor(intersectionStart / 60);
        const startMin = intersectionStart % 60;
        const endHour = Math.floor(intersectionEnd / 60);
        const endMin = intersectionEnd % 60;

        intersections.push({
          openTime: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
          closeTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
        });
      }
    });
  });

  // Trier et fusionner les intersections qui se chevauchent
  if (intersections.length === 0) {
    return [];
  }

  intersections.sort((a, b) => {
    const [aHour, aMin] = a.openTime.split(':').map(Number);
    const [bHour, bMin] = b.openTime.split(':').map(Number);
    return (aHour * 60 + aMin) - (bHour * 60 + bMin);
  });

  const merged: TimeSlot[] = [];
  let current = { ...intersections[0] };

  for (let i = 1; i < intersections.length; i++) {
    const [currentEndHour, currentEndMin] = current.closeTime.split(':').map(Number);
    const [nextStartHour, nextStartMin] = intersections[i].openTime.split(':').map(Number);

    const currentEndMinutes = currentEndHour * 60 + currentEndMin;
    const nextStartMinutes = nextStartHour * 60 + nextStartMin;

    if (nextStartMinutes <= currentEndMinutes) {
      // Les slots se chevauchent ou se touchent, fusionner
      const [nextEndHour, nextEndMin] = intersections[i].closeTime.split(':').map(Number);
      const nextEndMinutes = nextEndHour * 60 + nextEndMin;

      if (nextEndMinutes > currentEndMinutes) {
        current.closeTime = intersections[i].closeTime;
      }
    } else {
      // Nouveau slot séparé
      merged.push(current);
      current = { ...intersections[i] };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Génère les créneaux horaires disponibles pour un intervalle donné
 * en tenant compte de la durée du service
 * 
 * RÈGLE MÉTIER : Un créneau est valide si et seulement si :
 * - startTime >= intervalStart
 * - startTime + serviceDuration <= intervalEnd
 * 
 * Cela garantit que le service complet (de start à start+duration) est entièrement inclus
 * dans l'intervalle, sans dépasser la fermeture ni traverser une pause.
 * 
 * @param slot - Intervalle d'ouverture (openTime, closeTime)
 * @param serviceDurationMinutes - Durée du service en minutes
 * @param slotStepMinutes - Pas entre les créneaux (défaut: 30 minutes)
 * @returns Liste des heures de début possibles (format "HH:mm")
 * 
 * @example
 * // Salon ouvert 13:00-18:30, service de 4h (240 min)
 * // Dernier créneau possible : 14:30 (14:30 + 240 min = 18:30)
 * generateTimeSlotsForInterval({ openTime: "13:00", closeTime: "18:30" }, 240, 30)
 * // Retourne : ["13:00", "13:30", "14:00", "14:30"]
 */
export function generateTimeSlotsForInterval(
  slot: TimeSlot,
  serviceDurationMinutes: number,
  slotStepMinutes: number = 30
): string[] {
  const [openHour, openMin] = slot.openTime.split(':').map(Number);
  const [closeHour, closeMin] = slot.closeTime.split(':').map(Number);

  const openMinutes = openHour * 60 + openMin;
  const closeMinutes = closeHour * 60 + closeMin;

  const slots: string[] = [];

  // Vérifier d'abord si l'intervalle est suffisamment long pour le service
  const intervalDuration = closeMinutes - openMinutes;
  if (intervalDuration < serviceDurationMinutes) {
    // L'intervalle est trop court pour le service, aucun créneau possible
    return [];
  }

  // Générer les créneaux en vérifiant que startTime + serviceDuration <= closeTime
  // Condition : timeMinutes + serviceDurationMinutes <= closeMinutes
  // Cela signifie que le service doit se terminer AVANT ou EXACTEMENT à la fermeture
  for (let timeMinutes = openMinutes; timeMinutes + serviceDurationMinutes <= closeMinutes; timeMinutes += slotStepMinutes) {
    const hour = Math.floor(timeMinutes / 60);
    const min = timeMinutes % 60;
    slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }

  return slots;
}

