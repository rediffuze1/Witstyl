import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';
import { useSalonData } from '@/hooks/useSalonData';
import { MapPin } from 'lucide-react';

export default function SalonMap() {
  const { data: salonData } = useSalonData();

  // Utiliser les données du salon depuis l'API, avec fallback sur la config
  const salonAddress = salonData?.salon?.address || salonConfig.contact.address;
  
  // Toujours générer l'URL de la carte Google Maps à partir de l'adresse réelle
  // Ne pas utiliser salonConfig.contact.mapUrl car il peut contenir une ancienne adresse
  // Méthode qui fonctionne sans clé API
  const mapUrl = salonAddress 
    ? `https://www.google.com/maps?q=${encodeURIComponent(salonAddress)}&output=embed`
    : salonConfig.contact.mapUrl || null;

  if (!mapUrl && !salonAddress) {
    return null;
  }

  return (
    <section
      id="location"
      className="relative py-24 sm:py-28 lg:py-32"
      style={{ backgroundColor: 'hsl(var(--bg-page))' }}
    >
      <Container className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-4"
            style={{ color: 'hsl(var(--text-main))' }}
          >
            Nous trouver
          </h2>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] items-center">
          {/* Adresse */}
          {salonAddress && (
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl border p-8 backdrop-blur-xl"
              style={{
                backgroundColor: 'hsla(var(--bg-section) / 0.8)',
                borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2)',
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
                  }}
                >
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3
                    className="text-xl font-semibold mb-2"
                    style={{ color: 'hsl(var(--text-main))' }}
                  >
                    Adresse
                  </h3>
                  <p
                    className="text-base leading-relaxed whitespace-pre-line"
                    style={{ color: 'hsl(var(--text-muted))' }}
                  >
                    {salonAddress}
                  </p>
                  {salonAddress && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salonAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-4 text-sm font-medium hover:underline transition-colors"
                      style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }}
                    >
                      <MapPin className="h-4 w-4" />
                      Voir sur Google Maps
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Carte */}
          {mapUrl && (
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6 }}
              className="relative rounded-3xl overflow-hidden border"
              style={{
                borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2)',
                boxShadow: '0 8px 32px hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.08)',
              }}
            >
              <iframe
                src={mapUrl}
                width="100%"
                height="400"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Carte Google Maps - Salon"
              />
            </motion.div>
          )}
        </div>
      </Container>
    </section>
  );
}
