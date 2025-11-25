/**
 * Modal pour les réglages du calendrier
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
import { useCalendar } from '../store';
import { useToast } from '@/hooks/use-toast';
import type { CalendarSettings } from '../types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { state, saveSettings } = useCalendar();
  const { toast } = useToast();
  
  const [slotMinutes, setSlotMinutes] = useState(state.settings.slotMinutes);
  const [businessStart, setBusinessStart] = useState(state.settings.businessHours.start);
  const [businessEnd, setBusinessEnd] = useState(state.settings.businessHours.end);
  const [bufferMinutes, setBufferMinutes] = useState(state.settings.bufferMinutes || 0);
  const [weekStartsOn, setWeekStartsOn] = useState(state.settings.weekStartsOn || 1);

  useEffect(() => {
    setSlotMinutes(state.settings.slotMinutes);
    setBusinessStart(state.settings.businessHours.start);
    setBusinessEnd(state.settings.businessHours.end);
    setBufferMinutes(state.settings.bufferMinutes || 0);
    setWeekStartsOn(state.settings.weekStartsOn || 1);
  }, [state.settings, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const settings: CalendarSettings = {
      timezone: 'Europe/Zurich',
      slotMinutes,
      businessHours: {
        start: businessStart,
        end: businessEnd,
      },
      bufferMinutes: bufferMinutes || undefined,
      weekStartsOn,
    };

    try {
      await saveSettings(settings);
      toast({
        title: 'Paramètres sauvegardés',
        description: 'Les paramètres ont été mis à jour avec succès.',
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réglages du calendrier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="slotMinutes">Durée des créneaux (minutes)</Label>
            <Input
              id="slotMinutes"
              type="number"
              min={5}
              max={60}
              step={5}
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value))}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Durée minimale d'un créneau (5-60 minutes)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="businessStart">Heure d'ouverture</Label>
              <Input
                id="businessStart"
                type="time"
                value={businessStart}
                onChange={(e) => setBusinessStart(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="businessEnd">Heure de fermeture</Label>
              <Input
                id="businessEnd"
                type="time"
                value={businessEnd}
                onChange={(e) => setBusinessEnd(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="bufferMinutes">Marge entre rendez-vous (minutes)</Label>
            <Input
              id="bufferMinutes"
              type="number"
              min={0}
              max={60}
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Temps de pause entre deux rendez-vous (optionnel)
            </p>
          </div>

          <div>
            <Label htmlFor="weekStartsOn">Premier jour de la semaine</Label>
            <select
              id="weekStartsOn"
              value={weekStartsOn}
              onChange={(e) => setWeekStartsOn(Number(e.target.value))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value={0}>Dimanche</option>
              <option value={1}>Lundi</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              Sauvegarder
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}








