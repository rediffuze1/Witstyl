/**
 * Utilitaires pour la manipulation des dates/heures
 * Fuseau horaire: Europe/Zurich
 * Formats: FR (Intl)
 */

import type { CalendarEvent, BusinessHours, CalendarSettings } from '../types';

/**
 * Formate une date en ISO string pour le fuseau Europe/Zurich
 */
export function toZurichISO(date: Date): string {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Zurich' })).toISOString();
}

/**
 * Convertit une ISO string en Date (en tenant compte du fuseau)
 */
export function fromZurichISO(iso: string): Date {
  return new Date(iso);
}

/**
 * Formate une date en français (Europe/Zurich)
 */
export function formatDateFR(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Zurich',
    ...options,
  }).format(date);
}

/**
 * Formate une heure en HH:mm
 */
export function formatTime(date: Date): string {
  return formatDateFR(date, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Formate une date complète en français
 */
export function formatDateTime(date: Date): string {
  return formatDateFR(date, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Arrondit une date à la grille de slots (ex: 15 min)
 */
export function snapToGrid(date: Date, slotMinutes: number): Date {
  const minutes = date.getMinutes();
  const snappedMinutes = Math.round(minutes / slotMinutes) * slotMinutes;
  const snapped = new Date(date);
  snapped.setMinutes(snappedMinutes, 0, 0);
  return snapped;
}

/**
 * Vérifie si deux événements se chevauchent
 */
export function overlaps(a: CalendarEvent, b: CalendarEvent): boolean {
  const startA = new Date(a.start).getTime();
  const endA = new Date(a.end).getTime();
  const startB = new Date(b.start).getTime();
  const endB = new Date(b.end).getTime();
  
  // Chevauchement si: (startA < endB) && (endA > startB)
  return startA < endB && endA > startB;
}

/**
 * Vérifie si un événement chevauche avec une liste d'événements
 */
export function hasOverlap(event: CalendarEvent, events: CalendarEvent[]): boolean {
  return events.some(e => e.id !== event.id && overlaps(e, event));
}

/**
 * Génère une grille de créneaux horaires pour une journée
 */
export function generateTimeGrid(
  date: Date,
  businessHours: BusinessHours,
  slotMinutes: number
): Date[] {
  const slots: Date[] = [];
  const [startHour, startMin] = businessHours.start.split(':').map(Number);
  const [endHour, endMin] = businessHours.end.split(':').map(Number);
  
  const start = new Date(date);
  start.setHours(startHour, startMin, 0, 0);
  
  const end = new Date(date);
  end.setHours(endHour, endMin, 0, 0);
  
  const current = new Date(start);
  
  while (current < end) {
    slots.push(new Date(current));
    current.setMinutes(current.getMinutes() + slotMinutes);
  }
  
  return slots;
}

/**
 * Clamp une date dans les heures d'ouverture
 */
export function clampToBusinessHours(
  date: Date,
  businessHours: BusinessHours
): Date {
  const [startHour, startMin] = businessHours.start.split(':').map(Number);
  const [endHour, endMin] = businessHours.end.split(':').map(Number);
  
  const dayStart = new Date(date);
  dayStart.setHours(startHour, startMin, 0, 0);
  
  const dayEnd = new Date(date);
  dayEnd.setHours(endHour, endMin, 0, 0);
  
  if (date < dayStart) return dayStart;
  if (date > dayEnd) return dayEnd;
  return date;
}

/**
 * Calcule la durée en minutes entre deux dates
 */
export function durationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Ajoute des minutes à une date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Obtient le début de la semaine (lundi par défaut)
 */
export function getWeekStart(date: Date, weekStartsOn: number = 1): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dimanche, 1 = lundi, etc.
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Obtient la fin de la semaine
 */
export function getWeekEnd(date: Date, weekStartsOn: number = 1): Date {
  const weekStart = getWeekStart(date, weekStartsOn);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Obtient le début du jour
 */
export function getDayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Obtient la fin du jour
 */
export function getDayEnd(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Vérifie si deux dates sont le même jour
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Parse une heure "HH:mm" en Date (pour aujourd'hui)
 */
export function parseTime(time: string, baseDate: Date = new Date()): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}








