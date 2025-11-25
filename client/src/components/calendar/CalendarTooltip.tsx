import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { type Appointment } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CalendarTooltipProps {
  appointment: Appointment & {
    client?: { firstName: string; lastName: string; email?: string };
    stylist?: { firstName: string; lastName: string };
    service?: { name: string; price?: number; duration?: number };
  };
  children: React.ReactNode;
}

export default function CalendarTooltip({ appointment, children }: CalendarTooltipProps) {
  const startTime = new Date(appointment.startTime);
  const endTime = new Date(appointment.endTime);
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

  const clientName = appointment.client
    ? `${appointment.client.firstName} ${appointment.client.lastName}`
    : "Client inconnu";
  const stylistName = appointment.stylist
    ? `${appointment.stylist.firstName} ${appointment.stylist.lastName}`
    : "Coiffeur·euse inconnu·e";
  const serviceName = appointment.service?.name || "Service inconnu";
  const price = appointment.service?.price || 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1.5">
            <div className="font-semibold text-sm">{clientName}</div>
            <div className="text-xs text-muted-foreground">
              <div>{serviceName}</div>
              <div>Avec {stylistName}</div>
              <div>
                {format(startTime, "EEEE d MMMM yyyy à HH:mm", { locale: fr })} - {format(endTime, "HH:mm", { locale: fr })}
              </div>
              <div>Durée: {duration} min</div>
              {price > 0 && <div>Prix: {price}€</div>}
              {appointment.status && (
                <div className="mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                    {appointment.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}



