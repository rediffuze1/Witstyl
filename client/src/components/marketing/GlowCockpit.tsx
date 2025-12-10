import { motion, useScroll, useTransform } from 'framer-motion';
import Container from '@/components/ui/Container';
import { fadeInUp, sectionVariants, glassCardVariants } from '@/components/ui/motion';

export default function GlowCockpit() {
  const { scrollYProgress } = useScroll();
  
  // Parallax pour les cartes (flottement au scroll)
  const cardY = useTransform(scrollYProgress, [0, 1], [0, -20]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 0.4, 0.3]);

  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      className="relative py-24 sm:py-28 lg:py-32 bg-white"
    >
      {/* Glow animé */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: glowOpacity,
          background: `radial-gradient(circle at 30% 50%, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2), transparent 60%)`,
        }}
      />

      <Container>
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <motion.div
            variants={fadeInUp}
            className="space-y-6"
          >
            <p className="text-xs uppercase tracking-[0.18em] brand-pill">Vue salon</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900">
              Un cockpit glassmorphism + glow prêt pour tes équipes
            </h2>
            <p className="text-lg text-slate-600">
              Le dashboard reprend le même code visuel que ta landing : glow doux,
              cartes claires, actions évidentes. Toute ton équipe s'y retrouve.
            </p>
            <ul className="space-y-3 text-slate-600">
              {[
                'Planning équipe en temps réel',
                'Vue salon / poste / coiffeur',
                'Filtre par type de service',
                'Alertes sur les journées surchargées',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: `hsl(var(--brand-h) var(--brand-s) var(--brand-l))` }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            style={{ y: cardY }}
            variants={glassCardVariants}
            className="relative"
          >
            {/* Glow autour de la carte */}
            <motion.div
              animate={{
                scale: [1, 1.08, 1],
                opacity: [0.3, 0.4, 0.3],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute -inset-6 rounded-[2rem] blur-3xl opacity-30 pointer-events-none"
              style={{
                background: `radial-gradient(circle at top, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.3), transparent 70%)`,
              }}
            />

            <div className="relative glass-card p-6 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium text-slate-900">Vue de la journée</span>
                <span>3 coiffeurs · 18 RDV</span>
              </div>
              <div className="space-y-3">
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: `hsl(var(--brand-h) var(--brand-s) 96% / 0.6)`,
                  }}
                >
                  <span className="font-medium text-slate-900">Matin</span>
                  <span style={{ color: `hsl(var(--brand-h) var(--brand-s) var(--brand-l))` }}>
                    90% rempli
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-900">Après-midi</span>
                  <span className="text-slate-600">65% rempli</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-900">No-show estimés</span>
                  <span style={{ color: `hsl(var(--brand-h) var(--brand-s) var(--brand-l))` }}>
                    -54% vs avant
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Container>
    </motion.section>
  );
}

