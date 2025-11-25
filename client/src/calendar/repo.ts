/**
 * Interface du repository pour le calendrier
 * Pattern repository pour faciliter la migration vers Supabase plus tard
 */

import type { CalendarEvent, CalendarEventId, CalendarSettings } from './types';

export interface CalendarRepo {
  list(): Promise<CalendarEvent[]>;
  get(id: CalendarEventId): Promise<CalendarEvent | undefined>;
  create(e: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent>;
  update(e: CalendarEvent): Promise<CalendarEvent>;
  remove(id: CalendarEventId): Promise<void>;
  loadSettings(): Promise<CalendarSettings>;
  saveSettings(s: CalendarSettings): Promise<void>;
}








