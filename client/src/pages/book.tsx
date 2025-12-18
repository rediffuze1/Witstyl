import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Scissors, Clock, Euro, ArrowLeft, ArrowRight, Check, Home } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  isStylistAvailableOnDay,
  type StylistHours,
} from "@/utils/bookingSlots";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ProgressSteps from "@/components/ProgressSteps";

interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: string;
  tags: string[];
}

interface Stylist {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  specialties: string[];
  isActive?: boolean;
}

interface BookingFormData {
  serviceId: string;
  stylistId: string; // Peut être "none" pour "Sans préférences"
  date: Date | undefined;
  timeSlot: string;
  clientInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    notes: string;
  };
}

interface AvailabilitySlot {
  time: string;
  stylistIds: string[];
}

interface AvailabilityResponse {
  date: string;
  serviceId: string;
  stylistId: string;
  slotIntervalMinutes: number;
  slots: AvailabilitySlot[];
}

const DEFAULT_SLOT_STEP_MINUTES = 15;

export default function Book() {
  console.log('[Book] 🚀 Composant Book monté');
  
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isNewClient, setIsNewClient] = useState(false);
  
  // Log initial pour diagnostic
  useEffect(() => {
    console.log('[Book] ✅ Composant Book rendu avec succès');
    return () => {
      console.log('[Book] 🔄 Composant Book démonté');
    };
  }, []);
  const [formData, setFormData] = useState<BookingFormData>({
    serviceId: "",
    stylistId: "",
    date: undefined,
    timeSlot: "",
    clientInfo: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      notes: "",
    },
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Récupérer le salon depuis l'API publique
  const { data: salonData } = useQuery({
    queryKey: ["/api/public/salon"],
    queryFn: async () => {
      const response = await fetch("/api/public/salon");
      if (!response.ok) throw new Error("Failed to fetch salon");
      return response.json();
    },
  });

  // SOLUTION TEMPORAIRE: L'API /api/public/salon ne retourne pas l'ID
  // On utilise directement l'ID connu du salon depuis la base de données
  // ID du salon: salon-c152118c-478b-497b-98db-db37a4c58898
  // TODO: Corriger l'API /api/public/salon pour qu'elle retourne l'ID
  const salonId = salonData?.salon?.id || "salon-c152118c-478b-497b-98db-db37a4c58898";
  
  console.log('[Book] salonData:', salonData);
  console.log('[Book] salonId utilisé:', salonId);

  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/salons", salonId, "services"],
    queryFn: async () => {
      if (!salonId) return [];
      // Utiliser l'ID tel quel (l'API gère les deux formats)
      const response = await fetch(`/api/salons/${salonId}/services`, {
        credentials: 'include',
      });
      if (!response.ok) {
        console.error('[Book] Erreur chargement services:', response.status);
        return [];
      }
      return response.json();
    },
    enabled: !!salonId,
    retry: false,
  });

  const { data: stylists, isLoading: stylistsLoading } = useQuery<Stylist[]>({
    queryKey: ["/api/public/salon/stylistes"],
    queryFn: async () => {
      const response = await fetch("/api/public/salon/stylistes");
      if (!response.ok) {
        console.error('[Book] Erreur chargement stylistes:', response.status);
        return [];
      }
      return response.json();
    },
    retry: false,
  });

  const activeStylists = useMemo(
    () => (stylists || []).filter((stylist) => stylist && stylist.isActive !== false),
    [stylists]
  );

  const selectedService = (services || [])?.find((s: Service) => s.id === formData.serviceId);
  const selectedStylist = (stylists || [])?.find((s: Stylist) => s.id === formData.stylistId);

  // Récupérer les horaires du salon
  const { data: salonHoursData } = useQuery({
    queryKey: ["/api/salons", salonId, "hours"],
    queryFn: async () => {
      if (!salonId) return { hours: [] };
      const response = await fetch(`/api/salons/${salonId}/hours`, { credentials: 'include' });
      if (!response.ok) return { hours: [] };
      return response.json();
    },
    enabled: !!salonId,
    retry: false,
  });

  // Récupérer les dates de fermeture
  const { data: closedDates } = useQuery({
    queryKey: ["/api/salons", salonId, "closed-dates"],
    queryFn: async () => {
      if (!salonId) return [];
      const response = await fetch(`/api/salons/${salonId}/closed-dates`, { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!salonId,
    retry: false,
  });

  // Récupérer les disponibilités des stylistes
  const { data: stylistHoursData } = useQuery<{ hours: StylistHours }>({
    queryKey: ["/api/salons", salonId, "stylist-hours"],
    queryFn: async () => {
      if (!salonId) return { hours: {} };
      const response = await fetch(`/api/salons/${salonId}/stylist-hours`, { credentials: 'include' });
      if (!response.ok) return { hours: {} };
      return response.json();
    },
    enabled: !!salonId,
    retry: false,
  });

  // Fonction pour obtenir les informations de fermeture d'une date
  const getClosedDateInfo = (date: Date, stylistId?: string): { isClosed: boolean; startTime?: string; endTime?: string } => {
    if (!closedDates || !Array.isArray(closedDates) || closedDates.length === 0) {
      return { isClosed: false };
    }
    
    const dayStr = format(date, 'yyyy-MM-dd');
    
    // Chercher d'abord les fermetures spécifiques au styliste, puis les fermetures du salon entier
    const closedDate = closedDates.find((cd: any) => {
      let closedDateStr: string;
      if (typeof cd.date === 'string') {
        closedDateStr = cd.date.split('T')[0];
      } else {
        closedDateStr = format(new Date(cd.date), 'yyyy-MM-dd');
      }
      
      if (closedDateStr !== dayStr) return false;
      
      // Si un styliste est spécifié, vérifier les fermetures pour ce styliste ou le salon entier
      if (stylistId && stylistId !== "none") {
        return !cd.stylist_id || cd.stylist_id === stylistId;
      }
      
      // Sinon, vérifier uniquement les fermetures du salon entier
      return !cd.stylist_id;
    });
    
    if (!closedDate) return { isClosed: false };
    
    // Si la date a des heures de fermeture spécifiques
    if (closedDate.start_time || closedDate.end_time || closedDate.startTime || closedDate.endTime) {
      return {
        isClosed: true,
        startTime: closedDate.start_time || closedDate.startTime || '00:00',
        endTime: closedDate.end_time || closedDate.endTime || '23:59',
      };
    }
    
    // Date complètement fermée
    return { isClosed: true };
  };

  // Fonction pour vérifier si une date est fermée (pour le calendrier)
  // Une date n'est désactivée que si elle est complètement fermée (sans heures spécifiques) pour le salon entier
  // OU si le styliste sélectionné est indisponible ce jour-là
  const isDateClosed = (date: Date): boolean => {
    const info = getClosedDateInfo(date); // Vérifier les fermetures du salon entier
    // Si la date a des heures de fermeture spécifiques, elle n'est pas complètement fermée
    // donc elle reste sélectionnable (seuls les créneaux dans la période seront exclus)
    if (info.isClosed && info.startTime && info.endTime) {
      return false; // Date partiellement fermée, reste sélectionnable
    }
    if (info.isClosed) {
      return true; // Date complètement fermée pour le salon
    }

    // Vérifier si le styliste sélectionné est indisponible ce jour-là
    if (formData.stylistId && formData.stylistId !== "none") {
      const dayOfWeek = date.getDay();
      const isAvailable = isStylistAvailableOnDay(
        stylistHoursData?.hours,
        formData.stylistId,
        dayOfWeek
      );
      if (!isAvailable) {
        return true; // Styliste indisponible ce jour
      }
    }

    return false;
  };

  const availabilityParams = useMemo(() => {
    if (!formData.date || !selectedService || !formData.serviceId) {
      return null;
    }
    return {
      date: format(formData.date, "yyyy-MM-dd"),
      serviceId: formData.serviceId,
      stylistId: formData.stylistId && formData.stylistId !== "" ? formData.stylistId : "none",
    };
  }, [formData.date, formData.serviceId, formData.stylistId, selectedService]);

  const {
    data: availabilityData,
    isFetching: availabilityLoading,
    error: availabilityError,
  } = useQuery<AvailabilityResponse>({
    queryKey: availabilityParams ? ["/api/public/salon/availability", availabilityParams] : ["availability", null],
    queryFn: async () => {
      if (!availabilityParams) {
        return { date: "", serviceId: "", stylistId: "", slotIntervalMinutes: DEFAULT_SLOT_STEP_MINUTES, slots: [] };
      }
      const params = new URLSearchParams({
        date: availabilityParams.date,
        serviceId: availabilityParams.serviceId,
      });
      if (availabilityParams.stylistId) {
        params.set("stylistId", availabilityParams.stylistId);
      }

      const response = await fetch(`/api/public/salon/availability?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Impossible de charger les créneaux disponibles");
      }
      return response.json();
    },
    enabled: !!availabilityParams,
    staleTime: 0,
    retry: false,
  });

  const availableSlots = availabilityData?.slots?.map((slot) => slot.time) ?? [];
  const isAvailabilityLoading = availabilityLoading && !!availabilityParams;

  useEffect(() => {
    if (availabilityError) {
      console.error("[Book] Erreur lors du chargement des créneaux disponibles:", availabilityError);
    }
  }, [availabilityError]);

  // Grouper les services par catégorie (tags)
  // Utilise la fonction utilitaire pour gérer les services multi-catégories
  const servicesByCategory = useMemo(() => {
    if (!services || services.length === 0) return {};
    
    const grouped: { [key: string]: Service[] } = {};
    const defaultCategories = ["Homme", "Femme", "Enfant"];
    
    // Initialiser les catégories par défaut
    defaultCategories.forEach(category => {
      grouped[category] = [];
    });
    
    // Parcourir tous les services
    services.forEach((service: Service) => {
      // Si le service a des tags (catégories multiples)
      if (service.tags && Array.isArray(service.tags) && service.tags.length > 0) {
        // Ajouter le service à toutes les catégories où il apparaît
        service.tags.forEach((tag: string) => {
          if (!grouped[tag]) {
            grouped[tag] = [];
          }
          // Éviter les doublons
          if (!grouped[tag].find((s: Service) => s.id === service.id)) {
            grouped[tag].push(service);
          }
        });
      } else {
        // Service sans catégorie → "Autres"
        if (!grouped["Autres"]) {
          grouped["Autres"] = [];
        }
        if (!grouped["Autres"].find((s: Service) => s.id === service.id)) {
          grouped["Autres"].push(service);
        }
      }
    });
    
    console.log('[Book] servicesByCategory:', grouped);
    console.log('[Book] Object.entries(servicesByCategory):', Object.entries(grouped));
    return grouped;
  }, [services]);


  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const response = await apiRequest("POST", "/api/appointments", appointmentData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rendez-vous confirmé ✨",
        description: "Votre rendez-vous a été réservé avec succès!",
      });
      setStep(5); // Confirmation step
      // Invalider les queries pour rafraîchir les données
      if (salonId) {
        // Invalider les rendez-vous du salon (pour le calendrier owner)
        queryClient.invalidateQueries({ queryKey: ["/api/salons", salonId, "appointments"] });
      }
      // Invalider les rendez-vous client (pour le dashboard client)
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le rendez-vous. Veuillez réessayer.",
        variant: "destructive",
      });
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const response = await apiRequest("POST", "/api/clients", clientData);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(errorData.message || "Erreur lors de la création du client");
      }
      return response.json();
    },
  });

  const handleNext = () => {
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!formData.date || !formData.timeSlot || !selectedService || !salonId) return;

    try {
      // Create or get client
      const client = await createClientMutation.mutateAsync({
        ...formData.clientInfo,
        salonId: salonId,
      });
      
      // Vérifier si le client est nouveau
      // Un client est considéré comme nouveau si :
      // 1. createdAt et updatedAt sont très proches (moins de 5 secondes) ET
      // 2. createdAt est très récent (moins de 10 secondes)
      if (client.createdAt) {
        const createdAt = new Date(client.createdAt).getTime();
        const now = Date.now();
        const timeSinceCreation = now - createdAt;
        
        // Si le client a été créé il y a moins de 10 secondes, c'est probablement un nouveau client
        if (timeSinceCreation < 10000) {
          if (client.updatedAt) {
            const updatedAt = new Date(client.updatedAt).getTime();
            const timeDiff = Math.abs(updatedAt - createdAt);
            // Si createdAt et updatedAt sont très proches, c'est un nouveau client
            setIsNewClient(timeDiff < 5000);
          } else {
            // Si pas d'updatedAt mais createdAt très récent, c'est un nouveau client
            setIsNewClient(true);
          }
        } else {
          // Client créé il y a plus de 10 secondes = client existant
          setIsNewClient(false);
        }
      } else {
        // Si pas de createdAt, considérer comme nouveau client par défaut
        setIsNewClient(true);
      }
      
      const wasNoPreference = formData.stylistId === "none";

      // Parse the selected time slot
      const [hours, minutes] = formData.timeSlot.split(':').map(Number);
      const startTime = new Date(formData.date);
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + selectedService.durationMinutes);

      // Si "Sans préférences" est sélectionné, trouver un styliste disponible à ce créneau
      let finalStylistId = formData.stylistId;
      if (wasNoPreference) {
        // Récupérer tous les rendez-vous à ce créneau
        const dayStart = new Date(formData.date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(formData.date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const appointmentsResponse = await fetch(
          `/api/salons/${salonId}/appointments?startDate=${dayStart.toISOString()}&endDate=${dayEnd.toISOString()}`,
          { credentials: 'include' }
        );
        
        if (appointmentsResponse.ok) {
          const allAppointments = await appointmentsResponse.json();
          
          // Trouver un styliste disponible (non occupé à ce créneau)
          const occupiedStylistIds = new Set(
            allAppointments
              .filter((apt: any) => {
                const aptStart = new Date(apt.startTime || apt.appointmentDate);
                const aptEnd = new Date(apt.endTime || new Date(aptStart.getTime() + (apt.duration || selectedService.durationMinutes) * 60000));
                return startTime < aptEnd && endTime > aptStart;
              })
              .map((apt: any) => apt.stylistId)
          );
          
          // Prendre le premier styliste disponible
          const availableStylist = (stylists || []).find((s: Stylist) => !occupiedStylistIds.has(s.id));
          if (availableStylist) {
            finalStylistId = availableStylist.id;
            console.log('[Book] Styliste auto-assigné:', availableStylist.firstName, availableStylist.lastName);
          } else {
            // Si aucun styliste n'est disponible, prendre le premier styliste (le système assignera)
            finalStylistId = (stylists || [])[0]?.id || "";
            console.warn('[Book] Aucun styliste disponible, utilisation du premier styliste');
          }
        }
      }

      // Create appointment
      const appointmentData = {
        salonId: salonId,
        clientId: client.id,
        stylistId: finalStylistId,
        serviceId: formData.serviceId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalAmount: selectedService.price,
        status: "confirmed",
        channel: "form",
        notes: formData.clientInfo.notes,
        stylistPreference: wasNoPreference ? "none" : "specific",
      };

      await createAppointmentMutation.mutateAsync(appointmentData);
      
      // Afficher un message de succès
      toast({
        title: "Réservation confirmée !",
        description: `Votre rendez-vous du ${format(formData.date, "EEEE d MMMM yyyy", { locale: fr })} à ${formData.timeSlot} a été confirmé.`,
      });
      
      // La page de confirmation (step 5) sera affichée via createAppointmentMutation.onSuccess
      // L'utilisateur pourra cliquer sur "Accueil" quand il le souhaite
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      toast({
        title: "Erreur",
        description: error?.message || "Une erreur est survenue lors de la création de la réservation. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  // Logs de débogage (désactivés en production)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Book] État du chargement:', JSON.stringify({
      step: step,
      servicesLoading: servicesLoading,
      stylistsLoading: stylistsLoading,
      servicesCount: services?.length || 0,
      stylistsCount: stylists?.length || 0,
      salonId: salonId
    }, null, 2));
    console.log('[Book] Services:', services);
  }
  
  // Gestion d'erreur pour les queries
  const servicesError = (servicesLoading || stylistsLoading) ? null : (!services || services.length === 0);
  
  if (servicesLoading || stylistsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Chargement des services...</p>
        </div>
      </div>
    );
  }
  
  if (!services || services.length === 0) {
    console.warn('[Book] ⚠️ Aucun service disponible');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold text-foreground">Aucun service disponible</h1>
          <p className="text-muted-foreground">
            Il n'y a actuellement aucun service disponible pour la réservation.
          </p>
          <Button onClick={() => setLocation('/')} variant="outline">
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Navigation bar with logo and home button */}
      <header className="bg-white/80 backdrop-blur-md border-b border-border/40 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div
              className="flex items-center space-x-3 cursor-pointer"
              onClick={() => setLocation('/')}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Scissors className="text-white text-sm" />
              </div>
              <span className="text-xl font-bold text-foreground">Witstyl</span>
            </div>
            <Button
              variant="ghost"
              onClick={() => setLocation('/')}
              className="flex items-center space-x-2"
            >
              <Home className="h-4 w-4" />
              <span>Accueil</span>
            </Button>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {/* Progress Steps - Barre d'avancement animée */}
        <div className="mb-10 sticky top-20 z-40 bg-background/90 backdrop-blur-sm py-4 px-6 rounded-2xl shadow-sm max-w-4xl mx-auto">
          <ProgressSteps
            totalSteps={4}
            currentStep={step}
            labels={["Service", "Coiffeur·euse", "Date & Heure", "Informations"]}
            discrete={true}
          />
        </div>

        <div className="max-w-2xl mx-auto">

          {/* Step 1: Service Selection */}
          {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Scissors className="mr-2 h-5 w-5" />
                  Choisissez votre service
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  {(!services || services.length === 0) ? (
                    <div className="text-center text-muted-foreground py-8">
                      Aucun service disponible pour le moment.
                    </div>
                  ) : (
                    <Accordion 
                      type="multiple" 
                      defaultValue={[]}
                      className="w-full"
                    >
                      {Object.entries(servicesByCategory).map(([category, categoryServices]) => {
                        console.log('[Book] Rendering category:', category, 'services:', categoryServices, 'isArray:', Array.isArray(categoryServices), 'length:', Array.isArray(categoryServices) ? categoryServices.length : 0);
                        return (
                          <AccordionItem key={category} value={category}>
                          <AccordionTrigger className="text-left font-semibold">
                              {category}
                            </AccordionTrigger>
                            <AccordionContent>
                            <div className="space-y-3 pt-2">
                                {categoryServices.map((service: Service) => (
                                  <div
                                    key={service.id}
                                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                      formData.serviceId === service.id
                                      ? 'border-primary bg-primary/5'
                                      : 'border-border hover:border-primary/50'
                                    }`}
                                    onClick={() => setFormData({ ...formData, serviceId: service.id })}
                                    data-testid={`service-option-${service.id}`}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h3 className="font-semibold">{service.name}</h3>
                                      {service.description && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {service.description}
                                        </p>
                                      )}
                                        <div className="flex items-center space-x-4 mt-2 text-sm">
                                          <span className="flex items-center">
                                            <Clock className="mr-1 h-4 w-4" />
                                          {service.durationMinutes} min
                                          </span>
                                          <span className="flex items-center">
                                            <Euro className="mr-1 h-4 w-4" />
                                          {service.price}€
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                
                  <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleNext} 
                    disabled={!formData.serviceId}
                    data-testid="button-next-service"
                  >
                    Suivant <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Coiffeur·euse Selection */}
          {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Choisissez votre coiffeur·euse</CardTitle>
              </CardHeader>
                <CardContent className="space-y-4">
                  {/* Option "Sans préférences" */}
                  <div
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.stylistId === "none"
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setFormData({ ...formData, stylistId: "none" })}
                    data-testid="stylist-option-none"
                >
                  <div className="flex items-start space-x-3">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-medium">
                        <Scissors className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Sans préférences</h3>
                      <p className="text-sm text-muted-foreground">
                          Affiche tous les créneaux disponibles de tou·te·s les coiffeur·euses
                      </p>
                    </div>
                  </div>
                </div>

                  {/* Liste des coiffeur·euses */}
                  {(stylists || [])?.map((stylist: Stylist) => (
                  <div
                    key={stylist.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.stylistId === stylist.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                    }`}
                      onClick={() => setFormData({ ...formData, stylistId: stylist.id })}
                    data-testid={`stylist-option-${stylist.id}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-medium">
                        {stylist.firstName[0]}{stylist.lastName[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold">{stylist.firstName} {stylist.lastName}</h3>
                        <p className="text-sm text-muted-foreground">
                            Spécialités: {stylist.specialties?.join(', ') || 'Aucune'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={handleBack} data-testid="button-back-stylist">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                  </Button>
                  <Button 
                    onClick={handleNext} 
                    disabled={!formData.stylistId || formData.stylistId === ""}
                    data-testid="button-next-stylist"
                  >
                    Suivant <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Date & Time Selection */}
          {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Choisissez la date et l'heure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                    <Label className="mb-3 block">Date</Label>
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date: Date | undefined) => setFormData({ ...formData, date, timeSlot: "" })}
                    disabled={(date: Date) => {
                      // Désactiver les dates passées
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      if (date < today) return true;
                      
                      // Désactiver les dates de fermeture exceptionnelles ou jours où le styliste est indisponible
                      if (isDateClosed(date)) return true;
                      
                      // Désactiver les jours où le salon est fermé (si pas de styliste sélectionné ou "Sans préférences")
                      if (!formData.stylistId || formData.stylistId === "none") {
                        if (salonHoursData?.hours) {
                          const dayOfWeek = date.getDay();
                          const dayHours = salonHoursData.hours.filter((h: any) => h.day_of_week === dayOfWeek);
                          
                          // Si le jour est marqué comme fermé ou s'il n'y a pas d'horaires pour ce jour
                          const isClosed = dayHours.length === 0 || dayHours.every((h: any) => h.is_closed);
                          if (isClosed) return true;
                        }
                      }
                      
                      return false;
                    }}
                    locale={fr}
                    className="rounded-md border"
                  />
                </div>
                
                    {formData.date && (
                      <div>
                        <Label className="mb-3 block">Heure</Label>
                        {isAvailabilityLoading ? (
                          <p className="text-sm text-muted-foreground py-4">
                            Chargement des créneaux disponibles…
                          </p>
                        ) : availableSlots.length > 0 ? (
                          <div className="grid grid-cols-4 gap-2">
                            {availableSlots.map((time: string) => (
                              <Button
                                key={time}
                                variant={formData.timeSlot === time ? 'default' : 'outline'}
                                onClick={() => setFormData({ ...formData, timeSlot: time })}
                                className="text-sm"
                              >
                                {time}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground py-4">
                            {formData.stylistId === "none" 
                              ? "Aucun créneau disponible pour ce service cette date parmi tou·te·s les coiffeur·euses. Veuillez choisir un autre horaire."
                              : "Aucun créneau disponible pour ce service cette date avec ce ou cette coiffeur·euse. Veuillez choisir un autre horaire."}
                          </p>
                        )}
                      </div>
                    )}
                
                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={handleBack} data-testid="button-back-datetime">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                  </Button>
                  <Button 
                    onClick={handleNext} 
                    disabled={!formData.date || !formData.timeSlot}
                    data-testid="button-next-datetime"
                  >
                    Suivant <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Client Information */}
          {step === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle>Vos informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      id="firstName"
                      value={formData.clientInfo.firstName}
                      onChange={(e) => setFormData({
                        ...formData,
                        clientInfo: { ...formData.clientInfo, firstName: e.target.value }
                      })}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      id="lastName"
                      value={formData.clientInfo.lastName}
                      onChange={(e) => setFormData({
                        ...formData,
                        clientInfo: { ...formData.clientInfo, lastName: e.target.value }
                      })}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.clientInfo.email}
                    onChange={(e) => setFormData({
                      ...formData,
                      clientInfo: { ...formData.clientInfo, email: e.target.value }
                    })}
                    data-testid="input-email"
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={formData.clientInfo.phone}
                    onChange={(e) => setFormData({
                      ...formData,
                      clientInfo: { ...formData.clientInfo, phone: e.target.value }
                    })}
                    data-testid="input-phone"
                  />
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes (optionnel)</Label>
                  <Textarea
                    id="notes"
                    value={formData.clientInfo.notes}
                    onChange={(e) => setFormData({
                      ...formData,
                      clientInfo: { ...formData.clientInfo, notes: e.target.value }
                    })}
                    placeholder="Informations supplémentaires..."
                    data-testid="input-notes"
                  />
                </div>

                {/* Booking Summary */}
                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Récapitulatif</h3>
                    <div className="space-y-1 text-sm">
                    <p><strong>Service:</strong> {selectedService?.name}</p>
                      <p><strong>Coiffeur·euse:</strong> {selectedStylist?.firstName} {selectedStylist?.lastName}</p>
                    <p><strong>Date:</strong> {formData.date && format(formData.date, 'EEEE d MMMM yyyy', { locale: fr })}</p>
                    <p><strong>Heure:</strong> {formData.timeSlot}</p>
                      <p><strong>Prix:</strong> {selectedService?.price}€</p>
                  </div>
                </div>
                
                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={handleBack} data-testid="button-back-info">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={!formData.clientInfo.firstName || !formData.clientInfo.lastName || !formData.clientInfo.email || createAppointmentMutation.isPending}
                    data-testid="button-confirm-booking"
                  >
                    {createAppointmentMutation.isPending ? "Confirmation..." : "Confirmer la réservation"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Confirmation */}
          {step === 5 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-center text-primary">
                    <Check className="mx-auto h-12 w-12 mb-4" />
                  Rendez-vous confirmé !
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-lg">
                  Votre rendez-vous a été réservé avec succès.
                </p>
                
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Détails de votre rendez-vous</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Service:</strong> {selectedService?.name}</p>
                    <p><strong>Coiffeur·euse:</strong> {selectedStylist?.firstName} {selectedStylist?.lastName}</p>
                    <p><strong>Date:</strong> {formData.date && format(formData.date, 'EEEE d MMMM yyyy', { locale: fr })}</p>
                    <p><strong>Heure:</strong> {formData.timeSlot}</p>
                    <p><strong>Prix:</strong> {selectedService?.price}€</p>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Un email de confirmation vous a été envoyé à {formData.clientInfo.email}
                </p>
                
                {/* Message différent selon si le client est nouveau ou existant */}
                {isNewClient ? (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                      Accéder à votre espace client
                    </h4>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2 text-left">
                      <p>
                        <strong>Comment accéder à votre espace client :</strong>
                      </p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Cliquez sur le bouton "Espace client" ci-dessous ou allez sur la page de connexion</li>
                        <li>Entrez votre email : <strong>{formData.clientInfo.email}</strong></li>
                        <li><strong>Important :</strong> Comme c'est votre première connexion, vous devez définir un mot de passe. Cliquez sur <strong>"Mot de passe oublié"</strong> pour recevoir un lien de réinitialisation par email</li>
                        <li>Une fois votre mot de passe défini, vous pourrez vous connecter et voir tous vos rendez-vous</li>
                      </ol>
                      <p className="mt-2">
                        💡 <strong>Astuce :</strong> Le lien de réinitialisation de mot de passe vous permettra de créer votre mot de passe pour la première fois.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                      Accéder à votre espace client
                    </h4>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Vous avez déjà un compte client. Rendez-vous sur votre <strong>espace client existant</strong> pour voir tous vos rendez-vous et gérer votre profil.
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                      Connectez-vous avec votre email : <strong>{formData.clientInfo.email}</strong>
                    </p>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <Button 
                    onClick={() => window.location.href = "/"}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-back-home"
                  >
                    Accueil
                  </Button>
                  <Button 
                    onClick={() => setLocation("/client-login")}
                    className="flex-1"
                    data-testid="button-client-space"
                  >
                    Espace client
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
