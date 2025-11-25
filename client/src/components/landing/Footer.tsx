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
    <footer className="bg-foreground text-white py-16">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Company Info */}
          <Reveal direction="up">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                  <Scissors className="text-white text-sm" />
                </div>
                <span className="text-xl font-bold">SalonPilot</span>
              </div>
              <p className="text-gray-300 mb-6 max-w-md leading-relaxed">
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
                    className="text-gray-400 hover:text-primary transition-colors"
                    aria-label={social.label}
                  >
                    <social.icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.3}>
          <div className="border-t border-gray-700 mt-12 pt-8 text-center">
            <p className="text-gray-400">
              © {new Date().getFullYear()} SalonPilot. Tous droits réservés.
            </p>
          </div>
        </Reveal>
      </Container>
    </footer>
  );
}








