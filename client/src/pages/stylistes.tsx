import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Edit, Trash2, Mail, Phone, X, ChevronDown, Check } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStylistSchema, type Styliste } from "@shared/schema";
import { z } from "zod";
import Navigation from "@/components/navigation";

const stylistFormSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  photoUrl: z.string().optional(),
  specialties: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  color: z.string().optional(),
});

type StylistFormData = z.infer<typeof stylistFormSchema>;

export default function Stylists() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStylist, setEditingStylist] = useState<Styliste | null>(null);
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [showNewSpecialtyInput, setShowNewSpecialtyInput] = useState(false);
  const [isSpecialtyDropdownOpen, setIsSpecialtyDropdownOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Non autorisé",
        description: "Vous devez être connecté pour gérer les coiffeurs et coiffeuses.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSpecialtyDropdownOpen(false);
      }
    };

    if (isSpecialtyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSpecialtyDropdownOpen]);

  const { data: salon } = useQuery({
    queryKey: ["/api/salon"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/salon");
      return response.json();
    },
    retry: false,
  }) as { data: { id?: string } | undefined };

  const { data: stylistes, isLoading: stylistesLoading } = useQuery({
    queryKey: salon?.id ? ["/api/salons", salon.id, "stylistes"] : ["/api/stylistes"],
    queryFn: async () => {
      const url = salon?.id ? `/api/salons/${salon.id}/stylistes` : `/api/stylistes`;
      const response = await apiRequest("GET", url);
      return response.json();
    },
    retry: false,
  }) as { data: any[] | undefined, isLoading: boolean };

  // Récupérer toutes les spécialités existantes
  const existingSpecialties = React.useMemo(() => {
    const specialties = new Set<string>();
    
    // Ajouter les catégories par défaut en premier
    const defaultCategories = ["Homme", "Femme", "Enfant"];
    defaultCategories.forEach(category => specialties.add(category));
    
    // Ajouter les spécialités des stylistes
    if (stylistes) {
      stylistes.forEach((stylist: any) => {
        if (stylist.specialties && Array.isArray(stylist.specialties)) {
          stylist.specialties.forEach((specialty: string) => {
            if (specialty.trim()) {
              specialties.add(specialty.trim());
            }
          });
        }
      });
    }
    
    // Trier en gardant les catégories par défaut en premier
    const sortedSpecialties = Array.from(specialties).sort();
    const defaultFirst = [...defaultCategories];
    const others = sortedSpecialties.filter(spec => !defaultCategories.includes(spec));
    
    return [...defaultFirst, ...others];
  }, [stylistes]);

  // Fonctions de gestion des filtres
  const toggleFilter = (specialty: string) => {
    setSelectedFilters(prev =>
      prev.includes(specialty)
        ? prev.filter(f => f !== specialty)
        : [...prev, specialty]
    );
  };

  const clearAllFilters = () => {
    setSelectedFilters([]);
  };

  const isFilterActive = (specialty: string) => {
    return selectedFilters.includes(specialty);
  };

  // Séparer et trier les stylistes par statut (actifs/inactifs) et par date de modification
  const { activeStylists, inactiveStylists } = React.useMemo(() => {
    let filtered = stylistes || [];
    
    // Filtrage par spécialités
    if (selectedFilters.length > 0) {
      filtered = filtered.filter((stylist: any) => {
        return stylist.specialties && stylist.specialties.some((specialty: string) => selectedFilters.includes(specialty));
      });
    }
    
    // Séparer en actifs et inactifs
    const active: any[] = [];
    const inactive: any[] = [];
    
    filtered.forEach((stylist: any) => {
      const isActive = stylist.isActive !== false; // Par défaut actif si non spécifié
      if (isActive) {
        active.push(stylist);
      } else {
        inactive.push(stylist);
      }
    });
    
    // Trier chaque groupe par updatedAt (plus récent en premier)
    const sortByUpdatedAt = (a: any, b: any) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA; // Décroissant (plus récent en premier)
    };
    
    active.sort(sortByUpdatedAt);
    inactive.sort(sortByUpdatedAt);
    
    // Appliquer le filtre de statut si nécessaire
    if (statusFilter === 'active') {
      return { activeStylists: active, inactiveStylists: [] };
    } else if (statusFilter === 'inactive') {
      return { activeStylists: [], inactiveStylists: inactive };
    }
    
    return { activeStylists: active, inactiveStylists: inactive };
  }, [stylistes, selectedFilters, statusFilter]);
  
  // Pour la compatibilité avec l'ancien code (affichage vide si aucun résultat)
  const hasAnyStylists = activeStylists.length > 0 || inactiveStylists.length > 0;

  const form = useForm<StylistFormData>({
    resolver: zodResolver(stylistFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      photoUrl: "",
      specialties: [],
      isActive: true,
      color: "",
    },
  });

  const createStylistMutation = useMutation({
    mutationFn: async (data: StylistFormData) => {
      const url = salon?.id ? `/api/salons/${salon.id}/stylistes` : `/api/stylistes`;
      const response = await apiRequest("POST", url, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Coiffeur·euse ajouté·e",
        description: "La fiche coiffeur·euse a été ajoutée avec succès.",
      });
      setIsDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: salon?.id ? ["/api/salons", salon.id, "stylistes"] : ["/api/stylistes"] });
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
        description: (error as Error)?.message || "Impossible d'ajouter la fiche coiffeur·euse.",
        variant: "destructive",
      });
    },
  });

  const updateStylistMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<StylistFormData> }) => {
      console.log(`[updateStylistMutation] Envoi PUT /api/stylists/${id} avec data:`, JSON.stringify(data, null, 2));
      const response = await apiRequest("PUT", `/api/stylists/${id}`, data);
      const result = await response.json();
      console.log(`[updateStylistMutation] Réponse reçue:`, JSON.stringify(result, null, 2));
      return result;
    },
    onSuccess: (data) => {
      console.log(`[updateStylistMutation] ✅ Succès, données retournées:`, JSON.stringify(data, null, 2));
      toast({
        title: "Coiffeur·euse modifié·e",
        description: "La fiche coiffeur·euse a été modifiée avec succès.",
      });
      setIsDialogOpen(false);
      setEditingStylist(null);
      form.reset();
      // Invalider toutes les queries liées aux stylistes
      queryClient.invalidateQueries({ queryKey: salon?.id ? ["/api/salons", salon.id, "stylistes"] : ["/api/stylistes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/salons", salon?.id, "stylistes"] });
      // Forcer le rechargement
      queryClient.refetchQueries({ queryKey: salon?.id ? ["/api/salons", salon.id, "stylistes"] : ["/api/stylistes"] });
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
        description: (error as Error)?.message || "Impossible de modifier la fiche coiffeur·euse.",
        variant: "destructive",
      });
    },
  });

  const deleteStylistMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/stylists/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Coiffeur·euse supprimé·e",
        description: "La fiche coiffeur·euse a été supprimée avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: salon?.id ? ["/api/salons", salon.id, "stylistes"] : ["/api/stylistes"] });
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
        description: "Impossible de supprimer la fiche coiffeur·euse.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (stylist: Styliste) => {
    setEditingStylist(stylist);
    form.reset({
      firstName: stylist.firstName,
      lastName: stylist.lastName,
      email: stylist.email || "",
      phone: stylist.phone || "",
      photoUrl: stylist.photoUrl || "",
      specialties: stylist.specialties || [],
      isActive: stylist.isActive ?? true,
      color: stylist.color || "",
    });
    setIsDialogOpen(true);
    setIsSpecialtyDropdownOpen(false); // Fermer le dropdown quand on ouvre le modal
  };

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr·e de vouloir supprimer ce ou cette coiffeur·euse ?")) {
      deleteStylistMutation.mutate(id);
    }
  };

  const onSubmit = (data: any) => {
    console.log("onSubmit called with data:", data);
    console.log("onSubmit - color field:", data.color);
    
    // Validation manuelle simple
    if (!data.firstName?.trim() || !data.lastName?.trim()) {
      toast({
        title: "Erreur",
        description: "Le prénom et le nom sont requis.",
        variant: "destructive",
      });
      return;
    }
    
    // S'assurer que le champ color est inclus dans les données
    const dataToSend = {
      ...data,
      color: data.color || null, // Inclure color même si vide
    };
    
    console.log("onSubmit - dataToSend:", dataToSend);
    
    if (editingStylist) {
      updateStylistMutation.mutate({ id: editingStylist.id, data: dataToSend });
    } else {
      createStylistMutation.mutate(dataToSend);
    }
  };

  const addSpecialty = (specialty: string) => {
    if (specialty.trim()) {
      const currentSpecialties = form.getValues("specialties");
      if (!currentSpecialties.includes(specialty.trim())) {
        form.setValue("specialties", [...currentSpecialties, specialty.trim()]);
      }
      setSpecialtyInput("");
      setShowNewSpecialtyInput(false);
      setIsSpecialtyDropdownOpen(false); // Fermer le dropdown après sélection
    }
  };

  const addNewSpecialty = () => {
    if (specialtyInput.trim()) {
      addSpecialty(specialtyInput.trim());
    }
  };

  const removeSpecialty = (index: number) => {
    const currentSpecialties = form.getValues("specialties");
    form.setValue("specialties", currentSpecialties.filter((_, i) => i !== index));
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
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center">
              <Users className="mr-3 h-8 w-8" />
              Gestion des coiffeurs et coiffeuses
            </h1>
            <p className="text-muted-foreground">Gérez votre équipe de coiffeurs et coiffeuses</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="btn-primary px-6 py-3 text-white font-medium"
                onClick={() => {
                  setEditingStylist(null);
                  form.reset();
                  setIsSpecialtyDropdownOpen(false); // Fermer le dropdown quand on ouvre le modal
                }}
                data-testid="button-add-stylist"
              >
                <Plus className="mr-2 h-5 w-5" />
                Ajouter un·e coiffeur·euse
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingStylist ? "Modifier le ou la coiffeur·euse" : "Ajouter un·e coiffeur·euse"}
                </DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <input type="submit" style={{ display: 'none' }} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prénom</FormLabel>
                          <FormControl>
                            <Input placeholder="Sarah" {...field} data-testid="input-stylist-firstname" />
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
                            <Input placeholder="Martin" {...field} data-testid="input-stylist-lastname" />
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
                            <Input type="email" placeholder="sarah@example.com" {...field} data-testid="input-stylist-email" />
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
                            <Input placeholder="06 12 34 56 78" {...field} data-testid="input-stylist-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de la photo</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} data-testid="input-stylist-photo" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <Label>Spécialités</Label>
                    <div className="space-y-3 mt-2">
                      {/* Dropdown personnalisé pour les spécialités existantes */}
<div className="relative w-full" ref={dropdownRef}>
  <button
    type="button"
    onClick={() => setIsSpecialtyDropdownOpen(!isSpecialtyDropdownOpen)}
    aria-expanded={isSpecialtyDropdownOpen}
                        className={[
                          "w-full select-none rounded-md",
                          "px-4 py-2 text-sm transition",
                          "hover:bg-gray-100",
                          "focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          "flex items-center justify-between gap-2",
                        ].join(" ")}
    style={{
      backgroundColor: "#ffffff",
      color: "#000000",
      border: "2px solid #D1D5DB",
    }}
  >
    <span>Choisir une spécialité existante</span>
    <ChevronDown
      className={`h-4 w-4 transition-transform ${isSpecialtyDropdownOpen ? "rotate-180" : ""}`}
      aria-hidden="true"
    />
  </button>

  {isSpecialtyDropdownOpen && (
    <div
      className="absolute z-50 mt-2 w-full rounded-xl shadow-lg animate-fade-in-up"
      role="listbox"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #D1D5DB",
        maxHeight: "200px",
        overflowY: "auto",
      }}
    >
      {existingSpecialties.length > 0 ? (
        <ul className="py-1">
          {existingSpecialties.map((specialty) => {
            const isSelected = form.watch("specialties").includes(specialty);
            return (
              <li
                key={specialty}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  if (isSelected) {
                    // Désélectionner la spécialité
                    const currentSpecialties = form.getValues("specialties");
                    form.setValue("specialties", currentSpecialties.filter(s => s !== specialty));
                  } else {
                    // Sélectionner la spécialité
                    addSpecialty(specialty);
                  }
                }}
                className={[
                  "px-4 py-2 text-sm cursor-pointer",
                  isSelected ? "opacity-60" : "hover:bg-[color-mix(in_srgb,_white_92%,_var(--primary)_8%)]",
                ].join(" ")}
                style={{ color: "#000000" }}
              >
                <span className="text-sm font-medium">{specialty}</span>
                {isSelected && <Check className="ml-2 inline h-4 w-4 text-gray-600" />}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-4 py-3">
          <p className="text-sm text-gray-500 italic text-center">
            Aucune spécialité enregistrée. Ajoutez-en une ci-dessous.
          </p>
        </div>
      )}
    </div>
  )}
</div>

                      {/* Bouton pour ajouter une nouvelle spécialité */}
                      {!showNewSpecialtyInput ? (
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowNewSpecialtyInput(true)}
                          className="w-full transition-colors" 
                          style={{ 
                            color: '#1f2937', 
                            borderColor: 'rgba(147, 51, 234, 0.5)',
                            backgroundColor: '#ffffff',
                            border: '2px solid rgba(147, 51, 234, 0.5)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.8)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                            e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.5)';
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Ajouter une nouvelle spécialité
                        </Button>
                      ) : (
                        <div className="flex space-x-2">
                          <Input
                            value={specialtyInput}
                            onChange={(e) => setSpecialtyInput(e.target.value)}
                            placeholder="Nouvelle spécialité"
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addNewSpecialty())}
                            data-testid="input-stylist-specialty"
                            autoFocus
                          />
                          <Button type="button" onClick={addNewSpecialty} data-testid="button-add-specialty">
                            Ajouter
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setShowNewSpecialtyInput(false);
                              setSpecialtyInput("");
                            }}
                            className="text-black hover:text-black"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      
                      {/* Affichage des spécialités sélectionnées */}
                      {form.watch("specialties").length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Spécialités sélectionnées :</Label>
                          <div className="flex flex-wrap gap-2">
                            {form.watch("specialties").map((specialty, index) => (
                              <span
                                key={index}
                                className={[
                                  "inline-flex items-center gap-2 rounded-full",
                                  "px-3 py-1 text-sm",
                                  "border transition select-none",
                                  "text-[var(--primary)]",
                                  "border-[var(--primary)]/30",
                                  "bg-[var(--primary)]/5",
                                  "hover:bg-[var(--primary)]/10",
                                  "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]",
                                ].join(" ")}
                              >
                                <span className="font-medium">{specialty}</span>
                                <span
                                  onClick={() => removeSpecialty(index)}
                                  className="ml-1 px-1 text-gray-500 cursor-pointer"
                                  style={{ background: 'transparent', border: 'none' }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      removeSpecialty(index);
                                    }
                                  }}
                                  aria-label={`Retirer ${specialty}`}
                                >
                                  ×
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-stylist-active"
                          />
                        </FormControl>
                        <FormLabel>Coiffeur·euse actif·ve</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <ColorPicker
                            value={field.value || "#6366f1"}
                            onChange={field.onChange}
                            label="Couleur dans le calendrier"
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
                      data-testid="button-cancel-stylist"
                    >
                      Annuler
                    </Button>
                    <Button 
                      type="button"
                      disabled={createStylistMutation.isPending || updateStylistMutation.isPending}
                      data-testid="button-save-stylist"
                      onClick={(e) => {
                        e.preventDefault();
                        const formData = form.getValues();
                        console.log("Forcing submission with data:", formData);
                        onSubmit(formData);
                      }}
                    >
                      {createStylistMutation.isPending || updateStylistMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Interface de filtrage */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Filtrer les coiffeur·euses</h2>
            {(selectedFilters.length > 0 || statusFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearAllFilters();
                  setStatusFilter('all');
                }}
                className="text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-300 hover:shadow-sm hover:scale-105 transition-all duration-200"
              >
                Effacer tous les filtres
              </Button>
            )}
          </div>

          {/* Filtrage par statut */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Statut</Label>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className={`transition-all duration-200 ${
                  statusFilter === 'all'
                    ? "bg-white text-black border-2 border-[var(--primary)] shadow-md hover:bg-[var(--primary)]/10 hover:shadow-lg hover:scale-105"
                    : "hover:bg-[var(--primary)]/10 hover:text-black hover:border-[var(--primary)]/30 hover:shadow-sm hover:scale-105"
                }`}
              >
                Tous
              </Button>
              <Button
                variant={statusFilter === 'active' ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter('active')}
                className={`transition-all duration-200 ${
                  statusFilter === 'active'
                    ? "bg-white text-black border-2 border-[var(--primary)] shadow-md hover:bg-[var(--primary)]/10 hover:shadow-lg hover:scale-105"
                    : "hover:bg-[var(--primary)]/10 hover:text-black hover:border-[var(--primary)]/30 hover:shadow-sm hover:scale-105"
                }`}
              >
                Actifs
              </Button>
              <Button
                variant={statusFilter === 'inactive' ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter('inactive')}
                className={`transition-all duration-200 ${
                  statusFilter === 'inactive'
                    ? "bg-white text-black border-2 border-[var(--primary)] shadow-md hover:bg-[var(--primary)]/10 hover:shadow-lg hover:scale-105"
                    : "hover:bg-[var(--primary)]/10 hover:text-black hover:border-[var(--primary)]/30 hover:shadow-sm hover:scale-105"
                }`}
              >
                Inactifs
              </Button>
            </div>
          </div>

          {/* Filtrage par spécialités */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Spécialités</Label>

            <div className="flex flex-wrap gap-2">
              {existingSpecialties.map((specialty) => (
                <Button
                  key={specialty}
                  variant={isFilterActive(specialty) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleFilter(specialty)}
                  className={`transition-all duration-200 ${
                    isFilterActive(specialty)
                      ? "bg-white text-black border-2 border-[var(--primary)] shadow-md hover:bg-[var(--primary)]/10 hover:shadow-lg hover:scale-105"
                      : "hover:bg-[var(--primary)]/10 hover:text-black hover:border-[var(--primary)]/30 hover:shadow-sm hover:scale-105"
                  }`}
                >
                  {specialty}
                  {isFilterActive(specialty) && (
                    <X className="ml-2 h-3 w-3" />
                  )}
                </Button>
              ))}
            </div>
          </div>

          {(selectedFilters.length > 0 || statusFilter !== 'all') && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Filtres actifs :</span>
              <div className="flex flex-wrap gap-1">
                {statusFilter !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    {statusFilter === 'active' ? 'Actifs' : 'Inactifs'}
                  </Badge>
                )}
                {selectedFilters.map((filter) => (
                  <Badge key={filter} variant="secondary" className="text-xs">
                    {filter}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {stylistesLoading ? (
          <div className="flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(stylistes as any[])?.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Aucun·e coiffeur·euse</h3>
                <p className="text-muted-foreground">Ajoutez votre premier·ère coiffeur·euse pour commencer.</p>
              </div>
            ) : !hasAnyStylists && (selectedFilters.length > 0 || statusFilter !== 'all') ? (
              <div className="col-span-full text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  Aucun·e coiffeur·euse trouvé·e
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Aucun·e coiffeur·euse ne correspond aux filtres sélectionnés.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    clearAllFilters();
                    setStatusFilter('all');
                  }}
                  className="mt-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300 hover:shadow-sm hover:scale-105 transition-all duration-200"
                >
                  Effacer tous les filtres
                </Button>
              </div>
            ) : (
              <>
                {/* Section coiffeur·euses actif·ves */}
                {activeStylists.length > 0 && (
                  <div className="col-span-full">
                    <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      Coiffeurs et coiffeuses actif·ves ({activeStylists.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                      {activeStylists.map((stylist: Styliste) => (
                        <Card key={stylist.id} className="glassmorphism-card hover:scale-105 transition-transform duration-200">
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={stylist.photoUrl || undefined} />
                                  <AvatarFallback>
                                    {stylist.firstName[0]}{stylist.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-semibold">
                                    {stylist.firstName} {stylist.lastName}
                                  </div>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleEdit(stylist)}
                                  data-testid={`button-edit-stylist-${stylist.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleDelete(stylist.id)}
                                  className="text-destructive"
                                  data-testid={`button-delete-stylist-${stylist.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {stylist.email && (
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Mail className="mr-2 h-4 w-4" />
                                  {stylist.email}
                                </div>
                              )}
                              
                              {stylist.phone && (
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Phone className="mr-2 h-4 w-4" />
                                  {stylist.phone}
                                </div>
                              )}

                              {stylist.specialties && stylist.specialties.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border/20">
                                  <p className="text-sm font-medium text-foreground mb-2">Spécialités:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {stylist.specialties.map((specialty: string, index: number) => (
                                      <Badge key={index} variant="outline" className="text-sm font-medium bg-white text-black border-gray-300 hover:border-primary hover:bg-primary/5 transition-colors px-3 py-1">
                                        {specialty}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section coiffeur·euses inactif·ves */}
                {inactiveStylists.length > 0 && (
                  <div className="col-span-full">
                    <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500"></div>
                      Coiffeurs et coiffeuses inactif·ves ({inactiveStylists.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {inactiveStylists.map((stylist: Styliste) => (
                        <Card key={stylist.id} className="glassmorphism-card hover:scale-105 transition-transform duration-200 opacity-75">
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={stylist.photoUrl || undefined} />
                                  <AvatarFallback>
                                    {stylist.firstName[0]}{stylist.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-semibold">
                                    {stylist.firstName} {stylist.lastName}
                                  </div>
                                  <Badge variant="destructive" className="text-xs mt-1">Inactif</Badge>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleEdit(stylist)}
                                  data-testid={`button-edit-stylist-${stylist.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleDelete(stylist.id)}
                                  className="text-destructive"
                                  data-testid={`button-delete-stylist-${stylist.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {stylist.email && (
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Mail className="mr-2 h-4 w-4" />
                                  {stylist.email}
                                </div>
                              )}
                              
                              {stylist.phone && (
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Phone className="mr-2 h-4 w-4" />
                                  {stylist.phone}
                                </div>
                              )}

                              {stylist.specialties && stylist.specialties.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border/20">
                                  <p className="text-sm font-medium text-foreground mb-2">Spécialités:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {stylist.specialties.map((specialty: string, index: number) => (
                                      <Badge key={index} variant="outline" className="text-sm font-medium bg-white text-black border-gray-300 hover:border-primary hover:bg-primary/5 transition-colors px-3 py-1">
                                        {specialty}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


