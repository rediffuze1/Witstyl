import { Badge } from "@/components/ui/badge";
import { type ClientRisk } from "@/hooks/useClientRisk";

interface ClientRiskBadgeProps {
  riskLevel: ClientRisk['riskLevel'];
  className?: string;
}

/**
 * Badge affichant le niveau de risque d'un client
 * 
 * @param riskLevel - Niveau de risque : 'low' | 'medium' | 'high'
 * @param className - Classes CSS additionnelles
 */
export function ClientRiskBadge({ riskLevel, className }: ClientRiskBadgeProps) {
  if (riskLevel === 'high') {
    return (
      <Badge variant="destructive" className={`text-xs ${className || ''}`}>
        ⚠️ Client à risque
      </Badge>
    );
  }
  
  if (riskLevel === 'medium') {
    return (
      <Badge variant="outline" className={`text-xs bg-yellow-50 text-yellow-700 border-yellow-300 ${className || ''}`}>
        🟡 Client à surveiller
      </Badge>
    );
  }
  
  // low → aucun badge
  return null;
}

