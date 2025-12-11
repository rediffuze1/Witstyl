import { useState, useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { withOwnerAuth } from "@/components/withOwnerAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Settings, 
  User, 
  Palette, 
  Clock, 
  Building, 
  RotateCcw,
  Save,
  Plus,
  X
} from "lucide-react";
import Navigation from "@/components/navigation";
import { Theme } from "@/lib/theme";
import { logger } from "@/lib/logger";
import NotificationSettings from "@/components/NotificationSettings";

interface SalonSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
}


function SettingsPage() {
  const { owner, salonId: contextSalonId, isHydrating } = useAuthContext();
  const { firstName: contextFirstName, updateFirstName } = useUserContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [salonVerified, setSalonVerified] = useState(false);
  const [salonId, setSalonId] = useState<string | null>(contextSalonId || null);

  // État local
  const [userName, setUserName] = useState("");
  const [lastName, setLastName] = useState("");
  const [salonSettings, setSalonSettings] = useState<SalonSettings>({
    name: "",
    address: "",
    phone: "",
    email: ""
  });
  const [primaryColor, setPrimaryColor] = useState(Theme.get().primary);

  // Vérification initiale du salon
  useEffect(() => {
    const verifySalon = async () => {
      if (!owner) {
        logger.log('[SETTINGS] Pas un owner, vérification salon ignorée');
        return;
      }
      
      // Si on a déjà un salonId depuis le contexte, on peut l'utiliser directement
      if (contextSalonId) {
        setSalonId(contextSalonId);
        setSalonVerified(true);
        logger.log('[SETTINGS] Salon ID depuis contexte:', contextSalonId);
        return;
      }
      
      logger.log('🔍 [SETTINGS] Vérification salon au chargement...');
      
      try {
        const response = await fetch('/api/auth/verify-salon', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[SETTINGS] Erreur vérification salon:', response.status, errorText);
          
          // Si 401, c'est un problème d'authentification, ne pas afficher d'erreur
          if (response.status === 401) {
            logger.log('[SETTINGS] Non authentifié, attente de la session...');
            return;
          }
          
          throw new Error(`Erreur vérification salon: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ [SETTINGS] Salon vérifié:', data.salon?.id);
        
        if (data.salon) {
          setSalonId(data.salon.id);
          setSalonVerified(true);
          
          if (data.created) {
            console.log('🎉 [SETTINGS] Salon créé automatiquement!');
            // Invalider les queries pour recharger les données
            queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
            queryClient.invalidateQueries({ queryKey: ['/api/salon'] });
          }
        }
      } catch (error: any) {
        console.error('❌ [SETTINGS] Erreur vérification:', error);
        // Ne pas afficher d'erreur si c'est juste un problème de session en cours de chargement
        if (error.message?.includes('401') || error.message?.includes('Non authentifié')) {
          logger.log('[SETTINGS] Session en cours de chargement, réessai plus tard...');
          return;
        }
        toast({
          title: "Erreur",
          description: "Impossible de vérifier votre salon. Veuillez contacter le support.",
          variant: "destructive",
        });
      }
    };
    
    // Attendre la fin de l'hydratation avant de vérifier
    if (!isHydrating) {
      verifySalon();
    }
  }, [owner, contextSalonId, isHydrating, queryClient, toast]);

  // Fonction pour convertir HSL en HEX (pour le color picker)
  const hslToHex = (hsl: string): string => {
    try {
      // Support des formats "hsl(0 0% 35%)" et "hsl(0, 0%, 35%)"
      const match = hsl.match(/hsl\((\d+)[,\s]+(\d+)%[,\s]+(\d+)%\)/);
      if (!match) return "#5a5a5a"; // gris foncé par défaut (R:90 G:90 B:90)
      
      const h = parseInt(match[1]);
      const s = parseInt(match[2]);
      const l = parseInt(match[3]);
      
      const c = (1 - Math.abs(2 * l / 100 - 1)) * s / 100;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = l / 100 - c / 2;
      
      let r = 0, g = 0, b = 0;
      
      if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
      } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
      } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
      } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
      } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
      } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
      }
      
      const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch {
      return "#5a5a5a"; // gris foncé par défaut (R:90 G:90 B:90)
    }
  };

  // Fonction pour convertir HEX en HSL
  const hexToHsl = (hex: string): string => {
    try {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }

      return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
    } catch {
      return "hsl(0 0% 35%)"; // gris foncé par défaut
    }
  };

  // Requête salon (déclarer AVANT les useEffect qui l'utilisent)
  const { data: salon } = useQuery({
    queryKey: ["/api/salon"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/salon");
      return response.json();
    },
    retry: false,
  });

  // Charger la couleur depuis la base de données ou le thème au démarrage
  useEffect(() => {
    // D'abord, essayer de charger depuis la base de données (via salon)
    if (salon && (salon as any).theme_color) {
      const dbColor = (salon as any).theme_color;
      console.log('[SETTINGS] Chargement couleur depuis DB:', dbColor);
      setPrimaryColor(dbColor);
      Theme.apply(dbColor);
    } else {
      // Sinon, utiliser le localStorage comme fallback
      const themeState = Theme.get();
      if (themeState.primary) {
        console.log('[SETTINGS] Chargement couleur depuis localStorage:', themeState.primary);
        setPrimaryColor(themeState.primary);
      }
    }
  }, [salon]); // Recharger quand le salon change

  // Charger les données depuis localStorage
  useEffect(() => {
    const savedSalonSettings = localStorage.getItem('salonSettings');
    if (savedSalonSettings) {
      setSalonSettings(JSON.parse(savedSalonSettings));
    }
  }, [salonId, salonVerified]);

  // Écouter les changements de thème depuis d'autres onglets (une seule fois)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "witstyl.theme.v1" && e.newValue) {
        try {
          const s = JSON.parse(e.newValue);
          if (s?.primary) setPrimaryColor(s.primary);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []); // Exécuter une seule fois au montage

  // Initialiser l'email avec l'email de l'owner si le champ est vide (après chargement salon)
  useEffect(() => {
    if (owner?.email && (!salonSettings.email || salonSettings.email === "")) {
      // Ne mettre à jour que si l'email est vraiment vide
      setSalonSettings(prev => {
        if (prev.email && prev.email !== "") {
          return prev; // Ne pas écraser un email existant
        }
        return {
          ...prev,
          email: owner?.email || ""
        };
      });
    }
  }, [owner?.email]); // Ne dépendre que de l'email de l'owner, pas de salonSettings

  // Synchroniser avec le contexte utilisateur ET les données utilisateur
  useEffect(() => {
    // Prioriser les données du contexte auth (owner.firstName) puis le contexte
    const apiFirstName = owner?.firstName;
    const currentFirstName = apiFirstName || contextFirstName || "";
    
    // Toujours mettre à jour avec la valeur de l'API si disponible, même si userName existe déjà
    if (apiFirstName && apiFirstName !== userName) {
      console.log('[SETTINGS] Mise à jour userName depuis API:', {
        apiFirstName,
        currentUserName: userName
      });
      setUserName(apiFirstName);
    } else if (currentFirstName && !userName && !apiFirstName) {
      // Seulement utiliser le contexte si pas de valeur API et userName est vide
      console.log('[SETTINGS] Initialisation userName depuis contexte:', {
        currentFirstName,
        contextFirstName
      });
      setUserName(currentFirstName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, owner?.firstName, contextFirstName]); // Ne pas inclure userName pour éviter les boucles

  // Initialiser le nom de famille depuis les données owner
  useEffect(() => {
    const apiLastName = owner?.lastName || "";
    if (apiLastName && apiLastName !== lastName) {
      setLastName(apiLastName);
    }
  }, [owner, owner?.lastName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charger les données du salon depuis l'API
  useEffect(() => {
    if (salon && typeof salon === 'object') {
      setSalonSettings({
        name: (salon as any).name || "",
        address: (salon as any).address || "",
        phone: (salon as any).phone || "",
        // Utiliser l'email du salon si disponible, sinon l'email de l'owner connecté
        email: (salon as any).email || (owner?.email || "")
      });
    } else if (owner?.email && !salonSettings.email) {
      // Si pas de salon mais un owner connecté, initialiser avec son email
      setSalonSettings(prev => ({
        ...prev,
        email: prev.email || owner?.email || ""
      }));
    }
  }, [salon, owner]);

  // Fonction simple pour sauvegarder le prénom utilisateur
  const handleSaveUserName = async () => {
    console.log('[SETTINGS] Sauvegarde du prénom:', userName);
    try {
      // Sauvegarder via API d'abord
      const response = await apiRequest("PUT", "/api/auth/user", { firstName: userName });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur HTTP: ${response.status}`);
      }
      
      const updatedUser = await response.json();
      console.log('[SETTINGS] Prénom sauvegardé avec succès:', updatedUser);
      
      // Mettre à jour le contexte utilisateur avec les données de l'API
      if (updatedUser.firstName) {
        console.log('[SETTINGS] Mise à jour du contexte avec:', updatedUser.firstName);
        updateFirstName(updatedUser.firstName);
        // Synchroniser userName avec la valeur retournée par l'API
        setUserName(updatedUser.firstName);
        // Sauvegarder aussi dans localStorage pour le dashboard
        localStorage.setItem('userFirstName', updatedUser.firstName);
        // Déclencher un événement pour notifier les autres composants
        window.dispatchEvent(new CustomEvent('userNameUpdated', { detail: updatedUser.firstName }));
      }
      
      // Invalider les queries pour recharger les données utilisateur
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      // Recharger les données utilisateur depuis l'API pour mettre à jour le contexte auth
      try {
        const userResponse = await apiRequest("GET", "/api/auth/user");
        const userData = await userResponse.json();
        console.log('[SETTINGS] Données utilisateur rechargées:', userData);
        // Les données seront automatiquement mises à jour via le contexte auth
      } catch (reloadError) {
        console.warn('[SETTINGS] Erreur lors du rechargement des données utilisateur:', reloadError);
      }
      
      // Afficher le toast de succès
      toast({
        title: "Profil mis à jour",
        description: `Votre prénom a été modifié avec succès : ${updatedUser.firstName}`,
      });
      
    } catch (apiError: any) {
      console.error("[SETTINGS] API Error:", apiError);
      console.error("[SETTINGS] Détails:", apiError.message);
      
      // Fallback : sauvegarder localement seulement
      updateFirstName(userName);
      
      toast({
        title: "Erreur de sauvegarde",
        description: apiError.message || "Impossible de sauvegarder le prénom. Les changements sont temporaires.",
        variant: "destructive",
      });
    }
  };

  // Fonction pour sauvegarder le nom de famille
  const handleSaveLastName = async () => {
    try {
      if (!lastName.trim()) {
        toast({
          title: "Erreur",
          description: "Le nom de famille ne peut pas être vide.",
          variant: "destructive",
        });
        return;
      }
      
      if (lastName.trim() === owner?.lastName) {
        toast({
          title: "Information",
          description: "Le nom de famille est identique à l'actuel.",
        });
        return;
      }

      // Sauvegarder via API
      const response = await apiRequest("PUT", "/api/auth/user", { lastName: lastName.trim() });
      const updatedUser = await response.json();
      
      // Invalider les queries pour rafraîchir les données utilisateur
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Afficher le toast de succès
      toast({
        title: "Profil mis à jour",
        description: "Votre nom de famille a été modifié avec succès.",
      });
      
    } catch (apiError) {
      console.error("API Error:", apiError);
      
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le nom de famille. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  // Mutation pour mettre à jour le salon
  const updateSalonMutation = useMutation({
    mutationFn: async (data: SalonSettings) => {
      const response = await apiRequest("PUT", "/api/salon", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Salon mis à jour",
        description: "Les informations du salon ont été sauvegardées.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/salon"] });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le salon.",
        variant: "destructive",
      });
    },
  });

  // Gestionnaires d'événements
  const handleUserNameChange = async () => {
    console.log("[SETTINGS] handleUserNameChange appelé avec:", userName);
    console.log("[SETTINGS] Current owner firstName:", owner?.firstName);
    console.log("[SETTINGS] contextFirstName:", contextFirstName);
    
    if (!userName.trim()) {
      toast({
        title: "Erreur",
        description: "Le prénom ne peut pas être vide.",
        variant: "destructive",
      });
      return;
    }
    
    // Comparer avec le prénom actuel (depuis owner ou contextFirstName)
    const currentFirstName = owner?.firstName || contextFirstName || "";
    const trimmedUserName = userName.trim();
    const trimmedCurrent = currentFirstName.trim();
    
    console.log("[SETTINGS] Comparaison:", {
      trimmedUserName,
      trimmedCurrent,
      areEqual: trimmedUserName === trimmedCurrent
    });
    
    if (trimmedUserName === trimmedCurrent) {
      toast({
        title: "Information",
        description: "Le prénom est identique à l'actuel.",
      });
      return;
    }
    
    console.log("[SETTINGS] Procédure de mise à jour...");
    await handleSaveUserName();
  };

  const handleColorChange = async (color: string) => {
    const hslColor = hexToHsl(color);
    setPrimaryColor(hslColor);
    Theme.apply(hslColor);
    
    // Sauvegarder en base de données si le salon est vérifié
    if (salonId && salonVerified) {
      try {
        const response = await apiRequest("PUT", "/api/salon", { theme_color: hslColor });
        if (response.ok) {
          console.log('[SETTINGS] Thème sauvegardé en base de données');
          // Invalider les caches pour forcer le rechargement du thème
          queryClient.invalidateQueries({ queryKey: ["/api/salon"] });
          // Invalider aussi le cache public pour que le hook useSalonAppearance recharge
          queryClient.invalidateQueries({ queryKey: ["/api/public/salon"] });
        } else {
          console.error('[SETTINGS] Erreur lors de la sauvegarde du thème');
        }
      } catch (error) {
        console.error('[SETTINGS] Erreur lors de la sauvegarde du thème:', error);
      }
    }
    
    toast({
      title: "Thème mis à jour",
      description: "La couleur principale a été changée.",
    });
  };



  const handleSalonSettingsChange = (field: keyof SalonSettings, value: string) => {
    setSalonSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSalonSettings = () => {
    updateSalonMutation.mutate(salonSettings);
    localStorage.setItem('salonSettings', JSON.stringify(salonSettings));
  };

  const handleReset = async () => {
    // Réinitialiser le thème avec le nouveau système
    Theme.resetAllPreferences();
    const defaultColor = Theme.get().primary;
    setPrimaryColor(defaultColor);
    
    // Réinitialiser le thème en base de données si le salon est vérifié
    if (salonId && salonVerified) {
      try {
        const response = await apiRequest("PUT", "/api/salon", { theme_color: null });
        if (response.ok) {
          console.log('[SETTINGS] Thème réinitialisé en base de données');
          // Invalider les caches pour forcer le rechargement du thème
          queryClient.invalidateQueries({ queryKey: ["/api/salon"] });
          // Invalider aussi le cache public pour que le hook useSalonAppearance recharge
          queryClient.invalidateQueries({ queryKey: ["/api/public/salon"] });
        }
      } catch (error) {
        console.error('[SETTINGS] Erreur lors de la réinitialisation du thème:', error);
      }
    }
    
    // Réinitialiser les autres préférences
    setUserName(""); // Réinitialiser le prénom
    
    // Nettoyer les autres données localStorage
    localStorage.removeItem('salonSettings');
    localStorage.removeItem('userFirstName');
    
    toast({
      title: "Réinitialisation",
      description: "Toutes les préférences ont été réinitialisées.",
    });
  };

  if (isHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Le HOC withOwnerAuth gère déjà la protection
  // Afficher un message de chargement si le salon n'est pas encore vérifié
  if (!salonVerified && owner) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Vérification de votre salon en cours...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profil utilisateur */}
          <Card className="glassmorphism-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profil utilisateur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="userName">Prénom</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="userName"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Votre prénom"
                  />
                  <Button 
                    onClick={handleUserNameChange} 
                    disabled={false}
                    className="bg-primary hover:bg-primary/90 text-white min-w-[120px]"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="lastName">Nom de famille</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Votre nom de famille"
                  />
                  <Button 
                    onClick={handleSaveLastName} 
                    disabled={!lastName.trim()}
                    className="bg-primary hover:bg-primary/90 text-white min-w-[120px]"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = "/change-password"}
                  className="w-full"
                >
                  Changer le mot de passe
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Apparence */}
          <Card className="glassmorphism-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Apparence du site
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="primaryColor">Couleur principale</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={hslToHex(primaryColor)}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-16 h-10 p-1 border rounded"
                  />
                  <span className="text-sm text-muted-foreground">
                    {primaryColor}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* À propos du salon */}
          <Card className="glassmorphism-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                À propos du salon
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="salonName">Nom du salon</Label>
                <Input
                  id="salonName"
                  value={salonSettings.name}
                  onChange={(e) => handleSalonSettingsChange('name', e.target.value)}
                  placeholder="Nom de votre salon"
                />
              </div>
              <div>
                <Label htmlFor="salonAddress">Adresse</Label>
                <Textarea
                  id="salonAddress"
                  value={salonSettings.address}
                  onChange={(e) => handleSalonSettingsChange('address', e.target.value)}
                  placeholder="Adresse complète du salon"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="salonPhone">Téléphone</Label>
                <Input
                  id="salonPhone"
                  value={salonSettings.phone}
                  onChange={(e) => handleSalonSettingsChange('phone', e.target.value)}
                  placeholder="Numéro de téléphone"
                />
              </div>
              <div>
                <Label htmlFor="salonEmail">Email</Label>
                <Input
                  id="salonEmail"
                  type="email"
                  value={salonSettings.email}
                  onChange={(e) => handleSalonSettingsChange('email', e.target.value)}
                  placeholder="Email du salon"
                />
              </div>
              <Button 
                onClick={handleSaveSalonSettings} 
                disabled={updateSalonMutation.isPending}
                className="w-full bg-primary hover:bg-primary/90 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder les informations
              </Button>
            </CardContent>
          </Card>

          {/* Notifications - Full width */}
          <div className="lg:col-span-2">
            <NotificationSettings />
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bouton de réinitialisation */}
        <Card className="glassmorphism-card border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5" />
              Zone de danger
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Cette action supprimera toutes vos préférences personnalisées (thème, horaires, etc.).
            </p>
            <Button 
              variant="destructive" 
              onClick={handleReset}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Réinitialiser toutes les préférences
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Exporter avec le HOC de protection
export default withOwnerAuth(SettingsPage);
