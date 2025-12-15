import { useState, useEffect, useMemo } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useClientRisk, type ClientRisk } from "@/hooks/useClientRisk";
import { ClientRiskBadge } from "@/components/ClientRiskBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Plus,
  Edit,
  Mail,
  Phone,
  Search,
  Calendar,
  User,
  Trash2,
  StickyNote,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertClientSchema,
  type Client,
  type Styliste,
  type Appointment,
} from "@shared/schema";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import Navigation from "@/components/navigation";

const clientFormSchema = insertClientSchema;
type ClientFormData = z.infer<typeof clientFormSchema>;

// Type étendu pour les appointments enrichis avec service et stylist
type EnrichedAppointment = Appointment & {
  service?: {
    id: string;
    name: string;
    durationMinutes: number;
    price: number | null;
  } | null;
  stylist?: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
  } | null;
};

export default function Clients() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedStylistFilter, setSelectedStylistFilter] = useState<string>("all");
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'all' | 'high' | 'medium'>('all');

  const { isAuthenticated, isLoading, isHydrating } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isHydrating && !isLoading && !isAuthenticated) {
      toast({
        title: "Non autorisé",
        description: "Vous devez être connecté pour gérer les clients.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/salon-login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, isHydrating, toast]);

  const { data: salon } = useQuery({ 
    queryKey: ["/api/salon"], 
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/salon");
      return response.json();
    },
    retry: false 
  });

  // Hook pour récupérer les risques clients
  const { data: clientRisks } = useClientRisk(salon?.id);
  const clientRiskMap = useMemo(() => {
    const map = new Map<string, ClientRisk>();
    if (clientRisks) {
      clientRisks.forEach((risk) => {
        map.set(risk.clientId, risk);
      });
    }
    // Debug en dev uniquement (Vite)
    if (import.meta.env.DEV && clientRisks) {
      console.log('[Clients] clientRiskMap créé:', {
        size: map.size,
        sampleKeys: Array.from(map.keys()).slice(0, 3),
        sampleValues: Array.from(map.values()).slice(0, 2).map(r => ({ clientId: r.clientId, riskLevel: r.riskLevel })),
      });
    }
    return map;
  }, [clientRisks]);
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/clients");
      return response.json();
    },
    retry: false,
  });

  // Debug en dev : comparer les IDs des clients avec les keys de la riskMap
  useEffect(() => {
    if (import.meta.env.DEV && clients && clientRiskMap.size > 0) {
      const sampleClients = (clients as Client[]).slice(0, 3);
      const sampleRiskKeys = Array.from(clientRiskMap.keys()).slice(0, 3);
      console.log('[Clients] Comparaison IDs:', {
        sampleClientIds: sampleClients.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })),
        sampleRiskKeys,
        matchExample: sampleClients.map(c => ({
          clientId: c.id,
          hasInMap: clientRiskMap.has(c.id),
          riskLevel: clientRiskMap.get(c.id)?.riskLevel || 'none',
        })),
      });
    }
  }, [clients, clientRiskMap]);

  // Mettre à jour selectedClient quand les données des clients sont rechargées
  useEffect(() => {
    if (selectedClient && clients && Array.isArray(clients)) {
      const updatedClient = clients.find((c: Client) => c.id === selectedClient.id);
      if (updatedClient) {
        setSelectedClient(updatedClient);
      }
    }
  }, [clients, selectedClient?.id]);

  const { data: stylistes } = useQuery({
    queryKey: ["/api/salons", salon?.id, "stylistes"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/salons/${salon?.id}/stylistes`);
      return response.json();
    },
    enabled: !!salon?.id,
    retry: false,
  });

  const { data: services } = useQuery({
    queryKey: ["/api/salons", salon?.id, "services"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/salons/${salon?.id}/services`);
      return response.json();
    },
    enabled: !!salon?.id,
    retry: false,
  });

  const { data: appointments } = useQuery({
    queryKey: ["/api/salons", salon?.id, "appointments"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/salons/${salon?.id}/appointments`);
      const data = await response.json();
      console.log('[Clients] Appointments récupérés:', data);
      console.log('[Clients] Premier appointment exemple:', data?.[0]);
      return data;
    },
    enabled: !!salon?.id,
    retry: false,
    refetchOnWindowFocus: true,
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      ownerNotes: "",
      preferredStylistId: "",
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const response = await apiRequest("POST", "/api/clients", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Client ajouté",
        description: "Le client a été ajouté avec succès.",
      });
      setIsDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous devez être connecté. Redirection...",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/salon-login"), 500);
        return;
      }
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le client.",
        variant: "destructive",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ClientFormData>;
    }) => {
      const response = await apiRequest("PUT", `/api/clients/${id}`, data);
      return response.json();
    },
    onSuccess: (updatedClient) => {
      toast({
        title: "Client modifié",
        description: "Le client a été modifié avec succès.",
      });
      setIsDialogOpen(false);
      setEditingClient(null);
      form.reset();
      
      // Mettre à jour selectedClient si c'est le même client qui est affiché
      if (selectedClient && selectedClient.id === updatedClient.id) {
        setSelectedClient(updatedClient);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous devez être connecté. Redirection...",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/salon-login"), 500);
        return;
      }
      
      // Vérifier si l'erreur indique que la colonne owner_notes n'existe pas
      const errorMessage = error?.message || error?.error || '';
      const errorHint = error?.hint || '';
      
      if (errorMessage.includes('owner_notes') || errorHint.includes('owner_notes') || errorMessage.includes('column') || errorMessage.includes('42703') || errorMessage.includes('PGRST204')) {
        toast({
          title: "Colonne manquante",
          description: "La colonne 'owner_notes' n'existe pas dans la base de données. Veuillez l'ajouter dans Supabase SQL Editor.",
          variant: "destructive",
          duration: 10000,
        });
        console.error('❌ Erreur: La colonne owner_notes n\'existe pas');
        console.error('📝 Exécutez dans Supabase SQL Editor:');
        console.error('ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_notes text;');
        return;
      }
      
      toast({
        title: "Erreur",
        description: errorMessage || "Impossible de modifier le client.",
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Client supprimé",
        description: "Le client a été supprimé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous devez être connecté. Redirection...",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/salon-login"), 500);
        return;
      }
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le client.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    form.reset({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone || "",
      ownerNotes: client.ownerNotes || "",
      preferredStylistId: client.preferredStylistId || "none",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) {
      deleteClientMutation.mutate(id);
    }
  };

  const handleViewDetails = (client: Client) => {
    setSelectedClient(client);
    setIsDetailsDialogOpen(true);
  };

  const onSubmit = (data: ClientFormData) => {
    console.log('[Clients] Données du formulaire (avant nettoyage):', data);
    console.log('[Clients] ownerNotes du formulaire:', data.ownerNotes);
    console.log('[Clients] Type de ownerNotes:', typeof data.ownerNotes);
    console.log('[Clients] Toutes les clés de data:', Object.keys(data));
    
    // Récupérer ownerNotes depuis le formulaire directement
    const formValues = form.getValues();
    console.log('[Clients] Valeurs du formulaire (form.getValues()):', formValues);
    console.log('[Clients] ownerNotes depuis form.getValues():', formValues.ownerNotes);
    
    const cleanedData: ClientFormData = {
      ...data,
      // important : normaliser l'absence de styliste
      // "" ou "none" => null côté API/DB
      preferredStylistId:
        !data.preferredStylistId || data.preferredStylistId === "none"
          ? (null as unknown as any)
          : data.preferredStylistId,
      // S'assurer que ownerNotes est inclus (même si vide)
      // Essayer de récupérer depuis formValues si data.ownerNotes est undefined
      ownerNotes: data.ownerNotes !== undefined 
        ? (data.ownerNotes || "") 
        : (formValues.ownerNotes !== undefined ? (formValues.ownerNotes || "") : ""),
    };

    console.log('[Clients] Données à envoyer:', cleanedData);
    console.log('[Clients] ownerNotes final:', cleanedData.ownerNotes);

    if (editingClient) {
      updateClientMutation.mutate({ id: editingClient.id, data: cleanedData });
    } else {
      createClientMutation.mutate(cleanedData);
    }
  };

  const filteredClients =
    clients?.filter((client: Client) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        client.firstName.toLowerCase().includes(searchLower) ||
        client.lastName.toLowerCase().includes(searchLower) ||
        client.email.toLowerCase().includes(searchLower) ||
        (client.phone && client.phone.toLowerCase().includes(searchLower))
      );
      
      // Filtrage par styliste préféré
      const matchesStylistFilter = selectedStylistFilter === "all" || 
        (selectedStylistFilter === "none" && !client.preferredStylistId) ||
        (selectedStylistFilter !== "none" && client.preferredStylistId === selectedStylistFilter);
      
      // Filtrage par niveau de risque
      let matchesRiskFilter = true;
      if (selectedRiskFilter !== 'all') {
        const clientRisk = clientRiskMap.get(client.id);
        if (selectedRiskFilter === 'high') {
          matchesRiskFilter = clientRisk?.riskLevel === 'high';
        } else if (selectedRiskFilter === 'medium') {
          matchesRiskFilter = clientRisk?.riskLevel === 'medium';
        }
      }
      
      return matchesSearch && matchesStylistFilter && matchesRiskFilter;
    }) || [];

  const getClientAppointments = (clientId: string) => {
    return (
      appointments
        ?.filter(
          (appointment: Appointment) => appointment.clientId === clientId,
        )
        .sort(
          (a: Appointment, b: Appointment) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
        ) || []
    );
  };

  const getPreferredStylistName = (stylistId?: string | null) => {
    if (!stylistId) return null;
    const stylist = stylistes?.find((s: Styliste) => s.id === stylistId);
    return stylist ? `${stylist.firstName} ${stylist.lastName}` : null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center">
              <Users className="mr-3 h-8 w-8" />
              Gestion des Clients
            </h1>
            <p className="text-muted-foreground">Gérez votre base clients</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="btn-primary px-6 py-3 text-white font-medium"
                onClick={() => {
                  setEditingClient(null);
                  form.reset();
                }}
                data-testid="button-add-client"
              >
                <Plus className="mr-2 h-5 w-5" />
                Ajouter un client
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? "Modifier le client" : "Ajouter un client"}
                </DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prénom</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Marie"
                              {...field}
                              data-testid="input-client-firstname"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Dubois"
                              {...field}
                              data-testid="input-client-lastname"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="marie@example.com"
                              {...field}
                              data-testid="input-client-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Téléphone</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="06 12 34 56 78"
                              {...field}
                              value={field.value ?? ""}
                              data-testid="input-client-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="preferredStylistId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coiffeur·euse préféré·e (optionnel·le)</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-preferred-stylist">
                              <SelectValue placeholder="Choisir un·e coiffeur·euse" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">
                              Aucune préférence
                            </SelectItem>
                            {stylistes?.map((stylist: Styliste) => (
                              <SelectItem key={stylist.id} value={stylist.id}>
                                {stylist.firstName} {stylist.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ownerNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes privées (post-it)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Notes privées visibles uniquement par vous..."
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-client-owner-notes"
                            className="min-h-[100px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      data-testid="button-cancel-client"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        createClientMutation.isPending ||
                        updateClientMutation.isPending
                      }
                      data-testid="button-save-client"
                    >
                      {createClientMutation.isPending ||
                      updateClientMutation.isPending
                        ? "Enregistrement..."
                        : "Enregistrer"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Barre de recherche */}
        <Card className="glassmorphism-card mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Rechercher par nom, email ou téléphone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-clients"
                />
              </div>
              
              {/* Filtres par niveau de risque */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={selectedRiskFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedRiskFilter('all')}
                  className={`transition-all duration-200 ${
                    selectedRiskFilter === 'all'
                      ? "bg-white text-black border-2 border-[var(--primary)] shadow-md hover:bg-[var(--primary)]/10 hover:shadow-lg hover:scale-105"
                      : "hover:bg-[var(--primary)]/10 hover:text-black hover:border-[var(--primary)]/30 hover:shadow-sm hover:scale-105"
                  }`}
                >
                  Tous
                </Button>
                <Button
                  type="button"
                  variant={selectedRiskFilter === 'medium' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedRiskFilter(selectedRiskFilter === 'medium' ? 'all' : 'medium')}
                  className={`transition-all duration-200 ${
                    selectedRiskFilter === 'medium'
                      ? "bg-yellow-50 text-yellow-700 border-2 border-yellow-300 shadow-md hover:bg-yellow-100 hover:shadow-lg hover:scale-105"
                      : "hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300 hover:shadow-sm hover:scale-105"
                  }`}
                >
                  🟡 Clients à surveiller
                </Button>
                <Button
                  type="button"
                  variant={selectedRiskFilter === 'high' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedRiskFilter(selectedRiskFilter === 'high' ? 'all' : 'high')}
                  className={`transition-all duration-200 ${
                    selectedRiskFilter === 'high'
                      ? "bg-red-50 text-red-700 border-2 border-red-300 shadow-md hover:bg-red-100 hover:shadow-lg hover:scale-105"
                      : "hover:bg-red-50 hover:text-red-700 hover:border-red-300 hover:shadow-sm hover:scale-105"
                  }`}
                >
                  🔴 Clients à risque
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interface de filtrage par coiffeur·euse préféré·e */}
        <Card className="glassmorphism-card mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Filtrer par coiffeur·euse préféré·e</h2>
                {selectedStylistFilter !== "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedStylistFilter("all")}
                    className="text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-300 hover:shadow-sm hover:scale-105 transition-all duration-200"
                  >
                    Effacer le filtre
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedStylistFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStylistFilter("all")}
                  className={`transition-all duration-200 ${
                    selectedStylistFilter === "all"
                      ? "bg-white text-black border-2 border-[var(--primary)] shadow-md hover:bg-[var(--primary)]/10 hover:shadow-lg hover:scale-105"
                      : "hover:bg-[var(--primary)]/10 hover:text-black hover:border-[var(--primary)]/30 hover:shadow-sm hover:scale-105"
                  }`}
                >
                  Tous les clients
                </Button>
                <Button
                  variant={selectedStylistFilter === "none" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStylistFilter("none")}
                  className={`transition-all duration-200 ${
                    selectedStylistFilter === "none"
                      ? "bg-white text-black border-2 border-[var(--primary)] shadow-md hover:bg-[var(--primary)]/10 hover:shadow-lg hover:scale-105"
                      : "hover:bg-[var(--primary)]/10 hover:text-black hover:border-[var(--primary)]/30 hover:shadow-sm hover:scale-105"
                  }`}
                >
                  Sans préférence
                </Button>
                {stylistes?.map((stylist: Styliste) => (
                  <Button
                    key={stylist.id}
                    variant={selectedStylistFilter === stylist.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedStylistFilter(stylist.id)}
                    className={`transition-all duration-200 ${
                      selectedStylistFilter === stylist.id
                        ? "bg-white text-black border-2 border-[var(--primary)] shadow-md hover:bg-[var(--primary)]/10 hover:shadow-lg hover:scale-105"
                        : "hover:bg-[var(--primary)]/10 hover:text-black hover:border-[var(--primary)]/30 hover:shadow-sm hover:scale-105"
                    }`}
                  >
                    {stylist.firstName} {stylist.lastName}
                  </Button>
                ))}
              </div>

              {(selectedStylistFilter !== "all" || selectedRiskFilter !== 'all') && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  <span>Filtres actifs :</span>
                  {selectedStylistFilter !== "all" && (
                    <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setSelectedStylistFilter("all")}>
                      {selectedStylistFilter === "none" 
                        ? "Sans préférence" 
                        : getPreferredStylistName(selectedStylistFilter) || "Coiffeur·euse inconnu·e"
                      }
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  )}
                  {selectedRiskFilter !== 'all' && (
                    <Badge 
                      variant="secondary" 
                      className="text-xs cursor-pointer" 
                      onClick={() => setSelectedRiskFilter('all')}
                    >
                      {selectedRiskFilter === 'high' ? '🔴 Clients à risque' : '🟡 Clients à surveiller'}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {clientsLoading ? (
          <div className="flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <Card className="glassmorphism-card">
            <CardContent className="p-0">
              {filteredClients.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {(searchTerm || selectedStylistFilter !== "all" || selectedRiskFilter !== 'all') ? "Aucun client trouvé" : "Aucun client"}
                  </h3>
                  <p className="text-muted-foreground">
                    {(searchTerm || selectedStylistFilter !== "all" || selectedRiskFilter !== 'all')
                      ? "Aucun client ne correspond aux filtres sélectionnés."
                      : "Ajoutez votre premier client pour commencer."}
                  </p>
                  {(searchTerm || selectedStylistFilter !== "all" || selectedRiskFilter !== 'all') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedStylistFilter("all");
                        setSelectedRiskFilter('all');
                      }}
                      className="mt-4 hover:bg-red-50 hover:text-red-600 hover:border-red-300 hover:shadow-sm hover:scale-105 transition-all duration-200"
                    >
                      Effacer tous les filtres
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Coiffeur·euse préféré·e</TableHead>
                      <TableHead>Dernière visite</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client: Client) => {
                      const clientAppointments = getClientAppointments(
                        client.id,
                      );
                      const lastAppointment = clientAppointments[0];
                      return (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {client.firstName[0]}
                                  {client.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-medium">
                                  {client.firstName} {client.lastName}
                                </div>
                                {client.ownerNotes && client.ownerNotes.trim() && (
                                  <div className="relative group">
                                    <StickyNote className="h-4 w-4 text-yellow-600" />
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      Ce client a des notes privées
                                    </div>
                                  </div>
                                )}
                                {(() => {
                                  // Récupérer le risque du client directement par son ID
                                  const clientRisk = clientRiskMap.get(client.id);
                                  
                                  // Debug en dev uniquement pour les premiers clients
                                  if (import.meta.env.DEV && filteredClients.indexOf(client) < 2) {
                                    console.log('[Clients] Rendu client:', {
                                      clientId: client.id,
                                      clientName: `${client.firstName} ${client.lastName}`,
                                      hasRisk: clientRiskMap.has(client.id),
                                      riskLevel: clientRisk?.riskLevel || 'none',
                                      mapSize: clientRiskMap.size,
                                      allRiskKeys: Array.from(clientRiskMap.keys()),
                                    });
                                  }
                                  
                                  // Afficher le badge avec tooltip uniquement pour high ou medium
                                  if (clientRisk && (clientRisk.riskLevel === 'high' || clientRisk.riskLevel === 'medium')) {
                                    const tooltipText = `${clientRisk.noShowCount} absent(s), ${clientRisk.cancelledCount} annulé(s) (90j)`;
                                    return (
                                      <div className="relative group">
                                        <ClientRiskBadge riskLevel={clientRisk.riskLevel} className="ml-2" />
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                          {tooltipText}
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center text-muted-foreground">
                                <Mail className="mr-1 h-3 w-3" />
                                {client.email}
                              </div>
                              {client.phone && (
                                <div className="flex items-center text-muted-foreground">
                                  <Phone className="mr-1 h-3 w-3" />
                                  {client.phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getPreferredStylistName(
                              client.preferredStylistId,
                            ) || (
                              <span className="text-muted-foreground">
                                Aucune préférence
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lastAppointment ? (
                              <div className="text-sm">
                                {format(
                                  parseISO(lastAppointment.startTime),
                                  "d MMM yyyy",
                                  { locale: fr },
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Jamais
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(client)}
                                data-testid={`button-view-client-${client.id}`}
                              >
                                <User className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(client)}
                                data-testid={`button-edit-client-${client.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(client.id)}
                                data-testid={`button-delete-client-${client.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Détails client */}
        <Dialog
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Détails du client</DialogTitle>
            </DialogHeader>

            {selectedClient && (
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-lg">
                      {selectedClient.firstName[0]}
                      {selectedClient.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-semibold">
                        {selectedClient.firstName} {selectedClient.lastName}
                      </h3>
                      {selectedClient.ownerNotes && selectedClient.ownerNotes.trim() && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 flex items-center gap-1">
                          <StickyNote className="h-3 w-3" />
                          Note privée
                        </Badge>
                      )}
                      {clientRiskMap.has(selectedClient.id) && (() => {
                        const risk = clientRiskMap.get(selectedClient.id)!;
                        if (risk.riskLevel === 'high') {
                          return (
                            <Badge variant="destructive" className="text-xs">
                              ⚠️ Client à risque
                            </Badge>
                          );
                        } else if (risk.riskLevel === 'medium') {
                          return (
                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                              Client à surveiller
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Mail className="mr-2 h-4 w-4" />
                        {selectedClient.email}
                      </div>
                      {selectedClient.phone && (
                        <div className="flex items-center">
                          <Phone className="mr-2 h-4 w-4" />
                          {selectedClient.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats de risque client */}
                {clientRiskMap.has(selectedClient.id) && (() => {
                  const risk = clientRiskMap.get(selectedClient.id)!;
                  return (
                    <div className="bg-muted/50 p-4 rounded-lg border">
                      <h4 className="font-semibold mb-2">Historique de risque (90 jours)</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Absences</div>
                          <div className="font-semibold text-lg">{risk.noShowCount}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Annulations</div>
                          <div className="font-semibold text-lg">{risk.cancelledCount}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Score</div>
                          <div className="font-semibold text-lg">{risk.riskScore}/100</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {selectedClient.preferredStylistId && (
                  <div>
                    <h4 className="font-semibold mb-2">Coiffeur·euse préféré·e</h4>
                    <p>
                      {getPreferredStylistName(
                        selectedClient.preferredStylistId,
                      )}
                    </p>
                  </div>
                )}

                {selectedClient.ownerNotes && selectedClient.ownerNotes.trim() && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold mb-2 flex items-center text-yellow-800">
                      <span className="text-yellow-600 mr-2">📌</span>
                      Notes privées
                    </h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedClient.ownerNotes}
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-4 flex items-center">
                    <Calendar className="mr-2 h-4 w-4" />
                    Historique des rendez-vous
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {getClientAppointments(selectedClient.id).map(
                      (appointment: EnrichedAppointment) => {
                        const appointmentDate = typeof appointment.startTime === 'string' 
                          ? parseISO(appointment.startTime)
                          : new Date(appointment.startTime);
                        
                        // Récupérer les informations du service (depuis l'appointment enrichi ou depuis la liste des services)
                        let serviceInfo = appointment.service;
                        if (!serviceInfo && appointment.serviceId && services && Array.isArray(services)) {
                          const foundService = services.find((s: any) => s.id === appointment.serviceId);
                          if (foundService) {
                            serviceInfo = {
                              id: foundService.id,
                              name: foundService.name,
                              durationMinutes: foundService.durationMinutes || foundService.duration_minutes || foundService.duration || 0,
                              price: foundService.price ? (typeof foundService.price === 'number' ? foundService.price : parseFloat(String(foundService.price))) : null,
                            };
                          }
                        }
                        
                        // Récupérer les informations du styliste (depuis l'appointment enrichi ou depuis la liste des stylistes)
                        let stylistInfo = appointment.stylist;
                        if (!stylistInfo && appointment.stylistId && stylistes && Array.isArray(stylistes)) {
                          const foundStylist = stylistes.find((s: any) => s.id === appointment.stylistId);
                          if (foundStylist) {
                            const fullName = `${foundStylist.firstName || foundStylist.first_name || ''} ${foundStylist.lastName || foundStylist.last_name || ''}`.trim();
                            stylistInfo = {
                              id: foundStylist.id,
                              fullName: fullName || foundStylist.name || 'Coiffeur·euse inconnu·e',
                              firstName: foundStylist.firstName || foundStylist.first_name || '',
                              lastName: foundStylist.lastName || foundStylist.last_name || '',
                            };
                          }
                        }
                        
                        const serviceName = serviceInfo?.name || 'Service inconnu';
                        const stylistName = stylistInfo?.fullName || appointment.stylistId || 'Coiffeur·euse inconnu·e';
                        const duration = serviceInfo?.durationMinutes || 'N/A';
                        const price = serviceInfo?.price ?? appointment.totalAmount;
                        const priceFormatted = price !== null && price !== undefined 
                          ? `${typeof price === 'number' ? price.toFixed(2) : parseFloat(String(price)).toFixed(2)} €` 
                          : 'N/A';
                        
                        return (
                          <div
                            key={appointment.id}
                            className="border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    <span className="font-semibold text-foreground">
                                      {format(appointmentDate, "EEEE d MMMM yyyy", { locale: fr })}
                                    </span>
                                  </div>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="font-semibold text-foreground">
                                    {format(appointmentDate, "HH:mm", { locale: fr })}
                                  </span>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="font-medium text-foreground">
                                    {stylistName}
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="text-sm">
                                    <span className="font-semibold text-foreground">Service :</span>{' '}
                                    <span className="text-foreground">{serviceName}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span>
                                      <span className="font-medium text-foreground">Durée :</span>{' '}
                                      {typeof duration === 'number' ? `${duration} min` : duration}
                                    </span>
                                    <span>·</span>
                                    <span>
                                      <span className="font-medium text-foreground">Prix :</span>{' '}
                                      <span className="text-foreground">{priceFormatted}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={`${getStatusColor(appointment.status)} shrink-0`}
                              >
                                {getStatusLabel(appointment.status)}
                              </Badge>
                            </div>
                          </div>
                        );
                      },
                    )}
                    {getClientAppointments(selectedClient.id).length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        Aucun rendez-vous dans l'historique
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => setIsDetailsDialogOpen(false)}
                    data-testid="button-close-client-details"
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

/** util locale pour le badge statut (même logique qu'avant) */
function getStatusColor(status: string) {
  switch (status) {
    case "confirmed":
    case "scheduled":
      return "bg-green-100 text-green-700 border-green-300";
    case "cancelled":
      return "bg-red-100 text-red-700 border-red-300";
    case "completed":
      return "bg-blue-100 text-blue-700 border-blue-300";
    case "no_show":
      return "bg-orange-100 text-orange-700 border-orange-300";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

/** Fonction pour traduire les statuts en français */
function getStatusLabel(status: string) {
  const statusMap: Record<string, string> = {
    "pending": "En attente",
    "confirmed": "Confirmé",
    "scheduled": "Planifié",
    "completed": "Terminé",
    "cancelled": "Annulé",
    "no_show": "Absent",
  };
  return statusMap[status] || status;
}
