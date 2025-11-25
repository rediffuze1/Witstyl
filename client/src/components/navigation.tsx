import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Scissors, Home, Calendar, Users, User, BarChart, ArrowLeft, BarChart3, Settings, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";

export default function Navigation() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { firstName } = useUserContext();

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/");
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
    }
  };

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: BarChart },
    { path: "/calendar", label: "Calendrier", icon: Calendar },
    { path: "/services", label: "Services", icon: Scissors },
    { path: "/stylistes", label: "Coiffeur·euses", icon: Users },
    { path: "/clients", label: "Clients", icon: User },
    { path: "/reports", label: "Rapports", icon: BarChart3 },
    { path: "/hours", label: "Horaire", icon: Clock },
    { path: "/settings", label: "Paramètres", icon: Settings },
  ];

  const currentItem = navItems.find(item => item.path === location);

  return (
    <header className="relative z-50 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-full">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-6 min-w-0 flex-shrink-0">
            <div 
              className="flex items-center space-x-3 cursor-pointer flex-shrink-0"
              onClick={() => setLocation("/dashboard")}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0">
                <Scissors className="text-white text-sm" />
              </div>
              <span className="text-xl font-bold text-foreground whitespace-nowrap">SalonPilot</span>
            </div>
            
            {/* Show current page indicator on mobile */}
            <div className="md:hidden">
              {currentItem && (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <currentItem.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{currentItem.label}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4 lg:space-x-6 flex-1 justify-center max-w-4xl mx-4">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={location === item.path ? "default" : "ghost"}
                onClick={() => setLocation(item.path)}
                className={`flex items-center space-x-1.5 lg:space-x-2 text-xs lg:text-sm px-2 lg:px-3 flex-shrink-0 ${
                  location === item.path 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-primary"
                }`}
                data-testid={`nav-${item.path.replace("/", "") || "home"}`}
              >
                <item.icon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Button>
            ))}
          </nav>

          {/* Mobile Back Button or Logout */}
          <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
            {location !== "/" && (
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/")}
                className="md:hidden flex-shrink-0"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            
            {/* Affichage du nom d'utilisateur sur desktop */}
            {user && (
              <div className="hidden md:block text-sm text-muted-foreground whitespace-nowrap flex-shrink-0">
                {(user as any)?.firstName || firstName || 'Utilisateur'}
              </div>
            )}
            
            <Button 
              variant="outline"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-primary flex-shrink-0 whitespace-nowrap"
              data-testid="button-logout"
            >
              Déconnexion
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-border/20">
        <div className="container mx-auto px-4">
          <div className="flex justify-around py-2">
            {navItems.slice(0, 6).map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                onClick={() => setLocation(item.path)}
                className={`flex flex-col items-center space-y-1 p-2 h-auto ${
                  location === item.path 
                    ? "text-primary" 
                    : "text-muted-foreground"
                }`}
                data-testid={`mobile-nav-${item.path.replace("/", "") || "home"}`}
              >
                <item.icon className="h-4 w-4" />
                <span className="text-xs">{item.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
