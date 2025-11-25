/**
 * Store pour le calendrier (React Context + useReducer)
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { CalendarEvent, CalendarSettings, CalendarView } from './types';
import { localCalendarRepo } from './repo.local';
import { hasOverlap } from './utils/datetime';
import { logger } from '@/lib/logger';

type CalendarState = {
  events: CalendarEvent[];
  settings: CalendarSettings;
  currentDate: Date;
  view: CalendarView;
  selectedEvent: CalendarEvent | null;
  isLoading: boolean;
  error: string | null;
};

type CalendarAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_EVENTS'; payload: CalendarEvent[] }
  | { type: 'SET_SETTINGS'; payload: CalendarSettings }
  | { type: 'SET_CURRENT_DATE'; payload: Date }
  | { type: 'SET_VIEW'; payload: CalendarView }
  | { type: 'SET_SELECTED_EVENT'; payload: CalendarEvent | null }
  | { type: 'ADD_EVENT'; payload: CalendarEvent }
  | { type: 'UPDATE_EVENT'; payload: CalendarEvent }
  | { type: 'REMOVE_EVENT'; payload: string };

const initialState: CalendarState = {
  events: [],
  settings: {
    timezone: 'Europe/Zurich',
    slotMinutes: 15,
    businessHours: { start: '09:00', end: '18:00' },
    bufferMinutes: 0,
    weekStartsOn: 1,
  },
  currentDate: new Date(),
  view: 'week',
  selectedEvent: null,
  isLoading: false,
  error: null,
};

function calendarReducer(state: CalendarState, action: CalendarAction): CalendarState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_EVENTS':
      return { ...state, events: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'SET_CURRENT_DATE':
      return { ...state, currentDate: action.payload };
    case 'SET_VIEW':
      return { ...state, view: action.payload };
    case 'SET_SELECTED_EVENT':
      return { ...state, selectedEvent: action.payload };
    case 'ADD_EVENT':
      return { ...state, events: [...state.events, action.payload] };
    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map(e => (e.id === action.payload.id ? action.payload : e)),
      };
    case 'REMOVE_EVENT':
      return {
        ...state,
        events: state.events.filter(e => e.id !== action.payload),
      };
    default:
      return state;
  }
}

type CalendarContextType = {
  state: CalendarState;
  loadEvents: () => Promise<void>;
  loadSettings: () => Promise<void>;
  createEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>;
  updateEvent: (event: CalendarEvent) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarView) => void;
  setSelectedEvent: (event: CalendarEvent | null) => void;
  saveSettings: (settings: CalendarSettings) => Promise<void>;
  goToToday: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
};

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(calendarReducer, initialState);

  const loadEvents = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const events = await localCalendarRepo.list();
      dispatch({ type: 'SET_EVENTS', payload: events });
      logger.log('[Calendar] Événements chargés:', events.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors du chargement';
      dispatch({ type: 'SET_ERROR', payload: message });
      logger.error('[Calendar] Erreur:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await localCalendarRepo.loadSettings();
      dispatch({ type: 'SET_SETTINGS', payload: settings });
      logger.log('[Calendar] Paramètres chargés');
    } catch (error) {
      logger.error('[Calendar] Erreur chargement paramètres:', error);
    }
  }, []);

  const createEvent = useCallback(async (event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
    // Vérifier les chevauchements
    const tempEvent: CalendarEvent = { ...event, id: 'temp' };
    if (hasOverlap(tempEvent, state.events)) {
      throw new Error('Cet événement chevauche avec un autre événement existant');
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const newEvent = await localCalendarRepo.create(event);
      dispatch({ type: 'ADD_EVENT', payload: newEvent });
      logger.log('[Calendar] Événement créé:', newEvent.id);
      return newEvent;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la création';
      dispatch({ type: 'SET_ERROR', payload: message });
      logger.error('[Calendar] Erreur:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.events]);

  const updateEvent = useCallback(async (event: CalendarEvent): Promise<void> => {
    // Vérifier les chevauchements (sauf avec l'événement lui-même)
    if (hasOverlap(event, state.events)) {
      throw new Error('Cet événement chevauche avec un autre événement existant');
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      await localCalendarRepo.update(event);
      dispatch({ type: 'UPDATE_EVENT', payload: event });
      logger.log('[Calendar] Événement mis à jour:', event.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la mise à jour';
      dispatch({ type: 'SET_ERROR', payload: message });
      logger.error('[Calendar] Erreur:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.events]);

  const removeEvent = useCallback(async (id: string): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      await localCalendarRepo.remove(id);
      dispatch({ type: 'REMOVE_EVENT', payload: id });
      logger.log('[Calendar] Événement supprimé:', id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la suppression';
      dispatch({ type: 'SET_ERROR', payload: message });
      logger.error('[Calendar] Erreur:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const setCurrentDate = useCallback((date: Date) => {
    dispatch({ type: 'SET_CURRENT_DATE', payload: date });
  }, []);

  const setView = useCallback((view: CalendarView) => {
    dispatch({ type: 'SET_VIEW', payload: view });
  }, []);

  const setSelectedEvent = useCallback((event: CalendarEvent | null) => {
    dispatch({ type: 'SET_SELECTED_EVENT', payload: event });
  }, []);

  const saveSettings = useCallback(async (settings: CalendarSettings): Promise<void> => {
    try {
      await localCalendarRepo.saveSettings(settings);
      dispatch({ type: 'SET_SETTINGS', payload: settings });
      logger.log('[Calendar] Paramètres sauvegardés');
    } catch (error) {
      logger.error('[Calendar] Erreur sauvegarde paramètres:', error);
      throw error;
    }
  }, []);

  const goToToday = useCallback(() => {
    dispatch({ type: 'SET_CURRENT_DATE', payload: new Date() });
  }, []);

  const goToPrevious = useCallback(() => {
    const newDate = new Date(state.currentDate);
    if (state.view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (state.view === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    dispatch({ type: 'SET_CURRENT_DATE', payload: newDate });
  }, [state.currentDate, state.view]);

  const goToNext = useCallback(() => {
    const newDate = new Date(state.currentDate);
    if (state.view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (state.view === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    dispatch({ type: 'SET_CURRENT_DATE', payload: newDate });
  }, [state.currentDate, state.view]);

  // Charger les données au montage
  useEffect(() => {
    loadEvents();
    loadSettings();
  }, [loadEvents, loadSettings]);

  const value: CalendarContextType = {
    state,
    loadEvents,
    loadSettings,
    createEvent,
    updateEvent,
    removeEvent,
    setCurrentDate,
    setView,
    setSelectedEvent,
    saveSettings,
    goToToday,
    goToPrevious,
    goToNext,
  };

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar doit être utilisé dans un CalendarProvider');
  }
  return context;
}








