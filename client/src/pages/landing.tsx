import { useEffect } from 'react';
import { initLenis, destroyLenis } from '@/lib/lenis';
import SEO from '@/components/SEO';
import FloatingChatbot from '@/components/floating-chatbot';

// Header
import Header from '@/components/marketing/Header';

// Composants marketing
import Hero from '@/components/marketing/Hero';
import Services from '@/components/marketing/Services';
import Reviews from '@/components/marketing/Reviews';
import Gallery from '@/components/marketing/Gallery';
import Team from '@/components/marketing/Team';
import Hours from '@/components/marketing/Hours';
import SalonMap from '@/components/marketing/SalonMap';
import FAQ from '@/components/marketing/FAQ';
import ContactFooter from '@/components/marketing/ContactFooter';

/**
 * Landing page - Refonte complète
 * - Hero avec CTA "Prendre RDV"
 * - Section Services avec cartes visuelles
 * - Avis clients (Google Reviews - top 5)
 * - Carrousel photos du salon
 * - Carrousel équipe
 * - Horaires clairs
 * - Carte Google Maps
 * - FAQ
 * - Contact & Footer
 * 
 * Design : glow + glassmorphism, animations type xtract.framer.ai
 * Thème : adaptatif avec variables CSS --brand-h/s/l
 */
export default function Landing() {
  useEffect(() => {
    // Initialize Lenis smooth scroll
    const timer = setTimeout(() => {
      const lenis = initLenis();
      if (lenis) {
        (window as any).lenis = lenis;
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      destroyLenis();
    };
  }, []);

  return (
    <>
      <SEO />
      <Header />
      <div
        className="min-h-screen antialiased overflow-x-hidden"
        style={{ backgroundColor: 'hsl(var(--bg-page))', color: 'hsl(var(--text-main))' }}
      >
        {/* 1. Hero avec CTA "Prendre RDV" */}
        <Hero />

        {/* 2. Carrousel photos du salon - Le Salon */}
        <Gallery />

        {/* 3. Section Services */}
        <Services />

        {/* 4. Avis clients (Google Reviews - top 5) */}
        <Reviews />

        {/* 5. Carrousel équipe */}
        <Team />

        {/* 6. Horaires clairs */}
        <Hours />

        {/* 7. Carte Google Maps */}
        <SalonMap />

        {/* 8. FAQ */}
        <FAQ />

        {/* 9. Contact & Footer */}
        <ContactFooter />
      </div>
      <FloatingChatbot />
    </>
  );
}
