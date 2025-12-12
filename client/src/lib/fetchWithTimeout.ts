/**
 * Wrapper pour fetch avec timeout
 * Utilisé pour éviter que les requêtes bloquent l'UI indéfiniment
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number; // Timeout en millisecondes (défaut: 10000ms)
}

/**
 * Effectue une requête fetch avec timeout
 * @param url URL de la requête
 * @param options Options de fetch + timeout
 * @returns Promise<Response>
 * @throws Error avec message "TIMEOUT" si le timeout est dépassé
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;

  // Créer un AbortController pour le timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    // Fusionner le signal d'abort avec celui fourni dans les options
    const signal = fetchOptions.signal
      ? AbortSignal.any([controller.signal, fetchOptions.signal])
      : controller.signal;

    const response = await fetch(url, {
      ...fetchOptions,
      signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Vérifier si c'est une erreur de timeout
    if (error.name === 'AbortError' || controller.signal.aborted) {
      const timeoutError = new Error('TIMEOUT') as Error & { code: string; timeout: number };
      timeoutError.code = 'TIMEOUT';
      timeoutError.timeout = timeout;
      throw timeoutError;
    }

    // Propager les autres erreurs
    throw error;
  }
}

