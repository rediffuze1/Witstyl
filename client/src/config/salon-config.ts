/**
 * Configuration centralisée du salon
 * Cette config sert de FALLBACK si les données ne sont pas disponibles depuis l'API
 * Les valeurs réelles viennent de la base de données via /api/public/salon
 */

export interface Service {
  id: string;
  name: string;
  description: string;
  price: string;
  icon?: string;
  image?: string;
}

export interface TeamMember {
  id: string;
  firstName: string;
  role: string;
  specialty?: string;
  photo?: string;
}

export interface SalonConfig {
  name: string;
  tagline: string;
  primaryColorHue: number;
  contact: {
    email: string;
    phone: string;
    address: string;
    mapUrl?: string;
    social?: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
    };
  };
  openingHours: Array<{
    day: string;
    open?: string;
    close?: string;
    closed?: boolean;
  }>;
  services: Service[];
  team: TeamMember[];
  galleryImages?: Array<{
    src: string;
    alt: string;
  }>;
  cta: {
    label: string;
    href: string;
  };
  stats: Array<{
    value: string;
    label: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
}

/**
 * Configuration par défaut (fallback)
 * Utilisée si les données ne sont pas disponibles depuis l'API
 */
export const salonConfig: SalonConfig = {
  name: "Witstyl",
  tagline: "Pilote ton salon de coiffure avec un cockpit tout-en-un",
  primaryColorHue: 262,

  contact: {
    email: "contact@witstyl.ch",
    phone: "+41 79 000 00 00",
    address: "Rue de l'exemple 12, 1200 Genève",
    mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2761.1234567890!2d6.1432!3d46.2044!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDbCsDEyJzE1LjgiTiA2wrAwOCczNS41IkU!5e0!3m2!1sfr!2sch!4v1234567890123!5m2!1sfr!2sch",
    social: {
      instagram: "https://instagram.com/witstyl",
      facebook: "https://facebook.com/witstyl",
    },
  },

  openingHours: [
    { day: "Lundi", open: "09:00", close: "18:30" },
    { day: "Mardi", open: "09:00", close: "18:30" },
    { day: "Mercredi", open: "09:00", close: "18:30" },
    { day: "Jeudi", open: "09:00", close: "19:30" },
    { day: "Vendredi", open: "09:00", close: "19:30" },
    { day: "Samedi", open: "08:30", close: "16:00" },
    { day: "Dimanche", closed: true },
  ],

  services: [
    {
      id: "coupe-femme",
      name: "Coupe femme",
      description: "Coupe moderne adaptée à votre style",
      price: "45€",
      icon: "✂️",
    },
    {
      id: "coupe-homme",
      name: "Coupe homme",
      description: "Coupe classique ou tendance",
      price: "30€",
      icon: "💇",
    },
    {
      id: "coloration",
      name: "Coloration",
      description: "Coloration complète ou retouche racines",
      price: "À partir de 65€",
      icon: "🎨",
    },
    {
      id: "balayage",
      name: "Balayage",
      description: "Effet naturel et lumineux",
      price: "À partir de 85€",
      icon: "✨",
    },
    {
      id: "lissage",
      name: "Lissage brésilien",
      description: "Lissage durable et soyeux",
      price: "À partir de 120€",
      icon: "🌟",
    },
    {
      id: "barbe",
      name: "Taille de barbe",
      description: "Taille précise et soignée",
      price: "25€",
      icon: "🧔",
    },
  ],

  team: [
    {
      id: "sarah",
      firstName: "Sarah",
      role: "Coloration",
      specialty: "Spécialiste balayage naturel",
      photo: "/team/sarah.jpg",
    },
    {
      id: "lucas",
      firstName: "Lucas",
      role: "Coiffure homme & barbe",
      specialty: "Expert en coupes tendance",
      photo: "/team/lucas.jpg",
    },
    {
      id: "emma",
      firstName: "Emma",
      role: "Coloration & soins",
      specialty: "Spécialiste cheveux colorés",
      photo: "/team/emma.jpg",
    },
  ],

  galleryImages: [
    { src: "/salon1.jpg", alt: "Vue du salon" },
    { src: "/salon2.jpg", alt: "Espace de travail" },
    { src: "/salon3.jpg", alt: "Salle d'attente" },
  ],

  cta: {
    label: "Prendre RDV",
    href: "/book",
  },

  stats: [
    { value: "+1200", label: "rdv gérés / mois" },
    { value: "-34%", label: "de no-show" },
    { value: "4.9★", label: "note moyenne clients" },
  ],

  faq: [
    {
      question: "Comment prendre rendez-vous en ligne ?",
      answer: "C'est très simple ! Cliquez sur le bouton 'Prendre RDV', choisissez votre service, sélectionnez un créneau disponible et confirmez votre réservation. Vous recevrez un email et un SMS de confirmation.",
    },
    {
      question: "Puis-je annuler ou modifier un rendez-vous ?",
      answer: "Oui, vous pouvez annuler ou modifier votre rendez-vous jusqu'à 24h avant l'heure prévue. Connectez-vous à votre espace client ou contactez-nous directement par téléphone.",
    },
    {
      question: "Prenez-vous les nouveaux clients ?",
      answer: "Absolument ! Nous sommes ravis d'accueillir de nouveaux clients. Réservez en ligne ou appelez-nous pour discuter de vos besoins.",
    },
    {
      question: "Quels moyens de paiement acceptez-vous ?",
      answer: "Nous acceptons les espèces, les cartes bancaires (CB, Visa, Mastercard) et les paiements par application mobile (Twint, etc.).",
    },
    {
      question: "Proposez-vous des prestations pour enfants ?",
      answer: "Oui, nous proposons des coupes pour enfants à partir de 3 ans. Les tarifs sont adaptés et nous prenons le temps nécessaire pour que votre enfant se sente à l'aise.",
    },
    {
      question: "Y a-t-il un parking à proximité ?",
      answer: "Oui, plusieurs places de parking sont disponibles dans la rue et un parking public se trouve à 2 minutes à pied du salon.",
    },
  ],
};
