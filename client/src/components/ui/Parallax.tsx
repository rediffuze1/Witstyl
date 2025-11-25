import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  offset?: number;
}

export default function Parallax({ children, className, speed = 0.5, offset = 0 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(0);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion || !ref.current || typeof window === 'undefined') return;

    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      const windowHeight = window.innerHeight;

      const scrolled = window.scrollY - elementTop + windowHeight;
      const parallaxValue = scrolled * speed + offset;

      setTransform(parallaxValue);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial call

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [speed, offset, prefersReducedMotion]);

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        transform: prefersReducedMotion ? undefined : `translateY(${transform}px)`,
      }}
    >
      {children}
    </div>
  );
}








