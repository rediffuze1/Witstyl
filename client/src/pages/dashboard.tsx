import { useEffect, useState, useMemo } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { withOwnerAuth } from "@/components/withOwnerAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useLocation } from "wouter";
import { 
  Calendar, 
  Clock, 
  UserX, 
  Euro, 
  Plus, 
  UserPlus, 
  CalendarDays,
  Users,
  Scissors,
  BarChart,
  Home
} from "lucide-react";
import { format, isSameDay, parseISO, isAfter, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import Navigation from "@/components/navigation";
import { generateTimeSlotsForInterval } from "@/utils/bookingSlots";

interface EnrichedAppointment {
  id: string;
  client: { firstName: string; lastName: string };
  service: { name: string };
  stylist: { firstName: string };
  startTime: string;
}

function Dashboard() {
  const { toast } = useToast();
  const { owner, salonId, isHydrating, isLoading, isAuthenticated } = useAuthContext();
  const { firstName } = useUserContext();
  const [, setLocation] = useLocation();

  // États locaux pour les données utilisateur et salon
  const [userName, setUserName] = useState('');
  const [userLastName, setUserLastName] = useState('');
  const [salonName, setSalonName] = useState('');

  // Charger les données utilisateur depuis le contexte auth
  useEffect(() => {
    // Priorité: owner.firstName (le plus à jour) > firstName (contexte) > localStorage
    const currentFirstName = owner?.firstName || firstName || localStorage.getItem('userFirstName') || '';
    
    if (currentFirstName) {
      setUserName(currentFirstName);
      // Sauvegarder dans localStorage si ce n'est pas déjà fait
      if (!localStorage.getItem('userFirstName') || localStorage.getItem('userFirstName') !== currentFirstName) {
        localStorage.setItem('userFirstName', currentFirstName);
      }
    }
    
    // Charger le nom de famille depuis l'owner connecté
    if (owner?.lastName) {
      setUserLastName(owner.lastName);
    }
  }, [firstName, owner]);

  // Écouter les changements de prénom depuis les autres composants (settings)
  useEffect(() => {
    const handleUserNameUpdate = (event: CustomEvent) => {
      const newFirstName = event.detail;
      console.log('[DASHBOARD] Prénom mis à jour:', newFirstName);
      setUserName(newFirstName);
    };

    window.addEventListener('userNameUpdated', handleUserNameUpdate as EventListener);
    
    return () => {
      window.removeEventListener('userNameUpdated', handleUserNameUpdate as EventListener);
    };
  }, []);

  // Le HOC withOwnerAuth gère déjà la protection
  // Pas besoin de vérifier l'authentification ici

  // Charger les données du salon depuis l'API
  const { data: salon } = useQuery({
    queryKey: ["/api/salon"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/salon");
      return response.json();
    },
    retry: false,
    refetchOnWindowFocus: true, // Rafraîchir quand on revient sur l'onglet
    staleTime: 0, // Toujours considérer les données comme obsolètes pour forcer le rafraîchissement
  });

  // Mettre à jour le nom du salon quand les données sont chargées depuis l'API
  useEffect(() => {
    if (salon && typeof salon === 'object') {
      const name = (salon as any).name;
      if (name) {
        setSalonName(name);
        // Mettre à jour aussi localStorage pour la cohérence
        const savedSalonSettings = localStorage.getItem('salonSettings');
        if (savedSalonSettings) {
          try {
            const salonData = JSON.parse(savedSalonSettings);
            salonData.name = name;
            localStorage.setItem('salonSettings', JSON.stringify(salonData));
          } catch (error) {
            console.error('Error updating salonSettings in localStorage:', error);
          }
        }
      }
    }
  }, [salon]);

  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const todayStartISO = todayStart.toISOString().split('T')[0];
  const todayEndISO = todayEnd.toISOString();

  // Récupérer tous les rendez-vous (pour calculer les stats et les prochains)
  const { data: allAppointments } = useQuery({
    queryKey: ["/api/salons", salon?.id, "appointments"],
    queryFn: async () => {
      if (!salon?.id) return [];
      try {
        const salonId = salon.id.startsWith('salon-') ? salon.id.substring(6) : salon.id;
        const response = await apiRequest("GET", `/api/salons/${salonId}/appointments`);
        return response.json();
      } catch (error) {
        console.error('[Dashboard] Erreur chargement rendez-vous:', error);
        return [];
      }
    },
    enabled: !!salon?.id,
    retry: false,
    refetchOnWindowFocus: true,
  });

  // Récupérer les clients
  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/clients");
        return response.json();
      } catch (error) {
        console.error('[Dashboard] Erreur chargement clients:', error);
        return [];
      }
    },
    enabled: !!salon?.id,
    retry: false,
    refetchOnWindowFocus: true,
  });

  // Récupérer les services
  const { data: services } = useQuery({
    queryKey: ["/api/salons", salon?.id, "services"],
    queryFn: async () => {
      if (!salon?.id) return [];
      try {
        const salonId = salon.id.startsWith('salon-') ? salon.id.substring(6) : salon.id;
        const response = await apiRequest("GET", `/api/salons/${salonId}/services`);
        return response.json();
      } catch (error) {
        console.error('[Dashboard] Erreur chargement services:', error);
        return [];
      }
    },
    enabled: !!salon?.id,
    retry: false,
    refetchOnWindowFocus: true,
  });

  // Récupérer les stylistes
  const { data: stylists } = useQuery({
    queryKey: ["/api/salons", salon?.id, "stylistes"],
    queryFn: async () => {
      if (!salon?.id) return [];
      try {
        const salonId = salon.id.startsWith('salon-') ? salon.id.substring(6) : salon.id;
        const response = await apiRequest("GET", `/api/salons/${salonId}/stylistes`);
        return response.json();
      } catch (error) {
        console.error('[Dashboard] Erreur chargement stylistes:', error);
        return [];
      }
    },
    enabled: !!salon?.id,
    retry: false,
    refetchOnWindowFocus: true,
  });

  // Récupérer les horaires du salon
  const { data: salonHours } = useQuery({
    queryKey: ["/api/salons", salon?.id, "hours"],
    queryFn: async () => {
      if (!salon?.id) return null;
      try {
        const salonId = salon.id.startsWith('salon-') ? salon.id.substring(6) : salon.id;
        const response = await apiRequest("GET", `/api/salons/${salonId}/hours`);
        return response.json();
      } catch (error) {
        console.error('[Dashboard] Erreur chargement horaires:', error);
        return null;
      }
    },
    enabled: !!salon?.id,
    retry: false,
    refetchOnWindowFocus: true,
  });

  // Calculer les statistiques réelles
  const stats = useMemo(() => {
    if (!allAppointments || !services || !clients || !stylists) {
      return {
        todayAppointments: 0,
        availableSlots: 0,
        noShows: 0,
        todayRevenue: 0,
      };
    }

    // Filtrer les rendez-vous d'aujourd'hui
    const todayAppointments = (allAppointments || []).filter((apt: any) => {
      if (!apt.startTime) return false;
      const aptDate = parseISO(apt.startTime);
      return isSameDay(aptDate, today);
    });

    // Compter les RDV du jour
    const todayAppointmentsCount = todayAppointments.length;

    // Compter les no-shows (status cancelled ou no_show aujourd'hui)
    const noShows = todayAppointments.filter((apt: any) => 
      apt.status === 'cancelled' || apt.status === 'no_show'
    ).length;

    // Calculer le CA d'aujourd'hui (rendez-vous completed ou confirmed)
    const todayRevenue = todayAppointments
      .filter((apt: any) => apt.status === 'completed' || apt.status === 'confirmed')
      .reduce((total: number, apt: any) => {
        const service = services.find((s: any) => s.id === apt.serviceId);
        const price = service?.price ? parseFloat(service.price.toString()) : 0;
        return total + price;
      }, 0);

    // Calculer les slots libres restants aujourd'hui
    let availableSlots = 0;
    if (salonHours?.hours) {
      const dayOfWeek = today.getDay();
      const dayHours = salonHours.hours.filter((h: any) => h.day_of_week === dayOfWeek && !h.is_closed);
      
      if (dayHours.length > 0) {
        // Générer tous les créneaux possibles pour aujourd'hui
        const allSlots: string[] = [];
        dayHours.forEach((hour: any) => {
          const slots =             generateTimeSlotsForInterval(
              {
                openTime: (hour.open_time || '09:00').substring(0, 5),
                closeTime: (hour.close_time || '18:00').substring(0, 5),
              },
              30, // Durée par défaut de 30 minutes
              15  // Pas de 15 minutes (quart d'heure)
            );
          allSlots.push(...slots);
        });

        // Filtrer les créneaux passés
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const futureSlots = allSlots.filter(slot => slot >= currentTime);

        // Compter les créneaux occupés
        const occupiedSlots = todayAppointments
          .filter((apt: any) => {
            if (!apt.startTime) return false;
            const aptDate = parseISO(apt.startTime);
            if (!isSameDay(aptDate, today)) return false;
            const aptTime = format(aptDate, 'HH:mm');
            return futureSlots.includes(aptTime);
          })
          .length;

        availableSlots = Math.max(0, futureSlots.length - occupiedSlots);
      }
    }

    return {
      todayAppointments: todayAppointmentsCount,
      availableSlots,
      noShows,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
    };
  }, [allAppointments, services, clients, stylists, salonHours, today]);

  // Récupérer les prochains rendez-vous (pas fictifs)
  const upcomingAppointments = useMemo(() => {
    if (!allAppointments || !clients || !services || !stylists) {
      return [];
    }

    const now = new Date();
    
    // Filtrer les rendez-vous futurs (après maintenant)
    const futureAppointments = (allAppointments || [])
      .filter((apt: any) => {
        if (!apt.startTime) return false;
        const aptDate = parseISO(apt.startTime);
        return isAfter(aptDate, now) && 
               (apt.status === 'confirmed' || apt.status === 'pending' || apt.status === 'scheduled');
      })
      .sort((a: any, b: any) => {
        const dateA = parseISO(a.startTime);
        const dateB = parseISO(b.startTime);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 3); // Prendre les 3 prochains

    // Enrichir avec les informations client/service/stylist
    return futureAppointments.map((apt: any) => {
      const client = clients.find((c: any) => c.id === apt.clientId);
      const service = services.find((s: any) => s.id === apt.serviceId);
      const stylist = stylists.find((s: any) => s.id === apt.stylistId);
      
      const aptDate = parseISO(apt.startTime);
      
      return {
        id: apt.id,
        client: client ? {
          firstName: client.firstName || client.first_name || '',
          lastName: client.lastName || client.last_name || '',
        } : { firstName: 'Client', lastName: 'Inconnu' },
        service: service ? { name: service.name || 'Service' } : { name: 'Service inconnu' },
        stylist: stylist ? {
          firstName: stylist.firstName || stylist.first_name || stylist.name || 'Styliste',
        } : { firstName: 'Styliste inconnu' },
        startTime: format(aptDate, 'HH:mm'),
      };
    });
  }, [allAppointments, clients, services, stylists]);

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
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-full overflow-x-hidden">
        
        {/* Dashboard Header */}
        <div className="glassmorphism-card rounded-3xl p-6 sm:p-8 mb-8 w-full max-w-full overflow-hidden">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 pb-6 border-b border-border/20">
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-1">
                Bonjour, {userName || 'Utilisateur'}{userLastName ? ` ${userLastName}` : ''}
              </h1>
              <p className="text-gray-600 text-lg mb-2">
                Bienvenue chez {salonName || 'votre salon'}
              </p>
              <p className="text-muted-foreground text-sm">
                {format(today, "EEEE d MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 mt-4 lg:mt-0">
              <Button 
                variant="outline" 
                className="btn-secondary-light px-4 py-2 text-sm font-medium"
                data-testid="button-home"
                onClick={() => setLocation("/")}
              >
                <Home className="mr-2 h-4 w-4" />
                Accueil
              </Button>
              <Button 
                variant="outline" 
                className="btn-secondary-light px-4 py-2 text-sm font-medium"
                data-testid="button-new-service"
                onClick={() => setLocation("/services")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nouveau service
              </Button>
              <Button 
                variant="outline" 
                className="btn-secondary-light px-4 py-2 text-sm font-medium"
                data-testid="button-add-stylist"
                onClick={() => setLocation("/stylistes")}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Ajouter un·e coiffeur·euse
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div 
              className="bg-white/50 rounded-2xl p-6 border border-border/20 cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
              onClick={() => setLocation("/calendar")}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground mb-1" data-testid="stat-today-appointments">
                {stats.todayAppointments}
              </div>
              <div className="text-sm text-muted-foreground">RDV du jour</div>
            </div>

            <div 
              className="bg-white/50 rounded-2xl p-6 border border-border/20 cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
              onClick={() => setLocation("/calendar?view=slots")}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                  <Clock className="h-6 w-6 text-accent" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground mb-1" data-testid="stat-available-slots">
                {stats.availableSlots}
              </div>
              <div className="text-sm text-muted-foreground">Slots libres</div>
            </div>

            <div 
              className="bg-white/50 rounded-2xl p-6 border border-border/20 cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
              onClick={() => setLocation("/clients?filter=no-show")}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center">
                  <UserX className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground mb-1" data-testid="stat-no-shows">
                {stats.noShows}
              </div>
              <div className="text-sm text-muted-foreground">No-shows</div>
            </div>

            <div 
              className="bg-white/50 rounded-2xl p-6 border border-border/20 cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
              onClick={() => setLocation("/reports?section=revenue")}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Euro className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground mb-1" data-testid="stat-today-revenue">
                {stats.todayRevenue.toFixed(2)}€
              </div>
              <div className="text-sm text-muted-foreground">CA aujourd'hui</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/50 rounded-2xl p-6 border border-border/20">
              <h3 className="text-lg font-semibold text-foreground mb-4">Prochains rendez-vous</h3>
              <div className="space-y-4">
                {upcomingAppointments.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Aucun rendez-vous à venir
                  </div>
                ) : (
                  upcomingAppointments.map((appointment: EnrichedAppointment) => (
                  <div key={appointment.id} className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {appointment.client.firstName[0]}{appointment.client.lastName[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {appointment.client.firstName} {appointment.client.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {appointment.service.name} • {appointment.startTime}
                      </div>
                    </div>
                    <div className="text-primary font-medium">
                      {appointment.stylist.firstName}
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white/50 rounded-2xl p-6 border border-border/20">
              <h3 className="text-lg font-semibold text-foreground mb-4">Accès rapide</h3>
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="btn-secondary-light p-4 h-auto flex flex-col items-start text-left hover:bg-white/80"
                  data-testid="button-quick-calendar"
                  onClick={() => setLocation("/calendar")}
                >
                  <CalendarDays className="h-6 w-6 text-primary mb-2" />
                  <div className="font-medium text-foreground">Calendrier</div>
                </Button>
                <Button 
                  variant="outline" 
                  className="btn-secondary-light p-4 h-auto flex flex-col items-start text-left hover:bg-white/80"
                  data-testid="button-quick-clients"
                  onClick={() => setLocation("/clients")}
                >
                  <Users className="h-6 w-6 text-primary mb-2" />
                  <div className="font-medium text-foreground">Clients</div>
                </Button>
                <Button 
                  variant="outline" 
                  className="btn-secondary-light p-4 h-auto flex flex-col items-start text-left hover:bg-white/80"
                  data-testid="button-quick-services"
                  onClick={() => setLocation("/services")}
                >
                  <Scissors className="h-6 w-6 text-primary mb-2" />
                  <div className="font-medium text-foreground">Services</div>
                </Button>
                <Button 
                  variant="outline" 
                  className="btn-secondary-light p-4 h-auto flex flex-col items-start text-left hover:bg-white/80"
                  data-testid="button-quick-reports"
                  onClick={() => setLocation("/reports")}
                >
                  <BarChart className="h-6 w-6 text-primary mb-2" />
                  <div className="font-medium text-foreground">Rapports</div>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Exporter avec le HOC de protection
export default withOwnerAuth(Dashboard);
