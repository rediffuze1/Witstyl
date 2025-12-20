import React from 'react';

interface GlowBackgroundProps {
  intensity?: 'subtle' | 'medium' | 'strong';
  position?: 'top' | 'center' | 'bottom' | 'custom';
  customPosition?: { x: number; y: number };
  className?: string;
}

/**
 * Composant pour créer des effets de glow réactifs basés sur --brand-h/s/l
 */
export default function GlowBackground({
  intensity = 'medium',
  position = 'center',
  customPosition,
  className = '',
}: GlowBackgroundProps) {
  const intensityMap = {
    subtle: { opacity: 0.15, blur: 'blur-3xl', size: 'h-64 w-64' },
    medium: { opacity: 0.25, blur: 'blur-3xl', size: 'h-80 w-80' },
    strong: { opacity: 0.35, blur: 'blur-[120px]', size: 'h-96 w-96' },
  };

  const config = intensityMap[intensity];

  const positionMap = {
    top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    custom: customPosition
      ? `top-[${customPosition.y}%] left-[${customPosition.x}%] -translate-x-1/2 -translate-y-1/2`
      : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  };

  return (
    <div
      className={`pointer-events-none absolute ${positionMap[position]} ${config.size} ${config.blur} ${className}`}
      style={{
        background: `radial-gradient(circle at center, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / ${config.opacity}), transparent 70%)`,
      }}
    />
  );
}




