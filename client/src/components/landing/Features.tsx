import { Bolt, Bot, Users, CreditCard } from 'lucide-react';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { motion } from 'framer-motion';

const features = [
  {
    icon: Bolt,
    title: 'Réservation express',
    description: 'Formulaire simple avec créneaux en temps réel. Réservez en moins de 2 minutes, en seulement 3 clics.',
    highlight: '3 clics',
  },
  {
    icon: Bot,
    title: 'IA réceptionniste',
    description: 'Prise de RDV à la voix, 24/7, avec confirmations instantanées et compréhension naturelle. Chat d\'aide en cas de problème.',
    highlight: '24/7',
  },
  {
    icon: Users,
    title: 'Tableau de bord client',
    description: 'Consultez vos rendez-vous, historique, et préférences depuis votre espace personnel dédié.',
    highlight: 'Dashboard',
  },
  {
    icon: CreditCard,
    title: 'Paiement & rappels',
    description: 'Acompte ou tarif complet, rappels automatiques par SMS, email ou WhatsApp pour ne jamais oublier.',
    highlight: 'Rappels SMS',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 sm:py-24 lg:py-32 bg-muted/30">
      <Container>
        <Reveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Ce que fait l'app
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Découvrez comment SalonPilot révolutionne la prise de rendez-vous pour les salons de
              coiffure
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.1} direction="up">
              <motion.div
                className="group relative bg-white/80 backdrop-blur-md border border-border/40 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                whileHover={{ scale: 1.02 }}
                initial={{ scale: 0.98 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="text-white text-2xl" />
                </div>
                <div className="mb-2">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    {feature.highlight}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}








