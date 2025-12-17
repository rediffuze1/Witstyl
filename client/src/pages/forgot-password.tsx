import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Email invalide",
        description: "Veuillez entrer une adresse email valide.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Récupérer l'URL de l'application pour le redirectTo
      // IMPORTANT: VITE_APP_URL doit être défini en prod Vercel
      // Si non défini, utiliser window.location.origin comme fallback
      const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
      
      // Forcer l'URL absolue pour reset-password
      const redirectTo = `${APP_URL}/reset-password`;

      // Logs de debug (dev + prod)
      console.log('[ForgotPassword] 📧 Envoi email reset password:', {
        email,
        redirectTo,
        VITE_APP_URL: import.meta.env.VITE_APP_URL,
        windowOrigin: window.location.origin,
        finalRedirectTo: redirectTo,
      });

      // Log supplémentaire en dev pour vérifier la config
      if (import.meta.env.DEV) {
        console.log('[ForgotPassword] [DEV] redirectTo:', redirectTo);
        console.log('[ForgotPassword] [DEV] VITE_APP_URL:', import.meta.env.VITE_APP_URL);
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        console.error('[forgot-password] ❌ Erreur Supabase:', error);
        throw error;
      }

      // Toujours afficher le message de succès (même si l'email n'existe pas)
      // pour ne pas révéler si un compte existe
      setIsSuccess(true);
      
      toast({
        title: "Email envoyé",
        description: "Si un compte existe, un email vous a été envoyé.",
      });
    } catch (error: any) {
      console.error('[forgot-password] ❌ Erreur:', error);
      // Afficher quand même le message générique pour ne pas révéler si l'email existe
      setIsSuccess(true);
      toast({
        title: "Email envoyé",
        description: "Si un compte existe, un email vous a été envoyé.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">Email envoyé</CardTitle>
            <CardDescription className="text-slate-600">
              Si un compte existe avec cet email, un lien de réinitialisation vous a été envoyé.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-2">📧 Vérifiez votre boîte mail</p>
              <p>Cliquez sur le lien dans l'email pour réinitialiser votre mot de passe.</p>
            </div>
            
            <Button 
              onClick={() => setLocation("/salon-login")}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">Mot de passe oublié</CardTitle>
          <CardDescription className="text-slate-600">
            Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Votre email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-3 pt-4">
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Envoi en cours..." : "Envoyer le lien"}
              </Button>
              
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setLocation("/salon-login")}
                className="w-full h-12 border-slate-300 text-slate-700 hover:bg-slate-50"
                disabled={isSubmitting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la connexion
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

