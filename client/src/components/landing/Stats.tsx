import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { Calendar, Bell, BarChart3, CheckCircle, CreditCard } from 'lucide-react';
import { useLocation } from 'wouter';

// Fallback SVG icons si Lottie n'est pas disponible
const FallbackIcon = ({ icon: Icon, className }: { icon: any; className?: string }) => (
  <div className={className}>
    <Icon className="w-full h-full text-primary" />
  </div>
);

interface FeatureCardProps {
  title: string;
  desc: string;
  lottieSrc?: string;
  fallbackIcon: any;
  delay?: number;
}

function FeatureCard({ title, desc, fallbackIcon, delay = 0 }: FeatureCardProps) {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      whileInView={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover={prefersReducedMotion ? {} : { y: -4 }}
      className="bg-white/80 backdrop-blur-md border border-border/40 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow duration-300"
    >
      {/* Animation area */}
      <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
        <FallbackIcon icon={fallbackIcon} className="w-10 h-10" />
      </div>
      <h4 className="text-xl font-semibold text-foreground mb-3">{title}</h4>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </motion.div>
  );
}

function OfferCard() {
  const [, setLocation] = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scroll-based parallax + scale
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const translateY = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : [20, -10]);
  const scale = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [1, 1] : [0.98, 1.03]);

  const handleCTAClick = () => {
    const target = document.getElementById('contact');
    if (target) {
      const lenis = (window as any).lenis;
      if (lenis) {
        lenis.scrollTo(target, { offset: -80, duration: 1.5 });
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <motion.div
      ref={ref}
      style={{
        translateY: prefersReducedMotion ? 0 : translateY,
        scale: prefersReducedMotion ? 1 : scale,
      }}
      animate={
        prefersReducedMotion
          ? {}
          : {
              y: [0, -6, 0],
            }
      }
      transition={
        prefersReducedMotion
          ? {}
          : {
              y: {
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            }
      }
      className="relative mt-12 overflow-hidden rounded-3xl"
    >
      {/* Pastel moving background */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-200/40 via-purple-200/40 to-blue-200/40 animate-pastel-gradient" />
      <div className="absolute inset-0 bg-gradient-to-tl from-yellow-200/30 via-pink-200/30 to-purple-200/30 animate-pastel-gradient-reverse" />

      {/* Content */}
      <div className="relative bg-white/60 backdrop-blur-md border border-border/40 rounded-3xl p-8 sm:p-12">
        <div className="text-center max-w-3xl mx-auto">
          <Reveal delay={0.2}>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Essai gratuit 14 jours
            </h3>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="text-lg text-muted-foreground mb-6">
              Testez SalonPilot sans engagement. Aucune carte bancaire requise.
            </p>
          </Reveal>

          {/* Badges */}
          <Reveal delay={0.4}>
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-border/40">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Sans CB</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-border/40">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Annulable à tout moment</span>
              </div>
            </div>
          </Reveal>

          {/* CTA Button */}
          <Reveal delay={0.5}>
            <motion.button
              onClick={handleCTAClick}
              whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
              className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Commencer gratuitement
            </motion.button>
          </Reveal>
        </div>
      </div>
    </motion.div>
  );
}

const features = [
  {
    title: 'Réservez + vite',
    desc: 'Formulaire ultra-léger : 3 clics suffisent pour réserver.',
    fallbackIcon: Calendar,
  },
  {
    title: 'Rappelez + facilement',
    desc: 'SMS/Email automatiques pour réduire les annulations.',
    fallbackIcon: Bell,
  },
  {
    title: 'Gérez + simplement',
    desc: 'Tableau de bord clair, suivi des RDV et performances.',
    fallbackIcon: BarChart3,
  },
];

export default function Stats() {
  return null;
}
