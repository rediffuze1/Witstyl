import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import Parallax from '@/components/ui/Parallax';
import { Smartphone, BarChart3, Calendar, Bell } from 'lucide-react';

export default function DashboardShowcase() {
  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal direction="right">
            <div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                Votre tableau de bord client
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Gérez tous vos rendez-vous depuis un seul endroit. Consultez votre historique,
                modifiez vos préférences, et recevez des rappels automatiques.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Calendar, text: 'Vue calendrier de tous vos rendez-vous' },
                  { icon: BarChart3, text: 'Historique complet de vos visites' },
                  { icon: Bell, text: 'Rappels personnalisables (SMS/Email)' },
                  { icon: Smartphone, text: 'Interface mobile-first optimisée' },
                ].map((item, index) => (
                  <Reveal key={index} delay={index * 0.1} direction="right">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <item.icon className="h-6 w-6 text-primary" />
                      </div>
                      <p className="text-foreground">{item.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal direction="left" delay={0.2}>
            <Parallax speed={0.3}>
              <div className="relative">
                {/* Mockup placeholder */}
                <div className="relative bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl p-8 shadow-2xl">
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="space-y-4">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="grid grid-cols-3 gap-4 mt-6">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-muted/50 rounded-lg h-24" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Gradient blob decoration */}
                <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-3xl" />
              </div>
            </Parallax>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}








