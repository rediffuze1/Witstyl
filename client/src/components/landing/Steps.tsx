import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { motion } from 'framer-motion';

const steps = [
  {
    number: '1',
    title: 'Choisissez service & date',
    description:
      'Sélectionnez votre service préféré et trouvez le créneau qui vous convient parmi les disponibilités en temps réel.',
  },
  {
    number: '2',
    title: 'Validez & payez',
    description:
      'Confirmez vos informations et procédez au paiement sécurisé. Acompte ou règlement complet selon vos préférences.',
  },
  {
    number: '3',
    title: 'Confirmation & rappels',
    description:
      'Confirmation instantanée par email/SMS. Rappels automatiques pour ne jamais oublier votre rendez-vous.',
  },
];

export default function Steps() {
  return (
    <section id="how-it-works" className="py-20 sm:py-24 lg:py-32">
      <Container>
        <Reveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Comment ça marche
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Un processus simple en 3 étapes pour réserver votre rendez-vous
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
          {steps.map((step, index) => (
            <Reveal key={step.number} delay={index * 0.15} direction="up">
              <div className="relative text-center">
                {/* Connector line (desktop only) */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-primary/50 via-accent/30 to-transparent" />
                )}

                {/* Step number */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <span className="text-3xl font-bold text-white">{step.number}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <motion.div
                      className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent"
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: index * 0.2 }}
                    />
                  )}
                </div>

                {/* Step content */}
                <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-4">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}








