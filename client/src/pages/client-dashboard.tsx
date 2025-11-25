import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Scissors, 
  Calendar, 
  Clock, 
  User, 
  Settings, 
  Edit, 
  Save, 
  X,
  Mail,
  Phone,
  MapPin,
  Star,
  Plus,
  Bell
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuthContext } from "@/contexts/AuthContext";
import { withClientAuth } from "@/components/withClientAuth";
import ClientNavigation from "@/components/client-navigation";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes?: string;
  preferredStylistId?: string;
}

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

function ClientDashboard() {
  const [location, setLocation] = useLocation();
  const { client, salonId, isHydrating } = useAuthContext();
  const { toast } = useToast();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Commencer à false, sera mis à true seulement quand on charge
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<Client>>({});
  const [isSaving, setIsSaving] = useState(false);
  const loadedClientIdRef = useRef<string | null>(null); // ID du client déjà chargé
  const isLoadingAppointmentsRef = useRef(false); // Flag pour éviter les appels multiples simultanés
  const loadAppointmentsRef = useRef<(() => Promise<void>) | null>(null); // Ref pour stocker la fonction

  // Définir loadAppointments avec useCallback pour stabilité
  const loadAppointments = useCallback(async () => {
    const currentClientId = client?.id;
    if (!currentClientId) {
      console.log('[ClientDashboard] Pas de client ID, skip loadAppointments');
      setIsLoading(false); // S'assurer que isLoading est false si pas de client
      return;
    }
    
    // Éviter les appels multiples simultanés
    if (isLoadingAppointmentsRef.current) {
      console.log('[ClientDashboard] Chargement déjà en cours, skip...');
      return;
    }
    
    // Si déjà chargé pour ce client, skip
    if (loadedClientIdRef.current === currentClientId) {
      console.log('[ClientDashboard] Déjà chargé pour ce client, skip...');
      setIsLoading(false); // S'assurer que isLoading est false si déjà chargé
      return;
    }
    
    isLoadingAppointmentsRef.current = true;
    setIsLoading(true);
    
    try {
      console.log('[ClientDashboard] Chargement des rendez-vous pour client:', currentClientId);
      
      const response = await fetch("/api/client/appointments", {
        credentials: 'include',
      });
      
      if (response.status === 401) {
        console.warn('[ClientDashboard] 401 Unauthorized - Session non propagée, attente...');
        // Attendre que la session soit propagée
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const retryResponse = await fetch("/api/client/appointments", {
          credentials: 'include',
        });
        
        if (retryResponse.ok) {
          const data = await retryResponse.json();
          console.log('[ClientDashboard] Données reçues après retry:', data);
          
          // Vérifier que les données sont valides
          if (Array.isArray(data)) {
            const validAppointments = data.filter((apt: any) => {
              const isValid = apt && apt.id && apt.startTime && apt.service && apt.stylist;
              if (!isValid) {
                console.warn('[ClientDashboard] Rendez-vous invalide ignoré (retry):', apt);
              }
              return isValid;
            });
            setAppointments(validAppointments);
          } else {
            setAppointments([]);
          }
          loadedClientIdRef.current = currentClientId;
        } else {
          console.error('[ClientDashboard] Échec après retry, status:', retryResponse.status);
          setAppointments([]);
          // Ne pas appeler updateClient() ici pour éviter les boucles
          // Le client sera rafraîchi automatiquement par le hook useClientAuth
        }
      } else if (response.ok) {
        const data = await response.json();
        console.log('[ClientDashboard] Données reçues:', data);
        console.log('[ClientDashboard] Nombre de rendez-vous:', data?.length || 0);
        
        // Vérifier que les données sont valides
        if (Array.isArray(data)) {
          // Valider chaque rendez-vous
          const validAppointments = data.filter((apt: any) => {
            const isValid = apt && apt.id && apt.startTime && apt.service && apt.stylist;
            if (!isValid) {
              console.warn('[ClientDashboard] Rendez-vous invalide ignoré:', apt);
            }
            return isValid;
          });
          
          console.log('[ClientDashboard] Rendez-vous valides:', validAppointments.length);
          setAppointments(validAppointments);
        } else {
          console.error('[ClientDashboard] Les données ne sont pas un tableau:', data);
          setAppointments([]);
        }
        loadedClientIdRef.current = currentClientId;
      } else {
        const errorText = await response.text().catch(() => '');
        console.error('[ClientDashboard] Erreur HTTP:', response.status, errorText);
        setAppointments([]);
      }
    } catch (error) {
      console.error("[ClientDashboard] Erreur lors du chargement des rendez-vous:", error);
      setAppointments([]);
    } finally {
      setIsLoading(false);
      isLoadingAppointmentsRef.current = false;
    }
  }, [client?.id]); // Dépend uniquement de client?.id pour éviter les boucles

  // Stocker la fonction dans une ref pour éviter les re-renders
  useEffect(() => {
    loadAppointmentsRef.current = loadAppointments;
  }, [loadAppointments]);

  // TOUS les hooks doivent être appelés AVANT tout return conditionnel
  useEffect(() => {
    // Mettre à jour le profil quand le client change (seulement si nécessaire)
    if (client) {
      const newProfile = {
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        email: client.email || '',
        phone: client.phone || '',
        notes: client.notes || ''
      };
      
      // Ne mettre à jour que si les valeurs ont changé
      if (
        editedProfile.firstName !== newProfile.firstName ||
        editedProfile.lastName !== newProfile.lastName ||
        editedProfile.email !== newProfile.email ||
        editedProfile.phone !== newProfile.phone ||
        editedProfile.notes !== newProfile.notes
      ) {
        setEditedProfile(newProfile);
      }
    }
  }, [client?.id, client?.firstName, client?.lastName, client?.email, client?.phone, client?.notes]);

  useEffect(() => {
    // Réinitialiser seulement si le client ID change vraiment
    const currentClientId = client?.id;
    if (currentClientId && loadedClientIdRef.current !== currentClientId) {
      loadedClientIdRef.current = null;
      isLoadingAppointmentsRef.current = false;
    }
  }, [client?.id]);

  // Écouter les changements de location pour recharger les rendez-vous quand on revient sur le dashboard
  useEffect(() => {
    if (location === '/client-dashboard' && client?.id && !isHydrating) {
      console.log('[ClientDashboard] Navigation vers le dashboard, rechargement des rendez-vous...');
      // Réinitialiser le flag pour forcer le rechargement
      loadedClientIdRef.current = null;
      // Attendre un peu pour laisser la session se propager
      const timer = setTimeout(() => {
        if (loadAppointmentsRef.current) {
          loadAppointmentsRef.current();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location, client?.id, isHydrating]);

  useEffect(() => {
    // Ne rien faire pendant l'hydratation
    if (isHydrating) {
      console.log('[ClientDashboard] Hydratation en cours, attente...');
      return;
    }
    
    // Charger seulement une fois si client disponible
    const currentClientId = client?.id;
    
    // Si client disponible, charger les rendez-vous
    if (currentClientId && loadedClientIdRef.current !== currentClientId) {
      console.log('[ClientDashboard] Client authentifié, chargement des rendez-vous...', currentClientId);
      // Délai pour laisser la session se propager après navigation
      const timer = setTimeout(() => {
        // Vérifier à nouveau que le client n'a pas changé pendant le délai
        if (loadAppointmentsRef.current) {
          loadAppointmentsRef.current();
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, isHydrating]); // Dépendre de isHydrating au lieu de status

  const handleSaveProfile = async () => {
    if (!client) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour modifier votre profil.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch("/api/client/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editedProfile),
      });

      if (response.ok) {
        // Rafraîchir le contexte auth
        const authContext = useAuthContext();
        await authContext.refresh();
        setIsEditingProfile(false);
        toast({
          title: "Profil mis à jour",
          description: "Vos informations ont été sauvegardées avec succès.",
        });
      } else {
        throw new Error("Erreur lors de la mise à jour");
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les modifications.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!client) return;
    setEditedProfile({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      notes: client.notes
    });
    setIsEditingProfile(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800">Confirmé</Badge>;
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

  const upcomingAppointments = appointments.filter(apt => 
    new Date(apt.startTime) > new Date() && apt.status !== "cancelled"
  ).slice(0, 3);

  // Le HOC withClientAuth gère déjà la redirection et l'hydratation
  // On peut supposer que si on arrive ici, c'est qu'on est un client authentifié
  if (!client) {
    // Rafraîchir le client une fois
    if (!loadedClientIdRef.current) {
      updateClient().catch(err => {
        console.error('[ClientDashboard] Erreur lors du rafraîchissement:', err);
      });
      loadedClientIdRef.current = 'refreshing'; // Marquer qu'on est en train de rafraîchir
    }
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de vos informations...</p>
        </div>
      </div>
    );
  }
  
  // Si on arrive ici sans client, quelque chose ne va pas
  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Erreur de chargement. Veuillez vous reconnecter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
        <ClientNavigation />

        <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bonjour, {client.firstName} ! 👋
          </h1>
          <p className="text-muted-foreground">
            Gérez vos rendez-vous et vos informations personnelles
          </p>
        </div>

        {/* Indicateur de chargement des rendez-vous */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Chargement des rendez-vous...</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card className="glassmorphism-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <User className="mr-2 h-5 w-5" />
                    Mon Profil
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditingProfile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">Prénom</Label>
                        <Input
                          id="firstName"
                          value={editedProfile.firstName || ""}
                          onChange={(e) => setEditedProfile(prev => ({ ...prev, firstName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Nom</Label>
                        <Input
                          id="lastName"
                          value={editedProfile.lastName || ""}
                          onChange={(e) => setEditedProfile(prev => ({ ...prev, lastName: e.target.value }))}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={editedProfile.email || ""}
                        onChange={(e) => setEditedProfile(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Téléphone</Label>
                      <Input
                        id="phone"
                        value={editedProfile.phone || ""}
                        onChange={(e) => setEditedProfile(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="flex-1"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="flex-1"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{client.email || 'Non renseigné'}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{client.phone}</span>
                      </div>
                    )}
                  </div>
                )}
                
                <Separator />
                
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/client-change-password")}
                    className="w-full"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Changer le mot de passe
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/client-settings")}
                    className="w-full"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Paramètres avancés
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <Card className="glassmorphism-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plus className="mr-2 h-5 w-5" />
                  Actions rapides
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={() => setLocation("/book-client")}
                    className="h-16 flex-col space-y-2"
                  >
                    <Calendar className="h-6 w-6" />
                    <span>Prendre un RDV</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/client-appointments")}
                    className="h-16 flex-col space-y-2"
                  >
                    <Clock className="h-6 w-6" />
                    <span>Mes Rendez-vous</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Appointments */}
            <Card className="glassmorphism-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Calendar className="mr-2 h-5 w-5" />
                    Prochains Rendez-vous
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation("/client-appointments")}
                  >
                    Voir tout
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Aucun rendez-vous à venir</p>
                    <Button
                      onClick={() => setLocation("/book-client")}
                      className="btn-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Prendre un rendez-vous
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="border border-border/20 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-semibold text-lg">
                                {appointment.service.name}
                              </h3>
                              {getStatusBadge(appointment.status)}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {format(new Date(appointment.startTime), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
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
                                <span>{appointment.service.duration} min</span>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <span className="text-muted-foreground">Prix:</span>
                                <span className="font-medium">{appointment.service.price}€</span>
                              </div>
                            </div>
                            
                            {appointment.notes && (
                              <div className="mt-2">
                                <p className="text-sm text-muted-foreground">
                                  <strong>Notes:</strong> {appointment.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="glassmorphism-card">
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-primary" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">
                        Total RDV
                      </p>
                      <p className="text-2xl font-bold">{appointments.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glassmorphism-card">
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Star className="h-8 w-8 text-yellow-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">
                        RDV Confirmés
                      </p>
                      <p className="text-2xl font-bold">
                        {appointments.filter(apt => apt.status === "confirmed").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glassmorphism-card">
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Bell className="h-8 w-8 text-blue-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">
                        En Attente
                      </p>
                      <p className="text-2xl font-bold">
                        {appointments.filter(apt => apt.status === "pending").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Exporter avec le HOC de protection
export default withClientAuth(ClientDashboard);