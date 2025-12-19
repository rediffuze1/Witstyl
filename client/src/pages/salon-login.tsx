import { useState, useEffect, useRef } from "react";
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
  const [isTimeoutError, setIsTimeoutError] = useState(false);
  
  // Tous les hooks doivent être appelés de manière inconditionnelle
  const { login } = useAuth();
  const authContext = useAuthContext();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginSuccessRef = useRef(false);

  // Effet pour rediriger automatiquement quand l'authentification est prête après un login réussi
  useEffect(() => {
    if (loginSuccessRef.current && !authContext.isHydrating && authContext.status === 'authenticated' && authContext.userType === 'owner') {
      console.log('[salon-login] ✅ Session restaurée (via useEffect), navigation vers dashboard');
      loginSuccessRef.current = false; // Réinitialiser pour éviter les redirections multiples
      setLocation("/dashboard", { replace: true });
    }
  }, [authContext.isHydrating, authContext.status, authContext.userType, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setIsTimeoutError(false);
    
    try {
      const loginSuccess = await login({ email, password });
      
      if (!loginSuccess) {
        // Vérifier si c'est une erreur EMAIL_NOT_CONFIRMED
        // Le hook login devrait gérer cela, mais on vérifie quand même
        setError("Email ou mot de passe incorrect.");
        setIsSubmitting(false);
        return;
      }
      
      // Marquer que le login a réussi - l'effet useEffect gérera la redirection
      loginSuccessRef.current = true;
      setIsSubmitting(false);
      
      // L'effet useEffect écoutera les changements de authContext et redirigera automatiquement
      // quand isHydrating devient false et status devient authenticated
      console.log('[salon-login] ✅ Login réussi, attente de la restauration de session...');
    } catch (error: any) {
      // Gérer spécifiquement les erreurs de timeout
      if (error?.code === 'TIMEOUT' || error?.message === 'TIMEOUT') {
        setIsTimeoutError(true);
        setError("Le serveur met trop de temps à répondre. Veuillez réessayer.");
      } else if (error?.message?.includes('confirmer votre email') || error?.message?.includes('Email not confirmed')) {
        // Erreur EMAIL_NOT_CONFIRMED
        setError("Merci de confirmer votre email avant de vous connecter. Vérifiez votre boîte mail.");
        setIsTimeoutError(false);
      } else {
        setError(error?.message || "Erreur de connexion. Veuillez réessayer.");
        setIsTimeoutError(false);
      }
      console.error("Erreur de connexion:", error);
      setIsSubmitting(false);
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsTimeoutError(false);
    setError(null);
    // Réessayer en appelant directement handleSubmit avec un événement mock
    const mockEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
    } as React.FormEvent;
    handleSubmit(mockEvent);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-3 sm:p-4">
        <Card className="w-full max-w-4xl overflow-hidden shadow-2xl">
          <div className="grid md:grid-cols-2 min-h-[500px] sm:min-h-[600px]">
            {/* Section gauche - Formulaire */}
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-4 sm:p-6 md:p-8 flex flex-col justify-center order-2 md:order-1">
              <div className="space-y-4 sm:space-y-6">
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
                  <p className="text-sm sm:text-base text-slate-600">Please select your account type to continue.</p>
                </div>
                
                <div className="space-y-3 sm:space-y-4">
                  <Button
                    onClick={() => handleUserTypeSelection('salon')}
                    className="w-full h-14 sm:h-16 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold text-sm sm:text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px]"
                  >
                    <Users className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />
                    Salon Owner / Manager
                  </Button>
                  
                  <Button
                    onClick={() => handleUserTypeSelection('client')}
                    className="w-full h-14 sm:h-16 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold text-sm sm:text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px]"
                  >
                    <User className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />
                    Client
                  </Button>
                </div>
                
                <div className="text-center">
                  <Button 
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
            <div className="bg-gradient-to-br from-purple-500 to-purple-700 p-6 sm:p-8 flex flex-col justify-center items-center text-white order-1 md:order-2 min-h-[200px] sm:min-h-[300px] md:min-h-auto">
              <div className="text-center space-y-4 sm:space-y-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Scissors className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-4">Witstyl</h2>
                  <p className="text-sm sm:text-base md:text-lg text-purple-100 max-w-sm px-4 sm:px-0">
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
              
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4" noValidate>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm space-y-2">
                    <p>{error}</p>
                    {isTimeoutError && (
                      <Button
                        type="button"
                        onClick={handleRetry}
                        className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white min-h-[44px] text-sm sm:text-base"
                        disabled={isSubmitting}
                      >
                        Réessayer
                      </Button>
                    )}
                  </div>
                )}
                
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="email" className="text-sm sm:text-base text-slate-700 font-medium">Email</Label>
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
                    className="h-11 sm:h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500 text-sm sm:text-base"
                  />
                </div>
                
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="password" className="text-sm sm:text-base text-slate-700 font-medium">Password</Label>
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
                    className="h-11 sm:h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500 text-sm sm:text-base"
                  />
                </div>
                
                <div className="text-right">
                  <Button 
                    type="button"
                    variant="link" 
                    onClick={() => setLocation("/forgot-password")}
                    className="text-purple-600 hover:text-purple-700 p-0 h-auto text-xs sm:text-sm"
                  >
                    Forgot password?
                  </Button>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 sm:h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px] text-sm sm:text-base"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Logging in..." : "Log In"}
                </Button>
              </form>
              
              <div className="text-center">
                <p className="text-xs sm:text-sm text-slate-600">
                  Don't have an account? 
                  <Button 
                    variant="link" 
                    onClick={() => setLocation("/salon-register")}
                    className="text-purple-600 hover:text-purple-700 p-0 h-auto ml-1 text-xs sm:text-sm"
                  >
                    Sign up
                  </Button>
                </p>
              </div>
              
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={() => setUserType(null)} 
                  className="text-slate-600 hover:text-slate-800 text-xs sm:text-sm"
                >
                  <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Changer le type de compte
                </Button>
              </div>
            </div>
          </div>

          {/* Section droite - Branding */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 p-6 sm:p-8 flex flex-col justify-center items-center text-white order-1 md:order-2 min-h-[200px] sm:min-h-[300px] md:min-h-auto">
            <div className="text-center space-y-4 sm:space-y-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Scissors className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-4">Witstyl</h2>
                <p className="text-sm sm:text-base md:text-lg text-purple-100 max-w-sm px-4 sm:px-0">
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
