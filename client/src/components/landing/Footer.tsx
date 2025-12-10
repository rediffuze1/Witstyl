import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { Scissors, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

const footerLinks = {
  social: [
    { label: 'Facebook', icon: Facebook, href: 'https://www.facebook.com/salonpilot' },
    { label: 'Twitter', icon: Twitter, href: 'https://www.twitter.com/salonpilot' },
    { label: 'Instagram', icon: Instagram, href: 'https://www.instagram.com/salonpilot' },
    { label: 'LinkedIn', icon: Linkedin, href: 'https://www.linkedin.com/company/salonpilot' },
  ],
};

export default function Footer() {
  return (
    <footer className="py-16" style={{ backgroundColor: 'var(--lp-bg-section)', borderTop: '1px solid var(--lp-border-soft)' }}>
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          <Reveal direction="up">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: `var(--lp-brand-gradient)`,
                  }}
                >
                  <Scissors className="text-white text-sm" />
                </div>
                <span className="text-xl font-bold" style={{ color: 'var(--lp-text-main)' }}>SalonPilot</span>
              </div>
              <p className="mb-6 max-w-md leading-relaxed" style={{ color: 'var(--lp-text-muted)' }}>
                La plateforme de réservation intelligente qui révolutionne la gestion des salons de
                coiffure.
              </p>
              <div className="flex space-x-4">
                {footerLinks.social.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:opacity-70"
                    style={{ color: 'var(--lp-text-muted)' }}
                    aria-label={social.label}
                  >
                    <social.icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
        <div className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--lp-border-soft)' }}>
          <p className="text-center text-sm" style={{ color: 'var(--lp-text-subtle)' }}>
            © {new Date().getFullYear()} SalonPilot. Tous droits réservés.
          </p>
        </div>
      </Container>
    </footer>
  );
}
