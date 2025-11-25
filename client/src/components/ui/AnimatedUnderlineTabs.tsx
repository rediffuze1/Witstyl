import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Interface pour les onglets
export interface Tab {
  id: string;
  label: string;
}

// Props pour AnimatedUnderlineTabs
interface AnimatedUnderlineTabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  orientation?: "horizontal" | "vertical";
}

// Props pour TabPanel
export interface TabPanelProps {
  id: string;
  value: string;
  children: React.ReactNode;
  className?: string;
}

// Hook pour détecter le mouvement réduit
function useReducedMotionHook() {
  return useReducedMotion();
}

// Composant principal AnimatedUnderlineTabs
export default function AnimatedUnderlineTabs({
  tabs,
  value,
  onChange,
  children,
  className,
  orientation = "horizontal",
}: AnimatedUnderlineTabsProps) {
  const shouldReduceMotion = useReducedMotionHook();
  const [focusedTabIndex, setFocusedTabIndex] = React.useState<number | null>(null);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartX = React.useRef(0);
  const dragThreshold = 50; // Seuil de glissement en pixels

  // Trouver l'index de l'onglet actif
  const activeIndex = tabs.findIndex((tab) => tab.id === value);
  const activeTab = tabs[activeIndex];

  // Gestion du clavier
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (orientation === "vertical") return;

    let newIndex = currentIndex;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      case "ArrowRight":
        e.preventDefault();
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case "Home":
        e.preventDefault();
        newIndex = 0;
        break;
      case "End":
        e.preventDefault();
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const newTab = tabs[newIndex];
    if (newTab) {
      onChange(newTab.id);
      setFocusedTabIndex(newIndex);
      // Focus sur le nouvel onglet après un court délai
      setTimeout(() => {
        tabRefs.current[newIndex]?.focus();
      }, 0);
    }
  };

  // Gestion du glissement mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (shouldReduceMotion) return;
    dragStartX.current = e.touches[0].clientX;
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (shouldReduceMotion) return;
    const deltaX = e.touches[0].clientX - dragStartX.current;
    if (Math.abs(deltaX) > 10) {
      setIsDragging(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (shouldReduceMotion || !isDragging) return;
    const deltaX = e.changedTouches[0].clientX - dragStartX.current;

    if (Math.abs(deltaX) > dragThreshold) {
      if (deltaX > 0 && activeIndex > 0) {
        // Glissement vers la droite -> onglet précédent
        onChange(tabs[activeIndex - 1].id);
      } else if (deltaX < 0 && activeIndex < tabs.length - 1) {
        // Glissement vers la gauche -> onglet suivant
        onChange(tabs[activeIndex + 1].id);
      }
    }

    setIsDragging(false);
  };

  // Transitions pour l'animation
  const underlineTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 38 };

  const highlightTransition = underlineTransition;

  return (
    <div
      className={cn("w-full", className)}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Barre d'onglets */}
      <div
        role="tablist"
        aria-orientation={orientation}
        className={cn(
          "relative flex",
          orientation === "horizontal" ? "flex-row" : "flex-col",
          "border-b border-border/40",
          "mb-6"
        )}
      >
        {/* Highlight pill (fond doux derrière l'onglet actif) */}
        {activeTab && (
          <motion.div
            layoutId="tabs-highlight"
            className="absolute inset-y-1 rounded-xl bg-indigo-500/8 dark:bg-indigo-400/10"
            transition={highlightTransition}
            aria-hidden="true"
            style={{
              zIndex: 0,
            }}
          />
        )}

        {/* Onglets */}
        {tabs.map((tab, index) => {
          const isActive = tab.id === value;
          const panelId = `tabpanel-${tab.id}`;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onFocus={() => setFocusedTabIndex(index)}
              onBlur={() => setFocusedTabIndex(null)}
              className={cn(
                "relative z-10 px-4 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}

        {/* Underline animé */}
        {activeTab && (
          <motion.span
            layoutId="tabs-underline"
            className="absolute bottom-0 h-0.5 rounded bg-indigo-500 dark:bg-indigo-400"
            transition={underlineTransition}
            aria-hidden="true"
            style={{
              zIndex: 1,
            }}
          />
        )}
      </div>

      {/* Panneaux de contenu avec transitions de layout fluides */}
      <motion.div
        role="tabpanels"
        className="relative"
        layout
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        style={{ minHeight: "200px" }} // Réserver de l'espace pour éviter les décalages
      >
        {shouldReduceMotion ? (
          // Sans animation, afficher directement le contenu
          React.Children.toArray(children).find(
            (child) =>
              React.isValidElement<TabPanelProps>(child) && child.props.id === value
          )
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {React.Children.toArray(children).map((child) => {
              if (React.isValidElement<TabPanelProps>(child) && child.props.id === value) {
                return (
                  <motion.div
                    key={value}
                    layout
                    layoutId={`tabpanel-${value}`}
                    initial={false} // Pas d'animation initiale pour éviter le flicker
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{
                      opacity: 1, // Garder l'opacité à 1 lors de la sortie pour éviter le flicker
                      y: 0, // Pas de mouvement vertical lors de la sortie
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 35,
                      opacity: { duration: 0.1 }, // Animation très rapide pour éviter le flicker
                    }}
                    style={{
                      willChange: 'opacity, transform',
                      // S'assurer que le contenu reste visible
                      visibility: 'visible',
                      display: 'block',
                      opacity: 1 // Opacité par défaut à 1
                    }}
                  >
                    {child}
                  </motion.div>
                );
              }
              return null;
            })}
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
}

// Composant TabPanel
export function TabPanel({ id, value, children, className }: TabPanelProps) {
  const shouldReduceMotion = useReducedMotionHook();
  const isActive = id === value;
  const tabId = `tab-${id}`;
  const panelId = `tabpanel-${id}`;

  if (!isActive) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={0}
      className={cn("outline-none", className)}
    >
      {children}
    </div>
  );
}

