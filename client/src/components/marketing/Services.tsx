import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';
import { useSalonServices } from '@/hooks/useSalonServices';
import { Button } from '@/components/ui/button';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export default function Services() {
  const [, setLocation] = useLocation();
  const { data: servicesFromApi, isLoading } = useSalonServices();

  // Utiliser UNIQUEMENT les services depuis l'API - pas de fallback config
  // Si l'API retourne des données, les utiliser. Sinon, afficher un message.
  const services = servicesFromApi && servicesFromApi.length > 0
    ? servicesFromApi.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description || '',
        price: s.price ? `CHF ${s.price.toFixed(2)}` : 'Sur demande',
        icon: '✂️', // Par défaut, peut être amélioré avec des tags
      }))
    : [];

  if (isLoading) {
    return (
      <section
        id="services"
        className="relative py-24 sm:py-28 lg:py-32"
        style={{ backgroundColor: 'hsl(var(--bg-page))' }}
      >
        <Container className="relative z-10">
          <div className="text-center">
            <p style={{ color: 'hsl(var(--text-muted))' }}>Chargement des services...</p>
          </div>
        </Container>
      </section>
    );
  }

  // Si aucun service n'est disponible après le chargement, ne rien afficher
  if (!services || services.length === 0) {
    console.log('[Services] Aucun service disponible - section masquée');
    return null; // Ne pas afficher la section si aucun service
  }

  return (
    <section
      id="services"
      className="relative py-12 sm:py-16 md:py-20 lg:py-24 xl:py-32"
      style={{ backgroundColor: 'hsl(var(--bg-page))' }}
    >
      {/* Glow subtil */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: `radial-gradient(circle at 50% 50%, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1), transparent 70%)`,
        }}
      />

      <Container className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 md:mb-16 px-4 sm:px-0"
        >
          <h2
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold mb-3 sm:mb-4"
            style={{ color: 'hsl(var(--text-main))' }}
          >
            Nos services
          </h2>
          <p className="text-sm sm:text-base md:text-lg" style={{ color: 'hsl(var(--text-muted))' }}>
            Découvrez notre gamme complète de prestations pour prendre soin de vos cheveux
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-4 sm:px-0"
        >
          {services.map((service) => (
            <motion.div
              key={service.id}
              variants={itemVariants}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="group relative rounded-2xl sm:rounded-3xl border p-4 sm:p-6 backdrop-blur-xl transition-all"
              style={{
                backgroundColor: 'hsla(var(--bg-section) / 0.8)',
                borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2)',
                boxShadow: '0 8px 32px hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.08)',
              }}
            >
              {/* Glow au hover */}
              <div
                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at center, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1), transparent 70%)`,
                }}
              />

              <div className="relative z-10">
                {service.icon && (
                  <div
                    className="inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl text-2xl sm:text-3xl mb-3 sm:mb-4"
                    style={{
                      background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
                    }}
                  >
                    {service.icon}
                  </div>
                )}

                <h3
                  className="text-lg sm:text-xl font-semibold mb-1.5 sm:mb-2"
                  style={{ color: 'hsl(var(--text-main))' }}
                >
                  {service.name}
                </h3>

                <p
                  className="text-xs sm:text-sm mb-3 sm:mb-4 leading-relaxed"
                  style={{ color: 'hsl(var(--text-muted))' }}
                >
                  {service.description}
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mt-4 sm:mt-6">
                  <span
                    className="text-xl sm:text-2xl font-bold"
                    style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }}
                  >
                    {service.price}
                  </span>

                  <Button
                    onClick={() => setLocation(`${salonConfig.cta.href}?service=${service.id}`)}
                    className="rounded-full px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium w-full sm:w-auto min-h-[44px]"
                    style={{
                      backgroundColor: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))',
                      color: '#FFFFFF',
                    }}
                  >
                    Réserver ce service
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
