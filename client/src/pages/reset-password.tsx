import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Lock, Eye, EyeOff, Mail } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

interface RecoveryParams {
  code?: string;
  type?: string;
  access_token?: string;
  refresh_token?: string;
}

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recoverySession, setRecoverySession] = useState<Session | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionCheckTimeout, setSessionCheckTimeout] = useState<NodeJS.Timeout | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fonction pour extraire les paramètres de recovery depuis l'URL
  const extractRecoveryParams = (): RecoveryParams => {
    const params: RecoveryParams = {};
    
    // Extraire depuis query string (?code=...&type=...)
    const urlParams = new URLSearchParams(window.location.search);
    params.code = urlParams.get('code') || undefined;
    params.type = urlParams.get('type') || undefined;
    
    // Extraire depuis hash (#access_token=...&refresh_token=...&type=...)
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      params.access_token = hashParams.get('access_token') || undefined;
      params.refresh_token = hashParams.get('refresh_token') || undefined;
      if (!params.type) {
        params.type = hashParams.get('type') || undefined;
      }
    }
    
    return params;
  };

  // Vérifier et obtenir la session de recovery
  useEffect(() => {
    // Logs de diagnostic (dev seulement)
    if (import.meta.env.DEV) {
      console.log('[reset-password] 🔍 Diagnostic URL (DEV):', {
        href: window.location.href,
        search: window.location.search,
        hash: window.location.hash,
      });
    }

    const checkRecoverySession = async () => {
      try {
        const params = extractRecoveryParams();
        
        console.log('[reset-password] 🔍 Paramètres extraits:', {
          hasCode: !!params.code,
          hasAccessToken: !!params.access_token,
          type: params.type,
        });

        // Cas 1: Code PKCE dans query string
        if (params.code && params.type === 'recovery') {
          console.log('[reset-password] 🔗 Code PKCE trouvé, échange pour session...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
          
          if (error) {
            console.error('[reset-password] ❌ Erreur échange code:', error);
            setIsCheckingSession(false);
            return;
          }
          
          if (data.session && data.user) {
            console.log('[reset-password] ✅ Session recovery créée via PKCE:', {
              userId: data.user.id,
              email: data.user.email,
            });
            setRecoverySession(data.session);
            setRecoveryEmail(data.user.email || null);
            setIsCheckingSession(false);
            return;
          }
        }

        // Cas 2: Tokens legacy dans hash
        if (params.access_token && params.refresh_token && params.type === 'recovery') {
          console.log('[reset-password] 🔗 Tokens legacy trouvés dans hash...');
          // Créer une session temporaire avec les tokens
          const { data: { session }, error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
          
          if (error) {
            console.error('[reset-password] ❌ Erreur setSession:', error);
            setIsCheckingSession(false);
            return;
          }
          
          if (session?.user) {
            console.log('[reset-password] ✅ Session recovery créée via tokens legacy:', {
              userId: session.user.id,
              email: session.user.email,
            });
            setRecoverySession(session);
            setRecoveryEmail(session.user.email || null);
            setIsCheckingSession(false);
            return;
          }
        }

        // Cas 3: Vérifier la session actuelle (peut-être déjà créée par Supabase)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[reset-password] ❌ Erreur récupération session:', sessionError);
          setIsCheckingSession(false);
          return;
        }

        // Vérifier si c'est une session de recovery
        if (session?.user && (session.user.recovery_sent_at || params.type === 'recovery')) {
          console.log('[reset-password] ✅ Session recovery détectée:', {
            userId: session.user.id,
            email: session.user.email,
            recovery_sent_at: session.user.recovery_sent_at,
          });
          setRecoverySession(session);
          setRecoveryEmail(session.user.email || null);
          setIsCheckingSession(false);
          return;
        }

        // Si aucun paramètre et pas de session, attendre un peu pour onAuthStateChange
        console.log('[reset-password] ⏳ Aucune session immédiate, attente onAuthStateChange...');
      } catch (error: any) {
        console.error('[reset-password] ❌ Erreur vérification session:', error);
        setIsCheckingSession(false);
      }
    };

    checkRecoverySession();

    // Timeout: si aucune session après 3 secondes, considérer comme invalide
    const timeout = setTimeout(() => {
      console.warn('[reset-password] ⏱️ Timeout: aucune session recovery obtenue après 3s');
      setIsCheckingSession(false);
    }, 3000);
    setSessionCheckTimeout(timeout);

    // Écouter les changements d'auth state (pour détecter PASSWORD_RECOVERY)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[reset-password] 🔔 Auth state change:', {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        recovery_sent_at: session?.user?.recovery_sent_at,
      });
      
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        console.log('[reset-password] ✅ PASSWORD_RECOVERY détecté via onAuthStateChange');
        setRecoverySession(session);
        setRecoveryEmail(session.user.email || null);
        setIsCheckingSession(false);
        if (sessionCheckTimeout) {
          clearTimeout(sessionCheckTimeout);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (sessionCheckTimeout) {
        clearTimeout(sessionCheckTimeout);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validation: session recovery requise
    if (!recoverySession || !recoveryEmail) {
      toast({
        title: "Lien invalide ou expiré",
        description: "Aucune session de réinitialisation valide. Veuillez refaire 'Mot de passe oublié'.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Validation: email correspond
    const emailInput = email.trim().toLowerCase();
    const expectedEmail = recoveryEmail.toLowerCase();
    
    if (emailInput !== expectedEmail) {
      toast({
        title: "Email incorrect",
        description: "L'email ne correspond pas au compte du lien de réinitialisation.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Validation: mots de passe
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

    try {
      console.log('[reset-password] 🔄 Mise à jour du mot de passe...', {
        userId: recoverySession.user.id,
        email: recoveryEmail,
      });
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('[reset-password] ❌ Erreur mise à jour:', error);
        throw error;
      }

      console.log('[reset-password] ✅ Mot de passe mis à jour avec succès');

      // Déconnecter la session recovery
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

  // Calculer si le bouton doit être désactivé
  const isSubmitDisabled = 
    isSubmitting ||
    !recoverySession ||
    !recoveryEmail ||
    !email.trim() ||
    email.trim().toLowerCase() !== recoveryEmail.toLowerCase() ||
    !newPassword ||
    newPassword.length < 8 ||
    newPassword !== confirmPassword;

  // Écran de chargement
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

  // Écran d'erreur: lien invalide/expiré
  if (!recoverySession || !recoveryEmail) {
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
              Renvoyer un lien
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

  // Formulaire de reset password
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">Réinitialiser le mot de passe</CardTitle>
          <CardDescription className="text-slate-600">
            Entrez votre email et choisissez un nouveau mot de passe sécurisé.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Votre email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500 pl-10"
                />
              </div>
              {recoveryEmail && email.trim() && email.trim().toLowerCase() !== recoveryEmail.toLowerCase() && (
                <p className="text-xs text-red-600">
                  L'email doit correspondre au compte du lien de réinitialisation.
                </p>
              )}
            </div>

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
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600">
                  Les mots de passe ne correspondent pas.
                </p>
              )}
            </div>

            <div className="space-y-3 pt-4">
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitDisabled}
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
