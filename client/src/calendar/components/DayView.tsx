/**
 * Vue Jour du calendrier
 */

import { useMemo } from 'react';
import { useCalendar } from '../store';
import { EventItem } from './EventItem';
import {
  generateTimeGrid,
  getDayStart,
  isSameDay,
  formatDateFR,
  formatTime,
} from '../utils/datetime';
import type { CalendarEvent } from '../types';

interface DayViewProps {
  onCreateEvent?: (date: Date) => void;
}

export function DayView({ onCreateEvent }: DayViewProps = {}) {
  const { state, setSelectedEvent, removeEvent } = useCalendar();

  const dayStart = useMemo(() => getDayStart(state.currentDate), [state.currentDate]);

  const timeSlots = useMemo(
    () => generateTimeGrid(dayStart, state.settings.businessHours, state.settings.slotMinutes),
    [dayStart, state.settings.businessHours, state.settings.slotMinutes]
  );

  const dayEvents = useMemo(() => {
    return state.events.filter((event) => {
      const eventStart = new Date(event.start);
      return isSameDay(eventStart, state.currentDate);
    });
  }, [state.events, state.currentDate]);

  const getEventPosition = (event: CalendarEvent) => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    
    const startMinutes = (eventStart.getTime() - dayStart.getTime()) / (1000 * 60);
    const durationMinutes = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60);
    
    const slotHeight = 60; // Hauteur d'un slot en pixels (1 heure = 60px)
    const top = (startMinutes / 60) * slotHeight;
    const height = (durationMinutes / 60) * slotHeight;

    return { top, height };
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-full inline-block">
        {/* En-tête */}
        <div className="border-b border-border sticky top-0 bg-background z-10 p-4">
          <div className="text-lg font-semibold">
            {formatDateFR(state.currentDate, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
        </div>

        {/* Grille de temps */}
        <div className="relative">
          <div className="grid grid-cols-2">
            {/* Colonne des heures */}
            <div className="border-r border-border">
              {timeSlots.map((slot, index) => (
                <div
                  key={index}
                  className="border-b border-border h-[60px] p-2 text-xs text-muted-foreground"
                >
                  {formatTime(slot)}
                </div>
              ))}
            </div>

            {/* Colonne principale */}
            <div className="relative">
              {/* Grille de slots */}
              {timeSlots.map((slot, slotIndex) => (
                <div
                  key={slotIndex}
                  className="border-b border-border h-[60px] hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => {
                    if (onCreateEvent) {
                      onCreateEvent(slot);
                    }
                  }}
                />
              ))}

              {/* Événements positionnés */}
              {dayEvents.map((event) => {
                const position = getEventPosition(event);
                
                return (
                  <div
                    key={event.id}
                    className="absolute left-0 right-0 px-1"
                    style={{
                      top: `${position.top}px`,
                      height: `${Math.max(position.height, 20)}px`,
                    }}
                  >
                    <EventItem
                      event={event}
                      onEdit={(e) => setSelectedEvent(e)}
                      onDelete={async () => {
                        if (confirm('Supprimer cet événement ?')) {
                          await removeEvent(event.id);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

