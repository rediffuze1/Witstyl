import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Scissors, Menu, X } from 'lucide-react';
import Container from '@/components/ui/Container';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { label: 'Fonctionnalités', href: '#features' },
  { label: 'Comment ça marche', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Horaires', href: '#hours' },
  { label: 'Contact', href: '#contact' },
];

export default function Header() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, userType, owner, client, isHydrating } = useAuthContext();
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Déterminer si l'utilisateur est connecté (propriétaire ou client)
  const userIsAuthenticated = isAuthenticated;
  const isOwner = userType === 'owner';
  const isClient = userType === 'client';
  
  console.log('[Header] Auth state:', { 
    isAuthenticated, 
    userType,
    hasOwner: !!owner,
    hasClient: !!client,
    isOwner,
    isClient,
    userIsAuthenticated 
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16);

      // Détecter la section active
      const sections = navItems.map((item) => item.href.substring(1));
      const currentSection = sections.find((section) => {
        const element = document.getElementById(section);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.top <= 100 && rect.bottom >= 100;
      });
      setActiveSection(currentSection ? `#${currentSection}` : '');
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (href: string) => {
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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/80 backdrop-blur-md border-b border-border/40 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <Container>
        <div className="flex items-center justify-between h-16">
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => setLocation('/')}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <Scissors className="text-white text-sm" />
            </div>
            <span className="text-xl font-bold text-foreground">SalonPilot</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavClick(item.href)}
                className="nav-link-simple text-sm font-medium text-black hover:text-black/80 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {userIsAuthenticated ? (
              <>
                {isOwner ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => setLocation('/dashboard')}
                      className="text-muted-foreground hover:text-primary"
                    >
                      Mon Dashboard
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setLocation('/client-login')}
                      className="text-muted-foreground hover:text-primary"
                    >
                      Espace Client
                    </Button>
                  </>
                ) : (
                  // Afficher "Mon Espace" si c'est un client (même si isClientAuthenticated est false mais qu'on a un client)
                  (isClient || client) && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        console.log('[Header] Redirection vers /client-dashboard');
                        setLocation('/client-dashboard');
                      }}
                      className="text-muted-foreground hover:text-primary"
                    >
                      Mon Espace
                    </Button>
                  )
                )}
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setLocation('/client-login')}
                  className="text-muted-foreground hover:text-primary"
                >
                  Espace Client
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setLocation('/salon-login')}
                  className="text-muted-foreground hover:text-primary"
                >
                  Se connecter
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
          </button>
        </div>
      </Container>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white/95 backdrop-blur-md border-t border-border/40"
          >
            <Container>
              <nav className="py-4 space-y-4">
                {navItems.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => handleNavClick(item.href)}
                    className="nav-link-simple block w-full text-left text-sm font-medium text-black hover:text-black/80 transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
                <div className="pt-4 border-t border-border/40 space-y-2">
                  {userIsAuthenticated ? (
                    <>
                      {isOwner ? (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setLocation('/dashboard');
                              setIsMobileMenuOpen(false);
                            }}
                            className="w-full justify-start"
                          >
                            Mon Dashboard
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setLocation('/client-login');
                              setIsMobileMenuOpen(false);
                            }}
                            className="w-full justify-start"
                          >
                            Espace Client
                          </Button>
                        </>
                      ) : (
                        // Afficher "Mon Espace" si c'est un client
                        isClient && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              console.log('[Header Mobile] Redirection vers /client-dashboard');
                              setLocation('/client-dashboard');
                              setIsMobileMenuOpen(false);
                            }}
                            className="w-full justify-start"
                          >
                            Mon Espace
                          </Button>
                        )
                      )}
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setLocation('/client-login');
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full justify-start"
                      >
                        Espace Client
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setLocation('/salon-login');
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full justify-start"
                      >
                        Se connecter
                      </Button>
                    </>
                  )}
                </div>
              </nav>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

