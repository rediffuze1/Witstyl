/**
 * Page principale du calendrier
 */

import React, { useState } from 'react';
import { CalendarProvider, useCalendar } from '../store';
import { CalendarToolbar } from './CalendarToolbar';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { EventModal } from './EventModal';
import { SettingsModal } from './SettingsModal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

function CalendarContent() {
  const { state, setSelectedEvent } = useCalendar();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [initialDate, setInitialDate] = useState<Date | undefined>();

  const handleCreateEvent = (date?: Date) => {
    setInitialDate(date || state.currentDate);
    setSelectedEvent(null);
    setIsEventModalOpen(true);
  };

  const handleEditEvent = () => {
    if (state.selectedEvent) {
      setIsEventModalOpen(true);
    }
  };

  // Ouvrir le modal d'édition quand un événement est sélectionné
  React.useEffect(() => {
    if (state.selectedEvent && !isEventModalOpen) {
      setIsEventModalOpen(true);
    }
  }, [state.selectedEvent, isEventModalOpen]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Calendrier</h1>
        <Button onClick={handleCreateEvent}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvel événement
        </Button>
      </div>

      <CalendarToolbar onSettingsClick={() => setIsSettingsModalOpen(true)} />

      <div className="flex-1 overflow-hidden border border-border rounded-lg bg-card">
        {state.view === 'week' && <WeekView onCreateEvent={handleCreateEvent} />}
        {state.view === 'day' && <DayView onCreateEvent={handleCreateEvent} />}
        {state.view === 'month' && (
          <div className="p-8 text-center text-muted-foreground">
            Vue Mois à venir prochainement
          </div>
        )}
      </div>

      <EventModal
        open={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setSelectedEvent(null);
        }}
        initialDate={initialDate}
        initialEvent={state.selectedEvent}
      />

      <SettingsModal
        open={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
}

export function CalendarPage() {
  return (
    <CalendarProvider>
      <CalendarContent />
    </CalendarProvider>
  );
}

