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
        console.warn('[Hours] Impossible de charger les horaires:', response.status);
        return { salon: null, hours: [] };
      }
      return response.json();
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  });

  const formatHours = (hoursData: SalonHour[] | undefined) => {
    if (!hoursData || !Array.isArray(hoursData)) {
      return DAYS.map(day => ({
        day: day.label,
        time: 'Horaires indisponibles'
      }));
    }

    const hoursByDay = groupHoursByDay(hoursData);

    return DAYS.map(day => {
      const dayHours = hoursByDay.get(day.key) || [];
      const formattedTime = formatSalonDaySlots(dayHours);
      
      return {
        day: day.label,
        time: formattedTime
      };
    });
  };

  const hours = formatHours(salonData?.hours);

  return (
    <section id="hours" className="py-20 sm:py-24 lg:py-32" style={{ backgroundColor: 'var(--lp-bg-section)' }}>
      <Container>
        <Reveal>
          <div className="text-center mb-16">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{
                background: `var(--lp-brand-gradient)`,
              }}
            >
              <Clock className="text-white text-2xl" />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4" style={{ color: 'var(--lp-text-main)' }}>
              Nos horaires
            </h2>
            <p className="text-lg sm:text-xl max-w-2xl mx-auto" style={{ color: 'var(--lp-text-muted)' }}>
              Nous sommes disponibles pour répondre à vos questions
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="max-w-2xl mx-auto">
            <div className="glass-panel p-8" style={{ backgroundColor: 'var(--lp-bg-card)' }}>
              {isLoading ? (
                <div className="text-center py-8">
                  <div
                    className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full mx-auto mb-4"
                    style={{
                      borderColor: 'var(--brand-color)',
                      borderTopColor: 'transparent',
                    }}
                  />
                  <p style={{ color: 'var(--lp-text-muted)' }}>Chargement des horaires...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p style={{ color: 'var(--lp-text-muted)' }}>
                    Les horaires ne sont pas disponibles pour le moment.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {hours.map((hour) => (
                    <div
                      key={hour.day}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                      style={{ borderColor: 'var(--lp-border-soft)' }}
                    >
                      <span className="font-semibold" style={{ color: 'var(--lp-text-main)' }}>{hour.day}</span>
                      <span
                        style={{
                          color: hour.time === 'Fermé' ? 'var(--lp-text-subtle)' : 'var(--lp-text-muted)',
                        }}
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
