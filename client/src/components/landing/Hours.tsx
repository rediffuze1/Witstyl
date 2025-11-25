import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatSalonDaySlots, groupHoursByDay, type SalonHour } from '@/utils/formatSalonHours';

const DAYS = [
  { key: 0, label: 'Dimanche' },
  { key: 1, label: 'Lundi' },
  { key: 2, label: 'Mardi' },
  { key: 3, label: 'Mercredi' },
  { key: 4, label: 'Jeudi' },
  { key: 5, label: 'Vendredi' },
  { key: 6, label: 'Samedi' },
];

export default function Hours() {
  const { data: salonData, isLoading, error } = useQuery({
    queryKey: ['/api/public/salon'],
    queryFn: async () => {
      const response = await fetch('/api/public/salon');
      if (!response.ok) {
        // Ne pas throw, retourner un objet vide pour permettre le rendu
        console.warn('[Hours] Impossible de charger les horaires:', response.status);
        return { salon: null, hours: [] };
      }
      return response.json();
    },
    retry: 1, // Réduire les retries pour éviter les blocages
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
    // Ne pas suspendre le rendu en cas d'erreur
    throwOnError: false,
  });

  // Convertir les horaires de l'API en format d'affichage
  // Affiche TOUS les créneaux configurés pour chaque jour
  const formatHours = (hoursData: SalonHour[] | undefined) => {
    if (!hoursData || !Array.isArray(hoursData)) {
      // Valeurs par défaut si pas de données
      return DAYS.map(day => ({
        day: day.label,
        time: 'Horaires indisponibles'
      }));
    }

    // Grouper les horaires par jour (un jour peut avoir plusieurs créneaux)
    const hoursByDay = groupHoursByDay(hoursData);

    return DAYS.map(day => {
      const dayHours = hoursByDay.get(day.key) || [];
      
      // Formater toutes les tranches du jour
      const formattedTime = formatSalonDaySlots(dayHours);
      
      return {
        day: day.label,
        time: formattedTime
      };
    });
  };

  const hours = formatHours(salonData?.hours);

  return (
    <section id="hours" className="py-20 sm:py-24 lg:py-32 bg-muted/30">
      <Container>
        <Reveal>
          <div className="text-center mb-16">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Clock className="text-white text-2xl" />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Nos horaires
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Nous sommes disponibles pour répondre à vos questions
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/80 backdrop-blur-md border border-border/40 rounded-2xl p-8 shadow-lg">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-muted-foreground">Chargement des horaires...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Les horaires ne sont pas disponibles pour le moment.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {hours.map((hour) => (
                    <div
                      key={hour.day}
                      className="flex items-center justify-between py-3 border-b border-border/40 last:border-0"
                    >
                      <span className="font-semibold text-foreground">{hour.day}</span>
                      <span
                        className={`text-muted-foreground ${
                          hour.time === 'Fermé' ? 'text-muted-foreground/60' : ''
                        }`}
                      >
                        {hour.time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

