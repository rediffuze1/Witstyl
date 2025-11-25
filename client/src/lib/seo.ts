// Métadonnées SEO pour SalonPilot
export const siteMetadata = {
  title: 'SalonPilot — Logiciel de prise de rendez-vous pour coiffeurs (IA + rappels SMS)',
  description:
    'Réservation en 3 clics, réceptionniste IA 24/7, tableau de bord client — essayez gratuitement. Simplifiez la gestion de votre salon avec SalonPilot.',
  url: 'https://salonpilot.com',
  siteName: 'SalonPilot',
  locale: 'fr_FR',
  type: 'website',
  image: '/og-image.jpg',
  twitterCard: 'summary_large_image',
};

// JSON-LD pour Organization
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SalonPilot',
  url: 'https://salonpilot.com',
  logo: 'https://salonpilot.com/logo.png',
  description:
    'SalonPilot est une plateforme de gestion de rendez-vous pour salons de coiffure avec réceptionniste IA et système de rappels automatiques.',
  sameAs: [
    'https://www.facebook.com/salonpilot',
    'https://www.twitter.com/salonpilot',
    'https://www.linkedin.com/company/salonpilot',
  ],
};

// JSON-LD pour WebSite
export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SalonPilot',
  url: 'https://salonpilot.com',
  description:
    'Plateforme de gestion de rendez-vous pour salons de coiffure avec réceptionniste IA 24/7',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://salonpilot.com/search?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

// JSON-LD pour SoftwareApplication
export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SalonPilot',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Logiciel de prise de rendez-vous en ligne pour salons de coiffure avec réceptionniste IA, tableau de bord client, et système de rappels automatiques (SMS/Email). Réservation en 3 clics, disponible 24/7.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
    description: 'Essai gratuit 14 jours',
  },
  featureList: [
    'Réservation en ligne en 3 clics',
    'Réceptionniste IA 24/7',
    'Tableau de bord client',
    'Système de rappels automatiques (SMS/Email)',
    'Gestion des horaires et disponibilités',
    'Paiement sécurisé',
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '127',
  },
};

// JSON-LD pour BreadcrumbList
export const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Accueil',
      item: 'https://salonpilot.com',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Fonctionnalités',
      item: 'https://salonpilot.com#features',
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Tarifs',
      item: 'https://salonpilot.com#pricing',
    },
    {
      '@type': 'ListItem',
      position: 4,
      name: 'Contact',
      item: 'https://salonpilot.com#contact',
    },
  ],
};

// JSON-LD pour FAQPage
export const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Comment réserver un rendez-vous avec SalonPilot ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Avec SalonPilot, la réservation se fait en seulement 3 clics : choisissez votre service, sélectionnez un créneau disponible, et validez votre rendez-vous. C\'est simple, rapide et sécurisé.',
      },
    },
    {
      '@type': 'Question',
      name: 'L\'assistant IA fonctionne-t-il 24h/24 ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Oui, notre réceptionniste IA est disponible 24h/24 et 7j/7. Vous pouvez réserver un rendez-vous ou poser vos questions à tout moment, même en dehors des horaires d\'ouverture du salon.',
      },
    },
    {
      '@type': 'Question',
      name: 'Comment fonctionnent les rappels automatiques ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'SalonPilot envoie automatiquement des rappels par SMS et/ou email avant votre rendez-vous. Vous pouvez personnaliser le délai des rappels (24h, 48h avant, etc.) dans votre tableau de bord client.',
      },
    },
    {
      '@type': 'Question',
      name: 'Puis-je voir mes rendez-vous passés et à venir ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Oui, votre tableau de bord client vous permet de consulter tous vos rendez-vous, passés et à venir, ainsi que l\'historique de vos visites au salon.',
      },
    },
    {
      '@type': 'Question',
      name: 'SalonPilot est-il sécurisé ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Absolument. SalonPilot utilise des protocoles de sécurité avancés pour protéger vos données personnelles et vos informations de paiement. Tous les paiements sont traités de manière sécurisée.',
      },
    },
  ],
};








