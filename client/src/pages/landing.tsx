import { useEffect } from 'react';
import { initLenis, destroyLenis } from '@/lib/lenis';
import Header from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import Features from '@/components/landing/Features';
import Steps from '@/components/landing/Steps';
import DashboardShowcase from '@/components/landing/DashboardShowcase';
import Stats from '@/components/landing/Stats';
import FAQ from '@/components/landing/FAQ';
import Hours from '@/components/landing/Hours';
import Contact from '@/components/landing/Contact';
import Booking from '@/components/landing/Booking';
import Footer from '@/components/landing/Footer';
import SEO from '@/components/SEO';
import FloatingChatbot from '@/components/floating-chatbot';

export default function Landing() {
  useEffect(() => {
    // Initialize Lenis smooth scroll après un court délai pour laisser le DOM se stabiliser
    const timer = setTimeout(() => {
      const lenis = initLenis();
      (window as any).lenis = lenis;
    }, 100);

    return () => {
      clearTimeout(timer);
      destroyLenis();
    };
  }, []);

  return (
    <>
      <SEO />
      <div className="min-h-screen bg-background text-foreground antialiased overflow-x-hidden">
        <Header />
        <main className="overflow-x-hidden">
          {/* Tous les composants sont rendus immédiatement, pas de lazy loading */}
          <Hero />
          <Features />
          <Steps />
          <DashboardShowcase />
          <Stats />
          <Booking />
          <FAQ />
          <Hours />
          <Contact />
        </main>
        <Footer />
        <FloatingChatbot />
      </div>
    </>
  );
}
