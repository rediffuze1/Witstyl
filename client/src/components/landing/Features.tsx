import { motion } from 'framer-motion';
import { CalendarRange, MessageSquareHeart, PhoneCall, UsersRound } from 'lucide-react';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';

const valueProps = [
  {
    icon: CalendarRange,
    title: 'Réservez + vite',
    description:
      'Créneaux dynamiques synchronisés avec l\'agenda styliste. 3 clics suffisent pour remplir ta journée.',
    badge: '🤝 Agenda temps réel',
  },
  {
    icon: PhoneCall,
    title: 'Rappels automatiques',
    description:
      'SMS, email et WhatsApp programmés selon tes règles pour réduire le no-show et rassurer les clients.',
    badge: '🔔 -34% de no-show',
  },
  {
    icon: UsersRound,
    title: 'Relation client assistée',
    description:
      'Fiches complètes, notes privées, préférences capillaires & labels VIP visibles depuis le dashboard.',
    badge: '💜 Fidélisation',
  },
  {
    icon: MessageSquareHeart,
    title: 'IA réceptionniste',
    description:
      'Une interface vocale & chat qui répond 24/7 et valide les réservations sans que tu lèves le petit doigt.',
    badge: '✨ IA native',
  },
];

export default function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-28 lg:py-32" style={{ backgroundColor: 'var(--lp-bg-section)' }}>
      {/* Glow très discret en arrière-plan */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, var(--lp-glow-subtle), transparent 70%)`,
        }}
      />
      <Container className="relative z-10">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm uppercase tracking-[0.4em] mb-4 brand-pill">
              Comment ça aide
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold" style={{ color: 'var(--lp-text-main)' }}>
              Les piliers qui soulagent ton salon
            </h2>
            <p className="mt-4 text-lg" style={{ color: 'var(--lp-text-muted)' }}>
              Chaque carte ci-dessous réplique une douleur réelle entendue chez les coiffeurs indépendants
              et reprend la palette de ton dashboard pour garder l\'identité produit.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-4">
          {valueProps.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.1}>
              <motion.div
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group relative h-full glass-panel p-6"
                style={{ backgroundColor: 'var(--lp-bg-card)' }}
              >
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.3em] uppercase mb-4">
                  <span className="brand-pill">{feature.badge}</span>
                </div>
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
                <div
                  className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ color: 'var(--lp-border-medium)' }}
                />
              </motion.div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
