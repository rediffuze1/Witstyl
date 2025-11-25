import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  User,
  Shield,
  Save,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Scissors
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { withClientAuth } from "@/components/withClientAuth";
import ClientNavigation from "@/components/client-navigation";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

function ClientSettings() {
  const [, setLocation] = useLocation();
  const { client, refresh, isHydrating, status } = useAuthContext();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
    preferredStylistId: ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Charger les stylistes pour le select
  const { data: stylistes, isLoading: stylistesLoading, error: stylistesError } = useQuery({
    queryKey: ["/api/public/salon/stylistes"],
    queryFn: async () => {
      console.log('[ClientSettings] Chargement des stylistes...');
      const response = await fetch("/api/public/salon/stylistes", {
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        console.error('[ClientSettings] Erreur chargement stylistes:', response.status);
        return [];
      }
      
      const data = await response.json();
      console.log('[ClientSettings] Stylistes chargés:', data);
      return data || [];
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
  
  // Log pour déboguer
  useEffect(() => {
    if (stylistesError) {
      console.error('[ClientSettings] Erreur chargement stylistes:', stylistesError);
    }
    if (stylistes) {
      console.log('[ClientSettings] Stylistes disponibles:', stylistes.length, stylistes);
    }
  }, [stylistes, stylistesError]);

  // Composant Select pour les stylistes
  const StylistSelect = ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => {
    return (
      <Select value={value || "none"} onValueChange={onValueChange}>
        <SelectTrigger id="preferredStylistId">
          <SelectValue placeholder="Aucun·e coiffeur·euse préféré·e" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Aucun·e coiffeur·euse préféré·e</SelectItem>
          {stylistes && Array.isArray(stylistes) && stylistes.map((stylist: any) => {
            const displayName = stylist.name || `${stylist.first_name || ''} ${stylist.last_name || ''}`.trim() || 'Coiffeur·euse inconnu·e';
            return (
              <SelectItem key={stylist.id} value={stylist.id}>
                {displayName}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  };

  useEffect(() => {
    // Si le status est loading ou en cours d'hydratation, attendre
    if (status === 'loading' || isHydrating) {
      setIsLoading(true);
      return;
    }
    
    // Si authentifié et client disponible, charger les données complètes
    if (status === 'authenticated' && client) {
      const loadClientData = async () => {
        try {
          const response = await fetch('/api/auth/user', {
            credentials: 'include',
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.profile) {
              setProfileData({
                firstName: data.profile.firstName || '',
                lastName: data.profile.lastName || '',
                email: data.profile.email || '',
                phone: data.profile.phone || '',
                notes: data.profile.notes || '',
                preferredStylistId: data.profile.preferredStylistId || ''
              });
              console.log('[ClientSettings] Données client chargées:', data.profile);
            }
          }
        } catch (error) {
          console.error('[ClientSettings] Erreur lors du chargement des données client:', error);
          // Fallback sur les données de base du contexte
          if (client) {
            setProfileData({
              firstName: client.firstName || '',
              lastName: client.lastName || '',
              email: client.email || '',
              phone: client.phone || '',
              notes: '',
              preferredStylistId: ''
            });
          }
        } finally {
          setIsLoading(false);
        }
      };
      
      loadClientData();
    } else {
      // Pas de client, le HOC devrait rediriger
      setIsLoading(false);
    }
  }, [client, status, isHydrating]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // Préparer les données à envoyer
      const dataToSend: any = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone,
        notes: profileData.notes,
        preferredStylistId: profileData.preferredStylistId || null
      };
      
      console.log('[ClientSettings] Envoi des données du profil:', dataToSend);
      
      const response = await fetch("/api/client/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include', // Important pour envoyer les cookies de session
        body: JSON.stringify(dataToSend),
      });

      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        console.log('[ClientSettings] ✅ Profil mis à jour avec succès');
        console.log('[ClientSettings] Données retournées:', responseData);
        
        // Mettre à jour profileData avec les valeurs sauvegardées (depuis la réponse ou depuis les données envoyées)
        setProfileData(prev => {
          const updatedData = {
            ...prev,
            preferredStylistId: responseData.client?.preferredStylistId !== undefined 
              ? (responseData.client.preferredStylistId || '') 
              : (dataToSend.preferredStylistId || prev.preferredStylistId || '')
          };
          console.log('[ClientSettings] ProfileData mis à jour:', updatedData);
          return updatedData;
        });
        
        // Rafraîchir le client pour récupérer les données mises à jour depuis le serveur
        await refresh();
        
        toast({
          title: "Profil mis à jour",
          description: "Vos informations ont été sauvegardées avec succès.",
        });
      } else {
        console.error('[ClientSettings] ❌ Erreur HTTP:', response.status, responseData);
        throw new Error(responseData.message || responseData.error || "Erreur lors de la mise à jour");
      }
    } catch (error: any) {
      console.error('[ClientSettings] ❌ Exception:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder les modifications.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/client/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordData),
      });

      if (response.ok) {
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        toast({
          title: "Mot de passe modifié",
          description: "Votre mot de passe a été mis à jour avec succès.",
        });
      } else {
        throw new Error("Erreur lors du changement de mot de passe");
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le mot de passe.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // État de chargement: afficher un spinner
  // Le HOC withClientAuth gère déjà la protection et l'hydratation
  // Si on arrive ici, c'est qu'on est un client authentifié

  // Si pas de client après tout ça, erreur
  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">Impossible de charger vos informations</p>
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
            Paramètres
          </h1>
          <p className="text-muted-foreground">
            Gérez vos préférences et vos informations personnelles
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Settings */}
          <Card className="glassmorphism-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Informations personnelles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="preferredStylistId">Coiffeur·euse préféré·e (optionnel·le)</Label>
                <StylistSelect
                  value={profileData.preferredStylistId || "none"}
                  onValueChange={(value) => setProfileData(prev => ({ ...prev, preferredStylistId: value === "none" ? "" : value }))}
                />
              </div>
              
              
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Sauvegarde..." : "Sauvegarder le profil"}
              </Button>
            </CardContent>
          </Card>

          {/* Password Settings */}
          <Card className="glassmorphism-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Sécurité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>
              
              <Button
                onClick={handleChangePassword}
                disabled={isSaving || !passwordData.currentPassword || !passwordData.newPassword}
                className="w-full"
              >
                <Shield className="mr-2 h-4 w-4" />
                {isSaving ? "Modification..." : "Changer le mot de passe"}
              </Button>
            </CardContent>
          </Card>
        {/* Notifications & Confidentialité supprimées */}
        </div>
      </div>
    </div>
  );
}

// Exporter avec le HOC de protection
export default withClientAuth(ClientSettings);
