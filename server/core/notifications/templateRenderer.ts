/**
 * Utilitaire de rendu de templates avec placeholders
 * 
 * Remplace les placeholders du type {{key}} par les valeurs du contexte.
 * 
 * Placeholders supportés :
 * - {{client_first_name}} → prénom du client
 * - {{client_full_name}} → nom complet du client
 * - {{appointment_date}} → date formatée (ex: "mardi 25 novembre 2025")
 * - {{appointment_time}} → heure formatée (ex: "09:00")
 * - {{service_name}} → nom du service
 * - {{salon_name}} → nom du salon
 * - {{stylist_name}} → nom du coiffeur/coiffeuse
 */

export type AppointmentTemplateContext = {
  clientFirstName: string;
  clientFullName: string;
  appointmentDate: string; // déjà formaté (ex: "mardi 25 novembre 2025")
  appointmentTime: string; // ex : "09:00"
  serviceName: string;
  salonName: string;
  stylistName?: string;
};

/**
 * Mappe les clés du contexte vers les noms de placeholders dans les templates
 */
const PLACEHOLDER_MAP: Record<string, keyof AppointmentTemplateContext> = {
  'client_first_name': 'clientFirstName',
  'client_full_name': 'clientFullName',
  'appointment_date': 'appointmentDate',
  'appointment_time': 'appointmentTime',
  'service_name': 'serviceName',
  'salon_name': 'salonName',
  'stylist_name': 'stylistName',
};

/**
 * Rend un template en remplaçant les placeholders {{key}} par les valeurs du contexte
 * 
 * @param template - Template avec placeholders (ex: "Bonjour {{client_first_name}}")
 * @param context - Contexte avec les valeurs à injecter
 * @returns Template rendu avec les valeurs remplacées
 */
export function renderTemplate(
  template: string,
  context: AppointmentTemplateContext
): string {
  if (!template) {
    if (process.env.NOTIFICATIONS_DEBUG === 'true') {
      console.warn('[TemplateRenderer DEBUG] Template vide ou null fourni');
    }
    return '';
  }

  // Mode DEBUG: log du template brut
  const DEBUG_MODE = process.env.NOTIFICATIONS_DEBUG === 'true';
  if (DEBUG_MODE) {
    console.log('[TemplateRenderer DEBUG] Rendu du template:', template.substring(0, 200) + (template.length > 200 ? '...' : ''));
    console.log('[TemplateRenderer DEBUG] Contexte fourni:', JSON.stringify(context, null, 2));
  }

  const rendered = template.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) => {
    // Normaliser la clé (enlever les espaces)
    const normalizedKey = key.trim();
    
    // Chercher dans le mapping
    const contextKey = PLACEHOLDER_MAP[normalizedKey];
    
    if (contextKey) {
      const value = context[contextKey];
      // Si la valeur est undefined ou null, retourner une chaîne vide
      // Si stylistName est undefined, utiliser un texte par défaut
      if (contextKey === 'stylistName' && !value) {
        if (DEBUG_MODE) {
          console.log(`[TemplateRenderer DEBUG] Placeholder {{${normalizedKey}}} → fallback "un·e coiffeur·euse"`);
        }
        return 'un·e coiffeur·euse';
      }
      const finalValue = value ?? '';
      if (DEBUG_MODE) {
        console.log(`[TemplateRenderer DEBUG] Placeholder {{${normalizedKey}}} → "${finalValue}"`);
      }
      return finalValue;
    }
    
    // Si le placeholder n'est pas trouvé, garder le placeholder original
    // (pour éviter de masquer des erreurs de configuration)
    console.warn(`[TemplateRenderer] Placeholder inconnu: {{${normalizedKey}}}`);
    if (DEBUG_MODE) {
      console.warn(`[TemplateRenderer DEBUG] Placeholder {{${normalizedKey}}} non mappé, conservé tel quel`);
    }
    return match;
  });

  if (DEBUG_MODE) {
    console.log('[TemplateRenderer DEBUG] Template rendu:', rendered.substring(0, 200) + (rendered.length > 200 ? '...' : ''));
  }

  return rendered;
}

/**
 * Valide qu'un template contient uniquement des placeholders connus
 * (utile pour l'interface d'édition)
 */
export function validateTemplate(template: string): {
  valid: boolean;
  unknownPlaceholders: string[];
} {
  const unknownPlaceholders: string[] = [];
  const placeholderRegex = /{{\s*(\w+)\s*}}/g;
  let match;

  while ((match = placeholderRegex.exec(template)) !== null) {
    const key = match[1].trim();
    if (!PLACEHOLDER_MAP[key]) {
      unknownPlaceholders.push(key);
    }
  }

  return {
    valid: unknownPlaceholders.length === 0,
    unknownPlaceholders,
  };
}

/**
 * Liste tous les placeholders disponibles
 */
export function getAvailablePlaceholders(): Array<{ key: string; description: string }> {
  return [
    { key: '{{client_first_name}}', description: 'Prénom du client' },
    { key: '{{client_full_name}}', description: 'Nom complet du client' },
    { key: '{{appointment_date}}', description: 'Date du rendez-vous (ex: "mardi 25 novembre 2025")' },
    { key: '{{appointment_time}}', description: 'Heure du rendez-vous (ex: "09:00")' },
    { key: '{{service_name}}', description: 'Nom du service' },
    { key: '{{salon_name}}', description: 'Nom du salon' },
    { key: '{{stylist_name}}', description: 'Nom du coiffeur/coiffeuse' },
  ];
}



