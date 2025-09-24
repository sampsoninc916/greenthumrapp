import { fetchAuthSession } from 'aws-amplify/auth';
import { SECURITY_CONFIG } from '../config/amplify';

type UserRole = 'buyer' | 'seller' | 'admin';

interface RequestConfig extends RequestInit {
  requiresAuth?: boolean;
}

class AuthService {
  private static instance: AuthService;
  private roleCache: UserRole | null = null;

  private constructor() {}

  private extractRole(payload: Record<string, any> | undefined): UserRole | null {
    if (!payload) {
      return null;
    }
    const rawRole = (payload["custom:role"] ?? payload["role"]) as string | undefined;
    if (rawRole === "buyer" || rawRole === "seller" || rawRole === "admin") {
      return rawRole;
    }
    return null;
  }

  private normalizeRole(role: unknown): UserRole | null {
    if (role === "buyer" || role === "seller" || role === "admin") {
      return role;
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
    const tokenInfo = await this.getTokenAndRole();
    return tokenInfo?.token ?? null;
  }

  private appendForceRefreshParam(url: string): string {
    if (url.includes('forceRefresh=')) {
      return url;
    }
    return url.includes('?') ? `${url}&forceRefresh=true` : `${url}?forceRefresh=true`;
  }

  private async getTokenAndRole(
    forceRefresh = false
  ): Promise<{ token: string; role: UserRole | null } | null> {
    if (SECURITY_CONFIG.SESSION_STRATEGY === 'token-exchange') {
      if (!SECURITY_CONFIG.SESSION_TOKEN_ENDPOINT) {
        console.error('SESSION_TOKEN_ENDPOINT is not configured for token-exchange strategy.');
        return null;
      }

      const endpoint = forceRefresh
        ? this.appendForceRefreshParam(SECURITY_CONFIG.SESSION_TOKEN_ENDPOINT)
        : SECURITY_CONFIG.SESSION_TOKEN_ENDPOINT;

      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          credentials: 'include'
        });

        if (!response.ok) {
          console.error(`Token retrieval endpoint responded with status ${response.status}`);
          return null;
        }

        const data = (await response.json()) as { token?: string; role?: unknown };

        if (!data || typeof data.token !== 'string') {
          console.error('Token retrieval endpoint did not return a usable token.');
          return null;
        }

        const normalizedRole = this.normalizeRole(data.role) ?? this.roleCache;
        this.roleCache = normalizedRole ?? null;

        return {
          token: data.token,
          role: normalizedRole ?? null
        };
      } catch (error) {
        console.error('Error retrieving token from secure session:', error);
        return null;
      }
    }

    try {
      const session = forceRefresh
        ? await fetchAuthSession({ forceRefresh: true })
        : await fetchAuthSession();

      const token = session.tokens?.idToken?.toString() ?? null;

      if (!token) {
        return null;
      }

      const role = this.extractRole(session.tokens?.idToken?.payload);
      this.roleCache = role;

      return {
        token,
        role
      };
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
    let role: UserRole | null = this.roleCache;

    if (SECURITY_CONFIG.SESSION_STRATEGY === 'token-exchange') {
      fetchConfig.credentials = fetchConfig.credentials ?? 'include';
    }

    if (requiresAuth) {
      const tokenInfo = await this.getTokenAndRole();
      const token = tokenInfo?.token;
      role = tokenInfo?.role ?? role;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const existingHeaders = new Headers(fetchConfig.headers as HeadersInit | undefined);
      existingHeaders.set('Authorization', `Bearer ${token}`);
      if (!existingHeaders.has('Content-Type')) {
        existingHeaders.set('Content-Type', 'application/json');
      }
      if (role) {
        existingHeaders.set('X-User-Role', role);
      } else {
        existingHeaders.delete('X-User-Role');
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

    if (response.status === 401 && requiresAuth) {
      const refreshedInfo = await this.getTokenAndRole(true);
      const newToken = refreshedInfo?.token;
      role = refreshedInfo?.role ?? null;

      if (newToken) {
        const retryHeaders = new Headers(fetchConfig.headers as HeadersInit | undefined);
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        if (role) {
          retryHeaders.set('X-User-Role', role);
        } else {
          retryHeaders.delete('X-User-Role');
        }
        if (!retryHeaders.has('Content-Type') && fetchConfig.body) {
          retryHeaders.set('Content-Type', 'application/json');
        }
        fetchConfig.headers = retryHeaders;
        return fetch(url, fetchConfig);
      }

      window.location.href = '/login';
      throw new Error('Authentication failed');
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