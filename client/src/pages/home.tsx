import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Calendar, Users, Scissors, BarChart, Settings } from "lucide-react";

export default function Home() {
  const { user, isLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  
  // Debug pour voir les données utilisateur
  console.log("Home - User data:", user);
  console.log("Home - Loading:", isLoading);

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/");
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Bienvenue, {isLoading ? "..." : (user?.firstName || user?.email || "Utilisateur")}
            </h1>
            <p className="text-muted-foreground">Gérez votre salon avec Witstyl</p>
          </div>
          <Button onClick={handleLogout} variant="outline" data-testid="button-logout">
            Déconnexion
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Button
            onClick={() => setLocation("/dashboard")}
            className="h-32 flex flex-col items-center justify-center space-y-2 bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-dashboard"
          >
            <BarChart className="h-8 w-8" />
            <span className="text-lg font-semibold">Dashboard</span>
          </Button>

          <Button
            onClick={() => setLocation("/calendar")}
            className="h-32 flex flex-col items-center justify-center space-y-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
            data-testid="button-calendar"
          >
            <Calendar className="h-8 w-8" />
            <span className="text-lg font-semibold">Calendrier</span>
          </Button>

          <Button
            onClick={() => setLocation("/services")}
            className="h-32 flex flex-col items-center justify-center space-y-2 bg-accent text-accent-foreground hover:bg-accent/90"
            data-testid="button-services"
          >
            <Scissors className="h-8 w-8" />
            <span className="text-lg font-semibold">Services</span>
          </Button>

          <Button
            onClick={() => setLocation("/stylistes")}
            className="h-32 flex flex-col items-center justify-center space-y-2 bg-muted text-muted-foreground hover:bg-muted/80"
            data-testid="button-stylistes"
          >
            <Users className="h-8 w-8" />
            <span className="text-lg font-semibold">Coiffeur·euses</span>
          </Button>

          <Button
            onClick={() => setLocation("/clients")}
            className="h-32 flex flex-col items-center justify-center space-y-2 bg-chart-2 text-white hover:opacity-90"
            data-testid="button-clients"
          >
            <Users className="h-8 w-8" />
            <span className="text-lg font-semibold">Clients</span>
          </Button>

          <Button
            onClick={() => setLocation("/settings")}
            variant="outline"
            className="h-32 flex flex-col items-center justify-center space-y-2"
            data-testid="button-settings"
          >
            <Settings className="h-8 w-8" />
            <span className="text-lg font-semibold">Paramètres</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
