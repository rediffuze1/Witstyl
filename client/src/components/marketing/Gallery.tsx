import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';

export default function Gallery() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const images = salonConfig.galleryImages || [];

  if (images.length === 0) {
    return null;
  }

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <section
      id="gallery"
      className="relative py-24 sm:py-28 lg:py-32"
      style={{ backgroundColor: 'hsl(var(--bg-page))' }}
    >
      <Container className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-4"
            style={{ color: 'hsl(var(--text-main))' }}
          >
            Découvrez notre salon
          </h2>
          <p className="text-lg" style={{ color: 'hsl(var(--text-muted))' }}>
            Un espace moderne et accueillant pour votre confort
          </p>
        </motion.div>

        <div className="relative max-w-5xl mx-auto">
          {/* Carrousel */}
          <div className="relative h-[400px] sm:h-[500px] lg:h-[600px] rounded-3xl overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentIndex}
                src={images[currentIndex].src}
                alt={images[currentIndex].alt}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5 }}
                className="w-full h-full object-cover"
              />
            </AnimatePresence>

            {/* Navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full backdrop-blur-md transition-all hover:scale-110"
                  style={{
                    backgroundColor: 'hsla(var(--bg-section) / 0.8)',
                    color: 'hsl(var(--text-main))',
                  }}
                  aria-label="Image précédente"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>

                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full backdrop-blur-md transition-all hover:scale-110"
                  style={{
                    backgroundColor: 'hsla(var(--bg-section) / 0.8)',
                    color: 'hsl(var(--text-main))',
                  }}
                  aria-label="Image suivante"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Glow autour de l'image */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at center, transparent 0%, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1) 100%)`,
              }}
            />
          </div>

          {/* Bullets / Pagination */}
          {images.length > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToImage(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentIndex ? 'w-8' : 'w-2'
                  }`}
                  style={{
                    backgroundColor:
                      index === currentIndex
                        ? 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))'
                        : 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.3)',
                  }}
                  aria-label={`Aller à l'image ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}


