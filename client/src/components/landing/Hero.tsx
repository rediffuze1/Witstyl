import { useLocation } from 'wouter';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Container from '@/components/ui/Container';
import { ShieldCheck, BellRing } from 'lucide-react';

const floatingHighlights = [
  { label: 'Rappels SMS envoyés', value: '1 200+', icon: BellRing },
  { label: 'Taux de no-show', value: '-34%', icon: ShieldCheck },
  { label: 'Clients fidèles', value: '4,9 ★', icon: ShieldCheck },
];


export default function Hero() {
  const [, setLocation] = useLocation();
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({
        x: (event.clientX / window.innerWidth) * 100,
        y: (event.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Glow très discret basé sur la position de la souris
  const subtleGlow = useMemo(() => {
    const glowX = Math.min(95, Math.max(5, mousePosition.x));
    const glowY = Math.min(95, Math.max(5, mousePosition.y));
    return `radial-gradient(circle at ${glowX}% ${glowY}%, var(--lp-glow-subtle), transparent 60%)`;
  }, [mousePosition]);

  return (
    <section
      id="hero"
      className="relative overflow-hidden pt-32 pb-20 lg:pt-36 lg:pb-32"
      style={{ backgroundColor: 'var(--lp-bg-page)' }}
    >
      {/* Glow très discret en arrière-plan */}
      <div
        className="absolute inset-0 -z-10 opacity-40 pointer-events-none"
        style={{
          background: subtleGlow,
        }}
      />

      {/* Animated blur gradient - très discret */}
      <div
        className="absolute inset-y-0 left-1/2 w-[60vw] -translate-x-1/2 blur-[120px] opacity-20 -z-10 pointer-events-none"
        style={{
          background: `var(--lp-brand-gradient)`,
        }}
      />

      <Container size="xl" className="relative z-10">
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-tight tracking-tight"
                style={{ color: 'var(--lp-text-main)' }}
              >
                Pilote ton salon de coiffure avec
                <span className="block brand-gradient-text mt-2">
                  un cockpit tout-en-un
                </span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="mt-6 text-base sm:text-lg max-w-2xl leading-relaxed"
                style={{ color: 'var(--lp-text-muted)' }}
              >
                SalonPilot synchronise les réservations, les rappels SMS et la relation client dans une expérience glassmorphism inspirée de ton dashboard.
                Moins de no-show, plus de créneaux remplis.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button
                onClick={() => setLocation('/salon-login')}
                className="group relative overflow-hidden rounded-full px-8 py-6 text-base font-semibold text-white brand-button"
              >
                <span className="relative z-10">Commencer gratuitement</span>
                <div className="absolute inset-0 bg-white/15 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setLocation('/book')}
                className="rounded-full px-8 py-6 text-base brand-button-outline"
              >
                Voir la démo
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="grid gap-6 sm:grid-cols-3"
            >
              {floatingHighlights.map((item, idx) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + idx * 0.1, duration: 0.4 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="glass-panel p-4"
                >
                  <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--lp-text-muted)' }}>
                    {item.label}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-2xl font-semibold" style={{ color: 'var(--lp-text-main)' }}>
                    <item.icon className="h-4 w-4" style={{ color: 'var(--brand-color)' }} />
                    {item.value}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
