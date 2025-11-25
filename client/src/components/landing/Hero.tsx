import { useLocation } from 'wouter';
import { Clock, Bot } from 'lucide-react';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import MagneticButton from '@/components/ui/MagneticButton';

export default function Hero() {
  const [, setLocation] = useLocation();

  const handleBookingClick = () => {
    setLocation('/book');
  };

  const handleVoiceClick = () => {
    setLocation('/voice');
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div 
        className="absolute inset-0 -z-10 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800" 
        aria-hidden="true"
      />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background z-10" />

      {/* Content */}
      <Container className="relative z-20 pt-32 pb-20">
        <div className="text-center max-w-5xl mx-auto">
          <Reveal delay={0.1}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold text-foreground mb-6 leading-tight">
              Réservez votre coupe en{' '}
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient">
                quelques secondes
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
              Réservation en ligne & réceptionniste IA — en un seul endroit.
              <br />
              Simplifiez la gestion de votre salon.
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <MagneticButton
                onClick={handleBookingClick}
                className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center"
              >
                <Clock className="mr-2 h-5 w-5 flex-shrink-0" />
                <span>Prendre un rendez-vous</span>
              </MagneticButton>
              <MagneticButton
                onClick={handleVoiceClick}
                className="px-8 py-4 bg-transparent border-2 border-foreground text-foreground rounded-full font-semibold text-lg hover:bg-foreground hover:text-background transition-all duration-300 flex items-center justify-center"
              >
                <Bot className="mr-2 h-5 w-5 flex-shrink-0" />
                <span>Parler à l'IA</span>
              </MagneticButton>
            </div>
          </Reveal>

          <Reveal delay={0.4}>
            <div className="flex flex-wrap justify-center items-center gap-8 text-muted-foreground text-sm sm:text-base">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>100% Sécurisé</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span>24/7 Disponible</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                <span>Mobile First</span>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

