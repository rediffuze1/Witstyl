import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

/**
 * Section de réservation
 * Redirige vers la page de réservation
 */
export default function Booking() {
  const [, setLocation] = useLocation();

  return (
    <section id="reservation" className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-background to-muted/20">
      <Container>
        <div className="max-w-5xl mx-auto">
          {/* En-tête de section */}
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                Réserver un créneau
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                Réservation en ligne — 3 clics pour prendre rendez-vous. 
                Choisissez votre créneau, confirmez et recevez une confirmation instantanée.
              </p>
            </div>
          </Reveal>

          {/* Bouton de réservation */}
          <Reveal delay={0.2}>
            <div className="bg-card rounded-2xl shadow-lg border border-border p-6 sm:p-8 text-center">
              <Button
                onClick={() => setLocation('/book')}
                size="lg"
                className="px-8 py-6 text-lg font-semibold"
              >
                Réserver maintenant
              </Button>
            </div>
          </Reveal>

          {/* Informations supplémentaires */}
          <Reveal delay={0.3}>
            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>
                Vous préférez réserver par téléphone ?{' '}
                <a 
                  href="#contact" 
                  className="text-primary hover:underline font-medium"
                >
                  Contactez-nous directement
                </a>
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
