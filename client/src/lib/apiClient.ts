/**
 * Client API centralisé avec gestion des erreurs, retries et refresh token
 */

interface ApiClientOptions {
  baseURL?: string;
  retries?: number;
  retryDelay?: number;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipErrorToast?: boolean;
}

class ApiClient {
  private baseURL: string;
  private retries: number;
  private retryDelay: number;
  private refreshTokenPromise: Promise<Response | null> | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseURL = options.baseURL || '';
    this.retries = options.retries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
  }

  /**
   * Rafraîchir le token d'authentification
   */
  private async refreshToken(): Promise<Response | null> {
    // Éviter les appels multiples simultanés
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = (async () => {
      try {
        const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          console.log('[ApiClient] Token rafraîchi avec succès:', data.authenticated ? 'authentifié' : 'non authentifié');
          return response;
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.warn('[ApiClient] Refresh token échoué:', errorData.error || response.statusText);
          return null;
        }
      } catch (error) {
        console.error('[ApiClient] Erreur lors du refresh token:', error);
        return null;
      } finally {
        // Réinitialiser après un court délai pour permettre les retries
        setTimeout(() => {
          this.refreshTokenPromise = null;
        }, 1000);
      }
    })();

    return this.refreshTokenPromise;
  }

  /**
   * Gérer les erreurs HTTP
   */
  private async handleError(response: Response, url: string, options: RequestOptions): Promise<Response | never> {
    const status = response.status;
    const statusText = response.statusText;

    // Essayer de parser le message d'erreur
    let errorMessage = statusText;
    let errorData: any = {};
    try {
      errorData = await response.json().catch(() => ({}));
      errorMessage = errorData.error || errorData.message || statusText;
    } catch {
      // Ignorer les erreurs de parsing
    }

    // Gestion spécifique des erreurs 401
    if (status === 401 && !options.skipAuth) {
      console.warn('[ApiClient] 401 Unauthorized - Tentative de refresh token...');
      
      // Essayer de rafraîchir le token
      const refreshResponse = await this.refreshToken();
      
      if (refreshResponse?.ok) {
        console.log('[ApiClient] Token rafraîchi avec succès, retry de la requête...');
        // Retry la requête originale après refresh (une seule fois pour éviter les boucles)
        const retryOptions = { ...options, skipAuth: true };
        return this.request(url, retryOptions);
      }

      // Si le refresh échoue, rediriger vers login
      console.warn('[ApiClient] Refresh token échoué, redirection vers login...');
      
      // Éviter les boucles de redirection
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const isLoginPage = currentPath.includes('login') || currentPath.includes('register');
        
        if (!isLoginPage) {
          // Utiliser un timeout pour éviter les conflits avec React Router
          setTimeout(() => {
            // Déterminer la page de login appropriée
            const isClientRoute = currentPath.startsWith('/client-');
            const loginPath = isClientRoute ? '/client-login' : '/salon-login';
            window.location.href = loginPath;
          }, 100);
        }
      }
    }

    // Gestion des autres erreurs
    if (!options.skipErrorToast && typeof window !== 'undefined') {
      // Import dynamique pour éviter les dépendances circulaires
      import('@/hooks/use-toast').then(({ useToast }) => {
        // Note: useToast est un hook, on ne peut pas l'utiliser ici directement
        // L'appelant devra gérer le toast
      });
    }

    const error = new Error(errorMessage) as Error & { status?: number; statusText?: string; data?: any };
    error.status = status;
    error.statusText = statusText;
    error.data = errorData;
    throw error;
  }

  /**
   * Effectuer une requête avec retry automatique
   */
  private async request(url: string, options: RequestOptions = {}): Promise<Response> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    const defaultOptions: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const requestOptions: RequestInit = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await fetch(fullUrl, requestOptions);

        // Si succès, retourner la réponse
        if (response.ok) {
          return response;
        }

        // Si 401 et pas skipAuth, laisser handleError gérer
        if (response.status === 401 && !options.skipAuth) {
          return this.handleError(response, url, options);
        }

        // Pour les autres erreurs, throw après le dernier retry
        if (attempt === this.retries) {
          return this.handleError(response, url, options);
        }

        // Attendre avant le retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
      } catch (error) {
        lastError = error as Error;
        
        // Si c'est le dernier essai, throw
        if (attempt === this.retries) {
          throw lastError;
        }

        // Attendre avant le retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
      }
    }

    throw lastError || new Error('Requête échouée après tous les retries');
  }

  /**
   * GET request
   */
  async get<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
    const response = await this.request(url, { ...options, method: 'GET' });
    return response.json();
  }

  /**
   * POST request
   */
  async post<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.request(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
    return response.json();
  }

  /**
   * PUT request
   */
  async put<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.request(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
    return response.json();
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
    const response = await this.request(url, { ...options, method: 'DELETE' });
    return response.json();
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.request(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
    return response.json();
  }
}

// Instance singleton
export const apiClient = new ApiClient({
  baseURL: '',
  retries: 3,
  retryDelay: 1000,
});

// Export du type pour les options
export type { RequestOptions };

