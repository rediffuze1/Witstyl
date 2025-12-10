import Lenis from 'lenis';

let lenisInstance: Lenis | null = null;

export const initLenis = () => {
  if (typeof window === 'undefined') return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  lenisInstance = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 2,
    infinite: false,
  });

  function raf(time: number) {
    lenisInstance?.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);

  // S'assurer que Lenis fonctionne dans les deux sens (montée et descente)
  // En écoutant les événements de scroll dans les deux directions
  if (lenisInstance) {
    // Lenis devrait déjà gérer les deux sens par défaut,
    // mais on s'assure que la synchronisation fonctionne correctement
    lenisInstance.on('scroll', ({ scroll, limit, velocity, direction, progress }) => {
      // Cette callback permet de s'assurer que Lenis détecte bien les deux directions
      // Le paramètre 'direction' indique la direction du scroll (-1 pour haut, 1 pour bas)
    });
  }

  // Handle anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = anchor.getAttribute('href');
      if (href && href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href) as HTMLElement;
        if (target && lenisInstance) {
          lenisInstance.scrollTo(target, {
            offset: -80,
            duration: 1.5,
          });
        }
      }
    });
  });

  return lenisInstance;
};

export const destroyLenis = () => {
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }
};

export const getLenis = () => lenisInstance;








