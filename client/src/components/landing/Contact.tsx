import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function Contact() {
  // Charger les informations du salon depuis l'API
  const { data: salonData, isLoading, error } = useQuery({
    queryKey: ['/api/public/salon'],
    queryFn: async () => {
      const response = await fetch('/api/public/salon');
      if (!response.ok) {
        // Ne pas throw, retourner un objet vide pour permettre le rendu
        console.warn('[Contact] Impossible de charger les informations du salon:', response.status);
        return { salon: null, hours: [] };
      }
      return response.json();
    },
    retry: 1, // Réduire les retries pour éviter les blocages
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
    // Ne pas suspendre le rendu en cas d'erreur
    throwOnError: false,
  });

  // Utiliser les données ou un objet vide en cas d'erreur
  const salon = salonData?.salon || {};
  const salonAddress = salon?.address?.trim();
  const encodedAddress = salonAddress ? encodeURIComponent(salonAddress) : null;
  const mapUrl = encodedAddress
    ? `https://www.google.com/maps?q=${encodedAddress}&output=embed`
    : null;

  return (
    <section id="contact" className="py-20 sm:py-24 lg:py-32">
      <Container>
        <Reveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Contactez-nous
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Notre équipe reste à votre disposition
            </p>
          </div>
        </Reveal>

        {/* Informations de contact */}
        <Reveal delay={0.1} direction="up">
          <div className="max-w-3xl mx-auto space-y-8">
            <div>
              <h3 className="text-2xl font-semibold text-foreground mb-6">
                Informations de contact
              </h3>
              <div className="space-y-6">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">Chargement des informations...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Les informations de contact ne sont pas disponibles pour le moment.
                    </p>
                  </div>
                ) : (
                  <>
                    {salon.email && (
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0">
                          <Mail className="text-white h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">Email</h4>
                          <a
                            href={`mailto:${salon.email}`}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            {salon.email}
                          </a>
                        </div>
                      </div>
                    )}

                    {salon.phone && (
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0">
                          <Phone className="text-white h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">Téléphone</h4>
                          <a
                            href={`tel:${salon.phone.replace(/\s/g, '')}`}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            {salon.phone}
                          </a>
                        </div>
                      </div>
                    )}

                    {salonAddress && (
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0">
                          <MapPin className="text-white h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">Adresse</h4>
                          <p className="text-muted-foreground whitespace-pre-line">
                            {salonAddress}
                          </p>
                        </div>
                      </div>
                    )}

                    {mapUrl && (
                      <div className="mt-8">
                        <div className="rounded-2xl overflow-hidden border border-border/40 shadow-md bg-white">
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

