import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  History, 
  Calendar, 
  Clock, 
  User, 
  Search, 
  Star,
  Award,
  CheckCircle,
  XCircle
} from "lucide-react";
import { format, isAfter, isBefore, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuthContext } from "@/contexts/AuthContext";
import { withClientAuth } from "@/components/withClientAuth";
import ClientNavigation from "@/components/client-navigation";

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

function ClientHistory() {
  const [, setLocation] = useLocation();
  const { client } = useAuthContext();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    loadAppointments();
  }, []);

  useEffect(() => {
    filterAppointments();
  }, [appointments, searchTerm, selectedMonth]);

  const loadAppointments = async () => {
    try {
      const response = await fetch("/api/client/appointments", {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAppointments(data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des rendez-vous:", error);
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

    // Filter by month
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    filtered = filtered.filter(appointment => {
      const appointmentDate = new Date(appointment.startTime);
      return appointmentDate >= monthStart && appointmentDate <= monthEnd;
    });

    // Sort by date (most recent first)
    filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    setFilteredAppointments(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Terminé</Badge>;
      case "confirmed":
        return <Badge className="bg-blue-100 text-blue-800">Confirmé</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800">Annulé</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getStatistics = () => {
    const completedAppointments = appointments.filter(apt => 
      apt.status === 'completed' || (apt.status === 'confirmed' && new Date(apt.startTime) < new Date())
    );
    
    const totalSpent = completedAppointments.reduce((sum, apt) => sum + apt.service.price, 0);
    const totalTime = completedAppointments.reduce((sum, apt) => sum + apt.service.duration, 0);
    
    const stylistCounts = completedAppointments.reduce((counts, apt) => {
      const stylistName = `${apt.stylist.firstName} ${apt.stylist.lastName}`;
      counts[stylistName] = (counts[stylistName] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const favoriteStylist = Object.entries(stylistCounts).reduce((a, b) => 
      stylistCounts[a[0]] > stylistCounts[b[0]] ? a : b, 
      ['', 0]
    );

    return {
      totalAppointments: completedAppointments.length,
      totalSpent,
      totalTime,
      favoriteStylist: favoriteStylist[0] || 'Aucun',
      favoriteStylistCount: favoriteStylist[1] || 0
    };
  };

  const stats = getStatistics();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement de l'historique...</p>
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
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Historique
          </h1>
          <p className="text-muted-foreground">
            Consultez votre historique de rendez-vous et vos statistiques
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="glassmorphism-card">
            <CardContent className="pt-6">
              <div className="flex items-center">
                <History className="h-8 w-8 text-primary" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Total RDV
                  </p>
                  <p className="text-2xl font-bold">{stats.totalAppointments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glassmorphism-card">
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Award className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Coiffeur·euse préféré·e
                  </p>
                  <p className="text-lg font-bold">{stats.favoriteStylist}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.favoriteStylistCount} RDV
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
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
              
              <div className="flex gap-2">
                <Button
                  variant={selectedMonth.getMonth() === new Date().getMonth() ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMonth(new Date())}
                >
                  Ce mois
                </Button>
                <Button
                  variant={selectedMonth.getMonth() === subMonths(new Date(), 1).getMonth() ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMonth(subMonths(new Date(), 1))}
                >
                  Mois dernier
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments History */}
        {filteredAppointments.length === 0 ? (
          <Card className="glassmorphism-card">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <History className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {appointments.length === 0 ? 'Aucun historique' : 'Aucun résultat'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {appointments.length === 0 
                    ? 'Vous n\'avez pas encore d\'historique de rendez-vous.'
                    : 'Aucun rendez-vous ne correspond à vos critères de recherche.'
                  }
                </p>
                <Button
                  onClick={() => setLocation("/book")}
                  className="btn-primary"
                >
                  Prendre un rendez-vous
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Rendez-vous de {format(selectedMonth, "MMMM yyyy", { locale: fr })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {filteredAppointments.length} rendez-vous
              </p>
            </div>
            
            {filteredAppointments.map((appointment) => (
              <Card key={appointment.id} className="glassmorphism-card">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-4">
                        {appointment.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : appointment.status === 'cancelled' ? (
                          <XCircle className="h-5 w-5 text-red-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-blue-600" />
                        )}
                        <h3 className="text-xl font-semibold">
                          {appointment.service.name}
                        </h3>
                        {getStatusBadge(appointment.status)}
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Exporter avec le HOC de protection
export default withClientAuth(ClientHistory);
