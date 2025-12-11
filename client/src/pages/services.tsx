import React, { useState } from "react";
import Navigation from "@/components/navigation";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Check, Plus, X } from "lucide-react";

const serviceSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional().default(""),
  price: z.union([z.number(), z.string()]),
  duration: z.union([z.number(), z.string()]),
  breakBefore: z.union([z.number(), z.string()]).optional(),
  breakAfter: z.union([z.number(), z.string()]).optional(),
  tags: z.array(z.string()).optional(),
  depositRequired: z.union([z.boolean(), z.string()]).optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

// Helpers de normalisation front -> backend
const toNumber = (v: unknown, fallback = 0) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

const toBool = (v: unknown, fallback = false) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true";
  return fallback;
};

export default function ServicesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ➜ on lit le salon courant pour envoyer salonId au backend
  const { data: salon } = useQuery({ 
    queryKey: ["/api/salon"], 
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/salon");
      return response.json();
    },
    retry: false 
  });

  const { data: services, isLoading } = useQuery({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/services");
      return response.json();
    },
    retry: false,
  });

  // Récupérer les stylistes pour obtenir les spécialités existantes
  const { data: stylistes } = useQuery({
    queryKey: salon?.id ? ["/api/salons", salon.id, "stylistes"] : ["/api/stylistes"],
    queryFn: async () => {
      const url = salon?.id ? `/api/salons/${salon.id}/stylistes` : `/api/stylistes`;
      const response = await apiRequest("GET", url);
      return response.json();
    },
    retry: false,
  });

  // Récupérer toutes les catégories existantes (des stylistes ET des services)
  const existingCategories = React.useMemo(() => {
    const categories = new Set<string>();
    
    // Ajouter les catégories par défaut en premier
    const defaultCategories = ["Homme", "Femme", "Enfant"];
    defaultCategories.forEach(category => categories.add(category));
    
    // Ajouter les spécialités des stylistes
    if (stylistes) {
      stylistes.forEach((stylist: any) => {
        if (stylist.specialties && Array.isArray(stylist.specialties)) {
          stylist.specialties.forEach((specialty: string) => {
            if (specialty.trim()) {
              categories.add(specialty.trim());
            }
          });
        }
      });
    }
    
    // Ajouter les catégories des services
    if (services) {
      services.forEach((service: any) => {
        if (service.tags && Array.isArray(service.tags)) {
          service.tags.forEach((tag: string) => {
            if (tag.trim()) {
              categories.add(tag.trim());
            }
          });
        }
      });
    }
    
    // Trier en gardant les catégories par défaut en premier
    const sortedCategories = Array.from(categories).sort();
    const defaultFirst = [...defaultCategories];
    const others = sortedCategories.filter(cat => !defaultCategories.includes(cat));
    
    return [...defaultFirst, ...others];
  }, [stylistes, services]);

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      duration: 30,
      breakBefore: 0,
      breakAfter: 0,
      tags: [],
      depositRequired: false,
    },
  });

  // Fonctions pour gérer les catégories
  const addCategory = (category: string) => {
    if (category.trim()) {
      const currentTags = form.getValues("tags") || [];
      if (!currentTags.includes(category.trim())) {
        form.setValue("tags", [...currentTags, category.trim()]);
      }
      setCategoryInput("");
      setShowNewCategoryInput(false);
      setIsCategoryDropdownOpen(false);
    }
  };

  const addNewCategory = () => {
    if (categoryInput.trim()) {
      addCategory(categoryInput.trim());
    }
  };

  const removeCategory = (index: number) => {
    const currentTags = form.getValues("tags") || [];
    form.setValue("tags", currentTags.filter((_, i) => i !== index));
  };

  // Supprimer une catégorie existante de tous les services
  const deleteCategory = async (category: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Empêcher le clic de sélectionner la catégorie
    
    // Ne pas permettre la suppression des catégories par défaut
    const defaultCategories = ["Homme", "Femme", "Enfant"];
    if (defaultCategories.includes(category)) {
      toast({
        title: "Action non autorisée",
        description: "Les catégories par défaut (Homme, Femme, Enfant) ne peuvent pas être supprimées.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Retirer cette catégorie de tous les services qui l'utilisent
      if (services && Array.isArray(services)) {
        const servicesToUpdate = services.filter((service: any) => 
          service.tags && Array.isArray(service.tags) && service.tags.includes(category)
        );
        
        if (servicesToUpdate.length > 0) {
          const updates = servicesToUpdate.map(async (service: any) => {
            try {
              const updatedTags = service.tags.filter((tag: string) => tag !== category);
              const response = await apiRequest("PUT", `/api/services/${service.id}`, {
                name: service.name,
                description: service.description || '',
                price: service.price || 0,
                duration: service.duration || service.duration_minutes || 0,
                breakBefore: service.breakBefore || service.buffer_before || 0,
                breakAfter: service.breakAfter || service.buffer_after || 0,
                depositRequired: service.depositRequired || service.requires_deposit || false,
                tags: updatedTags,
              });
              return response.json();
            } catch (error) {
              console.error(`Erreur lors de la mise à jour du service ${service.id}:`, error);
              return null;
            }
          });

          await Promise.all(updates);
        }
      }

      // Retirer cette catégorie de tous les stylistes qui l'utilisent
      if (stylistes && Array.isArray(stylistes)) {
        const stylistsToUpdate = stylistes.filter((stylist: any) => 
          stylist.specialties && Array.isArray(stylist.specialties) && stylist.specialties.includes(category)
        );
        
        if (stylistsToUpdate.length > 0) {
          const updates = stylistsToUpdate.map(async (stylist: any) => {
            try {
              const updatedSpecialties = stylist.specialties.filter((spec: string) => spec !== category);
              const response = await apiRequest("PUT", `/api/stylists/${stylist.id}`, {
                firstName: stylist.firstName || stylist.first_name,
                lastName: stylist.lastName || stylist.last_name,
                email: stylist.email || '',
                phone: stylist.phone || '',
                photoUrl: stylist.photoUrl || stylist.photo_url || '',
                specialties: updatedSpecialties,
                isActive: stylist.isActive ?? stylist.is_active ?? true,
              });
              return response.json();
            } catch (error) {
              console.error(`Erreur lors de la mise à jour du styliste ${stylist.id}:`, error);
              return null;
            }
          });

          await Promise.all(updates);
        }
      }

      // Retirer la catégorie des tags sélectionnés dans le formulaire
      const currentTags = form.getValues("tags") || [];
      if (currentTags.includes(category)) {
        form.setValue("tags", currentTags.filter(t => t !== category));
      }

      // Invalider les queries pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stylistes"] });

      toast({
        title: "Catégorie supprimée",
        description: `La catégorie "${category}" a été retirée de tous les services et coiffeur·euses.`,
      });
    } catch (error) {
      console.error("Erreur lors de la suppression de la catégorie:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la catégorie. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  // Fonctions pour gérer les filtres
  const toggleFilter = (category: string) => {
    setSelectedFilters(prev => 
      prev.includes(category) 
        ? prev.filter(f => f !== category)
        : [...prev, category]
    );
  };

  const clearAllFilters = () => {
    setSelectedFilters([]);
  };

  const isFilterActive = (category: string) => {
    return selectedFilters.includes(category);
  };

  // Filtrer les services selon les catégories sélectionnées
  const filteredServices = React.useMemo(() => {
    if (selectedFilters.length === 0) {
      return services || [];
    }
    return (services || []).filter((service: any) => {
      return service.tags && service.tags.some((tag: string) => selectedFilters.includes(tag));
    });
  }, [services, selectedFilters]);

  // Fermer le dropdown quand le dialog se ferme
  React.useEffect(() => {
    if (!isDialogOpen) {
      setIsCategoryDropdownOpen(false);
      setShowNewCategoryInput(false);
      setCategoryInput("");
    }
  }, [isDialogOpen]);

  const onApiError = async (res: Response) => {
    let msg = "Erreur inconnue";
    try {
      const data = await res.json();
      msg = data?.message || JSON.stringify(data);
    } catch {
      try {
        msg = await res.text();
      } catch {}
    }
    toast({
      title: "Erreur",
      description: msg || "Impossible de créer le service.",
      variant: "destructive",
    });
  };

  const createServiceMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/services", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Service créé", description: "Le service a été ajouté." });
      setIsDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous devez être connecté. Redirection...",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/salon-login"), 500);
      } else {
        toast({
          title: "Erreur",
          description: (error as Error)?.message || "Impossible de créer le service.",
          variant: "destructive",
        });
      }
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Service modifié",
        description: "Le service a été mis à jour.",
      });
      setIsDialogOpen(false);
      setEditing(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous devez être connecté. Redirection...",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/salon-login"), 500);
      } else {
        toast({
          title: "Erreur",
          description: (error as Error)?.message || "Impossible de modifier le service.",
          variant: "destructive",
        });
      }
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/services/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Service supprimé",
        description: "Le service a été supprimé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous devez être connecté. Redirection...",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/salon-login"), 500);
      } else {
        toast({
          title: "Erreur",
          description: (error as Error)?.message || "Impossible de supprimer le service.",
          variant: "destructive",
        });
      }
    },
  });

  const handleDeleteService = (serviceId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce service ? Cette action est irréversible.")) {
      deleteServiceMutation.mutate(serviceId);
    }
  };

  const onSubmit = (data: ServiceFormData) => {
    // payload normalisé + salonId
    const cleaned = {
      salonId: salon?.id ?? undefined, // ← indispensable si l’API est multi-salon
      name: data.name,
      description: data.description ?? "",
      price: toNumber(data.price),
      duration: toNumber(data.duration),
      breakBefore: toNumber(data.breakBefore, 0),
      breakAfter: toNumber(data.breakAfter, 0),
      tags: Array.isArray(data.tags) ? data.tags : [],
      depositRequired: toBool(data.depositRequired, false),
    };

    if (editing) {
      updateServiceMutation.mutate({ id: editing.id, data: cleaned });
    } else {
      createServiceMutation.mutate(cleaned);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Gestion des Services</h1>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="btn-primary px-6 py-3 text-white font-medium"
                onClick={() => {
                  setEditing(null);
                  form.reset();
                }}
                data-testid="button-add-service"
              >
                + Ajouter un service
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Modifier un service" : "Ajouter un service"}
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
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom du service</FormLabel>
                          <FormControl>
                            <Input placeholder="Coupe + Brushing" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prix (€)</FormLabel>
                          <FormControl>
                            <Input inputMode="decimal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Description du service..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Durée (min)</FormLabel>
                          <FormControl>
                            <Input inputMode="numeric" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="breakBefore"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pause avant (min)</FormLabel>
                          <FormControl>
                            <Input inputMode="numeric" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="breakAfter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pause après (min)</FormLabel>
                          <FormControl>
                            <Input inputMode="numeric" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="depositRequired"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3">
                        <FormControl>
                          <Switch
                            checked={Boolean(field.value)}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Nécessite un acompte</FormLabel>
                      </FormItem>
                    )}
                  />

                  {/* Section Catégories */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Catégories</Label>
                    
                    {/* Bouton pour choisir une catégorie existante */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        aria-expanded={isCategoryDropdownOpen}
                        className={[
                          "w-full select-none rounded-md",
                          "px-4 py-2 text-sm transition",
                          "hover:bg-[color-mix(in_srgb,_white_90%,_var(--primary)_10%)]",
                          "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          "flex items-center justify-between gap-2",
                        ].join(" ")}
                        style={{
                          backgroundColor: "#ffffff",
                          color: "#000000",
                          border: "2px solid #D1D5DB",
                        }}
                      >
                        <span>Choisir une catégorie existante</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isCategoryDropdownOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </button>

                      {isCategoryDropdownOpen && (
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
                          {existingCategories.length > 0 ? (
                            <ul className="py-1">
                              {existingCategories.map((category) => {
                                const isSelected = form.watch("tags")?.includes(category) || false;
                                const defaultCategories = ["Homme", "Femme", "Enfant"];
                                const isDefaultCategory = defaultCategories.includes(category);
                                
                                return (
                                  <li
                                    key={category}
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                      if (isSelected) {
                                        const currentTags = form.getValues("tags") || [];
                                        form.setValue("tags", currentTags.filter(t => t !== category));
                                      } else {
                                        addCategory(category);
                                      }
                                    }}
                                    className={[
                                      "px-4 py-2 text-sm cursor-pointer flex items-center justify-between group",
                                      isSelected ? "opacity-60" : "hover:bg-[color-mix(in_srgb,_white_92%,_var(--primary)_8%)]",
                                    ].join(" ")}
                                    style={{ color: "#000000" }}
                                  >
                                    <span className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{category}</span>
                                      {isSelected && <Check className="h-4 w-4 text-gray-600" />}
                                    </span>
                                    {!isDefaultCategory && (
                                      <button
                                        type="button"
                                        onClick={(e) => deleteCategory(category, e)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded-full"
                                        title="Supprimer cette catégorie"
                                      >
                                        <X className="h-4 w-4 text-red-600" />
                                      </button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <div className="px-4 py-3">
                              <p className="text-sm italic text-gray-500 text-center">
                                Aucune catégorie enregistrée. Ajoutez-en une ci-dessous.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bouton pour ajouter une nouvelle catégorie */}
                    <div className="flex items-center gap-2">
                      {!showNewCategoryInput ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowNewCategoryInput(true)}
                          className="flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Ajouter une nouvelle catégorie
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            placeholder="Nom de la catégorie"
                            value={categoryInput}
                            onChange={(e) => setCategoryInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addNewCategory();
                              } else if (e.key === "Escape") {
                                setShowNewCategoryInput(false);
                                setCategoryInput("");
                              }
                            }}
                            className="flex-1"
                            autoFocus
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={addNewCategory}
                            disabled={!categoryInput.trim()}
                          >
                            Ajouter
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setShowNewCategoryInput(false);
                              setCategoryInput("");
                            }}
                            className="text-black hover:text-black"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Affichage des catégories sélectionnées */}
                    {form.watch("tags") && form.watch("tags")!.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Catégories sélectionnées</Label>
                        <div className="flex flex-wrap gap-2">
                          {form.watch("tags")!.map((tag, index) => (
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
                              <span className="font-medium">{tag}</span>
                              <span
                                onClick={() => removeCategory(index)}
                                className="ml-1 px-1 text-gray-500 cursor-pointer"
                                style={{ background: 'transparent', border: 'none' }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    removeCategory(index);
                                  }
                                }}
                                aria-label={`Retirer ${tag}`}
                              >
                                ×
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        createServiceMutation.isPending ||
                        updateServiceMutation.isPending
                      }
                    >
                      {createServiceMutation.isPending ||
                      updateServiceMutation.isPending
                        ? "Enregistrement..."
                        : "Enregistrer"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="glassmorphism-card">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Interface de filtrage */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Filtrer par catégorie</h2>
                    {selectedFilters.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllFilters}
                        className="text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-300 hover:shadow-sm hover:scale-105 transition-all duration-200"
                      >
                        Effacer les filtres ({selectedFilters.length})
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {existingCategories.map((category) => (
                      <Button
                        key={category}
                        variant={isFilterActive(category) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleFilter(category)}
                        className={`transition-all duration-200 ${
                          isFilterActive(category) 
                            ? "bg-[var(--primary)] text-white shadow-md hover:shadow-lg hover:scale-105" 
                            : "hover:bg-[var(--primary)]/10 hover:text-black hover:border-[var(--primary)]/30 hover:shadow-sm hover:scale-105"
                        }`}
                      >
                        {category}
                        {isFilterActive(category) && (
                          <X className="ml-2 h-3 w-3" />
                        )}
                      </Button>
                    ))}
                  </div>

                  {selectedFilters.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Filtres actifs :</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedFilters.map((filter) => (
                          <Badge key={filter} variant="secondary" className="text-xs">
                            {filter}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-8">
                {/* Message si aucun service ne correspond aux filtres */}
                {filteredServices.length === 0 && selectedFilters.length > 0 && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                      Aucun service trouvé
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Aucun service ne correspond aux filtres sélectionnés.
                    </p>
                    <Button
                      variant="outline"
                      onClick={clearAllFilters}
                      className="mt-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300 hover:shadow-sm hover:scale-105 transition-all duration-200"
                    >
                      Effacer tous les filtres
                    </Button>
                  </div>
                )}

                {/* Services Homme */}
                {(() => {
                  const hommeServices = (filteredServices ?? []).filter((s: any) => {
                    // Vérifier si le service a la catégorie "Homme" dans ses tags
                    return s.tags && Array.isArray(s.tags) && s.tags.includes("Homme");
                  });
                  return hommeServices.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-px bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent flex-1"></div>
                        <h3 className="text-lg font-semibold text-[var(--primary)] flex items-center gap-2">
                          <span className="text-2xl">👨</span>
                          Services Homme
                        </h3>
                        <div className="h-px bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent flex-1"></div>
                      </div>
                      <div className="grid gap-4">
                        {hommeServices.map((s: any) => (
                          <div
                    key={s.id}
                            className="flex items-center justify-between border-2 border-[var(--primary)]/20 rounded-lg p-4 bg-gradient-to-r from-[var(--primary)]/5 to-transparent hover:from-[var(--primary)]/10 transition-all duration-200"
                  >
                            <div className="space-y-2">
                              <div className="font-semibold text-lg">{s.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {s.duration} min • {s.price} €
                        {s.depositRequired ? " • acompte requis" : ""}
                      </div>
                              {s.tags && Array.isArray(s.tags) && s.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {s.tags.map((tag: string, index: number) => (
                                    <Badge 
                                      key={index} 
                                      variant={tag === "Homme" ? "default" : "secondary"} 
                                      className={`text-xs ${tag === "Homme" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : ""}`}
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditing(s);
                          form.reset({
                            name: s.name ?? "",
                            description: s.description ?? "",
                            price: s.price ?? 0,
                            duration: s.duration ?? 30,
                            breakBefore: s.breakBefore ?? 0,
                            breakAfter: s.breakAfter ?? 0,
                            tags: Array.isArray(s.tags) ? s.tags : [],
                            depositRequired: Boolean(s.depositRequired),
                          });
                          setIsDialogOpen(true);
                        }}
                      >
                        Modifier
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleDeleteService(s.id)}
                        disabled={deleteServiceMutation.isPending}
                      >
                        Supprimer
                      </Button>
                    </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Services Femme */}
                {(() => {
                  const femmeServices = (filteredServices ?? []).filter((s: any) => {
                    // Vérifier si le service a la catégorie "Femme" dans ses tags
                    return s.tags && Array.isArray(s.tags) && s.tags.includes("Femme");
                  });
                  return femmeServices.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-px bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent flex-1"></div>
                        <h3 className="text-lg font-semibold text-[var(--primary)] flex items-center gap-2">
                          <span className="text-2xl">👩</span>
                          Services Femme
                        </h3>
                        <div className="h-px bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent flex-1"></div>
                      </div>
                      <div className="grid gap-4">
                        {femmeServices.map((s: any) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between border-2 border-[var(--primary)]/20 rounded-lg p-4 bg-gradient-to-r from-[var(--primary)]/5 to-transparent hover:from-[var(--primary)]/10 transition-all duration-200"
                          >
                            <div className="space-y-2">
                              <div className="font-semibold text-lg">{s.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {s.duration} min • {s.price} €
                                {s.depositRequired ? " • acompte requis" : ""}
                              </div>
                              {s.tags && Array.isArray(s.tags) && s.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {s.tags.map((tag: string, index: number) => (
                                    <Badge 
                                      key={index} 
                                      variant={tag === "Femme" ? "default" : "secondary"} 
                                      className={`text-xs ${tag === "Femme" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : ""}`}
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditing(s);
                                  form.reset({
                                    name: s.name ?? "",
                                    description: s.description ?? "",
                                    price: s.price ?? 0,
                                    duration: s.duration ?? 30,
                                    breakBefore: s.breakBefore ?? 0,
                                    breakAfter: s.breakAfter ?? 0,
                                    tags: Array.isArray(s.tags) ? s.tags : [],
                                    depositRequired: Boolean(s.depositRequired),
                                  });
                                  setIsDialogOpen(true);
                                }}
                              >
                                Modifier
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleDeleteService(s.id)}
                                disabled={deleteServiceMutation.isPending}
                              >
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Services Enfant */}
                {(() => {
                  const enfantServices = (filteredServices ?? []).filter((s: any) => {
                    // Vérifier si le service a la catégorie "Enfant" dans ses tags
                    return s.tags && Array.isArray(s.tags) && s.tags.includes("Enfant");
                  });
                  return enfantServices.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-px bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent flex-1"></div>
                        <h3 className="text-lg font-semibold text-[var(--primary)] flex items-center gap-2">
                          <span className="text-2xl">👶</span>
                          Services Enfant
                        </h3>
                        <div className="h-px bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent flex-1"></div>
                      </div>
                      <div className="grid gap-4">
                        {enfantServices.map((s: any) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between border-2 border-[var(--primary)]/20 rounded-lg p-4 bg-gradient-to-r from-[var(--primary)]/5 to-transparent hover:from-[var(--primary)]/10 transition-all duration-200"
                          >
                            <div className="space-y-2">
                              <div className="font-semibold text-lg">{s.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {s.duration} min • {s.price} €
                                {s.depositRequired ? " • acompte requis" : ""}
                              </div>
                              {s.tags && Array.isArray(s.tags) && s.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {s.tags.map((tag: string, index: number) => (
                                    <Badge 
                                      key={index} 
                                      variant={tag === "Enfant" ? "default" : "secondary"} 
                                      className={`text-xs ${tag === "Enfant" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : ""}`}
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditing(s);
                                  form.reset({
                                    name: s.name ?? "",
                                    description: s.description ?? "",
                                    price: s.price ?? 0,
                                    duration: s.duration ?? 30,
                                    breakBefore: s.breakBefore ?? 0,
                                    breakAfter: s.breakAfter ?? 0,
                                    tags: Array.isArray(s.tags) ? s.tags : [],
                                    depositRequired: Boolean(s.depositRequired),
                                  });
                                  setIsDialogOpen(true);
                                }}
                              >
                                Modifier
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleDeleteService(s.id)}
                                disabled={deleteServiceMutation.isPending}
                              >
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Services sans catégorie principale */}
                {(() => {
                  const otherServices = (filteredServices ?? []).filter((s: any) => 
                    !s.tags || !s.tags.some((tag: string) => ["Homme", "Femme", "Enfant"].includes(tag))
                  );
                  return otherServices.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-px bg-gradient-to-r from-transparent via-[var(--muted-foreground)] to-transparent flex-1"></div>
                        <h3 className="text-lg font-semibold text-[var(--muted-foreground)] flex items-center gap-2">
                          <span className="text-2xl">🔧</span>
                          Autres Services
                        </h3>
                        <div className="h-px bg-gradient-to-r from-transparent via-[var(--muted-foreground)] to-transparent flex-1"></div>
                      </div>
                      <div className="grid gap-4">
                        {otherServices.map((s: any) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between border rounded-lg p-4 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/50 transition-all duration-200"
                          >
                            <div className="space-y-2">
                              <div className="font-semibold text-lg">{s.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {s.duration} min • {s.price} €
                                {s.depositRequired ? " • acompte requis" : ""}
                              </div>
                              {s.tags && Array.isArray(s.tags) && s.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {s.tags.map((tag: string, index: number) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditing(s);
                                  form.reset({
                                    name: s.name ?? "",
                                    description: s.description ?? "",
                                    price: s.price ?? 0,
                                    duration: s.duration ?? 30,
                                    breakBefore: s.breakBefore ?? 0,
                                    breakAfter: s.breakAfter ?? 0,
                                    tags: Array.isArray(s.tags) ? s.tags : [],
                                    depositRequired: Boolean(s.depositRequired),
                                  });
                                  setIsDialogOpen(true);
                                }}
                              >
                                Modifier
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleDeleteService(s.id)}
                                disabled={deleteServiceMutation.isPending}
                              >
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
