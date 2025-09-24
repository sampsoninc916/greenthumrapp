import { fetchAuthSession } from 'aws-amplify/auth';
import { API_ENDPOINTS, SECURITY_CONFIG } from '../config/amplify';

type UserRole = 'buyer' | 'seller' | 'admin';

interface RequestConfig extends RequestInit {
  requiresAuth?: boolean;
}

class AuthService {
  private static instance: AuthService;
  private roleCache: UserRole | null = null;

  private constructor() {}

  private sanitizeUserScopedUrl(url: string): string {
    if (!url.includes('userId=')) {
      return url;
    }

    const userScopedEndpoints = [
      API_ENDPOINTS.USERS_READ,
      API_ENDPOINTS.USERS_UPDATE,
      API_ENDPOINTS.USERS_WRITE,
    ].filter((endpoint): endpoint is string => typeof endpoint === 'string' && endpoint.length > 0);

    if (userScopedEndpoints.length === 0) {
      return url;
    }

    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const toComparable = (value: string): string | null => {
      try {
        const parsed = new URL(value, baseOrigin);
        return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
      } catch {
        const sanitized = value.split('?')[0]?.replace(/\/+$/, '');
        return sanitized ?? null;
      }
    };

    const normalizedUrl = toComparable(url);
    if (!normalizedUrl) {
      return url;
    }

    const matchesUserScopedEndpoint = userScopedEndpoints.some(endpoint => toComparable(endpoint) === normalizedUrl);
    if (!matchesUserScopedEndpoint) {
      return url;
    }

    try {
      const parsedUrl = new URL(url, baseOrigin);
      if (!parsedUrl.searchParams.has('userId')) {
        return url;
      }
      parsedUrl.searchParams.delete('userId');
      const serializedSearch = parsedUrl.searchParams.toString();
      parsedUrl.search = serializedSearch ? `?${serializedSearch}` : '';
      const isRelative = !/^https?:/i.test(url);
      return isRelative
        ? `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
        : parsedUrl.toString();
    } catch {
      return url
        .replace(/([?&])userId=[^&]*(&)?/, (_match, prefix, suffix) => {
          if (!suffix) {
            return '';
          }
          return prefix === '?' ? '?' : prefix;
        })
        .replace(/[?&]$/, '');
    }
  }

  private handleForbiddenResponse(requestUrl: string): never {
    console.warn(`Received unexpected 403 response for ${requestUrl}. Redirecting to login.`);
    this.roleCache = null;

    if (typeof window !== 'undefined') {
      try {
        const event = new CustomEvent('auth:forbidden', { detail: { url: requestUrl } });
        window.dispatchEvent(event);
      } catch {
        // Silently ignore event dispatch errors
      }

      const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const loginUrl = `/login?reauth=1&redirect=${encodeURIComponent(currentLocation)}`;
      window.location.href = loginUrl;
    }

    throw new Error('Access forbidden. Please sign in again.');
  }

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

    const isFormDataBody = typeof FormData !== 'undefined' && fetchConfig.body instanceof FormData;
    const requestUrl = this.sanitizeUserScopedUrl(url);

    if (requiresAuth) {
      const tokenInfo = await this.getTokenAndRole();
      const token = tokenInfo?.token;
      role = tokenInfo?.role ?? role;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const existingHeaders = new Headers(fetchConfig.headers as HeadersInit | undefined);
      existingHeaders.set('Authorization', `Bearer ${token}`);
      if (!existingHeaders.has('Content-Type') && !isFormDataBody) {
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
      if (!existingHeaders.has('Content-Type') && !isFormDataBody) {
        existingHeaders.set('Content-Type', 'application/json');
      }
      fetchConfig.headers = existingHeaders;
    }

    let response = await fetch(requestUrl, fetchConfig);

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
        const retryIsFormData = typeof FormData !== 'undefined' && fetchConfig.body instanceof FormData;
        if (!retryHeaders.has('Content-Type') && fetchConfig.body && !retryIsFormData) {
          retryHeaders.set('Content-Type', 'application/json');
        }
        fetchConfig.headers = retryHeaders;
        response = await fetch(requestUrl, fetchConfig);
      } else {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Authentication failed');
      }
    }

    if (response.status === 403 && requiresAuth) {
      this.handleForbiddenResponse(requestUrl);
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