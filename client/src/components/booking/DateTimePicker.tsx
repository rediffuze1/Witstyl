/**
 * Composant de sélection de date/heure basé sur le calendrier interne
 * Utilisé dans le formulaire de réservation
 */

import { useState, useMemo } from 'react';
import { useCalendar } from '@/calendar/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  generateTimeGrid,
  getDayStart,
  isSameDay,
  formatTime,
  snapToGrid,
  clampToBusinessHours,
} from '@/calendar/utils/datetime';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarEvent } from '@/calendar/types';

interface DateTimePickerProps {
  selectedDate: Date | undefined;
  selectedTime: string;
  onDateSelect: (date: Date | undefined) => void;
  onTimeSelect: (time: string) => void;
  serviceDuration?: number; // Durée du service en minutes
  disabledDates?: (date: Date) => boolean;
}

export function DateTimePicker({
  selectedDate,
  selectedTime,
  onDateSelect,
  onTimeSelect,
  serviceDuration = 30,
  disabledDates,
}: DateTimePickerProps) {
  const { state } = useCalendar();
  const [calendarDate, setCalendarDate] = useState<Date>(selectedDate || new Date());

  // Charger les rendez-vous existants depuis l'API pour vérifier les conflits
  const { data: appointments } = useQuery({
    queryKey: ['/api/appointments'],
    queryFn: async () => {
      const response = await fetch('/api/appointments');
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Charger les horaires du salon depuis l'API publique
  const { data: salonData } = useQuery({
    queryKey: ['/api/public/salon'],
    queryFn: async () => {
      const response = await fetch('/api/public/salon');
      if (!response.ok) return { hours: [] };
      return response.json();
    },
  });

  // Fonction pour obtenir les créneaux d'un jour spécifique
  const getDaySlots = (day: Date): Array<{ openTime: string; closeTime: string }> | null => {
    const dayOfWeek = day.getDay(); // 0 = dimanche, 1 = lundi, etc.
    const hours = salonData?.hours || [];
    
    // Fonction pour formater l'heure (retirer les secondes si présentes)
    const formatTime = (time: string | null | undefined): string => {
      if (!time) return '09:00';
      // Si le format contient des secondes (HH:mm:ss), ne garder que HH:mm
      return time.substring(0, 5);
    };
    
    // Récupérer tous les créneaux pour ce jour
    const daySlots = hours
      .filter((h: any) => h.day_of_week === dayOfWeek && !h.is_closed)
      .map((h: any) => ({
        openTime: formatTime(h.open_time) || '09:00',
        closeTime: formatTime(h.close_time) || '18:00',
      }));
    
    return daySlots.length > 0 ? daySlots : null;
  };

  // Générer les créneaux disponibles pour la date sélectionnée
  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];

    // Obtenir les créneaux du salon pour ce jour
    const daySlots = getDaySlots(selectedDate);
    if (!daySlots || daySlots.length === 0) return []; // Salon fermé ce jour

    // Générer les créneaux pour chaque slot du jour
    const dayStart = getDayStart(selectedDate);
    const allSlots: Date[] = [];
    
    daySlots.forEach(slot => {
      const slots = generateTimeGrid(
        dayStart,
        { start: slot.openTime, end: slot.closeTime },
        state.settings.slotMinutes
      );
      allSlots.push(...slots);
    });
    
    // Trier les créneaux par ordre chronologique
    allSlots.sort((a, b) => a.getTime() - b.getTime());

    // Filtrer les créneaux selon les rendez-vous existants et la durée du service
    const dayAppointments = (appointments || []).filter((apt: any) => {
      const aptDate = new Date(apt.appointmentDate || apt.startTime);
      return isSameDay(aptDate, selectedDate);
    });

    const available = allSlots.filter((slot) => {
      const slotEnd = new Date(slot);
      slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration);

      // Vérifier si le créneau chevauche avec un rendez-vous existant
      const hasConflict = dayAppointments.some((apt: any) => {
        const aptStart = new Date(apt.appointmentDate || apt.startTime);
        const aptEnd = new Date(apt.endTime || new Date(aptStart.getTime() + (apt.duration || 30) * 60000));
        return slot < aptEnd && slotEnd > aptStart;
      });

      // Vérifier que le créneau est dans le futur
      const isFuture = slot > new Date();

      return !hasConflict && isFuture;
    });

    return available;
  }, [selectedDate, appointments, state.settings, serviceDuration, salonData]);

  const handleDateSelect = (date: Date | undefined) => {
    onDateSelect(date);
    onTimeSelect(''); // Réinitialiser l'heure quand la date change
  };

  return (
    <div className="space-y-6">
      {/* Sélection de date */}
      <div>
        <h3 className="text-sm font-medium mb-3">Choisissez une date</h3>
          <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={(date) => {
            // Désactiver les dates passées
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (date < today) return true;
            
            // Désactiver les jours où le salon est fermé
            const daySlots = getDaySlots(date);
            if (!daySlots || daySlots.length === 0) return true; // Salon fermé ce jour
            
            // Désactiver les dates personnalisées si fournies
            if (disabledDates) return disabledDates(date);
            return false;
          }}
          locale={fr}
          className="rounded-md border"
        />
      </div>

      {/* Sélection d'heure */}
      {selectedDate && (
        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center">
            <Clock className="mr-2 h-4 w-4" />
            Créneaux disponibles
            {selectedDate && (
              <span className="ml-2 text-muted-foreground font-normal">
                ({format(selectedDate, 'EEEE d MMMM', { locale: fr })})
              </span>
            )}
          </h3>
          
          {availableSlots.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {availableSlots.map((slot, index) => {
                const timeStr = formatTime(slot);
                const isSelected = selectedTime === timeStr;
                
                return (
                  <Button
                    key={index}
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => onTimeSelect(timeStr)}
                    className="text-sm"
                    type="button"
                  >
                    {timeStr}
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">
                Aucun créneau disponible pour cette date.
              </p>
              <p className="text-xs mt-2">
                Veuillez choisir une autre date.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation du calendrier */}
      {selectedDate && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const prev = new Date(calendarDate);
              prev.setDate(prev.getDate() - 1);
              setCalendarDate(prev);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>{format(calendarDate, 'MMMM yyyy', { locale: fr })}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new Date(calendarDate);
              next.setDate(next.getDate() + 1);
              setCalendarDate(next);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

