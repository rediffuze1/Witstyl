import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Vérifier si une session de recovery existe
  useEffect(() => {
    const checkRecoverySession = async () => {
      try {
        // Log de diagnostic : vérifier l'URL complète et les paramètres
        const currentUrl = window.location.href;
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const type = urlParams.get('type');
        const redirectTo = urlParams.get('redirect_to');
        
        console.log('[reset-password] 🔍 Diagnostic URL:', {
          currentUrl,
          pathname: window.location.pathname,
          search: window.location.search,
          code: code ? `${code.substring(0, 20)}...` : null,
          type,
          redirectTo,
        });

        // Vérifier si l'URL contient un code (PKCE flow)
        if (code) {
          console.log('[reset-password] 🔗 Code trouvé dans URL, échange pour session...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('[reset-password] ❌ Erreur échange code:', error);
            setHasRecoverySession(false);
            setIsCheckingSession(false);
            return;
          }
          
          if (data.session) {
            console.log('[reset-password] ✅ Session recovery créée');
            setHasRecoverySession(true);
            setIsCheckingSession(false);
            return;
          }
        }

        // Vérifier la session actuelle
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[reset-password] ❌ Erreur récupération session:', sessionError);
          setHasRecoverySession(false);
          setIsCheckingSession(false);
          return;
        }

        // Vérifier si c'est une session de recovery (type PASSWORD_RECOVERY)
        if (session?.user?.recovery_sent_at || session?.user?.app_metadata?.provider === 'email') {
          console.log('[reset-password] ✅ Session recovery détectée');
          setHasRecoverySession(true);
        } else {
          console.log('[reset-password] ⚠️ Pas de session recovery');
          setHasRecoverySession(false);
        }
        
        setIsCheckingSession(false);
      } catch (error: any) {
        console.error('[reset-password] ❌ Erreur vérification session:', error);
        setHasRecoverySession(false);
        setIsCheckingSession(false);
      }
    };

    checkRecoverySession();

    // Écouter les changements d'auth state (pour détecter PASSWORD_RECOVERY)
    // Supabase peut déclencher cet événement quand l'utilisateur arrive depuis le lien email
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[reset-password] 🔔 Auth state change:', {
        event,
        hasSession: !!session,
        recovery_sent_at: session?.user?.recovery_sent_at,
        userId: session?.user?.id,
      });
      
      if (event === 'PASSWORD_RECOVERY' || session?.user?.recovery_sent_at) {
        console.log('[reset-password] ✅ PASSWORD_RECOVERY détecté via onAuthStateChange');
        setHasRecoverySession(true);
        setIsCheckingSession(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validation côté client
    if (newPassword !== confirmPassword) {
      toast({
        title: "Erreur de validation",
        description: "Les nouveaux mots de passe ne correspondent pas.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Erreur de validation",
        description: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (!hasRecoverySession) {
      toast({
        title: "Lien invalide",
        description: "Aucune session de réinitialisation valide. Veuillez refaire 'Mot de passe oublié'.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('[reset-password] 🔄 Mise à jour du mot de passe...');
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('[reset-password] ❌ Erreur mise à jour:', error);
        throw error;
      }

      console.log('[reset-password] ✅ Mot de passe mis à jour');

      // Déconnecter la session recovery si nécessaire
      await supabase.auth.signOut();

      toast({
        title: "Mot de passe mis à jour ✅",
        description: "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.",
      });

      // Rediriger vers la connexion
      setTimeout(() => {
        setLocation("/salon-login");
      }, 1500);
    } catch (error: any) {
      console.error('[reset-password] ❌ Erreur:', error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la réinitialisation du mot de passe.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-white animate-pulse" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">Vérification...</CardTitle>
            <CardDescription className="text-slate-600">
              Vérification du lien de réinitialisation...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">Lien invalide ou expiré</CardTitle>
            <CardDescription className="text-slate-600">
              Le lien de réinitialisation est invalide ou a expiré.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <p className="font-medium mb-2">⚠️ Que faire ?</p>
              <p>Veuillez refaire une demande de "Mot de passe oublié" pour recevoir un nouveau lien.</p>
            </div>
            
            <Button 
              onClick={() => setLocation("/forgot-password")}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Mot de passe oublié
            </Button>
            
            <Button 
              type="button"
              variant="outline" 
              onClick={() => setLocation("/salon-login")}
              className="w-full h-12 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
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
            <Lock className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">Réinitialiser le mot de passe</CardTitle>
          <CardDescription className="text-slate-600">
            Choisissez un nouveau mot de passe sécurisé.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-slate-700 font-medium">
                Nouveau mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Nouveau mot de passe"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-12 px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Minimum 8 caractères
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">
                Confirmer le nouveau mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirmer le nouveau mot de passe"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-12 px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Réinitialisation en cours..." : "Réinitialiser le mot de passe"}
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
