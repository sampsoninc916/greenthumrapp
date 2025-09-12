import { fetchAuthSession } from 'aws-amplify/auth';

interface RequestConfig extends RequestInit {
  requiresAuth?: boolean;
}

class AuthService {
  private static instance: AuthService;

  private constructor() {}

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

    if (requiresAuth) {
      const token = await this.getToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Add Authorization header
      fetchConfig.headers = {
        ...fetchConfig.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }

    const response = await fetch(url, fetchConfig);

    // Handle 401 Unauthorized
    if (response.status === 401 && requiresAuth) {
      // Token might be expired, try to refresh
      const session = await fetchAuthSession({ forceRefresh: true });
      const newToken = session.tokens?.idToken?.toString();
      
      if (newToken) {
        // Retry with new token
        fetchConfig.headers = {
          ...fetchConfig.headers,
          'Authorization': `Bearer ${newToken}`,
        };
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