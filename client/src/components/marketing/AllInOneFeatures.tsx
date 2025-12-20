import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import { fadeInUp, staggerContainer, glassCardVariants, sectionVariants } from '@/components/ui/motion';

const features = [
  'Réservation en ligne 24/7',
  'Rappels SMS & email configurables',
  'Gestion multi-coiffeurs',
  'Temps de pause & techniques',
  'Fiches clients complètes',
  'Exports et suivi d\'activité',
];

export default function AllInOneFeatures() {
  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      className="relative py-24 sm:py-28 lg:py-32"
      style={{ backgroundColor: `hsl(var(--bg-page))` }}
    >
      <Container>
        <motion.div
          variants={fadeInUp}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <p className="text-xs uppercase tracking-[0.18em] mb-4 brand-pill">À ton service</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 mb-4">
            Tout ce qu'il faut pour orchestrer ton salon
          </h2>
          <p className="text-lg text-slate-600">
            Tous les outils sont déjà synchronisés entre eux. Tu actives ce dont
            tu as besoin, quand tu en as besoin.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((label, index) => (
            <motion.div
              key={label}
              variants={glassCardVariants}
              custom={index}
              className="glass-card p-5 backdrop-blur-xl"
            >
              <div
                className="inline-flex h-8 w-8 items-center justify-center rounded-full mb-3"
                style={{
                  background: `hsl(var(--brand-h) var(--brand-s) 96% / 0.8)`,
                  color: `hsl(var(--brand-h) var(--brand-s) var(--brand-l))`,
                }}
              >
                ✓
              </div>
              <p className="text-sm font-medium text-slate-900">{label}</p>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </motion.section>
  );
}




