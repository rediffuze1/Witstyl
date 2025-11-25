/**
 * Utilitaires pour calculer les KPIs à partir des données brutes
 * 
 * Ces fonctions sont pures et peuvent être testées unitairement.
 * Elles ne dépendent pas de React ou d'autres frameworks.
 * 
 * Fuseau horaire : Les dates sont traitées comme des objets Date JavaScript,
 * qui sont en UTC en interne mais peuvent être créées depuis des timestamps locaux.
 * Les comparaisons de dates utilisent les méthodes natives de Date.
 * 
 * Bornes : Inclusives/inclusives [startDate, endDate]
 * - startDate : 00:00:00.000 (inclus)
 * - endDate : 23:59:59.999 (inclus)
 */

export interface Appointment {
  id: string;
  appointment_date: string; // ISO string (UTC)
  service_id: string;
  stylist_id: string;
  client_id: string;
  status: string;
}

export interface Client {
  id: string;
  created_at: string; // ISO string (UTC)
}

export interface Service {
  id: string;
  price: number | string;
}

export interface KpiData {
  totalAppointments: number;
  totalRevenue: number;
  newClients: number;
  retentionRate: number;
}

export interface PreviousPeriodData {
  totalAppointments: number;
  totalRevenue: number;
  newClients: number;
  retentionRate: number;
}

export interface KpiResult extends KpiData {
  trends: {
    appointments: number; // Pourcentage de variation
    revenue: number;
    newClients: number;
    retention: number;
  };
}

/**
 * Calcule les KPIs pour une période donnée
 * 
 * @param appointments - Liste de tous les rendez-vous
 * @param clients - Liste de tous les clients
 * @param services - Map des services (id -> Service)
 * @param periodStart - Date de début de période (inclusive)
 * @param periodEnd - Date de fin de période (inclusive)
 * @returns KPIs calculés pour la période
 */
export function computeKpis(
  appointments: Appointment[],
  clients: Client[],
  services: Map<string, Service>,
  periodStart: Date,
  periodEnd: Date
): KpiData {
  // Filtrer les rendez-vous dans la période
  // Les dates sont comparées en UTC
  const periodAppointments = appointments.filter((apt) => {
    const aptDate = new Date(apt.appointment_date);
    return aptDate >= periodStart && aptDate <= periodEnd;
  });

  // Filtrer les nouveaux clients dans la période
  const periodClients = clients.filter((client) => {
    const clientDate = new Date(client.created_at);
    return clientDate >= periodStart && clientDate <= periodEnd;
  });

  // Calculer le revenu total
  const totalRevenue = periodAppointments.reduce((sum, apt) => {
    const service = services.get(apt.service_id);
    const price = service ? parseFloat(String(service.price)) || 0 : 0;
    return sum + price;
  }, 0);

  // Calculer le taux de fidélisation (clients avec au moins 2 rendez-vous)
  // Utiliser TOUS les rendez-vous (pas seulement la période) pour calculer la fidélisation
  const clientAppointmentCount = new Map<string, number>();
  appointments.forEach((apt) => {
    const count = clientAppointmentCount.get(apt.client_id) || 0;
    clientAppointmentCount.set(apt.client_id, count + 1);
  });

  const loyalClients = Array.from(clientAppointmentCount.values()).filter(
    (count) => count >= 2
  ).length;

  const retentionRate =
    clients.length > 0 ? (loyalClients / clients.length) * 100 : 0;

  return {
    totalAppointments: periodAppointments.length,
    totalRevenue,
    newClients: periodClients.length,
    retentionRate: Math.round(retentionRate * 10) / 10,
  };
}

/**
 * Calcule les tendances en comparant avec la période précédente
 * 
 * @param current - KPIs de la période actuelle
 * @param previous - KPIs de la période précédente
 * @returns Tendances en pourcentage de variation
 */
export function computeTrends(
  current: KpiData,
  previous: PreviousPeriodData
): KpiResult["trends"] {
  const appointmentsTrend =
    previous.totalAppointments > 0
      ? ((current.totalAppointments - previous.totalAppointments) /
          previous.totalAppointments) *
        100
      : current.totalAppointments > 0
      ? 100 // Nouveau (pas de période précédente)
      : 0;

  const revenueTrend =
    previous.totalRevenue > 0
      ? ((current.totalRevenue - previous.totalRevenue) /
          previous.totalRevenue) *
        100
      : current.totalRevenue > 0
      ? 100
      : 0;

  const newClientsTrend =
    previous.newClients > 0
      ? ((current.newClients - previous.newClients) / previous.newClients) *
        100
      : current.newClients > 0
      ? 100
      : 0;

  // Taux de fidélisation : calculé sur tous les clients, pas de tendance par période
  const retentionTrend = 0;

  return {
    appointments: Math.round(appointmentsTrend * 10) / 10,
    revenue: Math.round(revenueTrend * 10) / 10,
    newClients: Math.round(newClientsTrend * 10) / 10,
    retention: retentionTrend,
  };
}

/**
 * Combine les KPIs et les tendances
 * 
 * @param current - KPIs de la période actuelle
 * @param previous - KPIs de la période précédente
 * @returns KPIs avec tendances
 */
export function computeKpisWithTrends(
  current: KpiData,
  previous: PreviousPeriodData
): KpiResult {
  return {
    ...current,
    trends: computeTrends(current, previous),
  };
}
