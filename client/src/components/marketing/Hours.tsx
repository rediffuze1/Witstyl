import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';
import { useSalonData } from '@/hooks/useSalonData';
import { Clock, CheckCircle2 } from 'lucide-react';

function isOpenNow(hours: Array<{ day_of_week: number; open_time: string; close_time: string; is_closed: boolean }>): boolean {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = dimanche, 1 = lundi, etc.
  const currentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });

  // La DB utilise 0=dimanche, 1=lundi, etc. (identique à JS getDay())
  // Donc pas besoin de conversion
  const dayOfWeek = currentDay;

  const todayHours = hours.find((h) => h.day_of_week === dayOfWeek && !h.is_closed);

  if (!todayHours) {
    return false;
  }

  const [openHour, openMin] = todayHours.open_time.split(':').map(Number);
  const [closeHour, closeMin] = todayHours.close_time.split(':').map(Number);
  const [currentHour, currentMin] = currentTime.split(':').map(Number);

  const openTime = openHour * 60 + openMin;
  const closeTime = closeHour * 60 + closeMin;
  const currentTimeMinutes = currentHour * 60 + currentMin;

  return currentTimeMinutes >= openTime && currentTimeMinutes <= closeTime;
}

const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Fonction pour formater l'heure sans les secondes (HH:MM:SS -> HH:MM)
function formatTime(time: string): string {
  if (!time) return '';
  // Si l'heure contient des secondes, on les retire
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return time;
}

export default function Hours() {
  const { data: salonData } = useSalonData();
  const [isOpen, setIsOpen] = useState(false);

  // Utiliser les horaires depuis l'API, avec fallback sur la config
  const hoursFromApi = salonData?.hours || [];
  const hours = hoursFromApi.length > 0 
    ? hoursFromApi 
    : salonConfig.openingHours.map((h, idx) => ({
        day_of_week: idx,
        open_time: h.open || '09:00',
        close_time: h.close || '18:00',
        is_closed: h.closed || false,
      }));

  useEffect(() => {
    if (hours.length > 0) {
      setIsOpen(isOpenNow(hours));
      const interval = setInterval(() => {
        setIsOpen(isOpenNow(hours));
      }, 60000); // Vérifier chaque minute

      return () => clearInterval(interval);
    }
  }, [hours]);

  // Grouper les horaires par jour (un jour peut avoir plusieurs créneaux)
  // IMPORTANT : La DB utilise 0=dimanche, 1=lundi, etc.
  // Mais dayNames utilise 0=lundi, 1=mardi, ..., 6=dimanche
  // Donc on doit mapper : DB 0 (dimanche) → dayIndex 6, DB 1 (lundi) → dayIndex 0, etc.
  const hoursByDay: Record<number, Array<{ open_time: string; close_time: string; is_closed: boolean }>> = {};
  hours.forEach((h) => {
    // Convertir day_of_week de la DB (0=dimanche) vers dayIndex (0=lundi)
    const dayIndex = h.day_of_week === 0 ? 6 : h.day_of_week - 1;
    if (!hoursByDay[dayIndex]) {
      hoursByDay[dayIndex] = [];
    }
    hoursByDay[dayIndex].push({
      open_time: h.open_time,
      close_time: h.close_time,
      is_closed: h.is_closed,
    });
  });

  return (
    <section
      id="hours"
      className="relative py-24 sm:py-28 lg:py-32"
      style={{ backgroundColor: 'hsl(var(--bg-section))' }}
    >
      <Container className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6" style={{
            background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
          }}>
            <Clock className="h-8 w-8 text-white" />
          </div>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-4"
            style={{ color: 'hsl(var(--text-main))' }}
          >
            Nos horaires
          </h2>
          <p className="text-lg" style={{ color: 'hsl(var(--text-muted))' }}>
            Nous sommes disponibles pour répondre à vos besoins
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          {/* Badge Ouvert/Fermé */}
          <div className="flex justify-center mb-6">
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                isOpen ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'
              }`}
            >
              {isOpen ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Ouvert maintenant</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  <span>Fermé</span>
                </>
              )}
            </div>
          </div>

          {/* Tableau des horaires */}
          <div
            className="rounded-3xl border p-8 backdrop-blur-xl"
            style={{
              backgroundColor: 'hsla(var(--bg-section) / 0.8)',
              borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2)',
              boxShadow: '0 8px 32px hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.08)',
            }}
          >
            <div className="space-y-3">
              {dayNames.map((dayName, dayIndex) => {
                const dayHours = hoursByDay[dayIndex];
                const isClosed = !dayHours || dayHours.every((h) => h.is_closed);

                return (
                  <motion.div
                    key={dayName}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: dayIndex * 0.05, duration: 0.4 }}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                    style={{ borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1)' }}
                  >
                    <span className="font-semibold" style={{ color: 'hsl(var(--text-main))' }}>
                      {dayName}
                    </span>
                    <span
                      className={isClosed ? 'text-gray-400' : ''}
                      style={{ color: isClosed ? 'hsl(var(--text-muted))' : 'hsl(var(--text-main))' }}
                    >
                      {isClosed
                        ? 'Fermé'
                        : dayHours && dayHours.length > 0
                        ? dayHours.map((h) => `${formatTime(h.open_time)} – ${formatTime(h.close_time)}`).join(', ')
                        : 'Sur rendez-vous'}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
