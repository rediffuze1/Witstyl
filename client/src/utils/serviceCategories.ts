/**
 * Utilitaires pour gérer les catégories de services
 * 
 * Cette fonction vérifie si un service appartient à une catégorie donnée.
 * Elle gère à la fois les services avec un tableau de catégories (tags)
 * et les services avec une seule catégorie (category).
 * 
 * @param service - Le service à vérifier
 * @param category - La catégorie recherchée
 * @returns true si le service appartient à la catégorie, false sinon
 */
export function serviceHasCategory(service: any, category: string): boolean {
  // Si le service a un tableau de catégories (tags)
  if (Array.isArray(service.tags)) {
    return service.tags.includes(category);
  }
  
  // Si le service a une seule catégorie (category)
  if (service.category) {
    return service.category === category;
  }
  
  // Si le service n'a pas de catégorie
  return false;
}

/**
 * Groupe les services par catégorie.
 * Un service avec plusieurs catégories apparaîtra dans toutes les sections correspondantes.
 * 
 * @param services - Liste des services à grouper
 * @param defaultCategories - Catégories par défaut à afficher (ex: ["Homme", "Femme", "Enfant"])
 * @returns Objet avec les catégories comme clés et les services comme valeurs
 */
export function groupServicesByCategory(
  services: any[],
  defaultCategories: string[] = ["Homme", "Femme", "Enfant"]
): { [key: string]: any[] } {
  if (!services || services.length === 0) {
    return {};
  }
  
  const grouped: { [key: string]: any[] } = {};
  
  // Initialiser les catégories par défaut
  defaultCategories.forEach(category => {
    grouped[category] = [];
  });
  
  // Parcourir tous les services
  services.forEach((service: any) => {
    // Si le service a des tags (catégories multiples)
    if (service.tags && Array.isArray(service.tags) && service.tags.length > 0) {
      // Ajouter le service à toutes les catégories où il apparaît
      service.tags.forEach((tag: string) => {
        if (!grouped[tag]) {
          grouped[tag] = [];
        }
        // Éviter les doublons
        if (!grouped[tag].find((s: any) => s.id === service.id)) {
          grouped[tag].push(service);
        }
      });
    } else if (service.category) {
      // Si le service a une seule catégorie
      const category = service.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      if (!grouped[category].find((s: any) => s.id === service.id)) {
        grouped[category].push(service);
      }
    } else {
      // Service sans catégorie → "Autres"
      if (!grouped["Autres"]) {
        grouped["Autres"] = [];
      }
      if (!grouped["Autres"].find((s: any) => s.id === service.id)) {
        grouped["Autres"].push(service);
      }
    }
  });
  
  return grouped;
}



