import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function Contact() {
  const { data: salonData, isLoading, error } = useQuery({
    queryKey: ['/api/public/salon'],
    queryFn: async () => {
      const response = await fetch('/api/public/salon');
      if (!response.ok) {
        console.warn('[Contact] Impossible de charger les informations du salon:', response.status);
        return { salon: null, hours: [] };
      }
      return response.json();
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  });

  const salon = salonData?.salon || {};
  const salonAddress = salon?.address?.trim();
  const encodedAddress = salonAddress ? encodeURIComponent(salonAddress) : null;
  const mapUrl = encodedAddress
    ? `https://www.google.com/maps?q=${encodedAddress}&output=embed`
    : null;

  return (
    <section id="contact" className="py-20 sm:py-24 lg:py-32" style={{ backgroundColor: 'var(--lp-bg-page)' }}>
      <Container>
        <Reveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4" style={{ color: 'var(--lp-text-main)' }}>
              Contactez-nous
            </h2>
            <p className="text-lg sm:text-xl max-w-2xl mx-auto" style={{ color: 'var(--lp-text-muted)' }}>
              Notre équipe reste à votre disposition
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1} direction="up">
          <div className="max-w-3xl mx-auto space-y-8">
            <div>
              <h3 className="text-2xl font-semibold mb-6" style={{ color: 'var(--lp-text-main)' }}>
                Informations de contact
              </h3>
              <div className="space-y-6">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div
                      className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full mx-auto mb-4"
                      style={{
                        borderColor: 'var(--brand-color)',
                        borderTopColor: 'transparent',
                      }}
                    />
                    <p style={{ color: 'var(--lp-text-muted)' }}>Chargement des informations...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p style={{ color: 'var(--lp-text-muted)' }}>
                      Les informations de contact ne sont pas disponibles pour le moment.
                    </p>
                  </div>
                ) : (
                  <>
                    {salon.email && (
                      <div className="flex items-start space-x-4">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: `var(--lp-brand-gradient)`,
                          }}
                        >
                          <Mail className="text-white h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1" style={{ color: 'var(--lp-text-main)' }}>Email</h4>
                          <a
                            href={`mailto:${salon.email}`}
                            className="transition-colors hover:opacity-80"
                            style={{ color: 'var(--brand-color)' }}
                          >
                            {salon.email}
                          </a>
                        </div>
                      </div>
                    )}

                    {salon.phone && (
                      <div className="flex items-start space-x-4">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: `var(--lp-brand-gradient)`,
                          }}
                        >
                          <Phone className="text-white h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1" style={{ color: 'var(--lp-text-main)' }}>Téléphone</h4>
                          <a
                            href={`tel:${salon.phone.replace(/\s/g, '')}`}
                            className="transition-colors hover:opacity-80"
                            style={{ color: 'var(--brand-color)' }}
                          >
                            {salon.phone}
                          </a>
                        </div>
                      </div>
                    )}

                    {salonAddress && (
                      <div className="flex items-start space-x-4">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: `var(--lp-brand-gradient)`,
                          }}
                        >
                          <MapPin className="text-white h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1" style={{ color: 'var(--lp-text-main)' }}>Adresse</h4>
                          <p className="whitespace-pre-line" style={{ color: 'var(--lp-text-muted)' }}>
                            {salonAddress}
                          </p>
                        </div>
                      </div>
                    )}

                    {mapUrl && (
                      <div className="mt-8">
                        <div className="rounded-2xl overflow-hidden border shadow-md" style={{ borderColor: 'var(--lp-border-soft)', backgroundColor: 'var(--lp-bg-card)' }}>
                          <iframe
                            title="Emplacement du salon"
                            src={mapUrl}
                            className="w-full h-[250px]"
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
