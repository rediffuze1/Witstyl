/**
 * Templates SMS standardisés pour ClickSend
 * 
 * Garantit :
 * - Suppression des accents (encodage GSM)
 * - Limite à 160 caractères (1 segment)
 * - Templates courts et efficaces
 */

/**
 * Contexte pour construire un SMS
 */
export type AppointmentSmsContext = {
  clientFirstName: string;      // ex: "Colette"
  serviceName: string;          // ex: "Service Modifie"
  salonName: string;            // ex: "HairPlay"
  appointmentWeekday: string;   // ex: "mardi"
  appointmentDate: string;       // ex: "2 decembre 2025" ou "02.12.2025"
  appointmentTime: string;      // ex: "17:30"
};

/**
 * Supprime les accents et caractères spéciaux pour rester en encodage GSM
 * 
 * @param input - Texte à normaliser
 * @returns Texte sans accents, compatible GSM
 */
export function normalizeSmsText(input: string): string {
  if (!input) return '';
  
  // Normaliser en NFD (décompose les caractères accentués)
  let normalized = input.normalize('NFD');
  
  // Supprimer les diacritiques (accents)
  normalized = normalized.replace(/[\u0300-\u036f]/g, '');
  
  // Remplacements spécifiques pour caractères français courants
  const replacements: Record<string, string> = {
    '\u0153': 'oe',      // œ
    '\u0152': 'OE',      // Œ
    '\u00E6': 'ae',      // æ
    '\u00C6': 'AE',      // Æ
    '\u00B7': ' ',       // ·
    '\u2026': '...',     // …
    '\u201C': '"',       // "
    '\u201D': '"',       // "
    '\u2018': "'",       // '
    '\u2019': "'",       // '
    '\u2013': '-',       // –
    '\u2014': '-',       // —
  };
  
  for (const [char, replacement] of Object.entries(replacements)) {
    normalized = normalized.replace(new RegExp(char, 'g'), replacement);
  }
  
  // Supprimer les caractères non-ASCII restants (sauf espaces et caractères de base)
  normalized = normalized.replace(/[^\x20-\x7E\n\r]/g, '');
  
  // Nettoyer les espaces multiples
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Trim
  return normalized.trim();
}

/**
 * Garantit que le texte tient dans 1 seul segment SMS (<= 160 caractères)
 * 
 * @param text - Texte à vérifier/tronquer
 * @param maxLength - Longueur maximale (défaut: 160)
 * @returns Texte normalisé et tronqué si nécessaire
 */
export function ensureSingleSegment(text: string, maxLength = 160): string {
  const normalized = normalizeSmsText(text);
  
  if (normalized.length <= maxLength) {
    return normalized;
  }
  
  // Si trop long, tronquer en ajoutant "..." si on a de la place
  const truncateLength = maxLength - 3;
  const truncated = normalized.slice(0, truncateLength).trimEnd();
  
  // Ne pas ajouter "..." si le texte se termine déjà par un point
  if (truncated.endsWith('.')) {
    return truncated;
  }
  
  return truncated + '...';
}

/**
 * Construit un SMS de confirmation avec style détaillé (GSM-safe)
 * 
 * Template : "Bonjour {prénom}, votre service {service} chez {salon} est confirme le {jour} {date} a {heure}. Nous avons hate de vous accueillir !"
 */
export function buildConfirmationSms(ctx: AppointmentSmsContext): string {
  const raw =
    `Bonjour ${ctx.clientFirstName}, votre service ${ctx.serviceName} ` +
    `chez ${ctx.salonName} est confirme le ${ctx.appointmentWeekday} ` +
    `${ctx.appointmentDate} a ${ctx.appointmentTime}. ` +
    `Nous avons hate de vous accueillir !`;
  
  return ensureSingleSegment(raw);
}

/**
 * Construit un SMS de rappel avec style détaillé (GSM-safe)
 * 
 * Template : "Rappel de RDV: Bonjour {prénom}, votre service {service} chez {salon} est prevu le {jour} {date} a {heure}. Si vous ne pouvez pas venir, merci de nous appeler."
 */
export function buildReminderSms(ctx: AppointmentSmsContext): string {
  const raw =
    `Rappel de RDV: Bonjour ${ctx.clientFirstName}, votre service ${ctx.serviceName} ` +
    `chez ${ctx.salonName} est prevu le ${ctx.appointmentWeekday} ` +
    `${ctx.appointmentDate} a ${ctx.appointmentTime}. ` +
    `Si vous ne pouvez pas venir, merci de nous appeler.`;
  
  return ensureSingleSegment(raw);
}

/**
 * Formate une date pour SMS (format: "2 decembre 2025")
 * 
 * @param date - Date à formater
 * @returns Date formatée "J mois YYYY" (sans accents)
 */
export function formatDateForSms(date: Date): string {
  const day = date.getDate();
  const monthNames = [
    'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Formate le jour de la semaine pour SMS (format: "mardi")
 * 
 * @param date - Date à formater
 * @returns Jour de la semaine (sans accents)
 */
export function formatWeekdayForSms(date: Date): string {
  const weekdays = [
    'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'
  ];
  return weekdays[date.getDay()];
}

/**
 * Formate une heure pour SMS (format: "17:30")
 * 
 * @param date - Date avec heure
 * @returns Heure formatée "HH:mm"
 */
export function formatTimeForSms(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

