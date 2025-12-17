import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Scissors, ArrowLeft, Users, Building, MapPin, Phone, Mail } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export default function SalonRegister() {
  const [formData, setFormData] = useState({
    // Informations personnelles
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    
    // Informations du salon
    salonName: "",
    salonAddress: "",
    salonPhone: "",
    salonEmail: "",
    salonDescription: "",
  });
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const registerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Utiliser Supabase Auth signUp côté client avec emailRedirectTo
      const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
      const emailRedirectTo = `${APP_URL}/auth/confirm`;

      console.log('[salon-register] 📧 Inscription avec confirmation email:', {
        email: data.email,
        redirectTo: emailRedirectTo,
      });

      // 1. Créer l'utilisateur avec Supabase Auth (nécessite confirmation)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo,
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            phone: data.phone,
          },
        },
      });

      if (authError) {
        throw new Error(authError.message || "Erreur lors de la création du compte");
      }

      if (!authData.user) {
        throw new Error("Échec de la création du compte utilisateur");
      }

      // 2. Créer le salon et l'utilisateur via l'API backend
      const response = await fetch("/api/salon/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          userId: authData.user.id, // Passer l'ID de l'utilisateur créé
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Échec de la création du salon");
      }

      return { ...authData, ...(await response.json()) };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["salons"] });
      // Ne pas rediriger vers login, afficher l'écran "Vérifie ton email"
      setLocation("/email-confirmation-required");
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
    
    // Validation des champs obligatoires
    const requiredFields = [
      'firstName', 'lastName', 'email', 'phone', 'password', 'confirmPassword',
      'salonName', 'salonAddress', 'salonPhone', 'salonEmail'
    ];
    
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Email invalide",
        description: "Veuillez entrer une adresse email valide.",
        variant: "destructive",
      });
      return;
    }

    // Validation email salon
    if (!emailRegex.test(formData.salonEmail)) {
      toast({
        title: "Email salon invalide",
        description: "Veuillez entrer une adresse email valide pour le salon.",
        variant: "destructive",
      });
      return;
    }

    // Validation mot de passe
    if (formData.password.length < 6) {
      toast({
        title: "Mot de passe trop court",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive",
      });
      return;
    }

    // Validation confirmation mot de passe
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Mots de passe différents",
        description: "Les mots de passe ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }

    // Validation téléphone
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
      <Card className="w-full max-w-4xl overflow-hidden shadow-2xl">
        <div className="grid md:grid-cols-2 min-h-[700px]">
          {/* Section gauche - Formulaire */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-8 flex flex-col justify-center overflow-y-auto">
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Create Account</h1>
                <p className="text-slate-600">Join Witstyl and start managing your salon.</p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Informations personnelles */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Users className="h-4 w-4" />
                    <span>Personal Information</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-slate-700 font-medium">First Name *</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="John"
                        required
                        value={formData.firstName}
                        onChange={handleChange}
                        disabled={registerMutation.isPending}
                        className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-slate-700 font-medium">Last Name *</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Doe"
                        required
                        value={formData.lastName}
                        onChange={handleChange}
                        disabled={registerMutation.isPending}
                        className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-700 font-medium">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      disabled={registerMutation.isPending}
                      className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-slate-700 font-medium">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+33 6 12 34 56 78"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={registerMutation.isPending}
                      className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-slate-700 font-medium">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        value={formData.password}
                        onChange={handleChange}
                        disabled={registerMutation.isPending}
                        className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">Confirm Password *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        required
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        disabled={registerMutation.isPending}
                        className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Informations du salon */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Building className="h-4 w-4" />
                    <span>Salon Information</span>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="salonName" className="text-slate-700 font-medium">Salon Name *</Label>
                    <Input
                      id="salonName"
                      type="text"
                      placeholder="My Beautiful Salon"
                      required
                      value={formData.salonName}
                      onChange={handleChange}
                      disabled={registerMutation.isPending}
                      className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salonAddress" className="text-slate-700 font-medium">Address *</Label>
                    <Input
                      id="salonAddress"
                      type="text"
                      placeholder="123 Main Street, Paris"
                      required
                      value={formData.salonAddress}
                      onChange={handleChange}
                      disabled={registerMutation.isPending}
                      className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="salonPhone" className="text-slate-700 font-medium">Salon Phone *</Label>
                      <Input
                        id="salonPhone"
                        type="tel"
                        placeholder="+33 1 23 45 67 89"
                        required
                        value={formData.salonPhone}
                        onChange={handleChange}
                        disabled={registerMutation.isPending}
                        className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salonEmail" className="text-slate-700 font-medium">Salon Email *</Label>
                      <Input
                        id="salonEmail"
                        type="email"
                        placeholder="contact@salon.com"
                        required
                        value={formData.salonEmail}
                        onChange={handleChange}
                        disabled={registerMutation.isPending}
                        className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salonDescription" className="text-slate-700 font-medium">Description (optional)</Label>
                    <Textarea
                      id="salonDescription"
                      placeholder="Tell us about your salon..."
                      value={formData.salonDescription}
                      onChange={handleChange}
                      disabled={registerMutation.isPending}
                      rows={3}
                      className="bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
              
              <div className="text-center">
                <p className="text-slate-600">
                  Already have an account? 
                  <Button 
                    variant="link" 
                    onClick={() => setLocation("/salon-login")}
                    className="text-purple-600 hover:text-purple-700 p-0 h-auto ml-1"
                  >
                    Sign in
                  </Button>
                </p>
              </div>
              
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={() => setLocation("/")} 
                  className="text-slate-600 hover:text-slate-800"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to home
                </Button>
              </div>
            </div>
          </div>

          {/* Section droite - Branding */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 p-8 flex flex-col justify-center items-center text-white">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Scissors className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-bold mb-4">Witstyl</h2>
                <p className="text-lg text-purple-100 max-w-sm">
                  Your salon's co-pilot for seamless booking and management.
                </p>
              </div>
              
              <div className="space-y-4 text-left max-w-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="text-purple-100">Manage your team</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Building className="h-4 w-4" />
                  </div>
                  <span className="text-purple-100">Organize your services</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <span className="text-purple-100">Track appointments</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Phone className="h-4 w-4" />
                  </div>
                  <span className="text-purple-100">Connect with clients</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
