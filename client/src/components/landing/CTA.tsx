import { useLocation } from 'wouter';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import MagneticButton from '@/components/ui/MagneticButton';
import { CheckCircle, CreditCard, Headphones } from 'lucide-react';

export default function CTA() {
  const [, setLocation] = useLocation();

  const handleLoginClick = () => {
    setLocation('/salon-login');
  };

  return (
    <section id="contact" className="py-20 sm:py-24 lg:py-32 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10">
      <Container>
        <div className="text-center max-w-4xl mx-auto">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Prêt à moderniser votre salon ?
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-lg sm:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Rejoignez les centaines de salons qui font confiance à SalonPilot pour gérer leurs
              rendez-vous
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <MagneticButton
                onClick={handleLoginClick}
                className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                Commencer gratuitement
              </MagneticButton>
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="flex flex-wrap justify-center items-center gap-8 text-muted-foreground">
              <div className="flex items-center space-x-2">
                <CheckCircle className="text-primary h-5 w-5" />
                <span>Essai gratuit 14 jours</span>
              </div>
              <div className="flex items-center space-x-2">
                <CreditCard className="text-primary h-5 w-5" />
                <span>Aucune carte requise</span>
              </div>
              <div className="flex items-center space-x-2">
                <Headphones className="text-primary h-5 w-5" />
                <span>Support 24/7</span>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}








