import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface TopStylist {
  id: string;
  name: string;
  appointments: number;
  revenue: number;
  position: number;
}

interface TopStylistsProps {
  stylists: TopStylist[];
  totalAppointments: number;
  isLoading?: boolean;
  maxItems?: number;
}

/**
 * Composant pour afficher les coiffeur·euse·s avec le plus de rendez-vous
 * 
 * Source de données : topStylists depuis useReportsData
 * Synchronisé avec la période sélectionnée (Jour/Semaine/Mois)
 */
export function TopStylists({ 
  stylists, 
  totalAppointments, 
  isLoading = false,
  maxItems = 5 
}: TopStylistsProps) {
  // Mémoriser le top N des stylistes
  const topStylists = useMemo(() => {
    if (!stylists || stylists.length === 0) return [];
    
    // Trier par nombre de rendez-vous (descendant), puis par ordre alphabétique si égalité
    const sorted = [...stylists].sort((a, b) => {
      if (b.appointments !== a.appointments) {
        return b.appointments - a.appointments;
      }
      return a.name.localeCompare(b.name, 'fr');
    });
    
    // Ajouter la position après le tri
    return sorted.slice(0, maxItems).map((stylist, index) => ({
      ...stylist,
      position: index + 1
    }));
  }, [stylists, maxItems]);

  // Obtenir l'icône de position
  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return `${position}°`;
    }
  };

  // Obtenir les initiales pour l'avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Calculer le pourcentage pour chaque styliste
  const getPercentage = (appointments: number) => {
    if (totalAppointments === 0) return 0;
    return Math.round((appointments / totalAppointments) * 100);
  };

  // Trouver le maximum pour la barre de progression
  const maxAppointments = topStylists.length > 0 
    ? Math.max(...topStylists.map(s => s.appointments))
    : 1;

  // Obtenir la couleur de fond selon la position
  const getPositionBg = (position: number) => {
    if (position <= 3) {
      return "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]";
    }
    return "";
  };

  if (isLoading) {
    return (
      <Card className="glassmorphism-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Coiffeur·euse·s avec le plus de rendez-vous
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (topStylists.length === 0) {
    return (
      <Card className="glassmorphism-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Coiffeur·euse·s avec le plus de rendez-vous
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Aucun résultat sur la période
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glassmorphism-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Coiffeur·euse·s avec le plus de rendez-vous
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topStylists.map((stylist) => {
            const percentage = getPercentage(stylist.appointments);
            const barWidth = maxAppointments > 0 
              ? (stylist.appointments / maxAppointments) * 100 
              : 0;
            
            return (
              <TooltipProvider key={stylist.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-help ${getPositionBg(stylist.position)}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-lg flex-shrink-0">{getPositionIcon(stylist.position)}</span>
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {getInitials(stylist.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{stylist.name}</p>
                          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 mt-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="font-medium text-foreground">{stylist.appointments} RDV</p>
                        <p className="text-sm text-muted-foreground">
                          {new Intl.NumberFormat('fr-FR', { 
                            style: 'currency', 
                            currency: 'EUR' 
                          }).format(stylist.revenue)}
                        </p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {stylist.appointments} RDV — {percentage}% des RDV de la période
                    </p>
                    <p className="text-xs mt-1">
                      CA : {new Intl.NumberFormat('fr-FR', { 
                        style: 'currency', 
                        currency: 'EUR' 
                      }).format(stylist.revenue)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

