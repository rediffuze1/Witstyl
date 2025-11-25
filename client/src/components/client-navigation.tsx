import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Scissors, Home, Calendar, User, Settings, LogOut } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";

export default function ClientNavigation() {
  const [location, setLocation] = useLocation();
  const { client, logout } = useAuthContext();

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/client-login");
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
    }
  };

  const navItems = [
    { path: "/client-dashboard", label: "Tableau de bord", icon: Home },
    { path: "/client-appointments", label: "Mes RDV", icon: Calendar },
    { path: "/client-settings", label: "Paramètres", icon: Settings },
  ];

  const currentItem = navItems.find(item => item.path === location);

  return (
    <header className="relative z-50 bg-white/80 backdrop-blur-md border-b border-border/40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <Scissors className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">SalonPilot</h1>
              <p className="text-xs text-muted-foreground">Espace Client</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentItem?.path === item.path;
              
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "ghost"}
                  onClick={() => setLocation(item.path)}
                  className={`px-4 py-2 ${
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          {/* User info and logout */}
          <div className="flex items-center space-x-4">
            {client && (
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-foreground">
                  {client.firstName} {client.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{client.email}</p>
              </div>
            )}
            
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="md:hidden pb-4">
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentItem?.path === item.path;
              
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLocation(item.path)}
                  className={`${
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground"
                  }`}
                >
                  <Icon className="mr-1 h-3 w-3" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}













