import { fetchAuthSession } from 'aws-amplify/auth';

interface RequestConfig extends RequestInit {
  requiresAuth?: boolean;
}

class AuthService {
  private static instance: AuthService;

  private constructor() {}

  private extractRole(payload: Record<string, any> | undefined): string | null {
    if (!payload) {
      return null;
    }
    const rawRole = (payload["custom:role"] ?? payload["role"]) as string | undefined;
    if (rawRole === "buyer" || rawRole === "seller" || rawRole === "admin") {
      return rawRole;
    }
    return null;
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Get the current JWT token
   */
  async getToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  /**
   * Make an authenticated API request
   */
  async authenticatedFetch(url: string, config: RequestConfig = {}): Promise<Response> {
    const { requiresAuth = true, ...fetchConfig } = config;
    let role: string | null = null;

    if (requiresAuth) {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) {
        throw new Error('No authentication token available');
      }

      role = this.extractRole(session.tokens?.idToken?.payload);

      // Add Authorization header
      const existingHeaders = new Headers(fetchConfig.headers as HeadersInit | undefined);
      existingHeaders.set('Authorization', `Bearer ${token}`);
      if (!existingHeaders.has('Content-Type')) {
        existingHeaders.set('Content-Type', 'application/json');
      }
      if (role) {
        existingHeaders.set('X-User-Role', role);
      }
      fetchConfig.headers = existingHeaders;
    } else if (fetchConfig.body) {
      const existingHeaders = new Headers(fetchConfig.headers as HeadersInit | undefined);
      if (!existingHeaders.has('Content-Type')) {
        existingHeaders.set('Content-Type', 'application/json');
      }
      fetchConfig.headers = existingHeaders;
    }

    const response = await fetch(url, fetchConfig);

    // Handle 401 Unauthorized
    if (response.status === 401 && requiresAuth) {
      // Token might be expired, try to refresh
      const session = await fetchAuthSession({ forceRefresh: true });
      const newToken = session.tokens?.idToken?.toString();
      role = this.extractRole(session.tokens?.idToken?.payload);

      if (newToken) {
        // Retry with new token
        const retryHeaders = new Headers(fetchConfig.headers as HeadersInit | undefined);
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        if (role) {
          retryHeaders.set('X-User-Role', role);
        }
        fetchConfig.headers = retryHeaders;
        return fetch(url, fetchConfig);
      } else {
        // Redirect to login if refresh fails
        window.location.href = '/login';
        throw new Error('Authentication failed');
      }
    }

    return response;
  }

  /**
   * Check if a user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      return !!session.tokens?.idToken;
    } catch {
      return false;
    }
  }

  /**
   * Get user information from token
   */
  async getUserInfo(): Promise<any> {
    try {
      const session = await fetchAuthSession();
      if (session.tokens?.idToken) {
        return session.tokens.idToken.payload;
      }
      return null;
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  }
}

export const authService = AuthService.getInstance();

// Helper functions for common API calls
export const apiClient = {
  /**
   * GET request with optional authentication
   */
  get: async (url: string, requiresAuth = false) => {
    return authService.authenticatedFetch(url, {
      method: 'GET',
      requiresAuth,
    });
  },

  /**
   * POST request with optional authentication
   */
  post: async (url: string, data: any, requiresAuth = true) => {
    return authService.authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth,
    });
  },

  /**
   * PUT request with optional authentication
   */
  put: async (url: string, data: any, requiresAuth = true) => {
    return authService.authenticatedFetch(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      requiresAuth,
    });
  },

  /**
   * DELETE request with optional authentication
   */
  delete: async (url: string, requiresAuth = true) => {
    return authService.authenticatedFetch(url, {
      method: 'DELETE',
      requiresAuth,
    });
  },
};