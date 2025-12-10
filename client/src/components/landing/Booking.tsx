import { Button } from '@/components/ui/button';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useLocation } from 'wouter';

export default function Booking() {
  const [, setLocation] = useLocation();
  const scrollToContact = () => {
    const target = document.getElementById('contact');
    if (target) {
      const lenis = (window as any).lenis;
      if (lenis) {
        lenis.scrollTo(target, { offset: -80, duration: 1.4 });
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <section id="cta" className="relative py-24 sm:py-28 lg:py-32" style={{ backgroundColor: 'var(--lp-bg-section)' }}>
      {/* Glow très discret */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, var(--lp-glow-subtle), transparent 60%)`,
        }}
      />
      <Container className="relative z-10">
        <div className="overflow-hidden glass-panel" style={{ backgroundColor: 'var(--lp-bg-card)' }}>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8 p-10">
              <Reveal>
                <p className="text-sm uppercase tracking-[0.4em] brand-pill">Prêt à décoller ?</p>
              </Reveal>
              <Reveal delay={0.1}>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold" style={{ color: 'var(--lp-text-main)' }}>
                  Pilote ton salon avec la même expérience glow que ton dashboard.
                </h2>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="text-lg" style={{ color: 'var(--lp-text-muted)' }}>
                  L\'accès propriétaire, l\'espace client et l\'IA réceptionniste sont compris. Tu peux inviter ton équipe,
                  ajouter des stylos, et personnaliser la marque selon ton salon.
                </p>
              </Reveal>

              <Reveal delay={0.3}>
                <div className="flex flex-col gap-4 text-sm">
                  {[
                    'Onboarding guidé & migration gratuite',
                    'Support humain (WhatsApp + email)',
                    'Annulation possible à tout moment',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3" style={{ color: 'var(--lp-text-main)' }}>
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--brand-color)' }} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={0.35}>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Button
                    onClick={() => setLocation('/salon-login')}
                    className="h-14 flex-1 rounded-full brand-button"
                  >
                    Essayer gratuitement
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={scrollToContact}
                    className="h-14 flex-1 rounded-full brand-button-outline"
                  >
                    Demander une démo
                  </Button>
                </div>
              </Reveal>
            </div>

            <div
              className="rounded-[36px] p-10 text-white relative overflow-hidden"
              style={{
                background: `var(--lp-brand-gradient)`,
              }}
            >
              {/* Glow très discret */}
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1), transparent 60%)`,
                }}
              />
              <div className="relative z-10">
                <Reveal direction="right">
                  <div className="text-sm uppercase tracking-[0.4em]" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Plan unique
                  </div>
                </Reveal>
                <Reveal delay={0.1} direction="right">
                  <div className="mt-6 text-5xl font-semibold text-white">
                    89€ <span className="text-base font-normal" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>/mois</span>
                  </div>
                </Reveal>
                <Reveal delay={0.2} direction="right">
                  <p className="mt-3" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sans frais cachés. Sans CB pendant l\'essai.
                  </p>
                </Reveal>

                <div className="mt-10 space-y-4 text-sm">
                  {[
                    'Accès dashboard + app client + IA',
                    'Rappels SMS inclus (en Suisse & UE)',
                    'Templates email personnalisables',
                    'Support prioritaire + roadmap partagée',
                  ].map((item, idx) => (
                    <Reveal key={item} delay={0.25 + idx * 0.05} direction="right">
                      <div className="flex items-center gap-3 text-white">
                        <ShieldCheck className="h-4 w-4 flex-shrink-0" style={{ color: 'rgba(255, 255, 255, 0.9)' }} />
                        <span>{item}</span>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
