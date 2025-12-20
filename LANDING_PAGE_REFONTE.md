# 🎨 Landing Page Refondue - Inspirée de xtract.framer.ai

## ✅ Fichiers créés/modifiés

### 📁 Configuration
- **`client/src/config/salon-config.ts`** - Configuration centralisée du salon (nom, couleurs, contact, horaires, etc.)

### 📁 Composants UI/Helpers
- **`client/src/components/ui/motion.ts`** - Helpers d'animation Framer Motion (variants, transitions, etc.)

### 📁 Composants Marketing
- **`client/src/components/marketing/Hero.tsx`** - Hero avec parallax, glow réactif, suivi souris
- **`client/src/components/marketing/Pillars.tsx`** - Section "Les piliers" avec animations stagger
- **`client/src/components/marketing/Timeline.tsx`** - Timeline avec reveals progressifs step-by-step
- **`client/src/components/marketing/GlowCockpit.tsx`** - Section cockpit avec parallax et glow animé
- **`client/src/components/marketing/AllInOneFeatures.tsx`** - Section fonctionnalités complètes
- **`client/src/components/marketing/Pricing.tsx`** - Section pricing avec scale + fade
- **`client/src/components/marketing/FAQ.tsx`** - FAQ avec animations d'ouverture fluides
- **`client/src/components/marketing/OpeningHours.tsx`** - Section horaires
- **`client/src/components/marketing/OpeningHoursTable.tsx`** - Tableau des horaires
- **`client/src/components/marketing/ContactSection.tsx`** - Section contact avec icônes
- **`client/src/components/marketing/SalonMap.tsx`** - Carte Google Maps intégrée
- **`client/src/components/marketing/SalonGallery.tsx`** - Carrousel d'images du salon

### 📁 Page principale
- **`client/src/pages/landing.tsx`** - Page landing refondue avec smooth scroll Lenis

## 🎯 Caractéristiques principales

### ✨ Animations inspirées de xtract.framer.ai
- **Smooth scroll** : Lenis intégré pour un défilement fluide
- **Reveals progressifs** : Chaque section apparaît avec fade-in + translateY
- **Stagger animations** : Éléments qui apparaissent séquentiellement (0.08s d'écart)
- **Parallax** : Hero avec parallax sur glow, texte et carte (vitesses différentes)
- **Step transitions** : Timeline avec reveals step-by-step
- **Hover effects** : Cartes glassmorphism avec élévation au hover
- **Glow animé** : Glows qui pulsent légèrement pour créer de la profondeur

### 🎨 Design System
- **Glow réactif** : Basé sur `--brand-h`, `--brand-s`, `--brand-l` (HSL)
- **Glassmorphism** : Cartes avec `backdrop-blur-xl`, bordures translucides
- **Lisibilité** : Overlays automatiques pour garantir le contraste
- **Responsive** : Mobile-first, adapté à tous les écrans

### ⚙️ Configuration centralisée
Toute la landing page est alimentée par `config/salon-config.ts` :
- Nom du salon
- Couleur principale (hue)
- Contact (email, téléphone, adresse)
- Horaires d'ouverture
- Images de galerie
- Stats
- Features
- Timeline
- Pricing
- FAQ

## 🚀 Utilisation

### 1. Personnaliser le salon
Modifie `client/src/config/salon-config.ts` :
```typescript
export const salonConfig: SalonConfig = {
  name: "Ton Salon",
  tagline: "Ton slogan",
  primaryColorHue: 262, // Change cette valeur (0-360)
  // ... reste de la config
};
```

### 2. Lancer la landing
La page est déjà intégrée dans `client/src/pages/landing.tsx`. 
Elle s'affiche automatiquement sur la route `/` (ou selon ta config de routing).

### 3. Variables CSS
Les variables suivantes sont utilisées (définies dans `index.css` et mises à jour par `theme.ts`) :
- `--brand-h`, `--brand-s`, `--brand-l` : Composantes HSL de la couleur principale
- `--bg-page`, `--bg-section` : Fonds clairs
- `--text-main`, `--text-muted` : Textes avec contraste élevé

## 📝 Notes techniques

- **Lenis** : Smooth scroll déjà configuré dans `lib/lenis.ts`
- **Framer Motion** : Utilisé pour toutes les animations
- **IntersectionObserver** : Pour les reveals au scroll
- **Parallax** : Via `useScroll` et `useTransform` de Framer Motion
- **Glassmorphism** : Classe `.glass-card` définie dans `index.css`

## 🎬 Animations détaillées

### Hero
- Glow réactif qui suit la souris
- Parallax sur 3 layers (glow, texte, carte)
- Apparition progressive avec stagger

### Sections
- Chaque section utilise `sectionVariants` pour un reveal groupé
- Stagger de 0.08s entre les éléments enfants
- Fade-in + translateY (10-20px)

### Timeline
- Reveal step-by-step avec délai progressif (0.15s par étape)
- Scale subtil (0.9 → 1.0)

### Pricing
- Scale + fade pour la carte pricing
- Glow interne animé (pulsation)

### FAQ
- Animation d'ouverture/fermeture fluide avec `AnimatePresence`
- Rotation de l'icône chevron

## 🔧 Personnalisation avancée

### Changer la couleur principale
Dans `config/salon-config.ts`, modifie `primaryColorHue` (0-360).
La couleur sera automatiquement appliquée partout via les variables CSS.

### Ajouter des images de galerie
Dans `config/salon-config.ts`, ajoute des images dans `galleryImages` :
```typescript
galleryImages: [
  { src: "/images/salon1.jpg", alt: "Description" },
  // ...
]
```

### Modifier les animations
Les variants sont définis dans `components/ui/motion.ts`. 
Tu peux ajuster les durées, easings, et délais selon tes préférences.

## ✨ Résultat

Une landing page moderne, fluide, avec :
- ✅ Smooth scroll professionnel
- ✅ Animations progressives au scroll
- ✅ Parallax subtil
- ✅ Glassmorphism cohérent
- ✅ Glow réactif à la couleur de marque
- ✅ Lisibilité parfaite (contraste élevé)
- ✅ Responsive mobile → desktop
- ✅ Configuration centralisée ultra simple

Tout est prêt à l'emploi ! 🚀




