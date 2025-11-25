import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/hooks/useUserContext";
import { Theme } from "@/lib/theme";
import { useEffect } from "react";
import { useSalonAppearance } from "@/hooks/useSalonAppearance";
import Landing from "@/pages/landing";
import Book from "@/pages/book";
import BookClient from "@/pages/book-client";
import Voice from "@/pages/voice";
import ClientLogin from "@/pages/client-login";
import ClientDashboard from "@/pages/client-dashboard";
import ClientRegister from "@/pages/client-register";
import ClientAppointments from "@/pages/client-appointments";
import ClientHistory from "@/pages/client-history";
import ClientSettings from "@/pages/client-settings";
import SalonLogin from "@/pages/salon-login";
import SalonRegister from "@/pages/salon-register";
import Dashboard from "@/pages/dashboard";
import Services from "@/pages/services";
import Stylists from "@/pages/stylistes";
import Calendar from "@/pages/calendar";
import Clients from "@/pages/clients";
import Settings from "@/pages/settings";
import Reports from "@/pages/reports";
import Hours from "@/pages/hours";
import ChangePassword from "@/pages/change-password";
import ClientChangePassword from "@/pages/client-change-password";
import ClientResetPassword from "@/pages/client-reset-password";
import ResetPassword from "@/pages/reset-password";
import NotFound from "@/pages/not-found";

/**
 * Composant pour charger le thème depuis la base de données
 * 
 * Ce composant charge les paramètres d'apparence du salon de manière publique
 * (sans authentification) pour garantir que la couleur principale est toujours
 * appliquée, même pour les visiteurs anonymes.
 * 
 * Note: L'application est mono-salon. La couleur principale est stockée dans
 * la table `salons` (colonne `theme_color`) et est accessible publiquement.
 */
function ThemeLoader() {
  const { appearance } = useSalonAppearance();

  useEffect(() => {
    // Charger le thème depuis la base de données si disponible
    if (appearance?.primaryColor) {
      const dbColor = appearance.primaryColor;
      console.log('[ThemeLoader] Chargement thème depuis DB (public):', dbColor);
      Theme.apply(dbColor);
    }
  }, [appearance]);

  return null; // Ce composant ne rend rien
}

function Router() {
  // Rendu direct sans transitions globales - les transitions sont gérées localement
  // Les HOC withClientAuth et withOwnerAuth gèrent la protection des routes
  return (
    <>
      {/* ThemeLoader charge toujours, même sans authentification */}
      <ThemeLoader />
      <Switch>
      {/* Routes publiques - toujours accessibles */}
      <Route path="/" component={Landing} />
      <Route path="/book" component={Book} />
      <Route path="/book-client" component={BookClient} />
      <Route path="/voice" component={Voice} />
      <Route path="/client-login" component={ClientLogin} />
      <Route path="/client-register" component={ClientRegister} />
      <Route path="/client-dashboard" component={ClientDashboard} />
      <Route path="/client-appointments" component={ClientAppointments} />
      <Route path="/client-history" component={ClientHistory} />
      <Route path="/client-settings" component={ClientSettings} />
      <Route path="/client-change-password" component={ClientChangePassword} />
      <Route path="/client-reset-password" component={ClientResetPassword} />
      <Route path="/salon-login" component={SalonLogin} />
      <Route path="/salon-register" component={SalonRegister} />
      <Route path="/change-password" component={ChangePassword} />
      <Route path="/reset-password" component={ResetPassword} />
      
      {/* Routes privées owner - protégées par withOwnerAuth */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/services" component={Services} />
      <Route path="/stylistes" component={Stylists} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/clients" component={Clients} />
      <Route path="/hours" component={Hours} />
      <Route path="/settings" component={Settings} />
      <Route path="/reports" component={Reports} />
      
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </UserProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
