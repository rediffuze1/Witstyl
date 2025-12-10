import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';
import { useSalonData } from '@/hooks/useSalonData';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MapPin, Instagram, Facebook } from 'lucide-react';

export default function ContactFooter() {
  const [, setLocation] = useLocation();
  const { data: salonData } = useSalonData();

  // Utiliser les données du salon depuis l'API, avec fallback sur la config
  const salonName = salonData?.salon?.name || salonConfig.name;
  const salonEmail = salonData?.salon?.email || salonConfig.contact.email;
  const salonPhone = salonData?.salon?.phone || salonConfig.contact.phone;
  const salonAddress = salonData?.salon?.address || salonConfig.contact.address;
  const salonSocial = salonConfig.contact.social;

  return (
    <footer
      id="contact"
      className="relative py-24 sm:py-28 lg:py-32"
      style={{ backgroundColor: 'hsl(var(--bg-section))' }}
    >
      <Container className="relative z-10">
        {/* Section Contact principale */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-4"
            style={{ color: 'hsl(var(--text-main))' }}
          >
            Contactez-nous
          </h2>
          <p className="text-lg mb-8" style={{ color: 'hsl(var(--text-muted))' }}>
            Notre équipe reste à votre disposition pour répondre à vos questions
          </p>

          {/* CTA principal */}
          <Button
            onClick={() => setLocation(salonConfig.cta.href)}
            className="rounded-full px-8 py-6 text-base font-semibold text-white shadow-lg hover:shadow-xl transition-all"
            style={{
              backgroundColor: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))',
              boxShadow: '0 20px 60px hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.35)',
            }}
          >
            {salonConfig.cta.label}
          </Button>
        </motion.div>

        {/* Informations de contact */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid gap-8 md:grid-cols-3 mb-16"
        >
          {/* Email */}
          {salonEmail && (
            <div className="text-center">
              <div
                className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
                style={{
                  background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
                }}
              >
                <Mail className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'hsl(var(--text-main))' }}>
                Email
              </h3>
              <a
                href={`mailto:${salonEmail}`}
                className="text-sm hover:underline transition-colors"
                style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }}
              >
                {salonEmail}
              </a>
            </div>
          )}

          {/* Téléphone */}
          {salonPhone && (
            <div className="text-center">
              <div
                className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
                style={{
                  background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
                }}
              >
                <Phone className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'hsl(var(--text-main))' }}>
                Téléphone
              </h3>
              <a
                href={`tel:${salonPhone.replace(/\s/g, '')}`}
                className="text-sm hover:underline transition-colors"
                style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }}
              >
                {salonPhone}
              </a>
            </div>
          )}

          {/* Adresse */}
          {salonAddress && (
            <div className="text-center">
              <div
                className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
                style={{
                  background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
                }}
              >
                <MapPin className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'hsl(var(--text-main))' }}>
                Adresse
              </h3>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salonAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm whitespace-pre-line hover:underline transition-colors inline-block"
                style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }}
              >
                {salonAddress}
              </a>
            </div>
          )}
        </motion.div>

        {/* Réseaux sociaux */}
        {salonSocial && (salonSocial.instagram || salonSocial.facebook) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex justify-center gap-4 mb-12"
          >
            {salonSocial.instagram && (
              <a
                href={salonSocial.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full border backdrop-blur-md transition-all hover:scale-110"
                style={{
                  borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.3)',
                  backgroundColor: 'hsla(var(--bg-section) / 0.8)',
                  color: 'hsl(var(--text-main))',
                }}
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
            )}
            {salonSocial.facebook && (
              <a
                href={salonSocial.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full border backdrop-blur-md transition-all hover:scale-110"
                style={{
                  borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.3)',
                  backgroundColor: 'hsla(var(--bg-section) / 0.8)',
                  color: 'hsl(var(--text-main))',
                }}
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
            )}
          </motion.div>
        )}

        {/* Footer bas */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="border-t pt-8 text-center"
          style={{ borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1)' }}
        >
          <p className="text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
            © {new Date().getFullYear()} {salonName}. Tous droits réservés.
          </p>
        </motion.div>
      </Container>
    </footer>
  );
}
