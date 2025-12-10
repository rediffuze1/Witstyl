/**
 * Implémentation localStorage du repository calendrier
 */

import type { CalendarEvent, CalendarEventId, CalendarSettings, DEFAULT_SETTINGS } from './types';
import type { CalendarRepo } from './repo';
import { DEFAULT_SETTINGS as defaultSettings } from './types';

const STORAGE_KEY_EVENTS = 'witstyl.calendar.v1.events';
const STORAGE_KEY_SETTINGS = 'witstyl.calendar.v1.settings';

function generateId(): string {
  return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export class LocalCalendarRepo implements CalendarRepo {
  async list(): Promise<CalendarEvent[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_EVENTS);
      if (!stored) return [];
      
      const events = JSON.parse(stored) as CalendarEvent[];
      // Valider et nettoyer les données
      return events.filter(e => e.id && e.start && e.end);
    } catch (error) {
      console.error('[LocalCalendarRepo] Erreur lors du chargement des événements:', error);
      return [];
    }
  }

  async get(id: CalendarEventId): Promise<CalendarEvent | undefined> {
    const events = await this.list();
    return events.find(e => e.id === id);
  }

  async create(e: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const newEvent: CalendarEvent = {
      ...e,
      id: generateId(),
      allDay: e.allDay ?? false,
    };
    
    const events = await this.list();
    events.push(newEvent);
    
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    } catch (error) {
      console.error('[LocalCalendarRepo] Erreur lors de la sauvegarde:', error);
      throw new Error('Impossible de sauvegarder l\'événement');
    }
    
    return newEvent;
  }

  async update(e: CalendarEvent): Promise<CalendarEvent> {
    const events = await this.list();
    const index = events.findIndex(ev => ev.id === e.id);
    
    if (index === -1) {
      throw new Error('Événement introuvable');
    }
    
    events[index] = e;
    
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    } catch (error) {
      console.error('[LocalCalendarRepo] Erreur lors de la mise à jour:', error);
      throw new Error('Impossible de mettre à jour l\'événement');
    }
    
    return e;
  }

  async remove(id: CalendarEventId): Promise<void> {
    const events = await this.list();
    const filtered = events.filter(e => e.id !== id);
    
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(filtered));
    } catch (error) {
      console.error('[LocalCalendarRepo] Erreur lors de la suppression:', error);
      throw new Error('Impossible de supprimer l\'événement');
    }
  }

  async loadSettings(): Promise<CalendarSettings> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (!stored) return defaultSettings;
      
      const settings = JSON.parse(stored) as CalendarSettings;
      // Valider et fusionner avec les valeurs par défaut
      return {
        ...defaultSettings,
        ...settings,
        businessHours: {
          ...defaultSettings.businessHours,
          ...(settings.businessHours || {}),
        },
      };
    } catch (error) {
      console.error('[LocalCalendarRepo] Erreur lors du chargement des paramètres:', error);
      return defaultSettings;
    }
  }

  async saveSettings(s: CalendarSettings): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(s));
    } catch (error) {
      console.error('[LocalCalendarRepo] Erreur lors de la sauvegarde des paramètres:', error);
      throw new Error('Impossible de sauvegarder les paramètres');
    }
  }
}

// Instance singleton
export const localCalendarRepo = new LocalCalendarRepo();








