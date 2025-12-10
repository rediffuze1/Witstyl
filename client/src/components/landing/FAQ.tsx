import { useState } from 'react';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
  {
    question: 'Comment fonctionne la réservation en 3 clics ?',
    answer:
      'Vos clients sélectionnent leur service, choisissent un créneau disponible dans votre calendrier en temps réel, et confirment leur rendez-vous. C\'est aussi simple que ça !',
  },
  {
    question: 'L\'assistant IA fonctionne-t-il vraiment 24/7 ?',
    answer:
      'Oui, notre réceptionniste IA est disponible 24h/24 et 7j/7. Elle peut prendre des rendez-vous, répondre aux questions sur vos services, horaires et tarifs, même en dehors de vos heures d\'ouverture.',
  },
  {
    question: 'Comment fonctionnent les rappels automatiques ?',
    answer:
      'SalonPilot envoie automatiquement des rappels par SMS et/ou email à vos clients avant leur rendez-vous. Vous pouvez personnaliser le délai (24h, 48h avant) et le contenu des messages.',
  },
  {
    question: 'Puis-je essayer SalonPilot gratuitement ?',
    answer:
      'Absolument ! Nous offrons un essai gratuit de 14 jours, sans carte bancaire requise. Vous pouvez tester toutes les fonctionnalités et voir comment SalonPilot transforme la gestion de votre salon.',
  },
  {
    question: 'Mes données sont-elles sécurisées ?',
    answer:
      'Oui, nous utilisons des protocoles de sécurité avancés pour protéger toutes vos données et celles de vos clients. Tous les paiements sont traités de manière sécurisée via Stripe.',
  },
  {
    question: 'Puis-je personnaliser l\'interface pour mon salon ?',
    answer:
      'Oui, vous pouvez personnaliser les couleurs, ajouter votre logo, configurer vos services, horaires et tarifs. Votre tableau de bord s\'adapte à votre identité de marque.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 sm:py-24 lg:py-32" style={{ backgroundColor: 'var(--lp-bg-page)' }}>
      <Container>
        <Reveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4" style={{ color: 'var(--lp-text-main)' }}>
              Questions fréquentes
            </h2>
            <p className="text-lg sm:text-xl max-w-2xl mx-auto" style={{ color: 'var(--lp-text-muted)' }}>
              Tout ce que vous devez savoir sur SalonPilot
            </p>
          </div>
        </Reveal>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <Reveal key={index} delay={index * 0.05} direction="up">
              <div className="glass-panel overflow-hidden" style={{ backgroundColor: 'var(--lp-bg-card)' }}>
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left transition-colors hover:bg-opacity-50"
                  style={{ 
                    backgroundColor: openIndex === index ? 'var(--lp-bg-section)' : 'transparent',
                  }}
                >
                  <span className="font-semibold pr-4" style={{ color: 'var(--lp-text-main)' }}>{faq.question}</span>
                  {openIndex === index ? (
                    <ChevronUp className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--brand-color)' }} />
                  ) : (
                    <ChevronDown className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--lp-text-muted)' }} />
                  )}
                </button>
                <AnimatePresence>
                  {openIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 leading-relaxed" style={{ color: 'var(--lp-text-muted)' }}>
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
