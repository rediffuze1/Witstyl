import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { BellRing, CalendarCheck2, LayoutDashboard, Users } from 'lucide-react';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';

const mockScreens = [
  {
    title: 'Vue propriétaire',
    yRange: [20, -20],
  },
  {
    title: 'App client',
    yRange: [40, -10],
  },
  {
    title: 'Assistant IA',
    yRange: [60, 0],
  },
];

export default function DashboardShowcase() {
  const showcaseRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: showcaseRef,
    offset: ['start end', 'center start'],
  });

  return (
    <section ref={showcaseRef} className="relative py-24 sm:py-28 lg:py-32" style={{ backgroundColor: 'var(--lp-bg-section)' }}>
      {/* Glow très discret */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 50%, var(--lp-glow-subtle), transparent 50%)`,
        }}
      />
      <Container className="relative z-10">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal direction="right">
            <div className="max-w-xl">
              <p className="text-sm uppercase tracking-[0.4em] mb-4 brand-pill">Screenshots</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold" style={{ color: 'var(--lp-text-main)' }}>
                Un cockpit glassmorphism + glow prêt pour tes équipes
              </h2>
              <p className="mt-6 text-lg" style={{ color: 'var(--lp-text-muted)' }}>
                Chaque écran a été redessiné pour refléter le même style que la landing :
                halos subtils, cartes glass, et données lisibles en un coup d\'œil.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { icon: LayoutDashboard, label: 'Vue propriétaire', desc: 'KPI temps réel + gestion des stylistes' },
                  { icon: CalendarCheck2, label: 'Calendrier styliste', desc: 'Glisser-déposer + filtres par service' },
                  { icon: BellRing, label: 'Rappels intelligents', desc: 'SMS / email configurables par salon' },
                  { icon: Users, label: 'Fiches clients', desc: 'Notes privées et préférences persistantes' },
                ].map((item, idx) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1, duration: 0.4 }}
                    className="flex items-start gap-4"
                  >
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-2xl"
                      style={{
                        background: `color-mix(in srgb, var(--brand-color) 12%, transparent)`,
                      }}
                    >
                      <item.icon className="h-5 w-5" style={{ color: 'var(--brand-color)' }} />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--lp-text-main)' }}>{item.label}</p>
                      <p className="text-sm" style={{ color: 'var(--lp-text-muted)' }}>{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="relative h-[460px] md:h-[520px]">
            {mockScreens.map((screen, index) => {
              const translateY = useTransform(scrollYProgress, [0, 1], screen.yRange);
              const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.3]);
              return (
                <motion.div
                  key={screen.title}
                  style={{ y: translateY, opacity }}
                  className="absolute left-1/2 top-1/2 w-[80%] max-w-sm -translate-x-1/2 -translate-y-1/2"
                >
                  <div className="glass-panel p-6" style={{ backgroundColor: 'var(--lp-bg-card)' }}>
                    <div
                      className="rounded-2xl p-4"
                      style={{
                        background: `var(--lp-bg-section)`,
                        border: `1px solid var(--lp-border-soft)`,
                      }}
                    >
                      <div className="mb-4 flex items-center justify-between text-xs font-semibold" style={{ color: 'var(--lp-text-muted)' }}>
                        <span>{screen.title}</span>
                        <span className="text-[10px] uppercase tracking-[0.4em]" style={{ color: 'var(--brand-color)' }}>
                          Live
                        </span>
                      </div>
                      <div className="space-y-3">
                        {[1, 2, 3].map((row) => (
                          <div
                            key={row}
                            className="flex items-center justify-between rounded-xl p-3"
                            style={{
                              background: `var(--lp-bg-page)`,
                              border: `1px solid var(--lp-border-soft)`,
                            }}
                          >
                            <div
                              className="h-3 w-20 rounded-lg"
                              style={{
                                background: `var(--lp-border-medium)`,
                              }}
                            />
                            <div
                              className="h-3 w-10 rounded-lg"
                              style={{
                                background: `var(--lp-border-soft)`,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
