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
import { Scissors, Clock, Euro, ArrowLeft, ArrowRight, Check, Home, User } from "lucide-react";
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
import { useAuthContext } from "@/contexts/AuthContext";

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

export default function BookClient() {
  const [, setLocation] = useLocation();
  const { client, isAuthenticated } = useAuthContext();
  const [step, setStep] = useState(1);
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

  // Pré-remplir les informations du client connecté
  useEffect(() => {
    if (client && isAuthenticated) {
      setFormData(prev => ({
        ...prev,
        clientInfo: {
          firstName: client.firstName || "",
          lastName: client.lastName || "",
          email: client.email || "",
          phone: client.phone || "",
          notes: "",
        },
      }));
    }
  }, [client, isAuthenticated]);

  // Rediriger si non connecté
  useEffect(() => {
    if (!isAuthenticated && client === null) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour prendre un rendez-vous.",
        variant: "destructive",
      });
      setLocation("/client-login");
    }
  }, [isAuthenticated, client, setLocation, toast]);

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
  
  console.log('[BookClient] salonData:', salonData);
  console.log('[BookClient] salonId utilisé:', salonId);

  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/salons", salonId, "services"],
    queryFn: async () => {
      if (!salonId) return [];
      // Utiliser l'ID tel quel (l'API gère les deux formats)
      const response = await fetch(`/api/salons/${salonId}/services`, {
        credentials: 'include',
      });
      if (!response.ok) {
        console.error('[BookClient] Erreur chargement services:', response.status);
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
        console.error('[BookClient] Erreur chargement stylistes:', response.status);
        return [];
      }
      return response.json();
    },
    retry: false,
  });

  const selectedService = (services || [])?.find((s: Service) => s.id === formData.serviceId);
  const selectedStylist = (stylists || [])?.find((s: Stylist) => s.id === formData.stylistId);

  // Récupérer les rendez-vous pour la date sélectionnée (si une date est sélectionnée)
  // Récupérer les horaires du salon
  const salonHours = salonData?.hours || [];

  const { data: closedDates } = useQuery({
    queryKey: ["/api/public/salon/closed-dates"],
    queryFn: async () => {
      const response = await fetch("/api/public/salon/closed-dates");
      if (!response.ok) return [];
      return response.json();
    },
    retry: false,
  });

  const { data: stylistHoursData } = useQuery<{ hours: StylistHours }>({
    queryKey: ["/api/public/salon/stylist-hours"],
    queryFn: async () => {
      const response = await fetch("/api/public/salon/stylist-hours");
      if (!response.ok) return { hours: {} };
      return response.json();
    },
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
    queryKey: availabilityParams ? ["/api/public/salon/availability", availabilityParams] : ["availability-client", null],
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
      console.error("[BookClient] Erreur lors du chargement des créneaux disponibles:", availabilityError);
    }
  }, [availabilityError]);

  // Grouper les services par catégorie (tags)
  // Utilise la même logique que /book pour gérer les services multi-catégories
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
    
    console.log('[BookClient] servicesByCategory:', grouped);
    console.log('[BookClient] Object.entries(servicesByCategory):', Object.entries(grouped));
    return grouped;
  }, [services]);


  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appointmentData),
        credentials: "include",
      });
      
      if (!response.ok) {
        // Essayer de parser le message d'erreur JSON du serveur
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
        title: "Rendez-vous confirmé ✨",
        description: "Votre rendez-vous a été réservé avec succès!",
      });
      setStep(5); // Confirmation step
      // Invalider uniquement les queries client (pas les queries owner qui nécessitent une auth différente)
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Impossible de créer le rendez-vous. Veuillez réessayer.";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!formData.date || !formData.timeSlot || !selectedService || !salonId || !client) return;

    try {
      const wasNoPreference = formData.stylistId === "none";

      // Parse the selected time slot
      const [hours, minutes] = formData.timeSlot.split(':').map(Number);
      const startTime = new Date(formData.date);
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + selectedService.durationMinutes);

      // Create appointment avec l'ID du client connecté
      console.log('[BookClient] Création rendez-vous avec clientId:', client.id);
      console.log('[BookClient] Client complet:', JSON.stringify(client, null, 2));
      
      const appointmentData = {
        salonId: salonId,
        clientId: client.id, // Utiliser l'ID du client connecté
        stylistId: formData.stylistId || (wasNoPreference ? "none" : ""),
        serviceId: formData.serviceId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalAmount: selectedService.price,
        status: "confirmed", // Statut confirmé par défaut
        channel: "form",
        notes: formData.clientInfo.notes,
        clientInfo: {
          firstName: formData.clientInfo.firstName,
          lastName: formData.clientInfo.lastName,
          email: formData.clientInfo.email,
          phone: formData.clientInfo.phone,
        },
        stylistPreference: wasNoPreference ? "none" : "specific",
      };
      
      console.log('[BookClient] Données du rendez-vous à envoyer:', JSON.stringify(appointmentData, null, 2));

      await createAppointmentMutation.mutateAsync(appointmentData);
      
      // Afficher un message de succès
      toast({
        title: "Réservation confirmée !",
        description: `Votre rendez-vous du ${format(formData.date, "EEEE d MMMM yyyy", { locale: fr })} à ${formData.timeSlot} a été confirmé.`,
      });
      
      // La page de confirmation (step 5) sera affichée via createAppointmentMutation.onSuccess
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
    console.log('[BookClient] État du chargement:', JSON.stringify({
      step: step,
      servicesLoading: servicesLoading,
      stylistsLoading: stylistsLoading,
      servicesCount: services?.length || 0,
      stylistsCount: stylists?.length || 0,
      salonId: salonId,
      client: client
    }, null, 2));
    console.log('[BookClient] Services:', services);
  }
  
  if (servicesLoading || stylistsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (!services || services.length === 0) {
    console.warn('[BookClient] ⚠️ Aucun service disponible');
  }

  if (!isAuthenticated || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Chargement...</p>
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
              onClick={() => setLocation('/client-dashboard')}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Scissors className="text-white text-sm" />
              </div>
              <span className="text-xl font-bold text-foreground">Witstyl</span>
            </div>
            <Button
              variant="ghost"
              onClick={() => setLocation('/client-dashboard')}
              className="flex items-center space-x-2"
            >
              <Home className="h-4 w-4" />
              <span>Tableau de bord</span>
            </Button>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
          
          {/* Progress Steps - Barre d'avancement animée */}
          <div className="mb-8 sticky top-20 z-40 bg-background/80 backdrop-blur-sm py-4 -mx-4 px-4 rounded-lg">
            <ProgressSteps
              totalSteps={4}
              currentStep={step}
              labels={["Service", "Coiffeur·euse", "Date & Heure", "Confirmation"]}
              discrete={true}
            />
          </div>

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
                        console.log('[BookClient] Rendering category:', category, 'services:', categoryServices, 'isArray:', Array.isArray(categoryServices), 'length:', Array.isArray(categoryServices) ? categoryServices.length : 0);
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

                  {/* Liste des stylistes */}
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
                      // Désactiver les dates de fermeture exceptionnelles
                      if (isDateClosed(date)) return true;
                      // Désactiver les dates passées
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (date < today) return true;
                        
                        // Désactiver les jours où le salon est fermé
                        if (salonHours?.length) {
                          const dayOfWeek = date.getDay();
                          const dayHours = salonHours.filter((h: any) => h.day_of_week === dayOfWeek);
                          
                          // Si le jour est marqué comme fermé ou s'il n'y a pas d'horaires pour ce jour
                          const isClosed = dayHours.length === 0 || dayHours.every((h: any) => h.is_closed);
                          if (isClosed) return true;
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
                              ? "Aucun créneau disponible pour cette date parmi tou·te·s les coiffeur·euses."
                              : "Aucun créneau disponible pour cette date avec ce ou cette coiffeur·euse."}
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

          {/* Step 4: Confirmation avec informations pré-remplies */}
          {step === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="mr-2 h-5 w-5" />
                    Confirmer votre réservation
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Informations du client (affichage seulement) */}
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <h3 className="font-semibold mb-3 flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    Vos informations
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground">Prénom:</span>
                        <p className="font-medium">{client.firstName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nom:</span>
                        <p className="font-medium">{client.lastName}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{client.email}</p>
                    </div>
                    {client.phone && (
                      <div>
                        <span className="text-muted-foreground">Téléphone:</span>
                        <p className="font-medium">{client.phone}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    💡 Pour modifier vos informations, rendez-vous dans vos paramètres.
                  </p>
                </div>

                {/* Notes optionnelles */}
                <div>
                  <Label htmlFor="notes">Notes pour le salon (optionnel)</Label>
                  <Textarea
                    id="notes"
                    value={formData.clientInfo.notes}
                    onChange={(e) => setFormData({
                      ...formData,
                      clientInfo: { ...formData.clientInfo, notes: e.target.value }
                    })}
                    placeholder="Informations supplémentaires, préférences particulières..."
                    data-testid="input-notes"
                    className="min-h-[100px]"
                  />
                </div>

                {/* Booking Summary */}
                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Récapitulatif de votre réservation</h3>
                    <div className="space-y-1 text-sm">
                    <p><strong>Service:</strong> {selectedService?.name}</p>
                      <p><strong>Coiffeur·euse:</strong> {formData.stylistId === "none" ? "Sans préférences" : `${selectedStylist?.firstName} ${selectedStylist?.lastName}`}</p>
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
                    disabled={createAppointmentMutation.isPending}
                    data-testid="button-confirm-booking"
                    className="min-w-[200px]"
                  >
                    {createAppointmentMutation.isPending ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Confirmation...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Confirmer la réservation
                      </>
                    )}
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
                    <p><strong>Coiffeur·euse:</strong> {formData.stylistId === "none" ? "Sans préférences" : `${selectedStylist?.firstName} ${selectedStylist?.lastName}`}</p>
                    <p><strong>Date:</strong> {formData.date && format(formData.date, 'EEEE d MMMM yyyy', { locale: fr })}</p>
                    <p><strong>Heure:</strong> {formData.timeSlot}</p>
                    <p><strong>Prix:</strong> {selectedService?.price}€</p>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Un email de confirmation vous a été envoyé à {client.email}
                </p>
                
                <div className="flex gap-3">
                  <Button 
                    onClick={() => setLocation("/client-dashboard")}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-back-dashboard"
                  >
                    Tableau de bord
                  </Button>
                  <Button 
                    onClick={() => setLocation("/client-appointments")}
                    className="flex-1"
                    data-testid="button-appointments"
                  >
                    Mes rendez-vous
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

