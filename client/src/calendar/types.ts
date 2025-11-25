/**
 * Types pour le calendrier interne
 */

export type CalendarEventId = string;

export type CalendarEvent = {
  id: CalendarEventId;
  title: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  notes?: string;
  start: string; // ISO
  end: string;   // ISO
  allDay?: boolean; // false par défaut
  color?: string;   // optionnel
};

export type BusinessHours = { 
  start: string; // "08:30"
  end: string;   // "18:00"
};

export type CalendarSettings = {
  timezone: 'Europe/Zurich';
  slotMinutes: number;    // ex: 15
  businessHours: BusinessHours; // ex: 09:00-18:00
  bufferMinutes?: number; // optionnel
  weekStartsOn?: number;  // 1 = lundi
};

export type CalendarView = 'week' | 'day' | 'month';

export const DEFAULT_SETTINGS: CalendarSettings = {
  timezone: 'Europe/Zurich',
  slotMinutes: 15,
  businessHours: {
    start: '09:00',
    end: '18:00',
  },
  bufferMinutes: 0,
  weekStartsOn: 1, // Lundi
};








