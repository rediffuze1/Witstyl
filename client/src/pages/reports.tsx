// Sections verrouillées par design : ne pas réintroduire sans spécification produit
// Whitelist autorisée :
// - Header de contrôle période (Précédent, Suivant, Aujourd'hui, Jour/Semaine/Mois)
// - 4 cartes résumé (Total RDV, Chiffre d'affaires, Nouveaux clients, Fidélisation)
// - Graphique Chiffre d'affaires (période sélectionnée)
// - Graphique Rendez-vous (période sélectionnée)
// - Top Services (Services les plus demandés)
// - Top Coiffeur·euse·s (Coiffeur·euse·s avec le plus de rendez-vous)

import { useMemo } from "react";
import { useReportRange } from "@/hooks/useReportRange";
import { useReportsData } from "@/hooks/useReportsData";
import Navigation from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  DollarSign, 
  Users, 
  TrendingUp, 
  ChevronLeft,
  ChevronRight,
  BarChart3
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TopServices } from "@/components/reports/TopServices";
import { TopStylists } from "@/components/reports/TopStylists";

// Composant pour les cartes de résumé
const ReportCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue, 
  format = "number",
  isLoading = false
}: {
  title: string;
  value: number;
  icon: any;
  trend: "up" | "down" | "neutral";
  trendValue: string;
  format?: "number" | "currency" | "percentage";
  isLoading?: boolean;
}) => {
  const formatValue = (val: number, fmt: string) => {
    switch (fmt) {
      case "currency":
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);
      case "percentage":
        return `${val}%`;
      default:
        return val.toLocaleString('fr-FR');
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "up": return "text-green-600";
      case "down": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  return (
    <Card className="glassmorphism-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mt-2" />
            ) : (
            <p className="text-2xl font-bold text-foreground">{formatValue(value, format)}</p>
            )}
            {!isLoading && (
            <div className="flex items-center mt-1">
              <TrendingUp className={`h-4 w-4 mr-1 ${getTrendColor(trend)}`} />
              <span className={`text-sm ${getTrendColor(trend)}`}>{trendValue}</span>
            </div>
            )}
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Reports() {
  // Hook unique pour gérer la période
  const { range, setGranularity, shiftPeriod, goToToday, displayLabel } = useReportRange("week");
  
  // Hook unique pour charger les données (KPIs + graphiques)
  const { data, isLoading, error } = useReportsData(range);

  // Calculer les valeurs de tendance formatées
  const getTrendValue = (trend: number, label: string) => {
    if (trend === 0) return "Aucun changement";
    const sign = trend > 0 ? "+" : "";
    const periodLabel = range.granularity === "day"
      ? "jour précédent"
      : range.granularity === "week"
        ? "semaine précédente"
        : range.granularity === "month"
          ? "mois précédent"
          : "année précédente";
    return `${sign}${trend.toFixed(1)}% vs ${periodLabel}`;
  };

  const getTrend = (trend: number): "up" | "down" | "neutral" => {
    if (trend > 0) return "up";
    if (trend < 0) return "down";
    return "neutral";
  };

  // Données pour les graphiques (même source que les KPIs)
  const chartData = data?.chartData || [];
  
  // Générer des données par défaut à zéro selon la granularité
  const defaultChartData = useMemo(() => {
    if (range.granularity === "day") {
      // 24 heures de 7h à 23h
      return Array.from({ length: 17 }, (_, i) => ({
        label: `${String(7 + i).padStart(2, '0')}:00`,
        revenue: 0,
        appointments: 0,
      }));
    } else if (range.granularity === "week") {
      // 7 jours de la semaine
      const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
      return days.map((day) => ({
        label: day,
        revenue: 0,
        appointments: 0,
      }));
    } else if (range.granularity === "month") {
      // 4-5 semaines dans un mois
      const weeksInMonth = Math.ceil((range.endDate.getTime() - range.startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      return Array.from({ length: Math.max(4, weeksInMonth) }, (_, i) => ({
        label: `Sem. ${i + 1}`,
        revenue: 0,
        appointments: 0,
      }));
    } else if (range.granularity === "year") {
      // 12 mois
      const months = [
        "Janvier",
        "Février",
        "Mars",
        "Avril",
        "Mai",
        "Juin",
        "Juillet",
        "Août",
        "Septembre",
        "Octobre",
        "Novembre",
        "Décembre",
      ];
      return months.map((label) => ({ label, revenue: 0, appointments: 0 }));
    }
    return [];
  }, [range.granularity, range.startDate, range.endDate]);
  
  const normalizedChartData = useMemo(() => {
    // Si on a des données, les utiliser
    if (chartData.length > 0) {
      if (range.granularity === "year") {
        // Pour l'année, on doit mapper les données sur les 12 mois
        const months = [
          "Janvier",
          "Février",
          "Mars",
          "Avril",
          "Mai",
          "Juin",
          "Juillet",
          "Août",
          "Septembre",
          "Octobre",
          "Novembre",
          "Décembre",
        ];
        const base = months.map((label) => ({ label, revenue: 0, appointments: 0 }));
        chartData.forEach((point) => {
          const idx = months.findIndex(
            (month) =>
              month === point.label ||
              month.startsWith(point.label || "") ||
              (point.label && month.startsWith(point.label?.slice(0, 3)))
          );
          if (idx >= 0) {
            base[idx].revenue = point.revenue;
            base[idx].appointments = point.appointments;
          }
        });
        return base;
      }
      return chartData;
    }
    // Sinon, retourner les données par défaut à zéro
    return defaultChartData;
  }, [chartData, range.granularity, defaultChartData]);

  const getAppointmentsTitle = () => {
    switch (range.granularity) {
      case "day":
        return "Total des rendez-vous aujourd'hui";
      case "week":
        return "Total des rendez-vous cette semaine";
      case "month":
        return "Total des rendez-vous ce mois-ci";
      case "year":
        return "Total des rendez-vous cette année";
      default:
        return "Total des rendez-vous";
    }
  };

  const getRevenueTitle = () => {
    switch (range.granularity) {
      case "day":
        return "Chiffre d'affaires aujourd'hui";
      case "week":
        return "Chiffre d'affaires cette semaine";
      case "month":
        return "Chiffre d'affaires mensuel";
      case "year":
        return "Chiffre d'affaires annuel";
      default:
        return "Chiffre d'affaires";
    }
  };

  const getClientsTitle = () => {
    switch (range.granularity) {
      case "day":
        return "Nouveaux clients aujourd'hui";
      case "week":
        return "Nouveaux clients cette semaine";
      case "month":
        return "Nouveaux clients ce mois-ci";
      case "year":
        return "Nouveaux clients cette année";
      default:
        return "Nouveaux clients";
    }
  };

  const getChartTitle = (type: "revenue" | "appointments") => {
    switch (range.granularity) {
      case "day":
        return type === "revenue" ? "Chiffre d'affaires aujourd'hui" : "Rendez-vous aujourd'hui";
      case "week":
        return type === "revenue" ? "Chiffre d'affaires hebdomadaire" : "Rendez-vous hebdomadaires";
      case "month":
        return type === "revenue" ? "Chiffre d'affaires mensuel" : "Rendez-vous mensuels";
      case "year":
        return type === "revenue" ? "Chiffre d'affaires annuel" : "Rendez-vous annuels";
      default:
        return type === "revenue" ? "Chiffre d'affaires" : "Rendez-vous";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* En-tête avec contrôles de période */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Rapports du salon
          </h1>
              <p className="text-muted-foreground">
            Analyse des performances et des activités du salon
          </p>
            </div>
          </div>

          {/* Contrôles de période */}
          <Card className="glassmorphism-card mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Navigation Précédent/Suivant/Aujourd'hui */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shiftPeriod(-1)}
                    disabled={isLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToToday}
                    disabled={isLoading}
                  >
                    Aujourd'hui
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shiftPeriod(1)}
                    disabled={isLoading}
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* Sélecteur de granularité */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={range.granularity === "day" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGranularity("day")}
                    disabled={isLoading}
                  >
                    Jour
                  </Button>
                  <Button
                    variant={range.granularity === "week" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGranularity("week")}
                    disabled={isLoading}
                  >
                    Semaine
                  </Button>
                  <Button
                    variant={range.granularity === "month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGranularity("month")}
                    disabled={isLoading}
                  >
                    Mois
                  </Button>
                  <Button
                    variant={range.granularity === "year" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGranularity("year")}
                    disabled={isLoading}
                  >
                    Année
                  </Button>
                </div>
              </div>

              {/* Label de période */}
              <div className="mt-4 text-center">
                <p className="text-sm font-medium text-foreground">
                  {displayLabel}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Message d'erreur - seulement pour les vraies erreurs, pas les 401 pendant le chargement */}
        {error && !error.message.includes("AUTH_LOADING") && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">
              Erreur lors du chargement des données : {error.message}
            </p>
          </div>
        )}

        {/* Section Résumé global - 4 cartes KPI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <ReportCard
            title={getAppointmentsTitle()}
            value={data?.totalAppointments || 0}
            icon={Calendar}
            trend={data ? getTrend(data.trends.appointments) : "neutral"}
            trendValue={data ? getTrendValue(data.trends.appointments, "appointments") : "Chargement..."}
            format="number"
            isLoading={isLoading}
          />
          <ReportCard
            title={getRevenueTitle()}
            value={data?.totalRevenue || 0}
            icon={DollarSign}
            trend={data ? getTrend(data.trends.revenue) : "neutral"}
            trendValue={data ? getTrendValue(data.trends.revenue, "revenue") : "Chargement..."}
            format="currency"
            isLoading={isLoading}
          />
          <ReportCard
            title={getClientsTitle()}
            value={data?.newClients || 0}
            icon={Users}
            trend={data ? getTrend(data.trends.newClients) : "neutral"}
            trendValue={data ? getTrendValue(data.trends.newClients, "newClients") : "Chargement..."}
            format="number"
            isLoading={isLoading}
          />
          <ReportCard
            title="Taux de fidélisation"
            value={data?.retentionRate || 0}
            icon={TrendingUp}
            trend="neutral"
            trendValue="Sur tous les clients"
            format="percentage"
            isLoading={isLoading}
          />
        </div>

        {/* Section Graphiques - Chiffre d'affaires et Rendez-vous */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Graphique Chiffre d'affaires */}
          <Card className="glassmorphism-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {getChartTitle("revenue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={normalizedChartData} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="label" 
                      angle={range.granularity === "year" ? -45 : 0}
                      textAnchor={range.granularity === "year" ? "end" : "middle"}
                      height={range.granularity === "year" ? 80 : 30}
                      interval={0}
                    />
                  <YAxis />
                  <Tooltip 
                      formatter={(value: number) => [
                        `${value}€`,
                        'Chiffre d\'affaires'
                    ]}
                  />
                  <Bar dataKey="revenue" fill="var(--primary)" />
                </BarChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Graphique Rendez-vous */}
          <Card className="glassmorphism-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {getChartTitle("appointments")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={normalizedChartData} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="label" 
                      angle={range.granularity === "year" ? -45 : 0}
                      textAnchor={range.granularity === "year" ? "end" : "middle"}
                      height={range.granularity === "year" ? 80 : 30}
                      interval={0}
                    />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Rendez-vous']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="appointments" 
                    stroke="var(--primary)" 
                    strokeWidth={3}
                    dot={{ fill: 'var(--primary)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section Classements - Services et Coiffeur·euse·s */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Services */}
          <TopServices
            services={data?.popularServices || []}
            totalAppointments={data?.totalAppointments || 0}
            isLoading={isLoading}
            maxItems={5}
          />

          {/* Top Coiffeur·euse·s */}
          <TopStylists
            stylists={data?.topStylists || []}
            totalAppointments={data?.totalAppointments || 0}
            isLoading={isLoading}
            maxItems={5}
          />
        </div>
      </div>
    </div>
  );
}
