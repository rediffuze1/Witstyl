import { motion, useReducedMotion } from "framer-motion";
import { ReactNode, useEffect, useRef } from "react";
import { useLocation } from "wouter";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Composant de transition de page optimisé pour éviter le flicker
 * - Pas d'opacity:0 initial sur le container racine
 * - Animation enter subtile uniquement
 * - Pas d'animation exit pour garder le contenu visible
 * - Utilise layoutId pour des transitions fluides
 */
export default function PageTransition({ children, className }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();

  // Scroll to top et focus sur le h1 lors du changement de page
  useEffect(() => {
    // Ne pas masquer la page pendant le scroll
    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? "auto" : "smooth" });

    // Focus sur le h1 après un court délai
    const timer = setTimeout(() => {
      const h1 = containerRef.current?.querySelector("h1");
      if (h1) {
        h1.setAttribute("tabindex", "-1");
        h1.focus();
        // Retirer le focus après un court instant pour éviter l'outline persistant
        setTimeout(() => {
          if (document.activeElement === h1) {
            h1.blur();
          }
        }, 300);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [location, shouldReduceMotion]);

  // Pas d'animation si mouvement réduit
  if (shouldReduceMotion) {
    return (
      <div ref={containerRef} className={className} style={{ opacity: 1 }}>
        {children}
      </div>
    );
  }

  // Animation enter subtile uniquement - pas d'exit pour garder le contenu visible
  // Utiliser layoutId pour des transitions fluides sans flicker
  // IMPORTANT: Ne jamais utiliser initial={{ opacity: 0 }} car cela cause un flicker
  return (
    <motion.div
      key={location}
      ref={containerRef}
      layoutId={`page-${location}`}
      initial={false} // Pas d'animation initiale pour éviter le flicker au mount
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }} // Garder l'opacité à 1 lors de la sortie
      transition={{ 
        duration: 0.15, // Animation très rapide
        ease: "easeOut",
        opacity: { duration: 0.1 } // Animation d'opacité encore plus rapide
      }}
      className={className}
      style={{ 
        willChange: 'opacity',
        // S'assurer que le contenu est toujours visible
        visibility: 'visible',
        display: 'block',
        opacity: 1 // Opacité par défaut à 1 pour éviter tout flash
      }}
    >
      {children}
    </motion.div>
  );
}

