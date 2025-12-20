import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';
import { fadeInUp, sectionVariants, glassCardVariants } from '@/components/ui/motion';
import OpeningHoursTable from './OpeningHoursTable';

export default function OpeningHours() {
  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      className="relative py-24 sm:py-28 lg:py-32 bg-white"
    >
      <Container>
        <motion.div
          variants={fadeInUp}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <p className="text-xs uppercase tracking-[0.18em] mb-4 brand-pill">En pratique</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 mb-4">
            Nos horaires
          </h2>
          <p className="text-lg text-slate-600">
            Pour donner un exemple concret à tes futurs clients quand tu mettras ta LP en ligne.
          </p>
        </motion.div>

        <motion.div
          variants={glassCardVariants}
          className="max-w-md mx-auto"
        >
          <OpeningHoursTable />
        </motion.div>
      </Container>
    </motion.section>
  );
}




