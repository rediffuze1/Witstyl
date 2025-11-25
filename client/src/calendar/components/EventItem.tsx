/**
 * Composant pour afficher un événement dans le calendrier
 */

import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { formatTime } from '../utils/datetime';
import type { CalendarEvent } from '../types';

interface EventItemProps {
  event: CalendarEvent;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export function EventItem({ event, onEdit, onDelete, className = '' }: EventItemProps) {
  const start = new Date(event.start);
  const end = new Date(event.end);

  return (
    <div
      className={`group relative p-2 rounded-md text-sm cursor-pointer transition-all hover:shadow-md ${className}`}
      style={{
        backgroundColor: event.color || 'hsl(var(--primary))',
        color: 'white',
      }}
      onClick={() => onEdit(event)}
    >
      <div className="font-semibold">{event.title}</div>
      {event.clientName && (
        <div className="text-xs opacity-90">{event.clientName}</div>
      )}
      <div className="text-xs opacity-75">
        {formatTime(start)} - {formatTime(end)}
      </div>
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-white/20 hover:bg-white/30"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(event);
          }}
        >
          <Edit className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-white/20 hover:bg-white/30"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(event.id);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}








