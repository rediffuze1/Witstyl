import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Scissors, ArrowLeft, Mail, Lock } from "lucide-react";

export default function ClientResetPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/client/reset-password", {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, newPassword }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          setLocation("/client-login");
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Erreur lors de la réinitialisation du mot de passe.");
      }
    } catch (error) {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-green-600 mb-4">
              <Lock className="w-16 h-16 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Mot de passe réinitialisé !</h2>
            <p className="text-muted-foreground mb-4">
              Votre mot de passe a été mis à jour avec succès.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirection vers la page de connexion...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Scissors className="w-8 h-8 text-primary mr-2" />
            <h1 className="text-2xl font-bold">Witstyl</h1>
          </div>
          <CardTitle className="text-xl">Réinitialiser le mot de passe</CardTitle>
          <p className="text-muted-foreground text-sm">
            Entrez votre email et votre nouveau mot de passe
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Votre adresse email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium">Nouveau mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Nouveau mot de passe (min. 6 caractères)"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirmer le nouveau mot de passe"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>
            
            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Réinitialisation en cours..." : "Réinitialiser le mot de passe"}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => setLocation("/client-login")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la connexion
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}














