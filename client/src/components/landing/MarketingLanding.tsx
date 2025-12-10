import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import GlowBackground from "./GlowBackground";
import GradientOrb from "./GradientOrb";
import Container from "@/components/ui/Container";

// ============================================
// HERO SECTION
// ============================================
function HeroSection() {
  const [, setLocation] = useLocation();
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Glow réactif basé sur la position de la souris
  const reactiveGlow = useMemo(
    () =>
      `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.3), transparent 50%)`,
    [mousePosition]
  );

  const stats = [
    { label: "rdv gérés / mois", value: "+1200" },
    { label: "de no-show", value: "-54%" },
    { label: "note moyenne clients", value: "4.9★" },
  ];

  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center">
      {/* Fond avec gradient réactif */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, hsl(var(--bg-page)) 0%, color-mix(in srgb, hsl(var(--brand-h) var(--brand-s) var(--brand-l)) 8%, hsl(var(--bg-page))) 40%, hsl(var(--bg-page)) 100%)`,
        }}
      />

      {/* Glows multiples réactifs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-60"
          style={{ background: reactiveGlow }}
        />
        <GradientOrb size="xl" intensity={0.25} position={{ x: 20, y: 30 }} />
        <GradientOrb size="lg" intensity={0.2} position={{ x: 80, y: 70 }} />
        <GradientOrb size="md" intensity={0.15} position={{ x: 50, y: 50 }} />
      </div>

      {/* Overlay pour lisibilité */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, hsl(var(--bg-page) / 0.7) 100%)`,
        }}
      />

      <Container size="xl" className="relative z-10 py-24 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          {/* Contenu gauche */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            {/* Badge */}
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium glass-card"
            >
              <span>✂️</span>
              <span className="text-slate-700">Logiciel de gestion pour salons de coiffure</span>
            </motion.span>

            {/* Titre */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-tight tracking-tight text-slate-900">
                Pilote ton salon de coiffure avec{" "}
                <span className="brand-gradient-text block mt-2">
                  un cockpit tout-en-un
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed">
                Centralise les rendez-vous, les plannings et les rappels en quelques clics.
                SalonPilot synchronise ton agenda, ton équipe et tes clients, sans prise de tête.
              </p>
            </div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-wrap items-center gap-4"
            >
              <button
                onClick={() => setLocation("/salon-login")}
                className="brand-button group"
              >
                <span className="relative z-10">Commencer l'essai gratuit</span>
                <div className="absolute inset-0 bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </button>
              <button
                onClick={() => setLocation("/book")}
                className="brand-button-outline"
              >
                Voir une démo
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex flex-wrap gap-8 pt-4"
            >
              {stats.map((stat) => (
                <div key={stat.label} className="text-sm">
                  <div className="text-2xl font-semibold text-slate-900">{stat.value}</div>
                  <div className="text-slate-600">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Carte hero droite */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Glow autour de la carte */}
            <div
              className="absolute -inset-4 rounded-[2rem] blur-2xl opacity-40 pointer-events-none"
              style={{
                background: `radial-gradient(circle, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.3), transparent 70%)`,
              }}
            />

            <div className="relative glass-card p-6">
              <div className="mb-4 flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium text-slate-900">Aujourd'hui · Salon du centre</span>
                <span>Planning équipe</span>
              </div>
              <div className="space-y-3">
                {[
                  { name: "Kassandra", service: "Coupe + couleur", time: "09:00 · 1h30" },
                  { name: "Julie", service: "Balayage", time: "11:00 · 2h" },
                  { name: "Colette", service: "Brushing", time: "14:30 · 45 min" },
                ].map((item) => (
                  <div
                    key={item.name + item.time}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5"
                  >
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{item.name}</div>
                      <div className="text-xs text-slate-600">{item.service}</div>
                    </div>
                    <span
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium"
                      style={{ color: `hsl(var(--brand-h) var(--brand-s) var(--brand-l))` }}
                    >
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

// ============================================
// PILIERS SECTION
// ============================================
function PiliersSection() {
  const features = [
    {
      icon: "📅",
      title: "Horaires & plannings",
      desc: "Visualise en un coup d'œil qui fait quoi et quand.",
    },
    {
      icon: "🔔",
      title: "Rappels automatiques",
      desc: "SMS & emails envoyés sans que tu aies à y penser.",
    },
    {
      icon: "⚙️",
      title: "Un agenda modulé",
      desc: "Gère les durées, temps de pause et combos de services.",
    },
    {
      icon: "📊",
      title: "Une vue services",
      desc: "Comprends ce qui tourne vraiment dans ton salon.",
    },
  ];

  return (
    <section className="relative py-24 sm:py-28 lg:py-32 bg-white">
      {/* Glow subtil en arrière-plan */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: `radial-gradient(circle at 50% 50%, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1), transparent 70%)`,
        }}
      />

      <Container className="relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs uppercase tracking-[0.18em] mb-4 brand-pill">
            Gagner du temps
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 mb-4">
            Les piliers qui soulagent ton salon
          </h2>
          <p className="text-lg text-slate-600">
            Chaque module est conçu pour enlever des tâches de ta to-do et rendre
            l'expérience fluide pour ton équipe comme pour tes clients.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="glass-card p-6 h-full group"
            >
              <div
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl mb-4"
                style={{
                  background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) var(--brand-l)), hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 10%)))`,
                }}
              >
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{feature.desc}</p>
              <div
                className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: `hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.3)` }}
              />
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ============================================
// TIMELINE SECTION
// ============================================
function TimelineSection() {
  const steps = [
    { step: "01", title: "RDV en ligne", desc: "Ton client réserve en quelques secondes." },
    { step: "02", title: "Confirmations", desc: "Email + SMS de confirmation personnalisés." },
    { step: "03", title: "Rappels", desc: "Rappel automatique 24–48h avant la venue." },
    { step: "04", title: "Suivi", desc: "Historique, préférences et notes centralisés." },
  ];

  return (
    <section className="relative py-24 sm:py-28 lg:py-32" style={{ backgroundColor: `hsl(var(--bg-page))` }}>
      <Container>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs uppercase tracking-[0.18em] mb-4 brand-pill">
            De la prise de RDV au paiement
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 mb-4">
            Une timeline lumineuse, sans friction
          </h2>
          <p className="text-lg text-slate-600">
            Le parcours client complet est automatisé : plus de trous dans l'emploi
            du temps, plus d'oublis de rappel.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="glass-card p-6 text-center"
            >
              <span
                className="text-sm font-semibold"
                style={{ color: `hsl(var(--brand-h) var(--brand-s) var(--brand-l))` }}
              >
                Étape {item.step}
              </span>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ============================================
// COCKPIT SECTION
// ============================================
function CockpitSection() {
  return (
    <section className="relative py-24 sm:py-28 lg:py-32 bg-white">
      {/* Glow subtil */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: `radial-gradient(circle at 30% 50%, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.15), transparent 60%)`,
        }}
      />

      <Container>
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.18em] brand-pill">Vue salon</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900">
              Un cockpit glassmorphism + glow prêt pour tes équipes
            </h2>
            <p className="text-lg text-slate-600">
              Le dashboard reprend le même code visuel que ta landing : glow doux,
              cartes claires, actions évidentes. Toute ton équipe s'y retrouve.
            </p>
            <ul className="space-y-3 text-slate-600">
              {[
                "Planning équipe en temps réel",
                "Vue salon / poste / coiffeur",
                "Filtre par type de service",
                "Alertes sur les journées surchargées",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: `hsl(var(--brand-h) var(--brand-s) var(--brand-l))` }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            {/* Glow autour de la carte */}
            <div
              className="absolute -inset-6 rounded-[2rem] blur-3xl opacity-30 pointer-events-none"
              style={{
                background: `radial-gradient(circle at top, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2), transparent 70%)`,
              }}
            />

            <div className="relative glass-card p-6">
              <div className="mb-4 flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium text-slate-900">Vue de la journée</span>
                <span>3 coiffeurs · 18 RDV</span>
              </div>
              <div className="space-y-3">
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: `hsl(var(--brand-h) var(--brand-s) 96% / 0.6)`,
                  }}
                >
                  <span className="font-medium text-slate-900">Matin</span>
                  <span style={{ color: `hsl(var(--brand-h) var(--brand-s) var(--brand-l))` }}>
                    90% rempli
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-900">Après-midi</span>
                  <span className="text-slate-600">65% rempli</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-900">No-show estimés</span>
                  <span style={{ color: `hsl(var(--brand-h) var(--brand-s) var(--brand-l))` }}>
                    -54% vs avant
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ============================================
// TOOLBOX SECTION
// ============================================
function ToolboxSection() {
  const features = [
    "Réservation en ligne 24/7",
    "Rappels SMS & email configurables",
    "Gestion multi-coiffeurs",
    "Temps de pause & techniques",
    "Fiches clients complètes",
    "Exports et suivi d'activité",
  ];

  return (
    <section className="relative py-24 sm:py-28 lg:py-32" style={{ backgroundColor: `hsl(var(--bg-page))` }}>
      <Container>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs uppercase tracking-[0.18em] mb-4 brand-pill">À ton service</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 mb-4">
            Tout ce qu'il faut pour orchestrer ton salon
          </h2>
          <p className="text-lg text-slate-600">
            Tous les outils sont déjà synchronisés entre eux. Tu actives ce dont
            tu as besoin, quand tu en as besoin.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((label, index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="glass-card p-5"
            >
              <div
                className="inline-flex h-8 w-8 items-center justify-center rounded-full mb-3"
                style={{
                  background: `hsl(var(--brand-h) var(--brand-s) 96% / 0.8)`,
                  color: `hsl(var(--brand-h) var(--brand-s) var(--brand-l))`,
                }}
              >
                ✓
              </div>
              <p className="text-sm font-medium text-slate-900">{label}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ============================================
// PRICING SECTION
// ============================================
function PricingSection() {
  const [, setLocation] = useLocation();

  return (
    <section className="relative py-24 sm:py-28 lg:py-32 bg-white">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          {/* Texte gauche */}
          <div className="glass-card p-8 space-y-6">
            <p className="text-xs uppercase tracking-[0.18em] brand-pill">Simple & transparent</p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900">
              Pilote ton salon avec la même expérience glow que ton dashboard.
            </h2>
            <p className="text-slate-600">
              Pas de frais cachés, pas de contrat enfermant. Tu commences avec un
              essai gratuit, tu ne payes que si l'outil te simplifie vraiment la vie.
            </p>
            <ul className="space-y-2 text-slate-600">
              {[
                "Essai gratuit 14 jours sans carte bancaire",
                "Support par chat pour la mise en place",
                "Import possible de tes anciens rdv",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: `hsl(var(--brand-h) var(--brand-s) var(--brand-l))` }}
                  />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-4 pt-4">
              <button
                onClick={() => setLocation("/salon-login")}
                className="brand-button"
              >
                Essayer gratuitement
              </button>
              <button className="brand-button-outline">Contacter le support</button>
            </div>
          </div>

          {/* Bloc prix */}
          <div
            className="relative overflow-hidden rounded-3xl p-8 text-white"
            style={{
              background: `linear-gradient(135deg, hsl(var(--brand-h) var(--brand-s) calc(var(--brand-l) - 8%)), hsl(var(--brand-h) var(--brand-s) var(--brand-l)))`,
              boxShadow: `0 28px 70px hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.35)`,
            }}
          >
            {/* Glow interne */}
            <div
              className="absolute -inset-10 opacity-60 pointer-events-none"
              style={{
                background: `radial-gradient(circle at top, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.4), transparent 65%)`,
              }}
            />

            <div className="relative space-y-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">Tarification unique</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold">89€</span>
                <span className="text-sm text-white/70">/ mois</span>
              </div>
              <p className="text-sm text-white/85">
                Pour un salon, tous les coiffeurs inclus. Tu ajoutes des salons
                quand tu développes ton activité.
              </p>
              <ul className="space-y-2 text-sm text-white/85">
                {[
                  "Accès complet à toutes les fonctionnalités",
                  "Rappels SMS / email inclus (selon ton opérateur)",
                  "Mises à jour et nouvelles features",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-white/70">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ============================================
// FAQ SECTION
// ============================================
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    "Est-ce que SalonPilot remplace mon agenda actuel ?",
    "Comment fonctionnent les rappels SMS ?",
    "Puis-je importer mes anciens rendez-vous ?",
    "Y a-t-il un engagement de durée ?",
  ];

  return (
    <section className="relative py-24 sm:py-28 lg:py-32" style={{ backgroundColor: `hsl(var(--bg-page))` }}>
      <Container>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs uppercase tracking-[0.18em] mb-4 brand-pill">Encore des questions ?</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 mb-4">
            Questions fréquentes
          </h2>
          <p className="text-lg text-slate-600">
            Toutes les réponses aux questions que se posent les salons qui passent sur SalonPilot.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((q, index) => (
            <details
              key={index}
              open={openIndex === index}
              className="glass-card p-4 rounded-2xl"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-slate-900 font-semibold">
                <span>{q}</span>
                <span className="ml-4 text-slate-600">▼</span>
              </summary>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Réponse exemple : adapte ce texte en fonction de ton fonctionnement
                réel. Le plus important est de rassurer sur la simplicité de mise en route.
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ============================================
// HORAIRES SECTION
// ============================================
function HoursSection() {
  const hours = [
    ["Lundi", "09:00 – 18:30"],
    ["Mardi", "09:00 – 18:30"],
    ["Mercredi", "09:00 – 18:30"],
    ["Jeudi", "09:00 – 19:30"],
    ["Vendredi", "09:00 – 19:30"],
    ["Samedi", "08:30 – 16:00"],
    ["Dimanche", "Fermé"],
  ];

  return (
    <section className="relative py-24 sm:py-28 lg:py-32 bg-white">
      <Container>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs uppercase tracking-[0.18em] mb-4 brand-pill">En pratique</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 mb-4">
            Nos horaires
          </h2>
          <p className="text-lg text-slate-600">
            Pour donner un exemple concret à tes futurs clients quand tu mettras ta LP en ligne.
          </p>
        </div>

        <div className="max-w-md mx-auto glass-card p-6">
          <table className="w-full text-sm">
            <tbody>
              {hours.map(([day, time]) => (
                <tr key={day} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{day}</td>
                  <td className="px-4 py-3 text-slate-600 text-right">{time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}

// ============================================
// CONTACT SECTION
// ============================================
function ContactSection() {
  return (
    <section className="relative py-24 sm:py-28 lg:py-32" style={{ backgroundColor: `hsl(var(--bg-page))` }}>
      <Container>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs uppercase tracking-[0.18em] mb-4 brand-pill">Besoin d'en savoir plus ?</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 mb-4">
            Contactez-nous
          </h2>
          <p className="text-lg text-slate-600">
            On répond à tes questions et on t'aide à configurer ton premier salon.
          </p>
        </div>

        <div className="max-w-3xl mx-auto grid gap-8 md:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <span className="font-medium text-slate-900">Email :</span> contact@salonpilot.app
            </div>
            <div>
              <span className="font-medium text-slate-900">Téléphone :</span> +41 79 000 00 00
            </div>
            <div>
              <span className="font-medium text-slate-900">Adresse :</span> Rue de l'exemple 12, 1200 Genève
            </div>
          </div>
          <div className="h-52 rounded-2xl border border-slate-200 bg-slate-100/80" />
        </div>
      </Container>
    </section>
  );
}

// ============================================
// FOOTER
// ============================================
function FooterSection() {
  return (
    <footer className="border-t border-slate-200 bg-white py-8">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
          <span>© {new Date().getFullYear()} SalonPilot. Tous droits réservés.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-900 transition-colors">
              Conditions
            </a>
            <a href="#" className="hover:text-slate-900 transition-colors">
              Confidentialité
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function MarketingLanding() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: `hsl(var(--bg-page))` }}>
      <HeroSection />
      <PiliersSection />
      <TimelineSection />
      <CockpitSection />
      <ToolboxSection />
      <PricingSection />
      <FAQSection />
      <HoursSection />
      <ContactSection />
      <FooterSection />
    </div>
  );
}
