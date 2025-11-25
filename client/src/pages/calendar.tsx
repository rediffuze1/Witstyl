import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, Filter, Edit, Save, X, LayoutGrid, CalendarDays } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, parseISO, isSameDay, startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval as eachDay, addDays, subDays, addMonths, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { type Appointment, type Stylist, type Service, type Client } from "@shared/schema";
import Navigation from "@/components/navigation";
import { getDayStart } from "@/calendar/utils/datetime";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CalendarLegend from "@/components/calendar/CalendarLegend";
import { createStylistColorMap, type StylistPalette } from "@/components/calendar/stylistColors";
import { PX_PER_MINUTE, SLOT_MINUTES } from "@/calendar/utils/layout";

const STYLIST_REASON_META = "stylist-closure-v1";

interface AppointmentWithDetails extends Appointment {
  client?: Client;
  stylist?: Stylist;
  service?: Service;
}

type CalendarView = "day" | "week" | "month";

function decodeEncodedReason(reason: unknown) {
  if (!reason || typeof reason !== "string") return null;
  const trimmed = reason.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && parsed.type === STYLIST_REASON_META) {
      return {
        label: typeof parsed.label === "string" ? parsed.label : "",
        stylistId: typeof parsed.stylistId === "string" ? parsed.stylistId : null,
      };
    }
  } catch (error) {
    console.warn("[calendar] Impossible de décoder la raison encodée:", error);
  }
  return null;
}

export default function Calendar() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentDay, setCurrentDay] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [selectedStylist, setSelectedStylist] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time: string } | null>(null);
  const [editFormData, setEditFormData] = useState<{
    clientId: string;
    serviceId: string;
    stylistId: string;
    startTime: string;
    startDate: string;
    startHour: string;
    status: string;
    notes: string;
  } | null>(null);
  const [createFormData, setCreateFormData] = useState<{
    clientId: string;
    serviceId: string;
    stylistId: string;
    startDate: string;
    startHour: string;
    status: string;
    notes: string;
  } | null>(null);
  
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Non autorisé",
        description: "Vous devez être connecté pour accéder au calendrier.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: salon } = useQuery({
    queryKey: ["/api/salon"],
    retry: false,
  });

  const { data: stylistes } = useQuery({
    queryKey: ["/api/salons", salon?.id, "stylistes"],
    enabled: !!salon?.id,
    retry: false,
  });

  const stylistNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (Array.isArray(stylistes)) {
      stylistes.forEach((stylist: Stylist) => {
        map.set(stylist.id, `${stylist.firstName} ${stylist.lastName}`.trim());
      });
    }
    return map;
  }, [stylistes]);

  const { data: services } = useQuery({
    queryKey: ["/api/salons", salon?.id, "services"],
    enabled: !!salon?.id,
    retry: false,
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
    retry: false,
  });

  // Charger les horaires du salon
  const { data: salonHours } = useQuery({
    queryKey: ["/api/salons", salon?.id, "hours"],
    queryFn: async () => {
      if (!salon?.id) return { hours: [] };
      const response = await fetch(`/api/salons/${salon.id}/hours`, { credentials: 'include' });
      if (!response.ok) return { hours: [] };
      return response.json();
    },
    enabled: !!salon?.id,
    retry: false,
  });

  // Charger les dates de fermeture
  const { data: closedDates } = useQuery({
    queryKey: ["/api/salons", salon?.id, "closed-dates"],
    queryFn: async () => {
      if (!salon?.id) return [];
      const response = await fetch(`/api/salons/${salon.id}/closed-dates`, { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!salon?.id,
    retry: false,
  });

const normalizedClosedDates = useMemo(() => {
    if (!closedDates || !Array.isArray(closedDates)) return [];
    return closedDates.map((date: any) => {
      const parsed = decodeEncodedReason(date.reason);
      if (!parsed) return date;
      return {
        ...date,
        reason: parsed.label || "",
        stylist_id: date.stylist_id || parsed.stylistId || date.stylistId,
        stylistId: date.stylistId || parsed.stylistId,
        _hasEncodedReason: true,
      };
    });
  }, [closedDates]);

  const formatTimeValue = (time?: string | null): string => {
    if (!time) return "09:00";
    if (typeof time !== "string") return "09:00";
    return time.substring(0, 5);
  };

  // Charger les horaires des stylistes
  const { data: stylistHoursData } = useQuery({
    queryKey: ["/api/salons", salon?.id, "stylist-hours"],
    queryFn: async () => {
      if (!salon?.id) return { hours: {} };
      const response = await fetch(`/api/salons/${salon.id}/stylist-hours`, { credentials: 'include' });
      if (!response.ok) return { hours: {} };
      const data = await response.json();
      return data.hours || {};
    },
    enabled: !!salon?.id,
    retry: false,
  });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  // Dates pour la vue jour
  const dayStart = startOfDay(currentDay);
  const dayEnd = endOfDay(currentDay);
  
  // Dates pour la vue mois
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const monthStartWeek = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthEndWeek = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthCalendarDays = eachDayOfInterval({ start: monthStartWeek, end: monthEndWeek });

  // Fonction pour vérifier si une date est fermée et obtenir les heures de fermeture
  const getClosedDateInfo = (day: Date, stylistId?: string): { isClosed: boolean; closures: Array<{ startTime: string; endTime: string; label?: string; isSalonWide?: boolean }> } => {
    if (!normalizedClosedDates || normalizedClosedDates.length === 0) {
      return { isClosed: false, closures: [] };
    }
    const dayStr = format(day, 'yyyy-MM-dd');
    const matchingDates = normalizedClosedDates.filter((cd: any) => {
      let closedDateStr: string;
      if (typeof cd.date === 'string') {
        closedDateStr = cd.date.split('T')[0];
      } else {
        closedDateStr = format(new Date(cd.date), 'yyyy-MM-dd');
      }
      if (closedDateStr !== dayStr) return false;
      
      if (stylistId && stylistId !== "all") {
        return !cd.stylist_id || cd.stylist_id === stylistId;
      }
      return true;
    });
    
    if (matchingDates.length === 0) return { isClosed: false, closures: [] };
    
    const isFullDay = matchingDates.some((cd: any) => !cd.start_time && !cd.end_time && !cd.startTime && !cd.endTime && (!cd.stylist_id || cd.stylist_id === stylistId || stylistId === "all"));
    const closures = matchingDates
      .map((cd: any) => {
        const start = formatTimeValue(cd.start_time || cd.startTime);
        const end = formatTimeValue(cd.end_time || cd.endTime);
        if (!start || !end || start === end) return null;
        return {
          startTime: start,
          endTime: end,
          label: cd.reason || (cd.stylist_id ? "Fermeture coiffeur·euse" : "Fermeture"),
          isSalonWide: !cd.stylist_id,
          stylistName: cd.stylist_id ? stylistNameMap.get(cd.stylist_id) : undefined,
        };
      })
      .filter(Boolean) as Array<{ startTime: string; endTime: string; label?: string; isSalonWide?: boolean }>;
    
    return { isClosed: isFullDay && closures.length === 0, closures };
  };

  // Fonction pour vérifier si un jour est fermé (soit par horaires du salon, soit par date exceptionnelle)
  const isDayClosed = (day: Date, stylistId?: string): boolean => {
    // Vérifier d'abord les dates de fermeture exceptionnelles
    const closedInfo = getClosedDateInfo(day, stylistId);
    if (closedInfo.isClosed && !closedInfo.startTime && !closedInfo.endTime) {
      // Date complètement fermée
      return true;
    }
    
    // Vérifier les horaires du salon pour ce jour de la semaine
    const dayOfWeek = day.getDay(); // 0 = dimanche, 1 = lundi, etc.
    const hours = salonHours?.hours || [];
    const dayHours = hours.filter((h: any) => h.day_of_week === dayOfWeek);
    
    // Si le jour est marqué comme fermé ou s'il n'y a pas d'horaires pour ce jour
    const isClosed = dayHours.length === 0 || dayHours.every((h: any) => h.is_closed);
    return isClosed;
  };

  // Fonction pour obtenir les créneaux d'un jour spécifique
  const getDaySlots = (day: Date, stylistId?: string): Array<{ openTime: string; closeTime: string }> | null => {
    // Vérifier d'abord si la date est fermée exceptionnellement
    const closedInfo = getClosedDateInfo(day, stylistId);
    if (closedInfo.isClosed && !closedInfo.startTime && !closedInfo.endTime) {
      // Date complètement fermée
      return null;
    }

    const dayOfWeek = day.getDay(); // 0 = dimanche, 1 = lundi, etc.
    const hours = salonHours?.hours || [];
    
    // Si un styliste est sélectionné, utiliser ses horaires spécifiques s'ils existent
    // Sinon, utiliser les horaires du salon par défaut
    if (stylistId && stylistId !== "all" && stylistHoursData) {
      const stylistHours = stylistHoursData[stylistId] || [];
      
      // Récupérer tous les créneaux du salon pour ce jour (peut y avoir plusieurs créneaux)
      const salonDayEntries = hours.filter((h: any) => h.day_of_week === dayOfWeek && !h.is_closed);
      let salonDaySlots: Array<{ openTime: string; closeTime: string }> = [];
      
      salonDayEntries.forEach((h: any) => {
        // Si le salon a des slots définis, les utiliser
        if (h.slots && Array.isArray(h.slots) && h.slots.length > 0) {
          h.slots.forEach((slot: any) => {
            salonDaySlots.push({
              openTime: formatTimeValue(slot.openTime || slot.open_time),
              closeTime: formatTimeValue(slot.closeTime || slot.close_time),
            });
          });
        } else {
          // Fallback : utiliser open_time et close_time
          salonDaySlots.push({
            openTime: formatTimeValue(h.open_time),
            closeTime: formatTimeValue(h.close_time),
          });
        }
      });
      
      if (salonDaySlots.length === 0) {
        return null; // Salon fermé ce jour
      }
      
      // Si le styliste a des horaires spécifiques, les utiliser
      if (stylistHours.length > 0) {
        // Vérifier si le styliste a une entrée pour ce jour
        const stylistDayEntry = stylistHours.find((h: any) => h.day_of_week === dayOfWeek);
        
        // Si le styliste est marqué comme fermé (is_closed: true) pour ce jour, retourner null
        if (stylistDayEntry && stylistDayEntry.is_closed) {
          return null; // Styliste indisponible ce jour
        }
        
        // Récupérer les créneaux du styliste pour ce jour (support de plusieurs créneaux)
        let stylistDaySlots: Array<{ openTime: string; closeTime: string }> = [];
        
        if (stylistDayEntry && !stylistDayEntry.is_closed) {
          // Si le styliste a des slots définis, les utiliser
          if (stylistDayEntry.slots && Array.isArray(stylistDayEntry.slots) && stylistDayEntry.slots.length > 0) {
            stylistDaySlots = stylistDayEntry.slots.map((slot: any) => ({
              openTime: formatTimeValue(slot.openTime || slot.open_time),
              closeTime: formatTimeValue(slot.closeTime || slot.close_time),
            }));
          } else if (stylistDayEntry.open_time && stylistDayEntry.close_time) {
            // Fallback : utiliser open_time et close_time (compatibilité)
            stylistDaySlots = [{
              openTime: formatTimeValue(stylistDayEntry.open_time),
              closeTime: formatTimeValue(stylistDayEntry.close_time),
            }];
          }
        }
        
        // Si le styliste a des horaires spécifiques pour ce jour, les utiliser
        if (stylistDaySlots.length > 0) {
          // Convertir en minutes pour faciliter la comparaison
          const toMinutes = (time: string) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
          };
          
          // Calculer les limites globales du salon (de l'heure la plus tôt à l'heure la plus tard)
          const salonOpenTimes = salonDaySlots.map(s => toMinutes(s.openTime));
          const salonCloseTimes = salonDaySlots.map(s => toMinutes(s.closeTime));
          const salonEarliestOpen = Math.min(...salonOpenTimes);
          const salonLatestClose = Math.max(...salonCloseTimes);
          
          // Filtrer les créneaux du styliste pour qu'ils soient dans les limites globales du salon
          // (les stylistes peuvent avoir des horaires continus qui couvrent plusieurs créneaux du salon)
          const validSlots = stylistDaySlots.filter((stylistSlot: any) => {
            const stylistStartMin = toMinutes(stylistSlot.openTime);
            const stylistEndMin = toMinutes(stylistSlot.closeTime);
            
            // Le créneau du styliste doit être dans les limites globales du salon
            return stylistStartMin >= salonEarliestOpen && stylistEndMin <= salonLatestClose;
          });
          
          return validSlots.length > 0 ? validSlots : null;
        }
        // Si le styliste n'a pas d'horaire spécifique pour ce jour, utiliser les horaires du salon
      }
      // Si le styliste n'a aucun horaire défini, utiliser les horaires du salon par défaut
      return salonDaySlots.length > 0 ? salonDaySlots : null;
    }
    
    // Sinon, utiliser les horaires du salon
    let daySlots = hours
      .filter((h: any) => h.day_of_week === dayOfWeek && !h.is_closed)
      .map((h: any) => ({
        openTime: formatTimeValue(h.open_time),
        closeTime: formatTimeValue(h.close_time),
      }));
    
    // Si la date a des heures de fermeture spécifiques, exclure ces heures
    if (closedInfo.isClosed && closedInfo.startTime && closedInfo.endTime) {
      const closedStart = formatTimeValue(closedInfo.startTime);
      const closedEnd = formatTimeValue(closedInfo.endTime);
      
      // Convertir en minutes pour faciliter la comparaison
      const toMinutes = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
      };
      
      // Filtrer les créneaux pour exclure les heures de fermeture
      const filteredSlots: Array<{ openTime: string; closeTime: string }> = [];
      
      daySlots.forEach((slot: any) => {
        const slotStart = formatTime(slot.openTime);
        const slotEnd = formatTime(slot.closeTime);
        
        const slotStartMin = toMinutes(slotStart);
        const slotEndMin = toMinutes(slotEnd);
        const closedStartMin = toMinutes(closedStart);
        const closedEndMin = toMinutes(closedEnd);
        
        // Si le créneau chevauche avec la fermeture, le diviser ou l'exclure
        if (slotStartMin < closedStartMin && slotEndMin > closedEndMin) {
          // Le créneau englobe la fermeture, créer deux créneaux
          if (slotStartMin < closedStartMin) {
            filteredSlots.push({ openTime: slotStart, closeTime: closedStart });
          }
          if (slotEndMin > closedEndMin) {
            filteredSlots.push({ openTime: closedEnd, closeTime: slotEnd });
          }
        } else if (slotStartMin >= closedStartMin && slotEndMin <= closedEndMin) {
          // Le créneau est complètement dans la fermeture, l'exclure
          // Ne rien ajouter
        } else if (slotStartMin < closedStartMin && slotEndMin > closedStartMin && slotEndMin <= closedEndMin) {
          // Le créneau commence avant la fermeture mais se termine pendant
          filteredSlots.push({ openTime: slotStart, closeTime: closedStart });
        } else if (slotStartMin >= closedStartMin && slotStartMin < closedEndMin && slotEndMin > closedEndMin) {
          // Le créneau commence pendant la fermeture mais se termine après
          filteredSlots.push({ openTime: closedEnd, closeTime: slotEnd });
        } else {
          // Le créneau ne chevauche pas avec la fermeture
          filteredSlots.push(slot);
        }
      });
      
      daySlots = filteredSlots.filter((slot: any) => {
        const slotStartMin = toMinutes(slot.openTime);
        const slotEndMin = toMinutes(slot.closeTime);
        return slotStartMin < slotEndMin; // Garder uniquement les créneaux valides
      });
    }
    
    return daySlots.length > 0 ? daySlots : null;
  };

  const getDayClosures = (day: Date, stylistId?: string) => {
    return getClosedDateInfo(day, stylistId).closures;
  };

  // Calculer les heures min/max pour la grille
  const { startHour, endHour } = useMemo(() => {
    let minHour = 8;
    let maxHour = 19;

    // Parcourir tous les créneaux du salon pour trouver les heures min/max
    const allSlots: Array<{ openTime: string; closeTime: string }> = [];
    weekDays.forEach((day) => {
      const slots = getDaySlots(day, selectedStylist !== "all" ? selectedStylist : undefined);
      if (slots) {
        allSlots.push(...slots);
      }
    });

    if (allSlots.length > 0) {
      const toMinutes = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
      };

      const allOpenTimes = allSlots.map(s => toMinutes(s.openTime));
      const allCloseTimes = allSlots.map(s => toMinutes(s.closeTime));

      const earliestOpen = Math.min(...allOpenTimes);
      const latestClose = Math.max(...allCloseTimes);

      minHour = Math.floor(earliestOpen / 60);
      maxHour = Math.ceil(latestClose / 60);

      // Arrondir pour avoir des heures rondes
      minHour = Math.max(6, minHour - 1); // Au moins 6h, avec une marge
      maxHour = Math.min(22, maxHour + 1); // Au plus 22h, avec une marge
    }

    return { startHour: minHour, endHour: maxHour };
  }, [weekDays, selectedStylist, salonHours, stylistHoursData, normalizedClosedDates]);

  const dayHeightPx = useMemo(
    () => (endHour - startHour) * 60 * PX_PER_MINUTE,
    [endHour, startHour]
  );

  const hourHeightPx = 60 * PX_PER_MINUTE;

  const hoursArray = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index),
    [startHour, endHour]
  );

  // Fonction pour vérifier si un créneau est occupé par un rendez-vous
  const isSlotOccupied = (slot: Date, day: Date) => {
    const dayAppointments = getAppointmentsForDay(day);
    return dayAppointments.some((apt: Appointment) => {
      const aptStart = parseISO(apt.startTime);
      const aptEnd = parseISO(apt.endTime);
      // Vérifier si le créneau chevauche avec le rendez-vous
      const slotEnd = new Date(slot);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30); // Durée d'un créneau
      return slot < aptEnd && slotEnd > aptStart;
    });
  };

  // Fonction pour obtenir le rendez-vous qui commence à un créneau donné
  const getAppointmentAtSlot = (slot: Date, day: Date): Appointment | null => {
    const dayAppointments = getAppointmentsForDay(day);
    // Trouver le rendez-vous qui commence exactement à ce créneau
    return dayAppointments.find((apt: Appointment) => {
      const aptStart = parseISO(apt.startTime);
      // Comparer les heures et minutes (ignorer les secondes)
      return aptStart.getHours() === slot.getHours() && 
             aptStart.getMinutes() === slot.getMinutes();
    }) || null;
  };

  // Calculer les dates de début et fin selon la vue
  const queryStartDate = view === "day" ? dayStart : view === "week" ? weekStart : monthStart;
  const queryEndDate = view === "day" ? dayEnd : view === "week" ? weekEnd : monthEnd;

  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["/api/salons", salon?.id, "appointments", queryStartDate.toISOString(), queryEndDate.toISOString()],
    queryFn: async () => {
      if (!salon?.id) return [];
      const response = await fetch(
        `/api/salons/${salon.id}/appointments?startDate=${queryStartDate.toISOString()}&endDate=${queryEndDate.toISOString()}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        console.error('[Calendar] Erreur chargement rendez-vous:', response.status);
        return [];
      }
      const data = await response.json();
      // Si l'API retourne un objet avec appointments, extraire le tableau
      return Array.isArray(data) ? data : (data.appointments || []);
    },
    enabled: !!salon?.id,
    retry: false,
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Appointment> }) => {
      const response = await fetch(`/api/appointments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!response.ok) {
        // Essayer de parser le message d'erreur JSON du serveur
        let errorMessage = "Impossible de modifier le rendez-vous. Veuillez réessayer.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Si le parsing échoue, utiliser le message par défaut
        }
        throw new Error(errorMessage);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rendez-vous modifié",
        description: "Le rendez-vous a été modifié avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/salons", salon?.id, "appointments"] });
      setIsDialogOpen(false);
      setIsEditing(false);
      setEditFormData(null);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous devez être connecté. Redirection...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      const errorMessage = error?.message || "Impossible de modifier le rendez-vous.";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: {
      salonId?: string;
      clientId: string;
      serviceId: string;
      stylistId: string;
      startTime: string;
      status: string;
      notes: string;
      duration?: number;
    }) => {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!response.ok) {
        let errorMessage = "Impossible de créer le rendez-vous. Veuillez réessayer.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Si le parsing échoue, utiliser le message par défaut
        }
        throw new Error(errorMessage);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rendez-vous créé",
        description: "Le rendez-vous a été créé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/salons", salon?.id, "appointments"] });
      setIsDialogOpen(false);
      setIsCreating(false);
      setCreateFormData(null);
      setSelectedSlot(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Impossible de créer le rendez-vous.";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/appointments/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Rendez-vous supprimé",
        description: "Le rendez-vous a été supprimé avec succès.",
      });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/salons", salon?.id, "appointments"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous devez être connecté. Redirection...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le rendez-vous.",
        variant: "destructive",
      });
    },
  });

  const getAppointmentDetails = (appointment: Appointment): AppointmentWithDetails => {
    const client = clients?.find((c: Client) => c.id === appointment.clientId);
    const stylist = stylistes?.find((s: Stylist) => s.id === appointment.stylistId);
    const service = services?.find((s: Service) => s.id === appointment.serviceId);
    
    return {
      ...appointment,
      client,
      stylist,
      service,
    };
  };

  const filteredAppointments = appointments?.filter((appointment: Appointment) => {
    if (selectedStylist === "all") return true;
    return appointment.stylistId === selectedStylist;
  }) || [];

  // Enrichir les rendez-vous avec les détails client/stylist/service
  const enrichedAppointments = filteredAppointments.map((appointment: Appointment) => {
    const client = clients?.find((c: Client) => c.id === appointment.clientId);
    const stylist = stylistes?.find((s: Stylist) => s.id === appointment.stylistId);
    const service = services?.find((s: Service) => s.id === appointment.serviceId);
    
    return {
      ...appointment,
      client: client ? { firstName: client.firstName, lastName: client.lastName, email: client.email } : undefined,
      stylist: stylist ? { firstName: stylist.firstName, lastName: stylist.lastName } : undefined,
      service: service ? { name: service.name, price: service.price, duration: service.durationMinutes } : undefined,
    };
  });

  // Créer la map des couleurs pour les stylistes
  const stylistColors = stylistes
    ? createStylistColorMap(stylistes)
    : new Map<string, StylistPalette>();

  const getAppointmentsForDay = (day: Date) => {
    return enrichedAppointments.filter((appointment: Appointment) => {
      const appointmentDate = parseISO(appointment.startTime);
      return isSameDay(appointmentDate, day);
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "no_show":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handlePrevious = () => {
    if (view === "day") {
      setCurrentDay(subDays(currentDay, 1));
    } else if (view === "week") {
    setCurrentWeek(subWeeks(currentWeek, 1));
    } else {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  const handleNext = () => {
    if (view === "day") {
      setCurrentDay(addDays(currentDay, 1));
    } else if (view === "week") {
    setCurrentWeek(addWeeks(currentWeek, 1));
    } else {
      setCurrentMonth(addMonths(currentMonth, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    if (view === "day") {
      setCurrentDay(today);
    } else if (view === "week") {
      setCurrentWeek(today);
    } else {
      setCurrentMonth(today);
    }
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(getAppointmentDetails(appointment));
    setIsDialogOpen(true);
  };

  const handleStatusChange = (appointmentId: string, newStatus: string) => {
    updateAppointmentMutation.mutate({
      id: appointmentId,
      data: { status: newStatus },
    });
  };

  const handleEditClick = () => {
    if (!selectedAppointment) return;
    
    const startDate = new Date(selectedAppointment.startTime);
    const dateStr = format(startDate, 'yyyy-MM-dd');
    const timeStr = format(startDate, 'HH:mm');
    
    setEditFormData({
      clientId: selectedAppointment.clientId || '',
      serviceId: selectedAppointment.serviceId || '',
      stylistId: selectedAppointment.stylistId || '',
      startTime: selectedAppointment.startTime,
      startDate: dateStr,
      startHour: timeStr,
      status: selectedAppointment.status || 'confirmed',
      notes: selectedAppointment.notes || '',
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFormData(null);
  };

  const handleSaveEdit = () => {
    if (!selectedAppointment || !editFormData) return;
    
    // Combiner date et heure
    const dateTimeStr = `${editFormData.startDate}T${editFormData.startHour}:00`;
    const startTime = new Date(dateTimeStr).toISOString();
    
    // Récupérer la durée du service si le service change
    const selectedService = services?.find((s: Service) => s.id === editFormData.serviceId);
    const duration = selectedService?.durationMinutes || selectedAppointment.service?.durationMinutes || 30;
    
    updateAppointmentMutation.mutate({
      id: selectedAppointment.id,
      data: {
        clientId: editFormData.clientId,
        serviceId: editFormData.serviceId,
        stylistId: editFormData.stylistId,
        startTime: startTime,
        status: editFormData.status,
        notes: editFormData.notes,
        duration: duration,
      },
    });
    
    setIsEditing(false);
    setEditFormData(null);
  };

  const handleCreateClick = (day: Date, slotTime: string) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    setSelectedSlot({ date: day, time: slotTime });
    setCreateFormData({
      clientId: '',
      serviceId: '',
      stylistId: '',
      startDate: dateStr,
      startHour: slotTime,
      status: 'confirmed',
      notes: '',
    });
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setCreateFormData(null);
    setSelectedSlot(null);
    setIsDialogOpen(false);
  };

  const handleSaveCreate = () => {
    if (!createFormData || !salon?.id) {
      toast({
        title: "Erreur",
        description: "Impossible de créer le rendez-vous. Informations du salon manquantes.",
        variant: "destructive",
      });
      return;
    }
    
    // Valider les champs requis
    if (!createFormData.clientId || !createFormData.serviceId || !createFormData.stylistId) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires (client, service, coiffeur·euse).",
        variant: "destructive",
      });
      return;
    }
    
    // Valider la date et l'heure
    if (!createFormData.startDate || !createFormData.startHour) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une date et une heure.",
        variant: "destructive",
      });
      return;
    }
    
    // Combiner date et heure
    const dateTimeStr = `${createFormData.startDate}T${createFormData.startHour}:00`;
    const startTime = new Date(dateTimeStr).toISOString();
    
    // Vérifier que la date est valide
    if (isNaN(new Date(startTime).getTime())) {
      toast({
        title: "Erreur",
        description: "La date et l'heure sélectionnées ne sont pas valides.",
        variant: "destructive",
      });
      return;
    }
    
    // Récupérer la durée du service
    const selectedService = services?.find((s: Service) => s.id === createFormData.serviceId);
    const duration = selectedService?.durationMinutes || 30;
    
    createAppointmentMutation.mutate({
      salonId: salon.id,
      clientId: createFormData.clientId,
      serviceId: createFormData.serviceId,
      stylistId: createFormData.stylistId,
      startTime: startTime,
      status: createFormData.status,
      notes: createFormData.notes,
      duration: duration,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen w-screen overflow-x-hidden bg-background">
      <Navigation />
      
      <main
        className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10"
        style={{ minHeight: "calc(100vh - 72px)" }}
      >
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center">
              <CalendarIcon className="mr-3 h-8 w-8" />
              Calendrier
            </h1>
            <p className="text-muted-foreground">Gérez vos rendez-vous par semaine</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
              <TabsList>
                <TabsTrigger value="day">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Jour
                </TabsTrigger>
                <TabsTrigger value="week">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Semaine
                </TabsTrigger>
                <TabsTrigger value="month">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Mois
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <Select value={selectedStylist} onValueChange={setSelectedStylist}>
                <SelectTrigger className="w-48" data-testid="select-stylist-filter">
                  <SelectValue placeholder="Filtrer par coiffeur·euse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tou·te·s les coiffeur·euses</SelectItem>
                  {stylistes?.map((stylist: Stylist) => (
                    <SelectItem key={stylist.id} value={stylist.id}>
                      {stylist.firstName} {stylist.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <Card className="glassmorphism-card mb-8 w-full mx-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button 
                variant="outline" 
                onClick={handlePrevious}
                data-testid="button-previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-4">
              <CardTitle className="text-center">
                  {view === "day" && format(currentDay, "EEEE d MMMM yyyy", { locale: fr })}
                  {view === "week" && `${format(weekStart, "d MMMM", { locale: fr })} - ${format(weekEnd, "d MMMM yyyy", { locale: fr })}`}
                  {view === "month" && format(currentMonth, "MMMM yyyy", { locale: fr })}
              </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleToday}
                  data-testid="button-today"
                >
                  {view === "day" ? "Aujourd'hui" : view === "week" ? "Cette semaine" : "Ce mois"}
                </Button>
              </div>
              
              <Button 
                variant="outline" 
                onClick={handleNext}
                data-testid="button-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Calendar Legend */}
        {stylistes && stylistes.length > 0 && (
          <div className="mb-6 px-4 lg:px-6">
            <CalendarLegend stylists={stylistes} stylistColors={stylistColors} />
          </div>
        )}

        {/* Calendar Grid - Google Calendar Style */}
        {appointmentsLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {view === "day" && (
              <Card className="glassmorphism-card overflow-hidden w-full">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    <div className="hidden lg:block w-20 flex-shrink-0 border-r border-border/50 bg-muted/5">
                      <div className="h-14 border-b border-border/50" />
                      <div
                        className="relative"
                        style={{
                          height: `${dayHeightPx}px`,
                          backgroundImage: `
                            linear-gradient(to bottom, rgba(148, 163, 184, 0.28) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)
                          `,
                          backgroundSize: `100% ${hourHeightPx}px, 100% ${SLOT_MINUTES * PX_PER_MINUTE}px`,
                          backgroundRepeat: "repeat",
                        }}
                        aria-hidden="true"
                      >
                        {hoursArray.map((hour, index) => {
                          const top = index * hourHeightPx;
                          return (
                            <div key={hour} className="absolute left-0 right-0" style={{ top: `${top}px` }}>
                              <div className="absolute left-2 -translate-y-1/2 rounded bg-muted/70 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                                {format(new Date().setHours(hour, 0, 0, 0), "HH:mm")}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex-1 overflow-visible">
                      <div className="h-14 border-b border-border/50 bg-muted/5 flex items-center justify-center p-3">
                        <div className="text-xl font-bold text-foreground">
                          {format(currentDay, "EEEE d MMMM yyyy", { locale: fr })}
                        </div>
                      </div>
                      <div className="relative overflow-visible" style={{ height: `${dayHeightPx}px` }}>
                        <CalendarGrid
                          day={currentDay}
                          appointments={getAppointmentsForDay(currentDay)}
                          daySlots={getDaySlots(currentDay, selectedStylist !== "all" ? selectedStylist : undefined)}
                          closures={getDayClosures(currentDay, selectedStylist !== "all" ? selectedStylist : undefined)}
                          startHour={startHour}
                          endHour={endHour}
                          stylistColors={stylistColors}
                          onAppointmentClick={handleAppointmentClick}
                          onSlotClick={(date, time) => handleCreateClick(date, time)}
                        isClosed={isDayClosed(currentDay, selectedStylist !== "all" ? selectedStylist : undefined)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {view === "week" && (
              <Card className="glassmorphism-card overflow-hidden w-full">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    <div className="hidden lg:block w-20 flex-shrink-0 border-r border-border/50 bg-muted/5">
                      <div className="h-14 border-b border-border/50" />
                      <div
                        className="relative"
                        style={{
                          height: `${dayHeightPx}px`,
                          backgroundImage: `
                            linear-gradient(to bottom, rgba(148, 163, 184, 0.28) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)
                          `,
                          backgroundSize: `100% ${hourHeightPx}px, 100% ${SLOT_MINUTES * PX_PER_MINUTE}px`,
                          backgroundRepeat: "repeat",
                        }}
                        aria-hidden="true"
                      >
                        {hoursArray.map((hour, index) => {
                          const top = index * hourHeightPx;
                          return (
                            <div key={hour} className="absolute left-0 right-0" style={{ top: `${top}px` }}>
                              <div className="absolute left-2 -translate-y-1/2 rounded bg-muted/70 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                                {format(new Date().setHours(hour, 0, 0, 0), "HH:mm")}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex-1 overflow-x-auto">
                      <div className="grid grid-cols-7 min-w-[800px]">
            {weekDays.map((day) => {
                          const daySlots = getDaySlots(day, selectedStylist !== "all" ? selectedStylist : undefined);
                          const dayClosures = getDayClosures(day, selectedStylist !== "all" ? selectedStylist : undefined);
                          const isClosed = isDayClosed(day, selectedStylist !== "all" ? selectedStylist : undefined);
              
              return (
                            <div key={day.toISOString()} className="border-r border-border/50 last:border-r-0 overflow-visible">
                              <div className={`h-14 border-b border-border/50 flex flex-col items-center justify-center p-2.5 ${
                                isClosed ? "bg-muted/40 opacity-60" : "bg-muted/5"
                              }`}>
                                <div className={`text-xs font-semibold uppercase tracking-wide ${
                                  isClosed ? "text-muted-foreground line-through" : "text-muted-foreground"
                                }`}>
                                  {format(day, "EEE", { locale: fr })}
                      </div>
                                <div className={`text-xl font-bold mt-0.5 ${
                                  isClosed ? "text-muted-foreground line-through" : "text-foreground"
                                }`}>
                        {format(day, "d")}
                      </div>
                              </div>
                              <div className="relative overflow-visible" style={{ height: `${dayHeightPx}px` }}>
                                <CalendarGrid
                                  day={day}
                                  appointments={getAppointmentsForDay(day)}
                                  daySlots={daySlots}
                                  closures={dayClosures}
                                  startHour={startHour}
                                  endHour={endHour}
                                  stylistColors={stylistColors}
                                  onAppointmentClick={handleAppointmentClick}
                                  onSlotClick={(date, time) => handleCreateClick(date, time)}
                                  isClosed={isClosed || !daySlots || daySlots.length === 0}
                                />
                              </div>
                              </div>
                            );
                          })}
                        </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {view === "month" && (
              <Card className="glassmorphism-card overflow-hidden w-full">
                <CardContent className="p-0">
                  <div className="grid grid-cols-7">
                    {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                      <div key={day} className="border-r border-b border-border/50 bg-muted/5 p-2 text-center text-sm font-medium text-muted-foreground last:border-r-0">
                        {day}
                      </div>
                    ))}
                    {monthCalendarDays.map((day) => {
                      const isCurrentMonth = day >= monthStart && day <= monthEnd;
                      const dayAppointments = getAppointmentsForDay(day);
                      const isToday = isSameDay(day, new Date());
                      const dayIsClosed = isDayClosed(day, selectedStylist !== "all" ? selectedStylist : undefined);
                          
                          return (
                            <div
                          key={day.toISOString()}
                          className={`border-r border-b border-border/50 p-2 min-h-[100px] last:border-r-0 ${
                            !isCurrentMonth ? "bg-muted/20 text-muted-foreground" : dayIsClosed ? "bg-muted/40 opacity-60" : "bg-background"
                          } ${isToday ? "bg-primary/5 border-primary/20" : ""} ${dayIsClosed ? "cursor-not-allowed" : "cursor-pointer"}`}
                              onClick={() => {
                            if (!dayIsClosed) {
                              setCurrentDay(day);
                              setView("day");
                            }
                          }}
                        >
                          <div className={`text-sm font-medium mb-1 ${isToday ? "text-primary" : dayIsClosed ? "text-muted-foreground line-through" : ""}`}>
                            {format(day, "d")}
                              </div>
                          {dayIsClosed ? (
                            <div className="text-xs text-muted-foreground italic mt-2">
                              Salon fermé
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {dayAppointments.slice(0, 3).map((apt) => {
                                const palette = stylistColors.get(apt.stylistId);
                                const baseColor = palette?.base ?? "#6366f1";
                                return (
                                  <div
                                    key={apt.id}
                                    className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-90"
                                    style={{
                                      backgroundColor: palette?.background ?? "rgba(99, 102, 241, 0.12)",
                                      color: baseColor,
                                      borderLeft: `3px solid ${palette?.border ?? "rgba(99, 102, 241, 0.5)"}`,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAppointmentClick(apt);
                                    }}
                                  >
                                    {format(parseISO(apt.startTime), "HH:mm")} - {apt.client?.firstName} {apt.client?.lastName}
                                    </div>
                                );
                              })}
                              {dayAppointments.length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                  +{dayAppointments.length - 3} autre{dayAppointments.length - 3 > 1 ? "s" : ""}
                                    </div>
                                )}
                            </div>
                          )}
                            </div>
                          );
                        })}
                      </div>
                  </CardContent>
                </Card>
            )}
          </>
        )}

        {/* Appointment Details/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setIsEditing(false);
            setIsCreating(false);
            setEditFormData(null);
            setCreateFormData(null);
            setSelectedSlot(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>
                  {isCreating ? 'Créer un nouveau rendez-vous' : isEditing ? 'Modifier le rendez-vous' : 'Détails du rendez-vous'}
                </span>
                {!isEditing && !isCreating && selectedAppointment && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditClick}
                    className="ml-auto"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Modifier
                  </Button>
                )}
              </DialogTitle>
            </DialogHeader>
            
            {isCreating && createFormData ? (
              /* Mode création */
              <div className="space-y-4">
                {/* Client */}
                <div className="space-y-2">
                  <Label htmlFor="create-client">Client *</Label>
                  <Select
                    value={createFormData.clientId}
                    onValueChange={(value) => setCreateFormData({ ...createFormData, clientId: value })}
                  >
                    <SelectTrigger id="create-client">
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client: Client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.firstName} {client.lastName} {client.email ? `(${client.email})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Service */}
                <div className="space-y-2">
                  <Label htmlFor="create-service">Service *</Label>
                  <Select
                    value={createFormData.serviceId}
                    onValueChange={(value) => setCreateFormData({ ...createFormData, serviceId: value })}
                  >
                    <SelectTrigger id="create-service">
                      <SelectValue placeholder="Sélectionner un service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services?.map((service: Service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - {service.durationMinutes} min - {service.price}€
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Coiffeur·euse */}
                <div className="space-y-2">
                  <Label htmlFor="create-stylist">Coiffeur·euse *</Label>
                  <Select
                    value={createFormData.stylistId}
                    onValueChange={(value) => setCreateFormData({ ...createFormData, stylistId: value })}
                  >
                    <SelectTrigger id="create-stylist">
                      <SelectValue placeholder="Sélectionner un·e coiffeur·euse" />
                    </SelectTrigger>
                    <SelectContent>
                      {stylistes?.map((stylist: Stylist) => (
                        <SelectItem key={stylist.id} value={stylist.id}>
                          {stylist.firstName} {stylist.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date et Heure */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-date">Date *</Label>
                    <Input
                      id="create-date"
                      type="date"
                      value={createFormData.startDate}
                      onChange={(e) => setCreateFormData({ ...createFormData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-time">Heure *</Label>
                    <Input
                      id="create-time"
                      type="time"
                      value={createFormData.startHour}
                      onChange={(e) => setCreateFormData({ ...createFormData, startHour: e.target.value })}
                    />
                  </div>
                </div>

                {/* Statut */}
                <div className="space-y-2">
                  <Label htmlFor="create-status">Statut</Label>
                  <Select
                    value={createFormData.status}
                    onValueChange={(value) => setCreateFormData({ ...createFormData, status: value })}
                  >
                    <SelectTrigger id="create-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="confirmed">Confirmé</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                      <SelectItem value="no_show">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="create-notes">Notes</Label>
                  <Textarea
                    id="create-notes"
                    value={createFormData.notes}
                    onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                    placeholder="Notes optionnelles..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleCancelCreate}
                    disabled={createAppointmentMutation.isPending}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Annuler
                  </Button>
                  <Button
                    onClick={handleSaveCreate}
                    disabled={createAppointmentMutation.isPending}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {createAppointmentMutation.isPending ? 'Création...' : 'Créer'}
                  </Button>
                </div>
              </div>
            ) : selectedAppointment && (
              <div className="space-y-4">
                {isEditing && editFormData ? (
                  /* Mode édition */
                  <div className="space-y-4">
                    {/* Client */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-client">Client</Label>
                      <Select
                        value={editFormData.clientId}
                        onValueChange={(value) => setEditFormData({ ...editFormData, clientId: value })}
                      >
                        <SelectTrigger id="edit-client">
                          <SelectValue placeholder="Sélectionner un client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients?.map((client: Client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.firstName} {client.lastName} {client.email ? `(${client.email})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Service */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-service">Service</Label>
                      <Select
                        value={editFormData.serviceId}
                        onValueChange={(value) => setEditFormData({ ...editFormData, serviceId: value })}
                      >
                        <SelectTrigger id="edit-service">
                          <SelectValue placeholder="Sélectionner un service" />
                        </SelectTrigger>
                        <SelectContent>
                          {services?.map((service: Service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name} - {service.durationMinutes} min - {service.price}€
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Coiffeur·euse */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-stylist">Coiffeur·euse</Label>
                      <Select
                        value={editFormData.stylistId}
                        onValueChange={(value) => setEditFormData({ ...editFormData, stylistId: value })}
                      >
                        <SelectTrigger id="edit-stylist">
                          <SelectValue placeholder="Sélectionner un·e coiffeur·euse" />
                        </SelectTrigger>
                        <SelectContent>
                          {stylistes?.map((stylist: Stylist) => (
                            <SelectItem key={stylist.id} value={stylist.id}>
                              {stylist.firstName} {stylist.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date et Heure */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-date">Date</Label>
                        <Input
                          id="edit-date"
                          type="date"
                          value={editFormData.startDate}
                          onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-time">Heure</Label>
                        <Input
                          id="edit-time"
                          type="time"
                          value={editFormData.startHour}
                          onChange={(e) => setEditFormData({ ...editFormData, startHour: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Statut */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-status">Statut</Label>
                      <Select
                        value={editFormData.status}
                        onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                      >
                        <SelectTrigger id="edit-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">En attente</SelectItem>
                          <SelectItem value="confirmed">Confirmé</SelectItem>
                          <SelectItem value="completed">Terminé</SelectItem>
                          <SelectItem value="cancelled">Annulé</SelectItem>
                          <SelectItem value="no_show">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-notes">Notes</Label>
                      <Textarea
                        id="edit-notes"
                        value={editFormData.notes}
                        onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                        placeholder="Notes optionnelles..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={updateAppointmentMutation.isPending}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Annuler
                      </Button>
                      <Button
                        onClick={handleSaveEdit}
                        disabled={updateAppointmentMutation.isPending}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {updateAppointmentMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Mode affichage */
                  <>
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    Client
                  </h4>
                  <p>{selectedAppointment.client?.firstName} {selectedAppointment.client?.lastName}</p>
                  {selectedAppointment.client?.email && (
                    <p className="text-sm text-muted-foreground">{selectedAppointment.client.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Service</h4>
                  <p>{selectedAppointment.service?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAppointment.service?.durationMinutes} min - {selectedAppointment.service?.price}€
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Coiffeur·euse</h4>
                  <p>{selectedAppointment.stylist?.firstName} {selectedAppointment.stylist?.lastName}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center">
                    <Clock className="mr-2 h-4 w-4" />
                    Horaire
                  </h4>
                  <p>
                    {format(parseISO(selectedAppointment.startTime), "EEEE d MMMM yyyy à HH:mm", { locale: fr })}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Statut</h4>
                  <Select 
                    value={selectedAppointment.status} 
                    onValueChange={(value) => handleStatusChange(selectedAppointment.id, value)}
                  >
                    <SelectTrigger data-testid="select-appointment-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="confirmed">Confirmé</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                      <SelectItem value="no_show">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedAppointment.notes && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Notes</h4>
                    <p className="text-sm text-muted-foreground">{selectedAppointment.notes}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-close-appointment"
                  >
                    Fermer
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Êtes-vous sûr de vouloir supprimer ce rendez-vous ?")) {
                        deleteAppointmentMutation.mutate(selectedAppointment.id);
                      }
                    }}
                    disabled={deleteAppointmentMutation.isPending}
                    data-testid="button-delete-appointment"
                  >
                    Supprimer
                  </Button>
                </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
