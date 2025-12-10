import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';
import { BellRing, ShieldCheck, Sparkles } from 'lucide-react';

export default function Hero() {
  const [, setLocation] = useLocation();
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const heroRef = useRef<HTMLElement>(null);

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

  // Glow dynamique basé sur la position de la souris
  const dynamicGlow = useMemo(
    () =>
      `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.3), transparent 50%)`,
    [mousePosition]
  );

  // Parallax pour le hero
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const parallaxY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative overflow-hidden min-h-[90vh] flex items-center pt-20"
      style={{ backgroundColor: 'hsl(var(--bg-page))' }}
    >
      {/* Fond avec gradient */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, hsl(var(--bg-page)) 0%, color-mix(in srgb, hsl(var(--brand-h) var(--brand-s) var(--brand-l)) 8%, hsl(var(--bg-page))) 40%, hsl(var(--bg-page)) 100%)`,
          y: parallaxY,
          opacity,
        }}
      />

      {/* Glow dynamique */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{ background: dynamicGlow }}
      />

      {/* Orbes de glow animés */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-40 -left-32 h-72 w-72 rounded-full blur-3xl pointer-events-none"
        style={{
          background: `radial-gradient(circle, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.25), transparent 60%)`,
        }}
      />
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
        className="absolute -bottom-40 right-0 h-72 w-72 rounded-full blur-3xl pointer-events-none"
        style={{
          background: `radial-gradient(circle, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.18), transparent 60%)`,
        }}
      />

      {/* Overlay pour lisibilité */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, hsl(var(--bg-page) / 0.7) 100%)`,
        }}
      />

      <Container size="xl" className="relative z-10 py-24 lg:py-32">
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            {/* Titre */}
            <div className="space-y-4">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-tight tracking-tight"
                style={{ color: 'hsl(var(--text-main))' }}
              >
                {salonConfig.tagline}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-lg sm:text-xl max-w-2xl leading-relaxed"
                style={{ color: 'hsl(var(--text-muted))' }}
              >
                Réservez votre rendez-vous en ligne en quelques clics. Gestion simplifiée, rappels automatiques, moins de no-show.
              </motion.p>
            </div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-wrap items-center gap-4"
            >
              <Button
                onClick={() => setLocation(salonConfig.cta.href)}
                className="group relative overflow-hidden rounded-full px-8 py-6 text-base font-semibold text-white shadow-lg hover:shadow-xl transition-all"
                style={{
                  backgroundColor: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))',
                  boxShadow: '0 20px 60px hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.35)',
                }}
              >
                <span className="relative z-10">{salonConfig.cta.label}</span>
                <div className="absolute inset-0 bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="grid gap-6 sm:grid-cols-3 pt-4"
            >
              {salonConfig.stats.map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + idx * 0.1, duration: 0.4 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="rounded-2xl border p-4 backdrop-blur-xl"
                  style={{
                    backgroundColor: 'hsla(var(--bg-section) / 0.8)',
                    borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2)',
                  }}
                >
                  <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'hsl(var(--text-muted))' }}>
                    {stat.label}
                  </div>
                  <div className="flex items-center gap-2 text-2xl font-semibold" style={{ color: 'hsl(var(--text-main))' }}>
                    {idx === 0 && <BellRing className="h-4 w-4" style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }} />}
                    {idx === 1 && <ShieldCheck className="h-4 w-4" style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }} />}
                    {idx === 2 && <Sparkles className="h-4 w-4" style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }} />}
                    {stat.value}
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
