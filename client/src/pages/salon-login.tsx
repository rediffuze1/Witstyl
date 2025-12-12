import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Scissors, ArrowLeft, Users, User } from "lucide-react";

export default function SalonLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState<'salon' | 'client' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Tous les hooks doivent être appelés de manière inconditionnelle
  const { login } = useAuth();
  const authContext = useAuthContext();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const loginSuccess = await login({ email, password });
      
      if (!loginSuccess) {
        setError("Email ou mot de passe incorrect.");
        setIsSubmitting(false);
        return;
      }
      
      // Attendre que l'hydratation soit complète avant de naviguer
      // Le AuthContext met isHydrating à true pendant restoreSession()
      // On attend qu'il soit remis à false et que le statut soit authenticated
      // Attendre jusqu'à ce que l'hydratation soit terminée
      let attempts = 0;
      const maxAttempts = 30; // 3 secondes max (30 * 100ms)
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
        
        // Vérifier le statut actuel depuis le contexte (déjà déclaré au niveau du composant)
        if (!authContext.isHydrating && authContext.status === 'authenticated' && authContext.userType === 'owner') {
          console.log('[salon-login] ✅ Session restaurée, navigation vers dashboard');
          setLocation("/dashboard", { replace: true });
          setIsSubmitting(false);
          return;
        }
      }
      
      // Si on arrive ici, l'hydratation a pris trop de temps
      // Vérifier manuellement la session avant de naviguer
      console.warn('[salon-login] ⚠️ Hydratation longue, vérification manuelle...');
      
      try {
        const checkResponse = await fetch('/api/auth/user', {
          credentials: 'include'
        });
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          if (checkData.authenticated && checkData.userType === 'owner') {
            console.log('[salon-login] ✅ Session vérifiée manuellement, navigation vers dashboard');
            setLocation("/dashboard", { replace: true });
            setIsSubmitting(false);
            return;
          }
        }
      } catch (checkError) {
        console.warn('[salon-login] Erreur vérification session:', checkError);
      }
      
      // Si tout échoue, afficher une erreur
      setError("Erreur lors de la restauration de la session. Veuillez réessayer.");
      setIsSubmitting(false);
    } catch (error: any) {
      setError(error?.message || "Erreur de connexion. Veuillez réessayer.");
      console.error("Erreur de connexion:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserTypeSelection = (type: 'salon' | 'client') => {
    setUserType(type);
    if (type === 'client') {
      setLocation("/client-login");
    }
  };

  // Si aucun type d'utilisateur n'est sélectionné, afficher le choix
  if (!userType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
        <Card className="w-full max-w-4xl overflow-hidden shadow-2xl">
          <div className="grid md:grid-cols-2 min-h-[600px]">
            {/* Section gauche - Formulaire */}
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-8 flex flex-col justify-center">
              <div className="space-y-6">
                <div className="text-center">
                  <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
                  <p className="text-slate-600">Please select your account type to continue.</p>
                </div>
                
                <div className="space-y-4">
                  <Button
                    onClick={() => handleUserTypeSelection('salon')}
                    className="w-full h-16 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Users className="mr-3 h-6 w-6" />
                    Salon Owner / Manager
                  </Button>
                  
                  <Button
                    onClick={() => handleUserTypeSelection('client')}
                    className="w-full h-16 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <User className="mr-3 h-6 w-6" />
                    Client
                  </Button>
                </div>
                
                <div className="text-center">
                  <Button 
                    variant="link" 
                    onClick={() => setLocation("/")} 
                    className="text-slate-600 hover:text-slate-800"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour à l'accueil
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
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Formulaire de connexion pour les salons
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
      <Card className="w-full max-w-4xl overflow-hidden shadow-2xl">
        <div className="grid md:grid-cols-2 min-h-[600px]">
          {/* Section gauche - Formulaire */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-8 flex flex-col justify-center">
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
                <p className="text-slate-600">Please enter your details to log in.</p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    disabled={isSubmitting}
                    className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    disabled={isSubmitting}
                    className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                
                <div className="text-right">
                  <Button 
                    type="button"
                    variant="link" 
                    onClick={() => setLocation("/reset-password")}
                    className="text-purple-600 hover:text-purple-700 p-0 h-auto"
                  >
                    Forgot password?
                  </Button>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Logging in..." : "Log In"}
                </Button>
              </form>
              
              <div className="text-center">
                <p className="text-slate-600">
                  Don't have an account? 
                  <Button 
                    variant="link" 
                    onClick={() => setLocation("/salon-register")}
                    className="text-purple-600 hover:text-purple-700 p-0 h-auto ml-1"
                  >
                    Sign up
                  </Button>
                </p>
              </div>
              
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={() => setUserType(null)} 
                  className="text-slate-600 hover:text-slate-800"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Changer le type de compte
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
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
