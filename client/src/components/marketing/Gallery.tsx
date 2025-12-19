import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';

export default function Gallery() {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Images par défaut si aucune image n'est configurée
  const defaultImages = [
    {
      src: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&h=800&fit=crop",
      alt: "Espace d'accueil moderne du salon"
    },
    {
      src: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&h=800&fit=crop",
      alt: "Cabine de coiffure professionnelle"
    },
    {
      src: "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1200&h=800&fit=crop",
      alt: "Espace de travail élégant"
    },
    {
      src: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&h=800&fit=crop",
      alt: "Salle d'attente confortable"
    }
  ];
  
  const images = salonConfig.galleryImages && salonConfig.galleryImages.length > 0 
    ? salonConfig.galleryImages 
    : defaultImages;

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
  };

  // Auto-play du carrousel toutes les 5 secondes
  useEffect(() => {
    if (images.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <section
      id="gallery"
      className="relative py-12 sm:py-16 md:py-20 lg:py-24 xl:py-32"
      style={{ backgroundColor: 'hsl(var(--bg-page))' }}
    >
      <Container className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 md:mb-16 px-4 sm:px-0"
        >
          <h2
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold mb-3 sm:mb-4"
            style={{ color: 'hsl(var(--text-main))' }}
          >
            Le Salon
          </h2>
          <p className="text-sm sm:text-base md:text-lg" style={{ color: 'hsl(var(--text-muted))' }}>
            Découvrez notre espace moderne et accueillant
          </p>
        </motion.div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-0">
          {/* Carrousel */}
          <div className="relative h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
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
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full backdrop-blur-md transition-all hover:scale-110 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  style={{
                    backgroundColor: 'hsla(var(--bg-section) / 0.9)',
                    color: 'hsl(var(--text-main))',
                  }}
                  aria-label="Image précédente"
                >
                  <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>

                <button
                  onClick={nextImage}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full backdrop-blur-md transition-all hover:scale-110 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  style={{
                    backgroundColor: 'hsla(var(--bg-section) / 0.9)',
                    color: 'hsl(var(--text-main))',
                  }}
                  aria-label="Image suivante"
                >
                  <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
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
            <div className="flex justify-center gap-2 mt-4 sm:mt-6">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToImage(index)}
                  className={`h-2 rounded-full transition-all min-h-[8px] ${
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




