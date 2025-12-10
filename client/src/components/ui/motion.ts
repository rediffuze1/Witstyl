/**
 * Helpers d'animation Framer Motion
 * Inspirés de xtract.framer.ai pour des transitions fluides et progressives
 */

import { motion, Variants, Transition } from 'framer-motion';

// Variants pour les animations de révélation progressive
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// Transition par défaut (inspirée de xtract)
export const defaultTransition: Transition = {
  duration: 0.6,
  ease: [0.22, 1, 0.36, 1], // Easing personnalisé pour fluidité
};

export const fastTransition: Transition = {
  duration: 0.4,
  ease: [0.22, 1, 0.36, 1],
};

export const slowTransition: Transition = {
  duration: 0.9,
  ease: [0.22, 1, 0.36, 1],
};

// Variants pour parallax (effet de profondeur)
export const parallaxVariants = {
  initial: { y: 0, opacity: 0.8 },
  animate: (offset: number) => ({
    y: offset,
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

// Variants pour les cartes glassmorphism avec hover
export const glassCardVariants: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: defaultTransition,
  },
  hover: {
    y: -4,
    scale: 1.01,
    transition: { duration: 0.3 },
  },
};

// Variants pour les sections avec reveal progressif
export const sectionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

// Variants pour timeline (step by step)
export const timelineItemVariants: Variants = {
  hidden: { opacity: 0, x: -30, scale: 0.9 },
  visible: (index: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      delay: index * 0.15,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

// Variants pour FAQ (accordion)
export const faqVariants: Variants = {
  closed: {
    height: 0,
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  open: {
    height: 'auto',
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// Composant wrapper pour les animations de section
export const MotionSection = motion.section;
export const MotionDiv = motion.div;
export const MotionH2 = motion.h2;
export const MotionP = motion.p;

// Note: useScroll doit être importé directement depuis framer-motion dans les composants
// export const useScrollProgress = () => {
//   return {
//     scrollYProgress: useScroll().scrollYProgress,
//   };
// };

