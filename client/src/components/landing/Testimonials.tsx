import { useState, useEffect } from 'react';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const testimonials = [
  {
    quote:
      "Witstyl a transformé la gestion de mon salon. Les clients adorent la réservation en 3 clics et l'IA répond à toutes leurs questions 24/7.",
    author: 'Marie Dubois',
    role: 'Propriétaire, Salon Élégance',
  },
  {
    quote:
      "Le système de rappels automatiques a réduit mes annulations de 80%. Mes clients n'oublient plus leurs rendez-vous !",
    author: 'Jean Martin',
    role: 'Coiffeur, Studio Moderne',
  },
  {
    quote:
      "L'interface est intuitive et le tableau de bord client permet à mes clients de gérer leurs rendez-vous en toute autonomie.",
    author: 'Sophie Laurent',
    role: 'Directrice, Coiffure & Style',
  },
];

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <section id="testimonials" className="py-20 sm:py-24 lg:py-32 bg-muted/30">
      <Container>
        <Reveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Ce que disent nos clients
            </h2>
          </div>
        </Reveal>

        <div
          className="relative max-w-4xl mx-auto"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={prefersReducedMotion ? {} : { opacity: 0, x: 50 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
              className="bg-white/80 backdrop-blur-md border border-border/40 rounded-3xl p-8 sm:p-12 shadow-xl"
            >
              <Quote className="h-12 w-12 text-primary/30 mb-6" />
              <p className="text-lg sm:text-xl text-foreground mb-8 leading-relaxed">
                "{testimonials[currentIndex].quote}"
              </p>
              <div>
                <p className="font-semibold text-foreground">{testimonials[currentIndex].author}</p>
                <p className="text-sm text-muted-foreground">{testimonials[currentIndex].role}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex items-center justify-center space-x-4 mt-8">
            <button
              onClick={goToPrevious}
              className="p-2 rounded-full bg-white/80 backdrop-blur-md border border-border/40 hover:bg-primary hover:text-primary-foreground transition-colors"
              aria-label="Témoignage précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? 'w-8 bg-primary'
                      : 'w-2 bg-muted-foreground/30'
                  }`}
                  aria-label={`Aller au témoignage ${index + 1}`}
                />
              ))}
            </div>
            <button
              onClick={goToNext}
              className="p-2 rounded-full bg-white/80 backdrop-blur-md border border-border/40 hover:bg-primary hover:text-primary-foreground transition-colors"
              aria-label="Témoignage suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}








