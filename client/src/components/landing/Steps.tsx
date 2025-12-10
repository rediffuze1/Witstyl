import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { CalendarDays, CheckCircle2, MessageCircleMore, SmartphoneNfc } from 'lucide-react';

const timeline = [
  {
    title: 'Le client réserve en ligne',
    description:
      'Widget mobile-first, créneaux filtrés par styliste et acompte optionnel.',
    icon: CalendarDays,
  },
  {
    title: 'Le salon valide ou ajuste',
    description:
      'Notification instantanée dans ton dashboard + sur ton mobile (push ou SMS).',
    icon: CheckCircle2,
  },
  {
    title: 'Confirmation premium',
    description:
      'Email glassmorphism + SMS brandé envoyés automatiquement avec lien de modification.',
    icon: MessageCircleMore,
  },
  {
    title: 'Rappel intelligent',
    description:
      '24h ou 2h avant : SMS + WhatsApp avec lien pour prévenir en cas de retard.',
    icon: SmartphoneNfc,
  },
];

export default function Steps() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-28 lg:py-32" style={{ backgroundColor: 'var(--lp-bg-page)' }}>
      <Container>
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm uppercase tracking-[0.4em] mb-4 brand-pill">Flow de réservation</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold" style={{ color: 'var(--lp-text-main)' }}>
              Une timeline lumineuse, sans friction
            </h2>
            <p className="mt-4 text-lg" style={{ color: 'var(--lp-text-muted)' }}>
              Chaque point de contact est habillé avec les mêmes effets Glow / Glass que ton application propriétaire.
            </p>
          </div>
        </Reveal>

        <div className="relative">
          <div
            className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-20"
            style={{ color: 'var(--lp-border-medium)' }}
          />
          <div className="grid gap-8 lg:gap-10 lg:grid-cols-4">
            {timeline.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.1}>
                <motion.div
                  whileHover={{ scale: 1.03, y: -4, transition: { duration: 0.2 } }}
                  className="relative glass-panel p-6"
                  style={{ backgroundColor: 'var(--lp-bg-card)' }}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg mb-6"
                    style={{
                      background: `var(--lp-brand-gradient)`,
                    }}
                  >
                    <step.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--lp-text-main)' }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-text-muted)' }}>{step.description}</p>
                  {index < timeline.length - 1 && (
                    <>
                      <span
                        className="absolute left-1/2 top-full hidden h-10 w-px bg-gradient-to-b from-current to-transparent opacity-20 lg:block"
                        style={{ color: 'var(--lp-border-medium)' }}
                      />
                      <span
                        className="absolute -left-1 lg:hidden top-6 h-6 w-px bg-gradient-to-b from-current to-transparent opacity-20"
                        style={{ color: 'var(--lp-border-medium)' }}
                      />
                    </>
                  )}
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
