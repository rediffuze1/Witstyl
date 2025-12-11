import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { ReportRange } from "./useReportRange";

export interface ChartDataPoint {
  label: string;
  revenue: number;
  appointments: number;
}

export interface ReportsData {
  // KPIs pour la période actuelle
  totalAppointments: number;
  totalRevenue: number;
  newClients: number;
  retentionRate: number;
  
  // Tendances (comparaison avec période précédente)
  trends: {
    appointments: number; // Pourcentage de variation
    revenue: number;
    newClients: number;
    retention: number;
  };
  
  // Données pour les graphiques (séries temporelles)
  chartData: ChartDataPoint[];
  
  // Données supplémentaires
  topStylists: Array<{
    id: string;
    name: string;
    appointments: number;
    revenue: number;
    position: number;
  }>;
  popularServices: Array<{
    name: string;
    bookings: number;
    revenue: number;
  }>;
}

/**
 * Hook pour charger les données des rapports depuis l'API
 * 
 * Unifie la source de données pour les KPIs et les graphiques.
 * 
 * Clé de cache : ['reports', salonId, granularity, startDateISO, endDateISO, stylistId?]
 * - Inclut startDate et endDate pour éviter les collisions de cache
 * - Inclut stylistId si filtré par styliste
 * 
 * Fuseau horaire :
 * - Les dates sont converties en ISO string (UTC) pour l'API
 * - L'API interprète ces dates en UTC et les compare avec les timestamps en UTC de la DB
 */
export function useReportsData(
  range: ReportRange,
  stylistId?: string
): {
  data: ReportsData | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { owner, salonId: contextSalonId, isAuthenticated } = useAuthContext();
  const salonId = contextSalonId || (owner as any)?.salonId;

  // Construire la clé de cache avec tous les paramètres critiques
  // Inclure startDate et endDate pour éviter les collisions de cache
  const startDateISO = range.startDate.toISOString().split("T")[0];
  const endDateISO = range.endDate.toISOString().split("T")[0];
  
  const cacheKey = [
    "reports",
    salonId,
    range.granularity,
    startDateISO,
    endDateISO,
    stylistId || "all",
  ];

  const { data, isLoading, error } = useQuery<ReportsData>({
    queryKey: cacheKey,
    queryFn: async () => {
      if (!salonId) {
        throw new Error("Salon ID manquant");
      }

      // Normaliser l'ID du salon
      const normalizedSalonId = salonId.startsWith("salon-")
        ? salonId.substring(6)
        : salonId;

      // Construire l'URL avec les paramètres
      // Utiliser referenceDate pour la compatibilité avec l'API existante
      const dateParam = range.referenceDate.toISOString().split("T")[0];
      const url = `/api/salons/${normalizedSalonId}/reports?view=${range.granularity}&date=${dateParam}${stylistId ? `&stylistId=${stylistId}` : ""}`;

      // Logs de debug (toujours activés en développement pour faciliter le debug)
      console.log("[useReportsData] 🔄 Chargement données:", {
        granularity: range.granularity,
        dateParam,
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
        startDateISO,
        endDateISO,
        stylistId,
        url,
        cacheKey,
      });

      const response = await apiRequest("GET", url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
      }

      const apiData = await response.json();

      console.log("[useReportsData] ✅ Données reçues:", {
        granularity: range.granularity,
        totalAppointments: apiData.totalAppointments,
        totalRevenue: apiData.monthlyRevenue,
        newClients: apiData.newClients,
        chartDataLength: apiData.chartData?.length || 0,
        trends: apiData.trends,
        topStylistsCount: apiData.topStylists?.length || 0,
        topStylists: apiData.topStylists || [],
        popularServicesCount: apiData.popularServices?.length || 0,
      });

      // Normaliser les données de l'API vers notre interface
      return {
        totalAppointments: apiData.totalAppointments || 0,
        totalRevenue: apiData.monthlyRevenue || 0,
        newClients: apiData.newClients || 0,
        retentionRate: apiData.retentionRate || 0,
        trends: apiData.trends || {
          appointments: 0,
          revenue: 0,
          newClients: 0,
          retention: 0,
        },
        chartData: apiData.chartData || apiData.weeklyData || [],
        topStylists: apiData.topStylists || [],
        popularServices: apiData.popularServices || [],
      };
    },
    enabled: !!salonId && isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0, // Toujours considérer comme périmé pour forcer le refetch
    gcTime: 0, // Ne pas mettre en cache (anciennement cacheTime)
    // Forcer le refetch quand la clé de cache change
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  return {
    data: data || null,
    isLoading,
    error: error as Error | null,
  };
}
