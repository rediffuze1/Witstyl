/**
 * Barre d'outils du calendrier
 */

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useCalendar } from '../store';
import { formatDateFR } from '../utils/datetime';
import type { CalendarView } from '../types';

export function CalendarToolbar({ onSettingsClick }: { onSettingsClick: () => void }) {
  const { state, setView, goToToday, goToPrevious, goToNext } = useCalendar();

  return (
    <div className="flex items-center justify-between mb-6 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={goToToday}>
          <CalendarIcon className="h-4 w-4 mr-2" />
          Aujourd'hui
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={goToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-lg font-semibold ml-4">
          {formatDateFR(state.currentDate, {
            month: 'long',
            year: 'numeric',
            ...(state.view === 'day' && { day: 'numeric' }),
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={state.view} onValueChange={(v) => setView(v as CalendarView)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Semaine</SelectItem>
            <SelectItem value="day">Jour</SelectItem>
            <SelectItem value="month">Mois</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={onSettingsClick}>
          <Settings className="h-4 w-4 mr-2" />
          Réglages
        </Button>
      </div>
    </div>
  );
}








