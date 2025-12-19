import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Scissors, ArrowLeft, User } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";

export default function ClientLogin() {
  const [, setLocation] = useLocation();
  const { loginClient, refresh } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    
    setIsLoading(true);
    setError("");

    try {
      console.log('[ClientLogin] Tentative de connexion pour:', email);
      
      // POST /api/client/login + mise à jour du contexte
      const success = await loginClient(email, password);
      console.log('[ClientLogin] Résultat de connexion:', success);
      
      if (!success) {
        setError("Email ou mot de passe incorrect. Veuillez vérifier vos identifiants.");
        setIsLoading(false);
        return;
      }

      // Si login() retourne true, attendre un peu pour que les cookies se propagent
      // puis naviguer vers le dashboard
      console.log('[ClientLogin] ✅ Connexion réussie, attente propagation des cookies...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Vérifier rapidement que la session est bien propagée (optionnel, non bloquant)
      try {
        const checkResponse = await fetch('/api/auth/user', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          if (checkData.authenticated && checkData.userType === 'client') {
            console.log('[ClientLogin] ✅ Session confirmée, redirection vers /client-dashboard');
          } else {
            console.log('[ClientLogin] ⚠️ Session pas encore propagée, redirection quand même');
          }
        }
      } catch (err) {
        console.warn('[ClientLogin] Erreur vérification session (non bloquant):', err);
      }
      
      setLocation("/client-dashboard", { replace: true });
      // Ne pas réinitialiser isLoading pour montrer le chargement pendant la navigation
      return;
    } catch (error: any) {
      console.error('[ClientLogin] Erreur lors de la connexion:', error);
      setError(error?.message || "Erreur de connexion. Veuillez réessayer.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-3 sm:p-4">
      <Card className="w-full max-w-4xl overflow-hidden shadow-2xl">
        <div className="grid md:grid-cols-2 min-h-[500px] sm:min-h-[600px]">
          {/* Section gauche - Formulaire */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-4 sm:p-6 md:p-8 flex flex-col justify-center order-2 md:order-1">
            <div className="space-y-4 sm:space-y-6">
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
                <p className="text-sm sm:text-base text-slate-600">Please enter your details to log in.</p>
              </div>
              
              <form 
                onSubmit={handleLogin}
                className="space-y-3 sm:space-y-4"
                noValidate
              >
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="email" className="text-sm sm:text-base text-slate-700 font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="h-11 sm:h-12 bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base"
                  />
                </div>
                
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="password" className="text-sm sm:text-base text-slate-700 font-medium">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mot de passe"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-11 sm:h-12 bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base"
                  />
                </div>
                
                {error && (
                  <div className="text-xs sm:text-sm text-red-500 bg-red-50 p-2.5 sm:p-3 rounded-lg">
                    {error}
                  </div>
                )}
                
                <div className="text-right">
                  <Button 
                    type="button"
                    variant="link" 
                    onClick={() => setLocation("/forgot-password")}
                    className="text-blue-600 hover:text-blue-700 p-0 h-auto text-xs sm:text-sm"
                  >
                    Mot de passe oublié ?
                  </Button>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 sm:h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm sm:text-base min-h-[44px]"
                  disabled={isLoading}
                >
                  {isLoading ? "Connexion en cours..." : "Se connecter"}
                </Button>
              </form>
              
              <div className="text-center">
                <p className="text-xs sm:text-sm text-slate-600">
                  Don't have an account? 
                  <Button 
                    type="button"
                    variant="link" 
                    onClick={() => setLocation("/client-register")}
                    className="text-blue-600 hover:text-blue-700 p-0 h-auto ml-1 text-xs sm:text-sm"
                  >
                    Sign up
                  </Button>
                </p>
              </div>
              
              <div className="text-center">
                <Button 
                  type="button"
                  variant="link" 
                  onClick={() => setLocation("/")} 
                  className="text-slate-600 hover:text-slate-800 text-xs sm:text-sm"
                >
                  <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Retour à l'accueil
                </Button>
              </div>
            </div>
          </div>

          {/* Section droite - Branding */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 sm:p-8 flex flex-col justify-center items-center text-white order-1 md:order-2 min-h-[200px] sm:min-h-[300px] md:min-h-auto">
            <div className="text-center space-y-4 sm:space-y-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <User className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-4">Witstyl</h2>
                <p className="text-sm sm:text-base md:text-lg text-blue-100 max-w-sm px-4 sm:px-0">
                  Your salon's co-pilot for seamless booking and management.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
