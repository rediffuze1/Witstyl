import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';
import { fadeInUp, sectionVariants, staggerContainer } from '@/components/ui/motion';
import SalonMap from './SalonMap';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function ContactSection() {
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
          <p className="text-xs uppercase tracking-[0.18em] mb-4 brand-pill">Besoin d'en savoir plus ?</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 mb-4">
            Contactez-nous
          </h2>
          <p className="text-lg text-slate-600">
            On répond à tes questions et on t'aide à configurer ton premier salon.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          className="max-w-4xl mx-auto grid gap-8 md:grid-cols-[0.9fr_1.1fr]"
        >
          {/* Informations de contact */}
          <motion.div
            variants={fadeInUp}
            className="space-y-6"
          >
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
                  }}
                >
                  <Mail className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-medium text-slate-900 mb-1">Email</div>
                  <a
                    href={`mailto:${salonConfig.contact.email}`}
                    className="text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {salonConfig.contact.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
                  }}
                >
                  <Phone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-medium text-slate-900 mb-1">Téléphone</div>
                  <a
                    href={`tel:${salonConfig.contact.phone.replace(/\s/g, '')}`}
                    className="text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {salonConfig.contact.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
                  }}
                >
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-medium text-slate-900 mb-1">Adresse</div>
                  <p className="text-slate-600">{salonConfig.contact.address}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Carte */}
          <motion.div
            variants={fadeInUp}
            custom={1}
          >
            <SalonMap />
          </motion.div>
        </motion.div>
      </Container>
    </motion.section>
  );
}




