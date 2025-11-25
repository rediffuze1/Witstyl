import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Scissors, ArrowLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function ClientRegister() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    notes: "",
  });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const registerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validate passwords match
      if (data.password !== data.confirmPassword) {
        throw new Error("Les mots de passe ne correspondent pas");
      }

      if (data.password.length < 6) {
        throw new Error("Le mot de passe doit contenir au moins 6 caractères");
      }

      // Register client with authentication
      const response = await fetch("/api/client/register", {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          password: data.password,
          notes: data.notes || '',
        }),
      });

      if (!response.ok) {
        let errorMessage = "Échec de la création du compte";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // Si la réponse n'est pas du JSON, utiliser le message par défaut
          errorMessage = `Erreur ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      // Inclure les informations de connexion dans le résultat
      return {
        ...result,
        loginCredentials: {
          email: data.email,
          password: data.password,
        },
      };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      
      // Tenter de connecter automatiquement l'utilisateur après l'inscription
      if (data.loginCredentials) {
        try {
          const loginResponse = await fetch("/api/client/login", {
            method: "POST",
            credentials: 'include',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: data.loginCredentials.email,
              password: data.loginCredentials.password,
            }),
          });

          if (loginResponse.ok) {
            toast({
              title: "Compte créé avec succès !",
              description: "Vous êtes maintenant connecté.",
            });
            // Attendre un peu avant la redirection pour que la session soit créée
            setTimeout(() => {
              setLocation("/client-dashboard");
            }, 500);
            return;
          }
        } catch (error) {
          console.warn("Erreur lors de la connexion automatique:", error);
        }
      }
      
      // Si la connexion automatique a échoué, rediriger vers la page de connexion
      toast({
        title: "Compte créé avec succès !",
        description: "Vous pouvez maintenant vous connecter avec votre email et mot de passe.",
      });
      setLocation("/client-login");
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur de création",
        description: error.message || "Une erreur est survenue lors de la création du compte.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Email invalide",
        description: "Veuillez entrer une adresse email valide.",
        variant: "destructive",
      });
      return;
    }

    // Phone validation (basic)
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(formData.phone)) {
      toast({
        title: "Téléphone invalide",
        description: "Veuillez entrer un numéro de téléphone valide.",
        variant: "destructive",
      });
      return;
    }

    registerMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glassmorphism-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <Scissors className="text-white h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">Créer un compte</CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            Créez votre compte client pour gérer vos rendez-vous facilement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Jean"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={registerMutation.isPending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Dupont"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={registerMutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre.email@exemple.com"
                required
                value={formData.email}
                onChange={handleChange}
                disabled={registerMutation.isPending}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+33 6 12 34 56 78"
                required
                value={formData.phone}
                onChange={handleChange}
                disabled={registerMutation.isPending}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Mot de passe *</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={formData.password}
                onChange={handleChange}
                disabled={registerMutation.isPending}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={registerMutation.isPending}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                placeholder="Préférences, allergies, remarques..."
                value={formData.notes}
                onChange={handleChange}
                disabled={registerMutation.isPending}
                rows={3}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full btn-primary" 
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? "Création en cours..." : "Créer mon compte"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button 
              variant="link" 
              onClick={() => setLocation("/")} 
              className="text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à l'accueil
            </Button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Vous avez déjà un compte ? 
              <Button 
                variant="link" 
                onClick={() => setLocation("/client-login")} 
                className="p-0 h-auto ml-1 text-primary"
              >
                Se connecter
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

