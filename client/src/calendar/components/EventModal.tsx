/**
 * Modal pour créer/éditer un événement
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCalendar } from '../store';
import { formatDateTime, snapToGrid, addMinutes, clampToBusinessHours } from '../utils/datetime';
import type { CalendarEvent } from '../types';
import { useToast } from '@/hooks/use-toast';

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  initialDate?: Date;
  initialEvent?: CalendarEvent | null;
}

export function EventModal({ open, onClose, initialDate, initialEvent }: EventModalProps) {
  const { state, createEvent, updateEvent } = useCalendar();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [start, setStart] = useState<Date>(new Date());
  const [duration, setDuration] = useState(30);

  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title);
      setClientName(initialEvent.clientName || '');
      setClientPhone(initialEvent.clientPhone || '');
      setClientEmail(initialEvent.clientEmail || '');
      setNotes(initialEvent.notes || '');
      setStart(new Date(initialEvent.start));
      const end = new Date(initialEvent.end);
      setDuration(Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
    } else if (initialDate) {
      const snapped = snapToGrid(initialDate, state.settings.slotMinutes);
      const clamped = clampToBusinessHours(snapped, state.settings.businessHours);
      setStart(clamped);
      setDuration(state.settings.slotMinutes * 2); // 2 slots par défaut
    }
  }, [initialEvent, initialDate, state.settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le titre est obligatoire',
        variant: 'destructive',
      });
      return;
    }

    const snappedStart = snapToGrid(start, state.settings.slotMinutes);
    const clampedStart = clampToBusinessHours(snappedStart, state.settings.businessHours);
    const end = addMinutes(clampedStart, duration);

    try {
      if (initialEvent) {
        await updateEvent({
          ...initialEvent,
          title,
          clientName: clientName || undefined,
          clientPhone: clientPhone || undefined,
          clientEmail: clientEmail || undefined,
          notes: notes || undefined,
          start: clampedStart.toISOString(),
          end: end.toISOString(),
        });
        toast({
          title: 'Événement mis à jour',
          description: 'L\'événement a été modifié avec succès.',
        });
      } else {
        await createEvent({
          title,
          clientName: clientName || undefined,
          clientPhone: clientPhone || undefined,
          clientEmail: clientEmail || undefined,
          notes: notes || undefined,
          start: clampedStart.toISOString(),
          end: end.toISOString(),
          allDay: false,
        });
        toast({
          title: 'Événement créé',
          description: 'L\'événement a été créé avec succès.',
        });
      }
      onClose();
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setTitle('');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setNotes('');
    if (initialDate) {
      const snapped = snapToGrid(initialDate, state.settings.slotMinutes);
      const clamped = clampToBusinessHours(snapped, state.settings.businessHours);
      setStart(clamped);
    }
    setDuration(state.settings.slotMinutes * 2);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialEvent ? 'Modifier l\'événement' : 'Nouvel événement'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Ex: Coupe + Brushing"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">Début</Label>
              <Input
                id="start"
                type="datetime-local"
                value={start.toISOString().slice(0, 16)}
                onChange={(e) => setStart(new Date(e.target.value))}
                required
              />
            </div>
            <div>
              <Label htmlFor="duration">Durée (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={state.settings.slotMinutes}
                step={state.settings.slotMinutes}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientName">Nom du client</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Prénom Nom"
              />
            </div>
            <div>
              <Label htmlFor="clientPhone">Téléphone</Label>
              <Input
                id="clientPhone"
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+41 XX XXX XX XX"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="clientEmail">Email</Label>
            <Input
              id="clientEmail"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations supplémentaires..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              {initialEvent ? 'Modifier' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}








