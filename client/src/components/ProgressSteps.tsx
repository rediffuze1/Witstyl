import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Composant de barre d'avancement animée inspirée de Linear's Import Assistant
 * 
 * @param totalSteps - Nombre total d'étapes (ex: 4)
 * @param currentStep - Étape actuelle (1..totalSteps)
 * @param labels - Labels optionnels pour chaque étape
 * @param discrete - Si true (défaut), affiche uniquement les pastilles. Si false, ajoute une barre continue
 * @param onAnimateStep - Callback optionnel déclenché lors du changement d'étape (from, to)
 * 
 * @example
 * ```tsx
 * <ProgressSteps 
 *   totalSteps={4} 
 *   currentStep={2} 
 *   labels={["Service", "Styliste", "Date", "Informations"]}
 * />
 * ```
 * 
 * Accessibilité:
 * - Utilise `aria-current="step"` sur la pastille active
 * - Inclut une progressbar cachée avec `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
 * - Texte lisible: "Étape {currentStep} sur {totalSteps}"
 * - Respecte `prefers-reduced-motion`
 */
export interface ProgressStepsProps {
  totalSteps: number;
  currentStep: number;
  labels?: string[];
  discrete?: boolean;
  onAnimateStep?: (from: number, to: number) => void;
  className?: string;
}

export default function ProgressSteps({
  totalSteps,
  currentStep,
  labels,
  discrete = true,
  onAnimateStep,
  className,
}: ProgressStepsProps) {
  const shouldReduceMotion = useReducedMotion();
  const prevStepRef = useRef(currentStep);

  // Clamp currentStep entre 1 et totalSteps
  const clampedStep = Math.max(1, Math.min(currentStep, totalSteps));
  
  // Calculer le pourcentage de progression basé sur l'index 0-based
  // currentStepIndex = 0 pour step 1, 1 pour step 2, etc.
  // progress = (currentStepIndex / (totalSteps - 1)) * 100
  const currentStepIndex = clampedStep - 1; // 0-based index
  const progressPercentage =
    totalSteps > 1 ? (currentStepIndex / (totalSteps - 1)) * 100 : 100;

  // Détecter le changement d'étape et appeler le callback
  useEffect(() => {
    if (prevStepRef.current !== clampedStep && onAnimateStep) {
      onAnimateStep(prevStepRef.current, clampedStep);
    }
    prevStepRef.current = clampedStep;
  }, [clampedStep, onAnimateStep]);

  // Déterminer l'état de chaque étape
  const getStepState = (stepNumber: number): "done" | "active" | "upcoming" => {
    if (stepNumber < clampedStep) return "done";
    if (stepNumber === clampedStep) return "active";
    return "upcoming";
  };

  // Animation pour le glow/dot qui se déplace
  const glowVariants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: {
      opacity: [0, 1, 1, 0],
      scale: [0.8, 1, 1, 0.8],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className={cn("w-full flex flex-col items-center", className)}>
      {/* Progressbar cachée pour l'accessibilité */}
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-valuenow={clampedStep}
        aria-label={`Étape ${clampedStep} sur ${totalSteps}`}
        className="sr-only"
      />

      {/* Conteneur principal avec ligne de progression */}
      <div className="relative w-full max-w-4xl mx-auto">
        {/* Liste des étapes - utilise justify-between pour espacer uniformément */}
        <ol
          aria-label="Progrès de la réservation"
          className="relative flex items-center justify-between w-full px-5"
        >
          {Array.from({ length: totalSteps }, (_, index) => {
            const stepNumber = index + 1;
            const state = getStepState(stepNumber);
            const isDone = state === "done";
            const isActive = state === "active";
            const isUpcoming = state === "upcoming";
            const label =
              labels && labels.length === totalSteps ? labels[index] : undefined;

            return (
              <li
                key={stepNumber}
                className="relative flex flex-col items-center flex-1 z-10"
              >
                {/* Pastille - taille fixe w-10 h-10, border-2 pour tous les états (même taille) */}
                <div className="relative flex-shrink-0">
                  <motion.div
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors border-2",
                      isDone && "bg-primary text-primary-foreground border-primary",
                      isActive && "bg-primary text-primary-foreground border-primary shadow-lg",
                      isUpcoming && "bg-background border-muted text-muted-foreground"
                    )}
                    initial={false}
                    animate={
                      isDone && !shouldReduceMotion
                        ? {
                            scale: [1, 1.05, 1],
                          }
                        : {}
                    }
                    transition={{
                      duration: 0.3,
                      ease: "easeOut",
                    }}
                  >
                    {isDone ? (
                      <motion.div
                        initial={false}
                        animate={
                          !shouldReduceMotion
                            ? {
                                scale: [0, 1.2, 1],
                              }
                            : {}
                        }
                        transition={{
                          duration: 0.4,
                          ease: "easeOut",
                        }}
                      >
                        <Check className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      stepNumber
                    )}
                  </motion.div>

                  {/* Effets visuels pour l'étape active */}
                  {isActive && !shouldReduceMotion && (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-full bg-primary/20 -z-10"
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.5, 0.2, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        style={{
                          filter: "blur(8px)",
                        }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full bg-primary -z-10"
                        variants={glowVariants}
                        initial="initial"
                        animate="animate"
                        style={{
                          filter: "blur(4px)",
                          willChange: "transform, opacity",
                        }}
                      />
                    </>
                  )}
                </div>

                {/* Label sous la pastille */}
                {label && (
                  <div className="mt-3 w-full text-center">
                    <span
                      className={cn(
                        "text-xs sm:text-sm transition-colors block leading-snug break-words",
                        isActive && "text-primary font-medium",
                        isDone && "text-primary/70",
                        isUpcoming && "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {/* Ligne de progression - positionnée absolument derrière les ronds */}
        {/* Conteneur pour la ligne : va exactement du centre du premier rond au centre du dernier rond */}
        <div
          className="absolute top-5 pointer-events-none"
          style={{
            left: "2.5rem", // px-5 (1.25rem) + centre du premier rond (w-10/2 = 1.25rem)
            right: "2.5rem", // px-5 (1.25rem) + centre du dernier rond (w-10/2 = 1.25rem)
            height: "0.125rem", // h-0.5 = 2px = 0.125rem
          }}
        >
          {/* Ligne inactive : pleine largeur du conteneur */}
          <div className="absolute inset-0 h-full bg-muted rounded-full" />
          
          {/* Ligne active : largeur basée sur progressPercentage (0-100%) */}
          <motion.div
            className="absolute left-0 top-0 h-full bg-primary rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{
              duration: 0.6,
              ease: "easeInOut",
            }}
            style={{
              willChange: "width",
            }}
          />
        </div>
      </div>

      {/* Barre continue optionnelle */}
      {!discrete && (
        <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{
              duration: 0.6,
              ease: "easeInOut",
            }}
            style={{
              willChange: "width",
            }}
          />
        </div>
      )}

      {/* Texte d'accessibilité */}
      <div className="mt-4 text-sm text-muted-foreground text-center">
        Étape {clampedStep} sur {totalSteps}
      </div>
    </div>
  );
}

