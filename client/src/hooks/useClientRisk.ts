import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface ClientRisk {
  clientId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  appointmentsTotal: number;
  cancelledCount: number;
  noShowCount: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
}

export function useClientRisk(salonId: string | undefined, days = 90) {
  return useQuery<ClientRisk[]>({
    queryKey: ['client-risk', salonId, days],
    queryFn: async () => {
      if (!salonId) {
        return [];
      }
      // apiRequest lance une exception si !res.ok, donc pas besoin de vérifier response.ok
      const response = await apiRequest('GET', `/api/owner/clients/risk?days=${days}`);
      return response.json();
    },
    enabled: !!salonId,
    staleTime: 60 * 1000, // 60 secondes
    retry: 1,
  });
}

/**
 * Hook helper qui retourne un Map pour lookup rapide par clientId
 */
export function useClientRiskMap(salonId: string | undefined, days = 90): Map<string, ClientRisk> {
  const { data } = useClientRisk(salonId, days);
  
  const riskMap = new Map<string, ClientRisk>();
  if (data) {
    data.forEach((risk) => {
      riskMap.set(risk.clientId, risk);
    });
  }
  
  return riskMap;
}

