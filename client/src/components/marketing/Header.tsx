import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Scissors, Menu, X, Sparkles } from 'lucide-react';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';
import { useSalonData } from '@/hooks/useSalonData';
import { useAuthContext } from '@/contexts/AuthContext';

const navItems = [
  { label: 'Le salon', href: '#gallery' },
  { label: 'Services', href: '#services' },
  { label: 'Avis', href: '#reviews' },
  { label: 'Équipe', href: '#team' },
  { label: 'Horaires', href: '#hours' },
  { label: 'Nous trouver', href: '#location' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
];

export default function Header() {
  const [, setLocation] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: salonData } = useSalonData();
  const { isAuthenticated, userType, isLoading: isAuthLoading } = useAuthContext();

  // Utiliser les données du salon depuis l'API, avec fallback sur la config
  const salonName = salonData?.salon?.name || salonConfig.name;
  
  // Déterminer si l'utilisateur est un propriétaire (owner)
  const isOwner = userType === 'owner';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (href: string) => {
    setIsMobileMenuOpen(false);
    if (href.startsWith('#')) {
      const target = document.querySelector(href);
      if (target) {
        const lenis = (window as any).lenis;
        if (lenis) {
          lenis.scrollTo(target, { offset: -80, duration: 1.5 });
        } else {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } else {
      setLocation(href);
    }
  };

  const openChatbot = () => {
    // Déclencher l'événement personnalisé pour ouvrir le chatbot
    window.dispatchEvent(new CustomEvent('openChatbot'));
  };

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'backdrop-blur-md border-b shadow-lg'
            : 'backdrop-blur-sm'
        }`}
        style={{
          backgroundColor: isScrolled
            ? 'hsla(var(--bg-section) / 0.85)'
            : 'hsla(var(--bg-section) / 0.6)',
          borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1)',
          boxShadow: isScrolled
            ? '0 8px 32px hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1)'
            : 'none',
        }}
      >
        <Container>
          <div className={`flex items-center justify-between transition-all duration-300 ${isScrolled ? 'h-14 sm:h-16' : 'h-16 sm:h-20'}`}>
            {/* Logo + Nom du salon */}
            <button
              onClick={() => {
                const hero = document.getElementById('hero');
                if (hero) {
                  const lenis = (window as any).lenis;
                  if (lenis) {
                    lenis.scrollTo(0, { duration: 1 });
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                } else {
                  setLocation('/');
                }
              }}
              className="flex items-center gap-2 sm:gap-3 group"
            >
              <div
                className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl transition-transform group-hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
                }}
              >
                <Scissors className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span
                  className="text-base sm:text-lg font-bold leading-tight transition-colors"
                  style={{ color: 'hsl(var(--text-main))' }}
                >
                  Witstyl
                </span>
                <span
                  className="text-[10px] sm:text-xs leading-tight transition-colors hidden sm:block"
                  style={{ color: 'hsl(var(--text-muted))' }}
                >
                  {salonName}
                </span>
              </div>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => scrollToSection(item.href)}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-all hover:scale-105"
                  style={{
                    color: 'hsl(var(--text-main))',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-2 xl:gap-3">
              {/* Bouton IA */}
              <Button
                onClick={openChatbot}
                className="rounded-full px-3 xl:px-4 py-2 text-xs xl:text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  color: '#000000',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                }}
              >
                <Sparkles className="h-3 w-3 xl:h-4 xl:w-4 mr-1 xl:mr-2" style={{ color: '#000000' }} />
                <span className="hidden xl:inline">Parler avec l'IA</span>
                <span className="xl:hidden">IA</span>
              </Button>

              {isAuthenticated && isOwner ? (
                <Button
                  onClick={() => setLocation('/dashboard')}
                  className="rounded-full px-4 xl:px-6 py-2 text-xs xl:text-sm font-medium text-white shadow-lg hover:shadow-xl transition-all"
                  style={{
                    backgroundColor: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))',
                    boxShadow: '0 4px 16px hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.3)',
                  }}
                >
                  Dashboard
                </Button>
              ) : (
                <Button
                  onClick={() => setLocation('/salon-login')}
                  className="rounded-full px-4 xl:px-6 py-2 text-xs xl:text-sm font-medium text-white shadow-lg hover:shadow-xl transition-all"
                  style={{
                    backgroundColor: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))',
                    boxShadow: '0 4px 16px hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.3)',
                  }}
                >
                  Connexion
                </Button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              style={{
                color: 'hsl(var(--text-main))',
              }}
              aria-label="Menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : (
                <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </button>
          </div>
        </Container>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 w-80 p-6 lg:hidden overflow-y-auto"
              style={{
                backgroundColor: 'hsl(var(--bg-section))',
                borderLeft: '1px solid hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1)',
                boxShadow: '-4px 0 24px hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1)',
              }}
            >
              <div className="flex flex-col h-full">
                {/* Header du menu mobile */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
                      }}
                    >
                      <Scissors className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold" style={{ color: 'hsl(var(--text-main))' }}>
                        Witstyl
                      </div>
                      <div className="text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
                        {salonName}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg"
                    style={{ color: 'hsl(var(--text-main))' }}
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Navigation mobile */}
                <nav className="flex-1 space-y-2">
                  {navItems.map((item, index) => (
                    <motion.button
                      key={item.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      onClick={() => scrollToSection(item.href)}
                      className="w-full px-4 py-3 text-left rounded-lg transition-colors"
                      style={{
                        color: 'hsl(var(--text-main))',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {item.label}
                    </motion.button>
                  ))}
                </nav>

                {/* Actions mobile */}
                <div className="mt-8 space-y-3 pt-8 border-t" style={{ borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1)' }}>
                  {/* Bouton IA mobile */}
                  <Button
                    onClick={() => {
                      openChatbot();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full rounded-full font-medium"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      color: '#000000',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" style={{ color: '#000000' }} />
                    Parler avec l'IA
                  </Button>

                  {isAuthenticated && isOwner ? (
                    <Button
                      onClick={() => {
                        setLocation('/dashboard');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full rounded-full text-white font-medium"
                      style={{
                        backgroundColor: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))',
                      }}
                    >
                      Mon dashboard
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setLocation('/salon-login');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full rounded-full text-white font-medium"
                      style={{
                        backgroundColor: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))',
                      }}
                    >
                      Se connecter
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
