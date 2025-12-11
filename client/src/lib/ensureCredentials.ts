/**
 * Utilitaire pour garantir que toutes les requêtes incluent les credentials
 * Cette fonction wrapper fetch pour s'assurer que credentials: 'include' est toujours présent
 */

/**
 * Wrapper autour de fetch qui garantit que credentials: 'include' est toujours présent
 * pour les routes protégées
 */
export async function fetchWithCredentials(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // S'assurer que credentials est toujours 'include'
  const options: RequestInit = {
    ...init,
    credentials: 'include',
  };

  return fetch(input, options);
}

/**
 * Vérifie si une URL est une route protégée qui nécessite des credentials
 */
function isProtectedRoute(url: string): boolean {
  // Routes publiques qui n'ont pas besoin de credentials
  const publicRoutes = [
    '/api/public/',
    '/api/auth/user', // Vérification de session (peut être appelée sans auth)
  ];

  // Si c'est une route publique, on peut ne pas forcer credentials
  if (publicRoutes.some(route => url.includes(route))) {
    return false;
  }

  // Toutes les autres routes API sont considérées comme protégées
  return url.startsWith('/api/');
}

/**
 * Fetch intelligent qui ajoute automatiquement credentials pour les routes protégées
 */
export async function smartFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
  
  // Si c'est une route protégée et que credentials n'est pas explicitement défini, l'ajouter
  if (isProtectedRoute(url) && !('credentials' in (init || {}))) {
    const options: RequestInit = {
      ...init,
      credentials: 'include',
    };
    return fetch(input, options);
  }

  // Sinon, utiliser fetch normal
  return fetch(input, init);
}

