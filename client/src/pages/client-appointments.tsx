import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Calendar, 
  Clock, 
  User, 
  Search, 
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Euro,
  FileText
} from "lucide-react";
import { format, isAfter, isBefore, startOfDay, endOfDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuthContext } from "@/contexts/AuthContext";
import { withClientAuth } from "@/components/withClientAuth";
import ClientNavigation from "@/components/client-navigation";
import { useToast } from "@/hooks/use-toast";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Stylist {
  id: string;
  firstName: string;
  lastName: string;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  service: Service;
  stylist: Stylist;
}

type FilterStatus = 'all' | 'upcoming' | 'past' | 'confirmed' | 'pending' | 'cancelled';

function ClientAppointments() {
  const [location, setLocation] = useLocation();
  const { client } = useAuthContext();
  const { toast } = useToast();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('upcoming');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  
  useEffect(() => {
    loadAppointments();
  }, []);
  
  // Recharger les rendez-vous quand on navigue vers cette page
  useEffect(() => {
    if (location === '/client-appointments') {
      console.log('[ClientAppointments] Navigation vers la page, rechargement des rendez-vous...');
      // Attendre un peu pour laisser la session se propager
      const timer = setTimeout(() => {
        loadAppointments();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location]);
  
  // Recharger les rendez-vous quand on revient sur cette page (focus)
  useEffect(() => {
    const handleFocus = () => {
      console.log('[ClientAppointments] Page focus, rechargement des rendez-vous...');
      loadAppointments();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    filterAppointments();
  }, [appointments, searchTerm, statusFilter]);

  const loadAppointments = async () => {
    try {
      setIsLoading(true);
      console.log('[ClientAppointments] Chargement des rendez-vous...');
      
      const response = await fetch("/api/client/appointments", {
        credentials: 'include',
      });
      
      console.log('[ClientAppointments] Réponse status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[ClientAppointments] Données reçues:', data);
        console.log('[ClientAppointments] Nombre de rendez-vous:', data?.length || 0);
        
        // Vérifier que les données sont valides
        if (Array.isArray(data)) {
          // Valider chaque rendez-vous
          const validAppointments = data.filter((apt: any) => {
            const isValid = apt && apt.id && apt.startTime && apt.service && apt.stylist;
            if (!isValid) {
              console.warn('[ClientAppointments] Rendez-vous invalide ignoré:', apt);
            }
            return isValid;
          });
          
          console.log('[ClientAppointments] Rendez-vous valides:', validAppointments.length);
          setAppointments(validAppointments);
        } else {
          console.error('[ClientAppointments] Les données ne sont pas un tableau:', data);
          setAppointments([]);
        }
      } else {
        const errorText = await response.text();
        console.error('[ClientAppointments] Erreur HTTP:', response.status, errorText);
        toast({
          title: "Erreur",
          description: `Impossible de charger les rendez-vous (${response.status}).`,
          variant: "destructive",
        });
        setAppointments([]);
      }
    } catch (error) {
      console.error("[ClientAppointments] Erreur lors du chargement des rendez-vous:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les rendez-vous.",
        variant: "destructive",
      });
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAppointments = () => {
    let filtered = [...appointments];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(appointment =>
        appointment.service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${appointment.stylist.firstName} ${appointment.stylist.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    const now = new Date();
    switch (statusFilter) {
      case 'upcoming':
        filtered = filtered.filter(apt => 
          new Date(apt.startTime) > now && apt.status !== 'cancelled'
        );
        break;
      case 'past':
        filtered = filtered.filter(apt => 
          new Date(apt.startTime) < now || apt.status === 'completed'
        );
        break;
      case 'confirmed':
        filtered = filtered.filter(apt => apt.status === 'confirmed');
        break;
      case 'pending':
        filtered = filtered.filter(apt => apt.status === 'pending');
        break;
      case 'cancelled':
        filtered = filtered.filter(apt => apt.status === 'cancelled');
        break;
    }

    // Sort by date
    // For upcoming: earliest first
    // For past: most recent first (oldest at bottom)
    if (statusFilter === 'past') {
      // Past appointments: most recent first, oldest at bottom
      filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    } else {
      // Upcoming and other filters: earliest first
      filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }

    setFilteredAppointments(filtered);
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir annuler ce rendez-vous ?")) {
      return;
    }

    try {
      const response = await fetch(`/api/client/appointments/${appointmentId}/cancel`, {
        method: "POST",
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: "Rendez-vous annulé",
          description: "Votre rendez-vous a été annulé avec succès.",
        });
        loadAppointments(); // Reload appointments
      } else {
        throw new Error("Erreur lors de l'annulation");
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'annuler le rendez-vous.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string, startTime: string) => {
    const now = new Date();
    const appointmentDate = new Date(startTime);
    const isPast = appointmentDate < now;

    switch (status) {
      case "confirmed":
        return (
          <Badge className={`${isPast ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
            {isPast ? 'Terminé' : 'Confirmé'}
          </Badge>
        );
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800">Annulé</Badge>;
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800">Terminé</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "pending":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const canCancelAppointment = (appointment: Appointment) => {
    const now = new Date();
    const appointmentDate = new Date(appointment.startTime);
    
    // Permettre l'annulation de tous les rendez-vous confirmés qui ne sont pas encore passés
    // (pas de restriction de 24 heures)
    // Vérifier que le status est annulable (confirmed, pending, ou scheduled)
    // et que le rendez-vous est dans le futur
    const status = appointment.status;
    const isCancellableStatus = status === 'confirmed' || status === 'pending' || status === 'scheduled';
    const isFuture = appointmentDate > now;
    
    return isCancellableStatus && isFuture;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des rendez-vous...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">Session expirée</p>
            <Button onClick={() => setLocation("/client-login")}>
              Se reconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ClientNavigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Mes Rendez-vous
              </h1>
              <p className="text-muted-foreground">
                Gérez tous vos rendez-vous passés et à venir
              </p>
            </div>
            <Button
              onClick={() => setLocation("/book-client")}
              className="btn-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouveau RDV
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6 glassmorphism-card">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Rechercher par service ou coiffeur·euse..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'all', label: 'Tous' },
                  { value: 'upcoming', label: 'À venir' },
                  { value: 'past', label: 'Passés' },
                  { value: 'confirmed', label: 'Confirmés' },
                  { value: 'pending', label: 'En attente' },
                  { value: 'cancelled', label: 'Annulés' }
                ].map((filter) => (
                  <Button
                    key={filter.value}
                    variant={statusFilter === filter.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(filter.value as FilterStatus)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        {filteredAppointments.length === 0 ? (
          <Card className="glassmorphism-card">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Calendar className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {appointments.length === 0 ? 'Aucun rendez-vous' : 'Aucun résultat'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {appointments.length === 0 
                    ? 'Vous n\'avez pas encore de rendez-vous.'
                    : 'Aucun rendez-vous ne correspond à vos critères de recherche.'
                  }
                </p>
                <Button
                  onClick={() => setLocation("/book-client")}
                  className="btn-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Prendre un rendez-vous
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAppointments.map((appointment) => (
              <Card key={appointment.id} className="glassmorphism-card">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-4">
                        {getStatusIcon(appointment.status)}
                        <h3 className="text-xl font-semibold">
                          {appointment.service.name}
                        </h3>
                        {getStatusBadge(appointment.status, appointment.startTime)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {format(new Date(appointment.startTime), "dd MMMM yyyy", { locale: fr })}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {format(new Date(appointment.startTime), "HH:mm", { locale: fr })} - 
                            {format(new Date(appointment.endTime), "HH:mm", { locale: fr })}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {appointment.stylist.firstName} {appointment.stylist.lastName}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-muted-foreground">Durée:</span>
                          <span className="font-medium">{appointment.service.duration} min</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-muted-foreground">Prix:</span>
                          <span className="font-medium text-primary">{appointment.service.price}€</span>
                        </div>
                      </div>
                      
                      {appointment.notes && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm">
                            <strong>Notes:</strong> {appointment.notes}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col space-y-2 ml-4">
                      {canCancelAppointment(appointment) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelAppointment(appointment.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Annuler
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setIsDetailsDialogOpen(true);
                        }}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Détails
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary */}
        {appointments.length > 0 && (
          <Card className="mt-8 glassmorphism-card">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{appointments.length}</p>
                  <p className="text-sm text-muted-foreground">Total RDV</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {appointments.filter(apt => apt.status === 'confirmed' && new Date(apt.startTime) > new Date()).length}
                  </p>
                  <p className="text-sm text-muted-foreground">À venir</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {appointments.filter(apt => apt.status === 'completed' || (apt.status === 'confirmed' && new Date(apt.startTime) < new Date())).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Terminés</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {appointments.filter(apt => apt.status === 'pending').length}
                  </p>
                  <p className="text-sm text-muted-foreground">En attente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appointment Details Dialog */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Détails du rendez-vous</DialogTitle>
            </DialogHeader>
            
            {selectedAppointment && (
              <div className="space-y-6">
                {/* Service */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg flex items-center">
                    <FileText className="mr-2 h-5 w-5 text-primary" />
                    Service
                  </h4>
                  <div className="pl-7 space-y-1">
                    <p className="text-lg font-medium">{selectedAppointment.service.name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center">
                        <Clock className="mr-1 h-4 w-4" />
                        {selectedAppointment.service.duration} min
                      </span>
                      <span className="flex items-center">
                        <Euro className="mr-1 h-4 w-4" />
                        {selectedAppointment.service.price}€
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coiffeur·euse */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg flex items-center">
                    <User className="mr-2 h-5 w-5 text-primary" />
                    Coiffeur·euse
                  </h4>
                  <p className="pl-7">
                    {selectedAppointment.stylist.firstName} {selectedAppointment.stylist.lastName}
                  </p>
                </div>

                {/* Date et Heure */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg flex items-center">
                    <Calendar className="mr-2 h-5 w-5 text-primary" />
                    Date et Heure
                  </h4>
                  <div className="pl-7 space-y-1">
                    <p className="font-medium">
                      {format(parseISO(selectedAppointment.startTime), "EEEE d MMMM yyyy", { locale: fr })}
                    </p>
                    <p className="text-muted-foreground flex items-center">
                      <Clock className="mr-1 h-4 w-4" />
                      {format(parseISO(selectedAppointment.startTime), "HH:mm", { locale: fr })} - 
                      {format(parseISO(selectedAppointment.endTime), "HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>

                {/* Statut */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">Statut</h4>
                  <div className="pl-7">
                    {getStatusBadge(selectedAppointment.status, selectedAppointment.startTime)}
                  </div>
                </div>

                {/* Notes */}
                {selectedAppointment.notes && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-lg">Notes</h4>
                    <div className="pl-7 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{selectedAppointment.notes}</p>
                    </div>
                  </div>
                )}

                {/* Informations supplémentaires */}
                <div className="pt-4 border-t space-y-2">
                  <h4 className="font-semibold text-lg">Informations</h4>
                  <div className="pl-7 space-y-2 text-sm text-muted-foreground">
                    <p>
                      <strong>ID du rendez-vous:</strong> {selectedAppointment.id}
                    </p>
                    <p>
                      <strong>Date de création:</strong> {format(new Date(selectedAppointment.startTime), "dd/MM/yyyy à HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Exporter avec le HOC de protection
export default withClientAuth(ClientAppointments);
