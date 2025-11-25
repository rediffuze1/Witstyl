import { ReactNode, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
  threshold?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  stagger?: number;
}

const directions = {
  up: { initial: { y: 24, opacity: 0 }, animate: { y: 0, opacity: 1 } },
  down: { initial: { y: -24, opacity: 0 }, animate: { y: 0, opacity: 1 } },
  left: { initial: { x: 24, opacity: 0 }, animate: { x: 0, opacity: 1 } },
  right: { initial: { x: -24, opacity: 0 }, animate: { x: 0, opacity: 1 } },
};

export default function Reveal({
  children,
  className,
  delay = 0,
  once = true,
  threshold = 0.1,
  direction = 'up',
  stagger = 0,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    // Vérifier après un court délai pour laisser le DOM se stabiliser
    const initialTimer = setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;

      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      
      if (isVisible) {
        // Si l'élément est déjà visible, activer l'animation immédiatement
        setIsInView(true);
        setShouldAnimate(true);
      } else {
        // Si l'élément n'est pas visible, activer l'animation au scroll
        setShouldAnimate(true);
      }
    }, 50);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setIsInView(false);
        }
      },
      {
        threshold,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      clearTimeout(initialTimer);
      observer.disconnect();
    };
  }, [once, threshold]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Toujours rendre le contenu, même si l'animation n'est pas encore prête
  // Utiliser initial={false} pour éviter le flash blanc
  if (prefersReducedMotion || !shouldAnimate) {
    return (
      <div ref={ref} className={cn(className)} style={{ opacity: 1 }}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={false} // Pas d'animation initiale pour éviter le flash blanc
      animate={isInView ? directions[direction].animate : { opacity: 1, y: 0, x: 0 }} // Toujours visible même si pas encore animé
      transition={{
        duration: 0.7,
        delay: delay + stagger,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(className)}
      style={{ 
        // S'assurer que le contenu est toujours visible
        opacity: 1,
        willChange: 'opacity, transform'
      }}
    >
      {children}
    </motion.div>
  );
}

