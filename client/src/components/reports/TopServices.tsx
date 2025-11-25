import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Scissors } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface PopularService {
  name: string;
  bookings: number;
  revenue: number;
}

interface TopServicesProps {
  services: PopularService[];
  totalAppointments: number;
  isLoading?: boolean;
  maxItems?: number;
}

/**
 * Composant pour afficher les services les plus demandés
 * 
 * Source de données : popularServices depuis useReportsData
 * Synchronisé avec la période sélectionnée (Jour/Semaine/Mois)
 */
export function TopServices({ 
  services, 
  totalAppointments, 
  isLoading = false,
  maxItems = 5 
}: TopServicesProps) {
  // Mémoriser le top N des services
  const topServices = useMemo(() => {
    if (!services || services.length === 0) return [];
    
    // Trier par nombre de réservations (descendant), puis par CA si égalité
    const sorted = [...services].sort((a, b) => {
      if (b.bookings !== a.bookings) {
        return b.bookings - a.bookings;
      }
      return b.revenue - a.revenue;
    });
    
    return sorted.slice(0, maxItems);
  }, [services, maxItems]);

  // Calculer le pourcentage pour chaque service
  const getPercentage = (bookings: number) => {
    if (totalAppointments === 0) return 0;
    return Math.round((bookings / totalAppointments) * 100);
  };

  // Trouver le maximum pour la barre de progression
  const maxBookings = topServices.length > 0 
    ? Math.max(...topServices.map(s => s.bookings))
    : 1;

  if (isLoading) {
    return (
      <Card className="glassmorphism-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            Services les plus demandés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (topServices.length === 0) {
    return (
      <Card className="glassmorphism-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            Services les plus demandés
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
          <Scissors className="h-5 w-5 text-primary" />
          Services les plus demandés
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topServices.map((service, index) => {
            const percentage = getPercentage(service.bookings);
            const barWidth = maxBookings > 0 ? (service.bookings / maxBookings) * 100 : 0;
            
            return (
              <TooltipProvider key={`${service.name}-${index}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="space-y-2 cursor-help">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-foreground">{service.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {service.bookings} réservation{service.bookings > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{service.bookings} RDV</span>
                        <span>
                          {new Intl.NumberFormat('fr-FR', { 
                            style: 'currency', 
                            currency: 'EUR' 
                          }).format(service.revenue)}
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {service.bookings} RDV — {percentage}% des RDV de la période
                    </p>
                    <p className="text-xs mt-1">
                      CA : {new Intl.NumberFormat('fr-FR', { 
                        style: 'currency', 
                        currency: 'EUR' 
                      }).format(service.revenue)}
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



