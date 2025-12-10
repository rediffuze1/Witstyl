import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { AlarmClock, BellRing, CalendarCog, ClipboardCheck, NotebookPen, Repeat } from 'lucide-react';
import { useLocation } from 'wouter';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';

const keyFeatures = [
  {
    icon: CalendarCog,
    title: 'Horaires dynamiques',
    description: 'Pauses, journées fermées, stylistes invités : tout se synchronise instantanément avec la prise de rendez-vous publique.',
  },
  {
    icon: BellRing,
    title: 'Notifications configurables',
    description: 'Templates SMS/Email stockés côté serveur. Tu peux les modifier depuis le dashboard sans redeployer.',
  },
  {
    icon: NotebookPen,
    title: 'Notes privées',
    description: 'Ajoute des notes discrètes (allergies, préférences) visibles uniquement par ton équipe.',
  },
  {
    icon: AlarmClock,
    title: 'Rappels intelligents',
    description: 'Déclenchement 48h / 24h / 2h avant selon le service pour réduire drastiquement le no-show.',
  },
  {
    icon: Repeat,
    title: 'Workflows récurrents',
    description: 'Identifie automatiquement les clients réguliers et propose un créneau similaire.',
  },
  {
    icon: ClipboardCheck,
    title: 'Validation en un clic',
    description: 'File d\'attente des demandes avec actions rapides : confirmer, reprogrammer, refuser.',
  },
];

function OfferCard() {
  const [, setLocation] = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'center start'],
  });
  const translateY = useTransform(scrollYProgress, [0, 1], [20, -10]);

  return (
    <motion.div
      ref={ref}
      style={{ y: translateY }}
      className="relative mt-16 overflow-hidden glass-panel p-10"
      style={{ backgroundColor: 'var(--lp-bg-card)' }}
    >
      {/* Glow très discret */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, var(--lp-glow-subtle), transparent)`,
        }}
      />
      <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] brand-pill">Pack Premium</p>
          <h3 className="mt-3 text-3xl font-semibold" style={{ color: 'var(--lp-text-main)' }}>Essai gratuit 14 jours</h3>
          <p className="mt-4 text-lg" style={{ color: 'var(--lp-text-muted)' }}>
            Aucun engagement, migration de tes clients offerte, coach onboarding pour recréer tes process existants.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            {['Onboarding guidé', 'Support WhatsApp', 'Templates prêts'].map((tag) => (
              <span key={tag} className="brand-pill">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="w-full max-w-sm glass-panel p-6 text-center" style={{ backgroundColor: 'var(--lp-bg-card)' }}>
          <p className="text-sm font-semibold uppercase tracking-[0.4em] brand-pill">Abonnement unique</p>
          <div className="mt-4 text-4xl font-semibold" style={{ color: 'var(--lp-text-main)' }}>
            89€ <span className="text-base font-normal" style={{ color: 'var(--lp-text-muted)' }}>/mois</span>
          </div>
          <p className="mt-2 text-sm" style={{ color: 'var(--lp-text-muted)' }}>Tout inclus, sans frais cachés</p>
          <button
            onClick={() => setLocation('/salon-login')}
            className="mt-6 w-full brand-button"
          >
            Tester SalonPilot
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Stats() {
  return (
    <section className="py-24 sm:py-28 lg:py-32" style={{ backgroundColor: 'var(--lp-bg-page)' }}>
      <Container>
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm uppercase tracking-[0.4em] mb-4 brand-pill">Fonctionnalités clés</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold" style={{ color: 'var(--lp-text-main)' }}>
              Tout ce qu\'il faut pour orchestrer ton salon
            </h2>
            <p className="mt-4 text-lg" style={{ color: 'var(--lp-text-muted)' }}>
              Ces modules reprennent exactement les blocs visibles dans le dashboard propriétaire, en version glow/glass.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {keyFeatures.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.05}>
              <motion.div
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="h-full glass-panel p-6"
                style={{ backgroundColor: 'var(--lp-bg-card)' }}
              >
                <div
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg mb-6"
                  style={{
                    background: `var(--lp-brand-gradient)`,
                  }}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--lp-text-main)' }}>{feature.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-text-muted)' }}>{feature.description}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>

        <OfferCard />
      </Container>
    </section>
  );
}
