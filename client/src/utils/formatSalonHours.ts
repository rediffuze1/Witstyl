/**
 * Utilitaires pour formater les horaires du salon pour l'affichage
 * 
 * Gère l'affichage de TOUS les créneaux configurés pour chaque jour
 */

export interface SalonHour {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

/**
 * Formate une heure au format français (HH:mm -> Hhmm)
 */
export function formatTime(time: string): string {
  if (!time) return '';
  // Gérer les formats HH:mm:ss et HH:mm
  const parts = time.split(':');
  const hours = parts[0] || '00';
  const minutes = parts[1] || '00';
  // Supprimer les zéros inutiles pour les minutes
  const formattedMinutes = minutes === '00' ? '' : minutes;
  return formattedMinutes ? `${hours}h${formattedMinutes}` : `${hours}h00`;
}

/**
 * Formate une tranche horaire (début - fin)
 */
export function formatTimeSlot(openTime: string, closeTime: string): string {
  return `${formatTime(openTime)} – ${formatTime(closeTime)}`;
}

/**
 * Formate toutes les tranches horaires d'un jour
 * 
 * @param dayHours - Tous les horaires pour un jour donné (peut y en avoir plusieurs)
 * @returns String formatée avec toutes les tranches, ou "Fermé" si aucune tranche disponible
 */
export function formatSalonDaySlots(dayHours: SalonHour[]): string {
  if (!dayHours || dayHours.length === 0) {
    return 'Fermé';
  }

  // Filtrer les horaires fermés
  const openSlots = dayHours.filter(h => !h.is_closed && h.open_time && h.close_time);
  
  if (openSlots.length === 0) {
    return 'Fermé';
  }

  // Trier les tranches par heure de début croissante
  openSlots.sort((a, b) => {
    const [aHour, aMin] = a.open_time.split(':').map(Number);
    const [bHour, bMin] = b.open_time.split(':').map(Number);
    return (aHour * 60 + aMin) - (bHour * 60 + bMin);
  });

  // Formater chaque tranche
  const formattedSlots = openSlots.map(slot => formatTimeSlot(slot.open_time, slot.close_time));

  // Joindre toutes les tranches avec ", "
  return formattedSlots.join(', ');
}

/**
 * Groupe les horaires par jour de la semaine
 * 
 * @param hours - Tous les horaires du salon
 * @returns Map avec day_of_week comme clé et array d'horaires comme valeur
 */
export function groupHoursByDay(hours: SalonHour[]): Map<number, SalonHour[]> {
  const grouped = new Map<number, SalonHour[]>();

  if (!hours || !Array.isArray(hours)) {
    return grouped;
  }

  hours.forEach(hour => {
    const day = hour.day_of_week;
    if (!grouped.has(day)) {
      grouped.set(day, []);
    }
    grouped.get(day)!.push(hour);
  });

  return grouped;
}



