import { useState, useEffect, useMemo } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Navigation from "@/components/navigation";
import { Clock, Save, Plus, X, Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { type Stylist } from "@shared/schema";

interface TimeSlot {
  id: string;
  openTime: string;
  closeTime: string;
}

interface SalonHour {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  slots?: TimeSlot[]; // Pour supporter plusieurs créneaux par jour
}

interface StylistHour {
  stylistId: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  slots?: TimeSlot[]; // Pour supporter plusieurs créneaux par jour
}

interface ClosedDate {
  id?: string;
  date: string;
  reason?: string;
  startTime?: string; // Heure de début de fermeture (HH:mm)
  endTime?: string; // Heure de fin de fermeture (HH:mm)
  stylistId?: string; // ID du styliste (optionnel, null = salon entier)
}

const DAYS = [
  { value: 0, label: "Dimanche", short: "Dim" },
  { value: 1, label: "Lundi", short: "Lun" },
  { value: 2, label: "Mardi", short: "Mar" },
  { value: 3, label: "Mercredi", short: "Mer" },
  { value: 4, label: "Jeudi", short: "Jeu" },
  { value: 5, label: "Vendredi", short: "Ven" },
  { value: 6, label: "Samedi", short: "Sam" },
];

const STYLIST_REASON_META = "stylist-closure-v1";

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
    console.warn("[hours.tsx] Impossible de décoder la raison encodée:", error);
  }
  return null;
}

export default function Hours() {
  const { isAuthenticated, isLoading, isHydrating } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [salonHours, setSalonHours] = useState<SalonHour[]>([]);
  const [stylistHours, setStylistHours] = useState<Record<string, StylistHour[]>>({});
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedDateRange, setSelectedDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [closedDateReason, setClosedDateReason] = useState("");
  const [closedDateStartTime, setClosedDateStartTime] = useState("");
  const [closedDateEndTime, setClosedDateEndTime] = useState("");
  const [closedDateStylistId, setClosedDateStylistId] = useState<string>("all"); // "all" = salon entier, sinon ID du styliste
  const [isDateRangeMode, setIsDateRangeMode] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: salon } = useQuery({
    queryKey: ["/api/salon"],
    retry: false,
  });

  const { data: stylistes } = useQuery({
    queryKey: ["/api/salons", salon?.id, "stylistes"],
    enabled: !!salon?.id,
    retry: false,
  });

  // Charger les horaires du salon
  const { data: salonHoursData, isLoading: isLoadingHours } = useQuery({
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
  const { data: closedDatesData } = useQuery({
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

  // Vérifier si la table stylist_schedule existe
  const { data: tableCheck } = useQuery({
    queryKey: ["/api/salons/check-stylist-schedule-table"],
    queryFn: async () => {
      const response = await fetch(`/api/salons/check-stylist-schedule-table`, { credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { exists: false, ...error };
      }
      return response.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Charger les horaires des stylistes
  const { data: stylistHoursData } = useQuery({
    queryKey: ["/api/salons", salon?.id, "stylist-hours"],
    queryFn: async () => {
      if (!salon?.id) return {};
      const response = await fetch(`/api/salons/${salon.id}/stylist-hours`, { credentials: 'include' });
      if (!response.ok) return {};
      const data = await response.json();
      return data.hours || {};
    },
    enabled: !!salon?.id,
    retry: false,
  });

  useEffect(() => {
    if (salonHoursData?.hours && Array.isArray(salonHoursData.hours)) {
      // Grouper les horaires par jour (un jour peut avoir plusieurs créneaux)
      const hoursByDay: { [key: number]: SalonHour[] } = {};
      salonHoursData.hours.forEach((h: any) => {
        const dayOfWeek = h.day_of_week;
        if (!hoursByDay[dayOfWeek]) {
          hoursByDay[dayOfWeek] = [];
        }
        hoursByDay[dayOfWeek].push({
          day_of_week: dayOfWeek,
          open_time: h.open_time || '09:00',
          close_time: h.close_time || '18:00',
          is_closed: h.is_closed || false,
        });
      });
      
      // Créer un tableau avec les horaires par jour, avec support de plusieurs créneaux
      const formattedHours = DAYS.map(day => {
        const dayHours = hoursByDay[day.value];
        if (dayHours && dayHours.length > 0) {
          // Convertir les créneaux en format slots
          const slots: TimeSlot[] = dayHours
            .filter(h => !h.is_closed)
            .map((h, idx) => ({
              id: `slot-${day.value}-${idx}`,
              openTime: h.open_time,
              closeTime: h.close_time,
            }));
          
          return {
            day_of_week: day.value,
            open_time: dayHours[0].open_time || '09:00',
            close_time: dayHours[0].close_time || '18:00',
            is_closed: dayHours[0].is_closed || false,
            slots: slots.length > 0 ? slots : [{ id: `slot-${day.value}-0`, openTime: '09:00', closeTime: '18:00' }],
          };
        }
        return {
          day_of_week: day.value,
          open_time: '09:00',
          close_time: '18:00',
          is_closed: true,
          slots: [{ id: `slot-${day.value}-0`, openTime: '09:00', closeTime: '18:00' }],
        };
      });
      
      setSalonHours(formattedHours);
    }
  }, [salonHoursData]);

  useEffect(() => {
    if (closedDatesData) {
      const dates = Array.isArray(closedDatesData) ? closedDatesData : [];
      const normalizedDates = dates.map((date: any) => {
        const parsed = decodeEncodedReason(date.reason);
        if (!parsed) {
          return date;
        }
        return {
          ...date,
          reason: parsed.label || "",
          stylist_id: date.stylist_id || parsed.stylistId || date.stylistId,
          stylistId: date.stylistId || parsed.stylistId,
          _hasEncodedReason: true,
        };
      });
      console.log('[hours.tsx] 🔄 closedDates normalisées:', normalizedDates);
      setClosedDates(normalizedDates);
    }
  }, [closedDatesData]);

  // Grouper et trier les dates par raison (recalculé à chaque changement de closedDates)
  const groupedAndSortedDates = useMemo(() => {
    if (closedDates.length === 0) return null;

    // Grouper les dates par raison
    const groupedByReason = closedDates.reduce((acc: Record<string, typeof closedDates>, date: any) => {
      const reason = date.reason || 'Sans raison';
      if (!acc[reason]) {
        acc[reason] = [];
      }
      acc[reason].push(date);
      return acc;
    }, {});

    // Trier les groupes par raison (alphabétique) puis trier les dates dans chaque groupe chronologiquement
    const sortedReasons = Object.keys(groupedByReason).sort();
    
    sortedReasons.forEach(reason => {
      groupedByReason[reason].sort((a: any, b: any) => {
        // Normaliser les dates pour la comparaison
        let dateA: string;
        let dateB: string;
        
        try {
          if (typeof a.date === 'string') {
            dateA = a.date;
          } else {
            dateA = format(new Date(a.date), 'yyyy-MM-dd');
          }
        } catch (e) {
          dateA = '';
        }
        
        try {
          if (typeof b.date === 'string') {
            dateB = b.date;
          } else {
            dateB = format(new Date(b.date), 'yyyy-MM-dd');
          }
        } catch (e) {
          dateB = '';
        }
        
        return dateA.localeCompare(dateB);
      });
    });

    return { sortedReasons, groupedByReason };
  }, [closedDates]);

  useEffect(() => {
    if (stylistHoursData) {
      // Convertir les données de l'API en format avec slots
      const converted: Record<string, StylistHour[]> = {};
      Object.keys(stylistHoursData).forEach((stylistId) => {
        const hours = stylistHoursData[stylistId] || [];
        converted[stylistId] = hours.map((h: any) => {
          // Si le styliste est fermé, pas de slots
          if (h.is_closed) {
            return {
              stylistId,
              day_of_week: h.day_of_week,
              open_time: h.open_time || '09:00',
              close_time: h.close_time || '18:00',
              is_closed: true,
              slots: [],
            };
          }
          // Si l'API retourne déjà des slots, les utiliser
          if (h.slots && Array.isArray(h.slots) && h.slots.length > 0) {
            return {
              stylistId,
              day_of_week: h.day_of_week,
              open_time: h.open_time || h.slots[0]?.openTime || '09:00',
              close_time: h.close_time || h.slots[h.slots.length - 1]?.closeTime || '18:00',
              is_closed: false,
              slots: h.slots.map((slot: any, idx: number) => ({
                id: slot.id || `slot-${h.day_of_week}-${idx}`,
                openTime: slot.openTime || slot.open_time || '09:00',
                closeTime: slot.closeTime || slot.close_time || '18:00',
              })),
            };
          }
          // Sinon, créer un slot avec les horaires (fallback pour compatibilité)
          return {
            stylistId,
            day_of_week: h.day_of_week,
            open_time: h.open_time || '09:00',
            close_time: h.close_time || '18:00',
            is_closed: false,
            slots: [{
              id: `slot-${h.day_of_week}-0`,
              openTime: h.open_time || '09:00',
              closeTime: h.close_time || '18:00',
            }],
          };
        });
      });
      setStylistHours(converted);
    }
  }, [stylistHoursData]);

  const updateSalonHoursMutation = useMutation({
    mutationFn: async (hours: SalonHour[]) => {
      if (!salon?.id) throw new Error("Salon ID manquant");
      // Convertir au format attendu par l'API (support de plusieurs créneaux par jour)
      const hoursToSave: any[] = [];
      hours
        .filter(h => !h.is_closed)
        .forEach(h => {
          const dayName = DAYS.find(d => d.value === h.day_of_week)?.label.toLowerCase() || "";
          // Si des slots sont définis, utiliser les slots, sinon utiliser les horaires de base
          if (h.slots && h.slots.length > 0) {
            h.slots.forEach(slot => {
              hoursToSave.push({
                dayOfWeek: dayName,
                openTime: slot.openTime,
                closeTime: slot.closeTime,
                isOpen: true,
              });
            });
          } else {
            // Fallback sur les horaires de base
            hoursToSave.push({
              dayOfWeek: dayName,
              openTime: h.open_time,
              closeTime: h.close_time,
              isOpen: true,
            });
          }
        });
      const response = await fetch(`/api/salons/${salon.id}/hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hours: hoursToSave }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la sauvegarde");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Horaires sauvegardés",
        description: "Les horaires du salon ont été mis à jour avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/salons", salon?.id, "hours"] });
      // Invalider aussi le cache de la landing page pour que les changements soient visibles
      queryClient.invalidateQueries({ queryKey: ["/api/public/salon"] });
      queryClient.invalidateQueries({ queryKey: ["/api/salon/hours"] });
      // Invalider les queries du calendrier pour synchronisation immédiate
      queryClient.invalidateQueries({ queryKey: ["/api/salons", salon?.id, "appointments"] });
      // Forcer le rechargement pour synchronisation immédiate
      queryClient.refetchQueries({ queryKey: ["/api/salons", salon?.id, "hours"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder les horaires.",
        variant: "destructive",
      });
    },
  });

  const updateStylistHoursMutation = useMutation({
    mutationFn: async ({ stylistId, hours }: { stylistId: string; hours: StylistHour[] }) => {
      if (!salon?.id) throw new Error("Salon ID manquant");
      
      console.log('[CLIENT] 📤 Envoi des horaires styliste:', {
        salonId: salon.id,
        stylistId,
        hoursCount: hours.length,
        hours: hours
      });
      
      const response = await fetch(`/api/salons/${salon.id}/stylist-hours/${stylistId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hours }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `Erreur ${response.status}` }));
        console.error('[CLIENT] ❌ Erreur lors de la sauvegarde:', error);
        
        // Si l'erreur contient des instructions SQL, les logger
        if (error.instructions) {
          console.error('[CLIENT] 📋 Instructions pour résoudre le problème:');
          error.instructions.forEach((instruction: string, index: number) => {
            console.error(`  ${instruction}`);
          });
          if (error.sql) {
            console.error('\n[CLIENT] 📋 Script SQL à exécuter dans Supabase:');
            console.error(error.sql);
          }
        }
        
        // Créer un objet d'erreur enrichi
        const errorObj: any = new Error(error.error || error.details || "Erreur lors de la sauvegarde");
        errorObj.instructions = error.instructions;
        errorObj.sql = error.sql;
        errorObj.sqlFile = error.sqlFile;
        throw errorObj;
      }
      
      const result = await response.json();
      console.log('[CLIENT] ✅ Horaires sauvegardés avec succès:', result);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Horaires sauvegardés",
        description: "Les horaires du ou de la coiffeur·euse ont été mis à jour avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/salons", salon?.id, "stylist-hours"] });
      // Invalider aussi les queries du calendrier pour synchronisation immédiate
      queryClient.invalidateQueries({ queryKey: ["/api/salons", salon?.id, "appointments"] });
      // Forcer le rechargement pour synchronisation immédiate
      queryClient.refetchQueries({ queryKey: ["/api/salons", salon?.id, "stylist-hours"] });
    },
    onError: (error: any) => {
      let errorMessage = error.message || "Impossible de sauvegarder les horaires.";
      
      // Si l'erreur indique que la table n'existe pas, afficher des instructions claires
      if (error.message?.includes('stylist_schedule introuvable') || error.message?.includes('Table stylist_schedule') || error.instructions) {
        errorMessage = "La table stylist_schedule n'existe pas. Ouvrez la console (F12) pour voir les instructions complètes.";
        console.error('❌ TABLE MANQUANTE - Instructions complètes:');
        if (error.instructions) {
          error.instructions.forEach((instruction: string) => {
            console.error(`  ${instruction}`);
          });
        }
        if (error.sql) {
          console.error('\n📋 Script SQL complet à copier dans Supabase SQL Editor:');
          console.error(error.sql);
        }
        if (error.sqlFile) {
          console.error(`\n📄 Ou ouvrez le fichier: ${error.sqlFile}`);
        }
      }
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
        duration: 10000, // Afficher plus longtemps pour les erreurs importantes
      });
    },
  });

  const addClosedDateMutation = useMutation({
    mutationFn: async (closedDate: ClosedDate) => {
      if (!salon?.id) {
        console.error('[addClosedDateMutation] Salon ID manquant, salon:', salon);
        throw new Error("Salon ID manquant. Veuillez rafraîchir la page.");
      }
      console.log('[addClosedDateMutation] Ajout date fermeture:', {
        salonId: salon.id,
        date: closedDate.date,
        reason: closedDate.reason,
        startTime: closedDate.startTime,
        endTime: closedDate.endTime,
        stylistId: closedDate.stylistId,
      });
      const response = await fetch(`/api/salons/${salon.id}/closed-dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: closedDate.date,
          reason: closedDate.reason,
          startTime: closedDate.startTime || undefined,
          endTime: closedDate.endTime || undefined,
          stylistId: closedDate.stylistId && closedDate.stylistId !== "all" ? closedDate.stylistId : undefined,
        }),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `Erreur ${response.status}: ${response.statusText}` }));
        console.error('[addClosedDateMutation] Erreur serveur:', error);
        
        // Créer un objet d'erreur enrichi avec les instructions
        const errorObj: any = new Error(error.error || "Erreur lors de l'ajout");
        errorObj.instructions = error.instructions;
        errorObj.sqlScript = error.sqlScript;
        throw errorObj;
      }
      const result = await response.json();
      
      // Vérifier si la réponse contient un avertissement concernant stylist_id
      if (result._warning) {
        console.warn('⚠️ AVERTISSEMENT:', result._warning);
        if (result._sqlScript) {
          console.warn('📋 Script SQL à exécuter dans Supabase:');
          console.warn(result._sqlScript);
        }
        // Afficher un toast d'avertissement
        toast({
          title: "Avertissement",
          description: result._warning,
          variant: "default",
          duration: 15000,
        });
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salons", salon?.id, "closed-dates"] });
      // Forcer le rechargement pour synchronisation immédiate
      queryClient.refetchQueries({ queryKey: ["/api/salons", salon?.id, "closed-dates"] });
    },
    onError: (error: any) => {
      let errorMessage = error.message || "Impossible d'ajouter la date de fermeture.";
      
      // Si l'erreur concerne stylist_id, afficher des instructions claires
      if (error.message?.includes('stylist_id') || error.instructions) {
        errorMessage = "La colonne stylist_id n'existe pas. Ouvrez la console (F12) pour voir les instructions.";
        console.error('❌ COLONNE STYLIST_ID MANQUANTE - Instructions complètes:');
        if (error.instructions) {
          error.instructions.forEach((instruction: string) => {
            console.error(`  ${instruction}`);
          });
        }
        if (error.sqlScript) {
          console.error('\n📋 Script SQL à copier dans Supabase SQL Editor:');
          console.error(error.sqlScript);
          console.error('\n💡 Instructions:');
          console.error('   1. Allez sur https://supabase.com/dashboard');
          console.error('   2. Sélectionnez votre projet');
          console.error('   3. Allez dans "SQL Editor"');
          console.error('   4. Copiez-collez le script ci-dessus');
          console.error('   5. Cliquez sur "Run"');
        }
      }
      
      // Si l'erreur contient des instructions SQL, les afficher dans la console
      if (error.sqlScript) {
        console.error('\n🔧 SOLUTION REQUISE:');
        console.error('La colonne stylist_id doit être ajoutée à votre base de données.');
        console.error('\n📋 Script SQL à exécuter dans Supabase SQL Editor:');
        console.error(error.sqlScript);
        console.error('\n💡 Instructions complètes:');
        if (error.instructions) {
          error.instructions.forEach((instruction: string) => {
            console.error(`  ${instruction}`);
          });
        }
      }
      
      toast({
        title: "Erreur",
        description: errorMessage + (error.sqlScript ? " Ouvrez la console (F12) pour voir les instructions." : ""),
        variant: "destructive",
        duration: 15000,
      });
    },
  });

  const deleteClosedDateMutation = useMutation({
    mutationFn: async (dateId: string) => {
      if (!salon?.id) throw new Error("Salon ID manquant");
      const response = await fetch(`/api/salons/${salon.id}/closed-dates/${dateId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la suppression");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Date de fermeture supprimée",
        description: "La date de fermeture a été supprimée avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/salons", salon?.id, "closed-dates"] });
      // Forcer le rechargement pour synchronisation immédiate
      queryClient.refetchQueries({ queryKey: ["/api/salons", salon?.id, "closed-dates"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la date de fermeture.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSalonHours = () => {
    // La mutation convertit déjà le format, on passe directement salonHours
    updateSalonHoursMutation.mutate(salonHours);
  };

  const handleSaveStylistHours = (stylistId: string) => {
    const hours = stylistHours[stylistId] || [];
    // Convertir les slots en format attendu par l'API (plusieurs créneaux par jour)
    const hoursToSend: StylistHour[] = [];
    hours.forEach(h => {
      if (h.is_closed) {
        // Si fermé, envoyer une seule entrée avec is_closed: true
        hoursToSend.push({
          stylistId,
          day_of_week: h.day_of_week,
          open_time: '',
          close_time: '',
          is_closed: true,
        });
      } else if (h.slots && h.slots.length > 0) {
        // Si ouvert avec des slots, envoyer une entrée par slot
        h.slots.forEach(slot => {
          hoursToSend.push({
            stylistId,
            day_of_week: h.day_of_week,
            open_time: slot.openTime,
            close_time: slot.closeTime,
            is_closed: false,
          });
        });
      } else {
        // Fallback : utiliser les horaires de base
        hoursToSend.push({
          stylistId,
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_closed: false,
        });
      }
    });
    updateStylistHoursMutation.mutate({ stylistId, hours: hoursToSend });
  };

  const handleAddClosedDate = async () => {
    if (!salon?.id) {
      toast({
        title: "Erreur",
        description: "Salon introuvable. Veuillez rafraîchir la page.",
        variant: "destructive",
      });
      return;
    }

    if (isDateRangeMode) {
      // Mode plage de dates
      if (!selectedDateRange?.from || !selectedDateRange?.to) {
        toast({
          title: "Erreur",
          description: "Veuillez sélectionner une plage de dates.",
          variant: "destructive",
        });
        return;
      }
      
      // Générer toutes les dates de la plage
      const dates: string[] = [];
      const currentDate = new Date(selectedDateRange.from);
      const endDate = new Date(selectedDateRange.to);
      
      while (currentDate <= endDate) {
        dates.push(format(currentDate, "yyyy-MM-dd"));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log('[handleAddClosedDate] Ajout plage de dates:', {
        from: selectedDateRange.from,
        to: selectedDateRange.to,
        dates,
        salonId: salon.id,
      });
      
      // Ajouter chaque date avec gestion d'erreur améliorée
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      for (const date of dates) {
        try {
          await new Promise<void>((resolve, reject) => {
            addClosedDateMutation.mutate(
              {
                date: date,
                reason: closedDateReason || `Fermeture du ${format(new Date(selectedDateRange.from!), "d MMMM", { locale: fr })} au ${format(new Date(selectedDateRange.to!), "d MMMM yyyy", { locale: fr })}`,
                startTime: closedDateStartTime || undefined,
                endTime: closedDateEndTime || undefined,
                stylistId: closedDateStylistId && closedDateStylistId !== "all" ? closedDateStylistId : undefined,
              },
              {
                onSuccess: () => {
                  successCount++;
                  resolve();
                },
                onError: (error) => {
                  // Si la date existe déjà, continuer
                  if (error.message?.includes("existe déjà")) {
                    successCount++;
                    resolve();
                  } else {
                    errorCount++;
                    errors.push(`${date}: ${error.message}`);
                    reject(error);
                  }
                },
              }
            );
          });
        } catch (error: any) {
          // Erreur déjà gérée dans onError
          console.error('[handleAddClosedDate] Erreur pour date:', date, error);
        }
      }
      
      // Afficher le résultat
      if (errorCount === 0) {
        toast({
          title: "Dates de fermeture ajoutées",
          description: `${successCount} date(s) de fermeture ajoutée(s) avec succès.`,
        });
        // Réinitialiser le formulaire après succès
        setSelectedDate(undefined);
        setSelectedDateRange(undefined);
        setClosedDateReason("");
        setClosedDateStartTime("");
        setClosedDateEndTime("");
        setClosedDateStylistId("all");
        setIsDialogOpen(false);
      } else {
        toast({
          title: "Résultat partiel",
          description: `${successCount} date(s) ajoutée(s), ${errorCount} erreur(s). ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`,
          variant: "destructive",
        });
        // Ne pas fermer le dialog s'il y a des erreurs pour permettre de réessayer
      }
    } else {
      // Mode date unique
      if (!selectedDate) {
        toast({
          title: "Erreur",
          description: "Veuillez sélectionner une date.",
          variant: "destructive",
        });
        return;
      }
      
      addClosedDateMutation.mutate({
        date: format(selectedDate, "yyyy-MM-dd"),
        reason: closedDateReason,
        startTime: closedDateStartTime || undefined,
        endTime: closedDateEndTime || undefined,
        stylistId: closedDateStylistId && closedDateStylistId !== "all" ? closedDateStylistId : undefined,
      }, {
        onSuccess: () => {
        // Réinitialiser le formulaire après succès
        setSelectedDate(undefined);
        setSelectedDateRange(undefined);
        setClosedDateReason("");
        setClosedDateStartTime("");
        setClosedDateEndTime("");
        setClosedDateStylistId("all");
        setIsDialogOpen(false);
      },
    });
    }
  };

  const handleDeleteClosedDate = (dateId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette date de fermeture ?")) {
      deleteClosedDateMutation.mutate(dateId);
    }
  };

  const initializeStylistHours = (stylistId: string) => {
    if (!stylistHours[stylistId]) {
      const initialHours: StylistHour[] = DAYS.map(day => ({
        stylistId,
        day_of_week: day.value,
        open_time: "09:00",
        close_time: "18:00",
        is_closed: true, // Par défaut fermé
        slots: [],
      }));
      setStylistHours({ ...stylistHours, [stylistId]: initialHours });
    }
  };

  // Séparer et trier les stylistes par statut (actifs/inactifs) et par date de modification
  const { activeStylists, inactiveStylists } = useMemo(() => {
    if (!stylistes || !Array.isArray(stylistes)) {
      return { activeStylists: [], inactiveStylists: [] };
    }
    
    const active = stylistes
      .filter((s: Stylist) => s.isActive !== false)
      .sort((a: Stylist, b: Stylist) => {
        const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bDate - aDate; // Plus récent en premier
      });
    
    const inactive = stylistes
      .filter((s: Stylist) => s.isActive === false)
      .sort((a: Stylist, b: Stylist) => {
        const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bDate - aDate; // Plus récent en premier
      });
    
    return { activeStylists: active, inactiveStylists: inactive };
  }, [stylistes]);

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
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="h-8 w-8" />
            Gestion des horaires
          </h1>
          <p className="text-muted-foreground mt-2">
            Configurez les horaires d'ouverture du salon, les horaires spécifiques des coiffeurs et coiffeuses et les dates de fermeture.
          </p>
        </div>

        <Tabs defaultValue="salon" className="space-y-6">
          <TabsList>
            <TabsTrigger value="salon">Horaires du salon</TabsTrigger>
            <TabsTrigger value="stylists">Horaires des coiffeur·euses</TabsTrigger>
            <TabsTrigger value="closed-dates">Dates de fermeture</TabsTrigger>
          </TabsList>

          {/* Horaires du salon */}
          <TabsContent value="salon">
            <Card>
              <CardHeader>
                <CardTitle>Horaires d'ouverture du salon</CardTitle>
                <CardDescription>
                  Définissez les horaires d'ouverture pour chaque jour de la semaine.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {DAYS.map((day) => {
                  const hour = salonHours.find(h => h.day_of_week === day.value);
                  if (!hour) return null;
                  
                  return (
                    <div key={day.value} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="w-24">
                        <Label className="font-semibold">{day.label}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!hour.is_closed}
                          onChange={(e) => {
                            const updated = salonHours.map(h =>
                              h.day_of_week === day.value
                                ? { ...h, is_closed: !e.target.checked }
                                : h
                            );
                            setSalonHours(updated);
                          }}
                          className="w-4 h-4"
                        />
                        <Label>Ouvert</Label>
                      </div>
                      {!hour.is_closed && (
                        <div className="flex-1 space-y-2">
                          {(hour.slots || [{ id: `slot-${day.value}-0`, openTime: hour.open_time || '09:00', closeTime: hour.close_time || '18:00' }]).map((slot, slotIndex) => (
                            <div key={slot.id || slotIndex} className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <Label>De</Label>
                                <Input
                                  type="time"
                                  value={slot.openTime}
                                  onChange={(e) => {
                                    const updated = salonHours.map(h => {
                                      if (h.day_of_week === day.value) {
                                        const updatedSlots = [...(h.slots || [])];
                                        updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], openTime: e.target.value };
                                        return { ...h, slots: updatedSlots, open_time: updatedSlots[0]?.openTime || h.open_time };
                                      }
                                      return h;
                                    });
                                    setSalonHours(updated);
                                  }}
                                  className="w-32"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label>À</Label>
                                <Input
                                  type="time"
                                  value={slot.closeTime}
                                  onChange={(e) => {
                                    const updated = salonHours.map(h => {
                                      if (h.day_of_week === day.value) {
                                        const updatedSlots = [...(h.slots || [])];
                                        updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], closeTime: e.target.value };
                                        return { ...h, slots: updatedSlots, close_time: updatedSlots[0]?.closeTime || h.close_time };
                                      }
                                      return h;
                                    });
                                    setSalonHours(updated);
                                  }}
                                  className="w-32"
                                />
                              </div>
                              {(hour.slots?.length || 1) > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const updated = salonHours.map(h => {
                                      if (h.day_of_week === day.value) {
                                        const updatedSlots = [...(h.slots || [])];
                                        updatedSlots.splice(slotIndex, 1);
                                        // Garder au moins un créneau
                                        if (updatedSlots.length === 0) {
                                          updatedSlots.push({ id: `slot-${day.value}-0`, openTime: '09:00', closeTime: '18:00' });
                                        }
                                        return { ...h, slots: updatedSlots };
                                      }
                                      return h;
                                    });
                                    setSalonHours(updated);
                                  }}
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = salonHours.map(h => {
                                if (h.day_of_week === day.value) {
                                  const newSlot: TimeSlot = {
                                    id: `slot-${day.value}-${Date.now()}`,
                                    openTime: '09:00',
                                    closeTime: '18:00',
                                  };
                                  return { ...h, slots: [...(h.slots || []), newSlot] };
                                }
                                return h;
                              });
                              setSalonHours(updated);
                            }}
                            className="mt-2"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Ajouter un créneau
                          </Button>
                        </div>
                      )}
                      {hour.is_closed && (
                        <Badge variant="secondary">Fermé</Badge>
                      )}
                    </div>
                  );
                })}
                <Button
                  onClick={handleSaveSalonHours}
                  disabled={updateSalonHoursMutation.isPending}
                  className="w-full"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateSalonHoursMutation.isPending ? "Sauvegarde..." : "Enregistrer les horaires du salon"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Horaires des coiffeur·euses */}
          <TabsContent value="stylists">
            <Card>
              <CardHeader>
                <CardTitle>Horaires spécifiques par coiffeur·euse</CardTitle>
                <CardDescription>
                  Définissez des horaires personnalisés pour chaque coiffeur·euse. Ces horaires doivent être dans les horaires d'ouverture du salon.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {tableCheck && !tableCheck.exists && (
                  <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 font-bold text-lg">⚠️ Action requise</span>
                    </div>
                    <p className="text-red-800 font-semibold">
                      La table <code className="bg-red-100 px-2 py-1 rounded">stylist_schedule</code> n'existe pas dans votre base de données Supabase.
                    </p>
                    <div className="bg-white rounded p-3 space-y-2">
                      <p className="font-semibold text-gray-800">Pour résoudre ce problème :</p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-700">
                        {tableCheck.instructions?.map((instruction: string, index: number) => (
                          <li key={index}>{instruction}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="bg-gray-100 rounded p-3">
                      <p className="text-sm font-mono text-gray-800 whitespace-pre-wrap">
                        {tableCheck.sql || 'Ouvrez le fichier supabase_create_stylist_schedule.sql et copiez son contenu dans Supabase SQL Editor'}
                      </p>
                    </div>
                    <p className="text-sm text-red-700">
                      Une fois la table créée, rechargez cette page et réessayez.
                    </p>
                  </div>
                )}
                {stylistes && Array.isArray(stylistes) && stylistes.length > 0 ? (
                  <>
                    {/* Section coiffeur·euses actif·ves */}
                    {activeStylists.length > 0 && (
                      <div className="mb-8">
                        <h3 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          Coiffeurs et coiffeuses actif·ves ({activeStylists.length})
                        </h3>
                        <div className="space-y-6">
                          {activeStylists.map((stylist: Stylist) => {
                            if (!stylistHours[stylist.id]) {
                              initializeStylistHours(stylist.id);
                            }
                            const hours = stylistHours[stylist.id] || [];
                            
                            return (
                              <div key={stylist.id} className="border rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="font-semibold text-lg">
                                    {stylist.firstName} {stylist.lastName}
                                  </h3>
                                  <div className="w-64">
                                    <ColorPicker
                                      value={stylist.color || "#6366f1"}
                                      onChange={async (color) => {
                                        if (!salon?.id) return;
                                        try {
                                          const response = await fetch(`/api/salons/${salon.id}/stylistes/${stylist.id}`, {
                                            method: "PUT",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ color }),
                                            credentials: "include",
                                          });
                                          if (!response.ok) {
                                            const errorData = await response.json().catch(() => ({}));
                                            throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
                                          }
                                          queryClient.invalidateQueries({ queryKey: ["/api/salons", salon.id, "stylistes"] });
                                          toast({
                                            title: "Couleur mise à jour",
                                            description: "La couleur du ou de la coiffeur·euse a été mise à jour.",
                                          });
                                        } catch (error: any) {
                                          console.error("Erreur mise à jour couleur:", error);
                                          toast({
                                            title: "Erreur",
                                            description: error.message || "Impossible de mettre à jour la couleur.",
                                            variant: "destructive",
                                          });
                                        }
                                      }}
                                      label="Couleur dans le calendrier"
                                    />
                                  </div>
                                </div>
                                {DAYS.map((day) => {
                                  const hour = hours.find(h => h.day_of_week === day.value);
                                  if (!hour) return null;
                                  
                                  const slots = hour.slots || [];
                                  
                                  return (
                                    <div key={day.value} className="space-y-2">
                                      <div className="flex items-center gap-4">
                                        <div className="w-24">
                                          <Label className="font-medium">{day.label}</Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={!hour.is_closed}
                                            onChange={(e) => {
                                              const updated = hours.map(h =>
                                                h.day_of_week === day.value
                                                  ? { 
                                                      ...h, 
                                                      is_closed: !e.target.checked,
                                                      slots: !e.target.checked ? [] : (h.slots && h.slots.length > 0 ? h.slots : [{ id: `slot-${day.value}-0`, openTime: '09:00', closeTime: '18:00' }])
                                                    }
                                                  : h
                                              );
                                              setStylistHours({ ...stylistHours, [stylist.id]: updated });
                                            }}
                                            className="w-4 h-4"
                                          />
                                          <Label>Disponible</Label>
                                        </div>
                                        {hour.is_closed && (
                                          <Badge variant="secondary">Indisponible</Badge>
                                        )}
                                      </div>
                                      {!hour.is_closed && (
                                        <div className="ml-28 space-y-2">
                                          {slots.map((slot, slotIndex) => (
                                            <div key={slot.id || slotIndex} className="flex items-center gap-2">
                                              <div className="flex items-center gap-2">
                                                <Label>De</Label>
                                                <Input
                                                  type="time"
                                                  value={slot.openTime}
                                                  onChange={(e) => {
                                                    const updated = hours.map(h => {
                                                      if (h.day_of_week === day.value && h.slots) {
                                                        const updatedSlots = h.slots.map((s, idx) =>
                                                          idx === slotIndex ? { ...s, openTime: e.target.value } : s
                                                        );
                                                        return { ...h, slots: updatedSlots };
                                                      }
                                                      return h;
                                                    });
                                                    setStylistHours({ ...stylistHours, [stylist.id]: updated });
                                                  }}
                                                  className="w-32"
                                                />
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Label>À</Label>
                                                <Input
                                                  type="time"
                                                  value={slot.closeTime}
                                                  onChange={(e) => {
                                                    const updated = hours.map(h => {
                                                      if (h.day_of_week === day.value && h.slots) {
                                                        const updatedSlots = h.slots.map((s, idx) =>
                                                          idx === slotIndex ? { ...s, closeTime: e.target.value } : s
                                                        );
                                                        return { ...h, slots: updatedSlots };
                                                      }
                                                      return h;
                                                    });
                                                    setStylistHours({ ...stylistHours, [stylist.id]: updated });
                                                  }}
                                                  className="w-32"
                                                />
                                              </div>
                                              {slots.length > 1 && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => {
                                                    const updated = hours.map(h => {
                                                      if (h.day_of_week === day.value && h.slots) {
                                                        const updatedSlots = h.slots.filter((_, idx) => idx !== slotIndex);
                                                        return { ...h, slots: updatedSlots };
                                                      }
                                                      return h;
                                                    });
                                                    setStylistHours({ ...stylistHours, [stylist.id]: updated });
                                                  }}
                                                  className="text-red-500 hover:text-red-700"
                                                >
                                                  <X className="h-4 w-4" />
                                                </Button>
                                              )}
                                            </div>
                                          ))}
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const updated = hours.map(h => {
                                                if (h.day_of_week === day.value) {
                                                  const newSlot: TimeSlot = {
                                                    id: `slot-${day.value}-${(h.slots?.length || 0)}`,
                                                    openTime: '13:00',
                                                    closeTime: '18:00',
                                                  };
                                                  return { ...h, slots: [...(h.slots || []), newSlot] };
                                                }
                                                return h;
                                              });
                                              setStylistHours({ ...stylistHours, [stylist.id]: updated });
                                            }}
                                            className="mt-2"
                                          >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Ajouter un créneau
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <Button
                                  onClick={() => handleSaveStylistHours(stylist.id)}
                                  disabled={updateStylistHoursMutation.isPending}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Save className="mr-2 h-4 w-4" />
                                  Enregistrer pour {stylist.firstName}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section coiffeur·euses inactif·ves */}
                    {inactiveStylists.length > 0 && (
                      <div>
                        <h3 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-500"></div>
                          Coiffeurs et coiffeuses inactif·ves ({inactiveStylists.length})
                        </h3>
                        <div className="space-y-6">
                          {inactiveStylists.map((stylist: Stylist) => {
                            if (!stylistHours[stylist.id]) {
                              initializeStylistHours(stylist.id);
                            }
                            const hours = stylistHours[stylist.id] || [];
                            
                            return (
                              <div key={stylist.id} className="border rounded-lg p-4 space-y-4 opacity-75">
                                <div className="flex items-center justify-between">
                                  <h3 className="font-semibold text-lg">
                                    {stylist.firstName} {stylist.lastName}
                                  </h3>
                                  <div className="w-64">
                                    <ColorPicker
                                      value={stylist.color || "#6366f1"}
                                      onChange={async (color) => {
                                        if (!salon?.id) return;
                                        try {
                                          const response = await fetch(`/api/salons/${salon.id}/stylistes/${stylist.id}`, {
                                            method: "PUT",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ color }),
                                            credentials: "include",
                                          });
                                          if (!response.ok) {
                                            const errorData = await response.json().catch(() => ({}));
                                            throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
                                          }
                                          queryClient.invalidateQueries({ queryKey: ["/api/salons", salon.id, "stylistes"] });
                                          toast({
                                            title: "Couleur mise à jour",
                                            description: "La couleur du ou de la coiffeur·euse a été mise à jour.",
                                          });
                                        } catch (error: any) {
                                          console.error("Erreur mise à jour couleur:", error);
                                          toast({
                                            title: "Erreur",
                                            description: error.message || "Impossible de mettre à jour la couleur.",
                                            variant: "destructive",
                                          });
                                        }
                                      }}
                                      label="Couleur dans le calendrier"
                                    />
                                  </div>
                                </div>
                                {DAYS.map((day) => {
                                  const hour = hours.find(h => h.day_of_week === day.value);
                                  if (!hour) return null;
                                  
                                  const slots = hour.slots || [];
                                  
                                  return (
                                    <div key={day.value} className="space-y-2">
                                      <div className="flex items-center gap-4">
                                        <div className="w-24">
                                          <Label className="font-medium">{day.label}</Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={!hour.is_closed}
                                            onChange={(e) => {
                                              const updated = hours.map(h =>
                                                h.day_of_week === day.value
                                                  ? { 
                                                      ...h, 
                                                      is_closed: !e.target.checked,
                                                      slots: !e.target.checked ? [] : (h.slots && h.slots.length > 0 ? h.slots : [{ id: `slot-${day.value}-0`, openTime: '09:00', closeTime: '18:00' }])
                                                    }
                                                  : h
                                              );
                                              setStylistHours({ ...stylistHours, [stylist.id]: updated });
                                            }}
                                            className="w-4 h-4"
                                          />
                                          <Label>Disponible</Label>
                                        </div>
                                        {hour.is_closed && (
                                          <Badge variant="secondary">Indisponible</Badge>
                                        )}
                                      </div>
                                      {!hour.is_closed && (
                                        <div className="ml-28 space-y-2">
                                          {slots.map((slot, slotIndex) => (
                                            <div key={slot.id || slotIndex} className="flex items-center gap-2">
                                              <div className="flex items-center gap-2">
                                                <Label>De</Label>
                                                <Input
                                                  type="time"
                                                  value={slot.openTime}
                                                  onChange={(e) => {
                                                    const updated = hours.map(h => {
                                                      if (h.day_of_week === day.value && h.slots) {
                                                        const updatedSlots = h.slots.map((s, idx) =>
                                                          idx === slotIndex ? { ...s, openTime: e.target.value } : s
                                                        );
                                                        return { ...h, slots: updatedSlots };
                                                      }
                                                      return h;
                                                    });
                                                    setStylistHours({ ...stylistHours, [stylist.id]: updated });
                                                  }}
                                                  className="w-32"
                                                />
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Label>À</Label>
                                                <Input
                                                  type="time"
                                                  value={slot.closeTime}
                                                  onChange={(e) => {
                                                    const updated = hours.map(h => {
                                                      if (h.day_of_week === day.value && h.slots) {
                                                        const updatedSlots = h.slots.map((s, idx) =>
                                                          idx === slotIndex ? { ...s, closeTime: e.target.value } : s
                                                        );
                                                        return { ...h, slots: updatedSlots };
                                                      }
                                                      return h;
                                                    });
                                                    setStylistHours({ ...stylistHours, [stylist.id]: updated });
                                                  }}
                                                  className="w-32"
                                                />
                                              </div>
                                              {slots.length > 1 && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => {
                                                    const updated = hours.map(h => {
                                                      if (h.day_of_week === day.value && h.slots) {
                                                        const updatedSlots = h.slots.filter((_, idx) => idx !== slotIndex);
                                                        return { ...h, slots: updatedSlots };
                                                      }
                                                      return h;
                                                    });
                                                    setStylistHours({ ...stylistHours, [stylist.id]: updated });
                                                  }}
                                                  className="text-red-500 hover:text-red-700"
                                                >
                                                  <X className="h-4 w-4" />
                                                </Button>
                                              )}
                                            </div>
                                          ))}
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const updated = hours.map(h => {
                                                if (h.day_of_week === day.value) {
                                                  const newSlot: TimeSlot = {
                                                    id: `slot-${day.value}-${(h.slots?.length || 0)}`,
                                                    openTime: '13:00',
                                                    closeTime: '18:00',
                                                  };
                                                  return { ...h, slots: [...(h.slots || []), newSlot] };
                                                }
                                                return h;
                                              });
                                              setStylistHours({ ...stylistHours, [stylist.id]: updated });
                                            }}
                                            className="mt-2"
                                          >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Ajouter un créneau
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <Button
                                  onClick={() => handleSaveStylistHours(stylist.id)}
                                  disabled={updateStylistHoursMutation.isPending}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Save className="mr-2 h-4 w-4" />
                                  Enregistrer pour {stylist.firstName}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeStylists.length === 0 && inactiveStylists.length === 0 && (
                      <p className="text-muted-foreground">Aucun·e coiffeur·euse disponible.</p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Aucun·e coiffeur·euse disponible.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dates de fermeture */}
          <TabsContent value="closed-dates">
            <Card>
              <CardHeader>
                <CardTitle>Dates de fermeture exceptionnelles</CardTitle>
                <CardDescription>
                  Définissez des dates spécifiques où le salon sera fermé (ex: Noël, jours fériés).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setIsDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter une date de fermeture
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Ajouter une date de fermeture</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* Mode de sélection */}
                      <div className="flex items-center justify-between">
                        <Label>Mode de sélection</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Date unique</span>
                          <Switch
                            checked={isDateRangeMode}
                            onCheckedChange={setIsDateRangeMode}
                          />
                          <span className="text-sm text-muted-foreground">Plage de dates</span>
                        </div>
                      </div>

                      {/* Sélection de date(s) */}
                      <div>
                        <Label>{isDateRangeMode ? "Plage de dates" : "Date"}</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {isDateRangeMode ? (
                                selectedDateRange?.from && selectedDateRange?.to ? (
                                  `${format(selectedDateRange.from, "PPP", { locale: fr })} - ${format(selectedDateRange.to, "PPP", { locale: fr })}`
                                ) : selectedDateRange?.from ? (
                                  `Du ${format(selectedDateRange.from, "PPP", { locale: fr })}...`
                                ) : (
                                  "Sélectionner une plage de dates"
                                )
                              ) : (
                                selectedDate ? format(selectedDate, "PPP", { locale: fr }) : "Sélectionner une date"
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode={isDateRangeMode ? "range" : "single"}
                              selected={isDateRangeMode ? selectedDateRange : selectedDate}
                              onSelect={(value) => {
                                if (isDateRangeMode) {
                                  setSelectedDateRange(value as { from?: Date; to?: Date });
                                } else {
                                  setSelectedDate(value as Date | undefined);
                                }
                              }}
                              locale={fr}
                              initialFocus
                              numberOfMonths={isDateRangeMode ? 2 : 1}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Sélection du ou de la coiffeur·euse (optionnel·le) */}
                      {stylistes && Array.isArray(stylistes) ? (
                        <div>
                          <Label>Coiffeur·euse (optionnel·le)</Label>
                          <Select
                            value={closedDateStylistId}
                            onValueChange={setClosedDateStylistId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Tou·te·s les coiffeur·euses (salon entier)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tou·te·s les coiffeur·euses (salon entier)</SelectItem>
                              {stylistes.length > 0 ? (
                                stylistes.map((stylist: Stylist) => (
                                  <SelectItem key={stylist.id} value={stylist.id}>
                                    {stylist.firstName} {stylist.lastName}
                                  </SelectItem>
                                ))
                              ) : null}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Sélectionnez un·e coiffeur·euse pour fermer uniquement cette personne, ou laissez "Tou·te·s les coiffeur·euses" pour fermer tout le salon.
                          </p>
                        </div>
                      ) : null}

                      {/* Heures de fermeture spécifiques (optionnel) */}
                      <div className="space-y-2">
                        <Label>Heures de fermeture spécifiques (optionnel)</Label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">De</Label>
                            <Input
                              type="time"
                              value={closedDateStartTime}
                              onChange={(e) => setClosedDateStartTime(e.target.value)}
                              placeholder="HH:mm"
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">À</Label>
                            <Input
                              type="time"
                              value={closedDateEndTime}
                              onChange={(e) => setClosedDateEndTime(e.target.value)}
                              placeholder="HH:mm"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Laissez vide pour fermer toute la journée. Ex: fermer plus tôt un jour férié (14:00 - 18:00).
                        </p>
                      </div>

                      {/* Raison */}
                      <div>
                        <Label>Raison (optionnel)</Label>
                        <Input
                          value={closedDateReason}
                          onChange={(e) => setClosedDateReason(e.target.value)}
                          placeholder="Ex: Noël, Jour de l'an, Vacances..."
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsDialogOpen(false);
                            setSelectedDate(undefined);
                            setSelectedDateRange(undefined);
        setClosedDateReason("");
        setClosedDateStartTime("");
        setClosedDateEndTime("");
        setClosedDateStylistId("all");
        setIsDateRangeMode(false);
                          }}
                        >
                          Annuler
                        </Button>
                        <Button
                          onClick={handleAddClosedDate}
                          disabled={addClosedDateMutation.isPending}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {addClosedDateMutation.isPending ? "Ajout..." : "Ajouter"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="space-y-4">
                  {groupedAndSortedDates ? (
                    (() => {
                      const { sortedReasons, groupedByReason } = groupedAndSortedDates;

                    return (
                      <Accordion type="multiple" className="space-y-2">
                        {sortedReasons.map((reason) => {
                          const dates = groupedByReason[reason];
                          const reasonId = reason.replace(/\s+/g, '-').toLowerCase();
                          
                          return (
                            <AccordionItem key={reason} value={reasonId} className="border rounded-lg px-4">
                              <div className="flex items-center justify-between pr-4">
                                <AccordionTrigger className="hover:no-underline py-4 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-base px-3 py-1">
                                      {reason}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                      ({dates.length} date{dates.length > 1 ? 's' : ''})
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Empêcher l'ouverture/fermeture de l'accordéon
                                    if (confirm(`Êtes-vous sûr de vouloir supprimer toutes les dates de "${reason}" (${dates.length} date${dates.length > 1 ? 's' : ''}) ?`)) {
                                      // Supprimer toutes les dates du groupe
                                      dates.forEach((date: any) => {
                                        handleDeleteClosedDate(date.id || date.date);
                                      });
                                    }
                                  }}
                                  disabled={deleteClosedDateMutation.isPending}
                                  className="ml-2"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Supprimer le groupe
                                </Button>
                              </div>
                              <AccordionContent>
                                <div className="space-y-2 pl-4 border-l-2 border-muted pt-2 pb-4">
                                  {dates.map((closedDate: any) => {
                                    // Gérer le format de date (string "2025-12-22" ou Date)
                                    let dateObj: Date;
                                    try {
                                      if (typeof closedDate.date === 'string') {
                                        dateObj = new Date(closedDate.date + 'T00:00:00');
                                      } else {
                                        dateObj = new Date(closedDate.date);
                                      }
                                    } catch (e) {
                                      console.error('[hours.tsx] Erreur parsing date:', closedDate.date, e);
                                      dateObj = new Date();
                                    }
                                    
                                    // Trouver le styliste si stylist_id est présent (gérer les deux formats: stylist_id de l'API et stylistId de l'interface)
                                    const stylistId = closedDate.stylist_id || closedDate.stylistId;
                                    const stylist = stylistId && stylistes ? stylistes.find((s: Stylist) => s.id === stylistId) : null;
                                    
                                    return (
                                      <div key={closedDate.id || closedDate.date} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                                        <div className="flex flex-col gap-1 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <CalendarIcon className="h-4 w-4" />
                                            <span className="font-medium">
                                              {format(dateObj, "EEEE d MMMM yyyy", { locale: fr })}
                                            </span>
                                            {stylistId && stylist ? (
                                              <Badge variant="secondary" className="ml-2">
                                                Coiffeur·euse: {stylist.firstName} {stylist.lastName}
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline" className="ml-2">
                                                Salon entier
                                              </Badge>
                                            )}
                                          </div>
                                          {(closedDate.start_time || closedDate.end_time || closedDate.startTime || closedDate.endTime) && (
                                            <span className="text-sm text-muted-foreground ml-6">
                                              Fermé de {(closedDate.start_time || closedDate.startTime || "00:00")} à {(closedDate.end_time || closedDate.endTime || "23:59")}
                                            </span>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteClosedDate(closedDate.id || closedDate.date)}
                                          disabled={deleteClosedDateMutation.isPending}
                                          className="text-destructive hover:text-destructive"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    );
                    })()
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Aucune date de fermeture définie.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

