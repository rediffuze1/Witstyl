import React from 'react';
import { motion } from 'framer-motion';

interface GradientOrbProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  intensity?: number; // 0-1
  position?: { x: number; y: number };
  animate?: boolean;
  className?: string;
}

/**
 * Composant pour créer des orbes de gradient animés réactifs à la couleur de marque
 */
export default function GradientOrb({
  size = 'md',
  intensity = 0.2,
  position,
  animate = true,
  className = '',
}: GradientOrbProps) {
  const sizeMap = {
    sm: 'h-32 w-32',
    md: 'h-48 w-48',
    lg: 'h-64 w-64',
    xl: 'h-96 w-96',
  };

  const blurMap = {
    sm: 'blur-2xl',
    md: 'blur-3xl',
    lg: 'blur-[100px]',
    xl: 'blur-[120px]',
  };

  const style: React.CSSProperties = {
    background: `radial-gradient(circle at center, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / ${intensity}), transparent 70%)`,
  };

  if (position) {
    style.left = `${position.x}%`;
    style.top = `${position.y}%`;
    style.transform = 'translate(-50%, -50%)';
  }

  const content = (
    <div
      className={`absolute ${sizeMap[size]} ${blurMap[size]} rounded-full ${className}`}
      style={style}
    />
  );

  if (animate) {
    return (
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [intensity, intensity * 1.2, intensity],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="pointer-events-none"
      >
        {content}
      </motion.div>
    );
  }

  return <div className="pointer-events-none">{content}</div>;
}



