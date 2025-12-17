import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthConfirm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Récupérer les paramètres de l'URL (code ou token selon le flow Supabase)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const token = urlParams.get('token');
        const type = urlParams.get('type');

        console.log('[auth-confirm] 🔗 Paramètres URL:', { code: !!code, token: !!token, type });

        // Si c'est un code (PKCE flow), l'échanger pour une session
        if (code) {
          console.log('[auth-confirm] 📧 Échange code pour session...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error('[auth-confirm] ❌ Erreur échange code:', error);
            setStatus('error');
            setErrorMessage(error.message || 'Lien de confirmation invalide ou expiré.');
            return;
          }

          if (data.session) {
            console.log('[auth-confirm] ✅ Session créée, email confirmé');
            setStatus('success');
            
            toast({
              title: "Email confirmé ✅",
              description: "Votre email a été confirmé avec succès. Vous pouvez maintenant vous connecter.",
            });

            // Rediriger vers login après 2 secondes
            setTimeout(() => {
              setLocation("/salon-login");
            }, 2000);
            return;
          }
        }

        // Si c'est un token (legacy flow)
        if (token && type === 'signup') {
          console.log('[auth-confirm] 📧 Vérification token...');
          // Pour les tokens legacy, Supabase gère automatiquement via detectSessionInUrl
          // On vérifie juste que la session est créée
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error || !session) {
            console.error('[auth-confirm] ❌ Pas de session après token');
            setStatus('error');
            setErrorMessage('Lien de confirmation invalide ou expiré.');
            return;
          }

          console.log('[auth-confirm] ✅ Session créée via token');
          setStatus('success');
          
          toast({
            title: "Email confirmé ✅",
            description: "Votre email a été confirmé avec succès. Vous pouvez maintenant vous connecter.",
          });

          setTimeout(() => {
            setLocation("/salon-login");
          }, 2000);
          return;
        }

        // Si aucun code ni token, vérifier si une session existe déjà (utilisateur déjà confirmé)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[auth-confirm] ❌ Erreur récupération session:', sessionError);
          setStatus('error');
          setErrorMessage('Impossible de vérifier la confirmation.');
          return;
        }

        if (session?.user?.email_confirmed_at) {
          console.log('[auth-confirm] ✅ Email déjà confirmé');
          setStatus('success');
          
          toast({
            title: "Email déjà confirmé",
            description: "Votre email est déjà confirmé. Vous pouvez vous connecter.",
          });

          setTimeout(() => {
            setLocation("/salon-login");
          }, 2000);
          return;
        }

        // Aucun paramètre valide
        console.warn('[auth-confirm] ⚠️ Aucun paramètre valide dans l\'URL');
        setStatus('error');
        setErrorMessage('Lien de confirmation invalide. Vérifiez votre email.');
      } catch (error: any) {
        console.error('[auth-confirm] ❌ Exception:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Une erreur est survenue lors de la confirmation.');
      }
    };

    handleEmailConfirmation();
  }, [setLocation, toast]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">Confirmation en cours...</CardTitle>
            <CardDescription className="text-slate-600">
              Vérification de votre email...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">Erreur de confirmation</CardTitle>
            <CardDescription className="text-slate-600">
              {errorMessage || 'Le lien de confirmation est invalide ou a expiré.'}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <p className="font-medium mb-2">💡 Que faire ?</p>
              <p>Vérifiez votre boîte mail pour un nouveau lien de confirmation, ou contactez le support.</p>
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

  // Success
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">Email confirmé ✅</CardTitle>
          <CardDescription className="text-slate-600">
            Votre email a été confirmé avec succès. Vous allez être redirigé vers la page de connexion...
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

