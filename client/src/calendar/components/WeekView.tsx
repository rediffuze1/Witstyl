/**
 * Vue Semaine du calendrier
 */

import { useMemo } from 'react';
import { useCalendar } from '../store';
import { EventItem } from './EventItem';
import {
  generateTimeGrid,
  getWeekStart,
  getWeekEnd,
  isSameDay,
  formatDateFR,
  formatTime,
} from '../utils/datetime';
import type { CalendarEvent } from '../types';

interface WeekViewProps {
  onCreateEvent?: (date: Date) => void;
}

export function WeekView({ onCreateEvent }: WeekViewProps = {}) {
  const { state, setSelectedEvent, removeEvent } = useCalendar();

  const weekStart = useMemo(() => getWeekStart(state.currentDate, state.settings.weekStartsOn), [
    state.currentDate,
    state.settings.weekStartsOn,
  ]);
  const weekEnd = useMemo(() => getWeekEnd(state.currentDate, state.settings.weekStartsOn), [
    state.currentDate,
    state.settings.weekStartsOn,
  ]);

  const days = useMemo(() => {
    const daysArray = [];
    const current = new Date(weekStart);
    while (current <= weekEnd) {
      daysArray.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return daysArray;
  }, [weekStart, weekEnd]);

  const timeSlots = useMemo(
    () => generateTimeGrid(weekStart, state.settings.businessHours, state.settings.slotMinutes),
    [weekStart, state.settings.businessHours, state.settings.slotMinutes]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    days.forEach((day, index) => {
      const dayEvents = state.events.filter((event) => {
        const eventStart = new Date(event.start);
        return isSameDay(eventStart, day);
      });
      map.set(index, dayEvents);
    });
    return map;
  }, [days, state.events]);

  const getEventPosition = (event: CalendarEvent, dayIndex: number) => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const day = days[dayIndex];
    
    if (!isSameDay(eventStart, day)) return null;

    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    
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
        {/* En-tête avec les jours */}
        <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-background z-10">
          <div className="border-r border-border p-2 text-sm font-medium">
            Heure
          </div>
          {days.map((day, index) => (
            <div
              key={index}
              className="border-r border-border p-2 text-center last:border-r-0"
            >
              <div className="text-sm font-semibold">
                {formatDateFR(day, { weekday: 'short' })}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDateFR(day, { day: 'numeric', month: 'short' })}
              </div>
            </div>
          ))}
        </div>

        {/* Grille de temps */}
        <div className="relative">
          <div className="grid grid-cols-8">
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

            {/* Colonnes des jours */}
            {days.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className="border-r border-border last:border-r-0 relative"
              >
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
                {eventsByDay.get(dayIndex)?.map((event) => {
                  const position = getEventPosition(event, dayIndex);
                  if (!position) return null;
                  
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

