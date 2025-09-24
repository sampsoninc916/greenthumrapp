import { fetchAuthSession } from 'aws-amplify/auth';
import { API_ENDPOINTS, SECURITY_CONFIG } from '../config/amplify';
import { createDeserializationError, httpClient, logApiError } from './httpClient';

type UserRole = 'buyer' | 'seller' | 'admin';

type ParseMode = 'json' | 'text' | 'none';

export interface ApiResult<T> {
  ok: any;
  status: any;
  json(): unknown;
  response: Response;
  data: T | null;
}

interface RequestConfig extends RequestInit {
  requiresAuth?: boolean;
  parseAs?: ParseMode;
}

class AuthService {
  private static instance: AuthService;
  private roleCache: UserRole | null = null;
  private userIdCache: string | null = null;

  private constructor() {}

  private decodeBase64Url(payload: string): string | null {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
    const padded = normalized + '='.repeat(padLength);

    try {
      if (typeof window !== 'undefined' && typeof window.atob === 'function') {
        return window.atob(padded);
      }
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(padded, 'base64').toString('utf-8');
      }
    } catch {
      return null;
    }
    return null;
  }

  private decodeJwtPayload(token: string | undefined): Record<string, any> | null {
    if (!token || typeof token !== 'string') {
      return null;
    }
    const segments = token.split('.');
    if (segments.length < 2) {
      return null;
    }

    const decoded = this.decodeBase64Url(segments[1]);
    if (!decoded) {
      return null;
    }

    try {
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  private extractUserIdFromPayload(payload: Record<string, any> | null | undefined): string | null {
    if (!payload) {
      return null;
    }
    const candidate = payload['sub'] ?? payload['user_id'] ?? payload['username'];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
    return null;
  }

  private extractUserIdFromToken(token: string | undefined): string | null {
    const payload = this.decodeJwtPayload(token);
    return this.extractUserIdFromPayload(payload ?? undefined);
  }

  private getCurrentLocation(): string {
    if (typeof window === 'undefined') {
      return '/';
    }
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  private redirectToLogin(query: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.location.href = `/login${query}`;
  }

  private sanitizeUserScopedUrl(url: string, currentUserId: string | null): string {
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

    const effectiveUserId = currentUserId ?? this.userIdCache;
    if (!effectiveUserId) {
      throw new Error('Unable to determine the current user identifier for scoped request.');
    }

    try {
      const parsedUrl = new URL(url, baseOrigin);
      const existingUserId = parsedUrl.searchParams.get('userId');
      if (existingUserId && existingUserId !== effectiveUserId) {
        throw new Error('User identifier mismatch for scoped request.');
      }
      parsedUrl.searchParams.set('userId', effectiveUserId);
      const serializedSearch = parsedUrl.searchParams.toString();
      parsedUrl.search = serializedSearch ? `?${serializedSearch}` : '';
      const isRelative = !/^https?:/i.test(url);
      return isRelative
        ? `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
        : parsedUrl.toString();
    } catch (error) {
      if (error instanceof Error && /mismatch/i.test(error.message)) {
        throw error;
      }
      const queryPattern = /([?&])userId=([^&]*)(?:&|$)/;
      const match = url.match(queryPattern);
      if (match && match[2] && match[2] !== effectiveUserId) {
        throw new Error('User identifier mismatch for scoped request.');
      }
      const cleaned = url.replace(queryPattern, (_match, prefix) => (prefix === '?' ? '?' : prefix)).replace(/[?&]$/, '');
      const separator = cleaned.includes('?') ? '&' : '?';
      return `${cleaned}${separator}userId=${encodeURIComponent(effectiveUserId)}`;
    }
  }

  private sanitizeUserProfilePayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const disallowedKeys = new Set([
      'email',
      'phone',
      'ssn',
      'socialSecurityNumber',
      'paymentInfo',
      'billingDetails',
      'address',
      'createdAt',
      'updatedAt',
    ]);

    const clone: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (disallowedKeys.has(key)) {
        continue;
      }
      clone[key] = value;
    }
    return clone;
  }

  private async enforceUserProfileResponsePolicy(requestUrl: string, response: Response): Promise<Response> {
    const userScopedEndpoints = [
      API_ENDPOINTS.USERS_READ,
      API_ENDPOINTS.USERS_UPDATE,
      API_ENDPOINTS.USERS_WRITE,
    ].filter((endpoint): endpoint is string => typeof endpoint === 'string' && endpoint.length > 0);

    if (userScopedEndpoints.length === 0) {
      return response;
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

    const normalizedUrl = toComparable(requestUrl);
    if (!normalizedUrl) {
      return response;
    }

    const matchesUserScopedEndpoint = userScopedEndpoints.some(endpoint => toComparable(endpoint) === normalizedUrl);
    if (!matchesUserScopedEndpoint) {
      return response;
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('application/json')) {
      return response;
    }

    try {
      const payload = await response.clone().json();
      const sanitized = this.sanitizeUserProfilePayload(payload);
      const serialized = JSON.stringify(sanitized);
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      return new Response(serialized, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return response;
    }
  }

  private getRetryCount(method: string | undefined): number {
    const normalizedMethod = method?.toUpperCase() ?? 'GET';
    return normalizedMethod === 'GET' ? 1 : 0;
  }

  private describeOperation(method: string | undefined, url: string): string {
    const normalizedMethod = method?.toUpperCase() ?? 'GET';
    return `${normalizedMethod} ${url}`;
  }

  private async parseResponseData<T>(response: Response, parseAs: ParseMode, endpoint: string): Promise<T | null> {
    if (parseAs === 'none') {
      return null;
    }

    if (parseAs === 'text') {
      try {
        return (await response.clone().text()) as unknown as T;
      } catch (error) {
        const apiError = createDeserializationError(endpoint, error);
        logApiError(apiError);
        throw apiError;
      }
    }

    if (response.status === 204) {
      return null;
    }

    try {
      const clone = response.clone();
      const rawBody = await clone.text();

      if (!rawBody) {
        return null;
      }

      return JSON.parse(rawBody) as T;
    } catch (error) {
      const apiError = createDeserializationError(endpoint, error);
      logApiError(apiError);
      throw apiError;
    }
  }

  private handleForbiddenResponse(requestUrl: string): never {
    console.warn(`Received unexpected 403 response for ${requestUrl}. Redirecting to login.`);
    this.roleCache = null;
    this.userIdCache = null;

    if (typeof window !== 'undefined') {
      try {
        const event = new CustomEvent('auth:forbidden', { detail: { url: requestUrl } });
        window.dispatchEvent(event);
      } catch {
        // Silently ignore event dispatch errors
      }

      const currentLocation = this.getCurrentLocation();
      const loginUrl = `?reauth=1&redirect=${encodeURIComponent(currentLocation)}`;
      this.redirectToLogin(loginUrl);
    }

    throw new Error('Access forbidden. Please sign in again.');
  }

  private handleUnauthorizedResponse(requestUrl: string): never {
    console.warn(`Received 401 response for ${requestUrl}. Redirecting to login.`);
    this.roleCache = null;
    this.userIdCache = null;

    if (typeof window !== 'undefined') {
      const currentLocation = this.getCurrentLocation();
      const loginQuery = `?redirect=${encodeURIComponent(currentLocation)}`;
      this.redirectToLogin(loginQuery);
    }

    throw new Error('Authentication required. Please sign in again.');
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
  ): Promise<{ token: string; role: UserRole | null; userId: string | null } | null> {
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
        const derivedUserId = this.extractUserIdFromToken(data.token) ?? this.userIdCache;
        this.roleCache = normalizedRole ?? null;
        this.userIdCache = derivedUserId ?? null;

        return {
          token: data.token,
          role: normalizedRole ?? null,
          userId: derivedUserId ?? null
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

      const payload = session.tokens?.idToken?.payload;
      const role = this.extractRole(payload);
      const derivedUserId = this.extractUserIdFromPayload(payload) ?? this.userIdCache;
      this.roleCache = role;
      this.userIdCache = derivedUserId ?? null;

      return {
        token,
        role,
        userId: derivedUserId ?? null
      };
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  /**
   * Make an authenticated API request
   */
  async authenticatedFetch<T = unknown>(url: string, config: RequestConfig = {}): Promise<ApiResult<T>> {
    const { requiresAuth = true, parseAs = 'json', ...fetchConfig } = config;
    let role: UserRole | null = this.roleCache;
    let userId: string | null = this.userIdCache;

    if (SECURITY_CONFIG.SESSION_STRATEGY === 'token-exchange') {
      fetchConfig.credentials = fetchConfig.credentials ?? 'include';
    }

    const isFormDataBody = typeof FormData !== 'undefined' && fetchConfig.body instanceof FormData;
    let requestUrl = url;

    if (requiresAuth) {
      const tokenInfo = await this.getTokenAndRole();
      const token = tokenInfo?.token;
      role = tokenInfo?.role ?? role;
      userId = tokenInfo?.userId ?? userId;

      requestUrl = this.sanitizeUserScopedUrl(url, userId ?? null);

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
    } else {
      if (fetchConfig.body) {
        const existingHeaders = new Headers(fetchConfig.headers as HeadersInit | undefined);
        if (!existingHeaders.has('Content-Type') && !isFormDataBody) {
          existingHeaders.set('Content-Type', 'application/json');
        }
        fetchConfig.headers = existingHeaders;
      }

      try {
        requestUrl = this.sanitizeUserScopedUrl(url, userId ?? null);
      } catch (error) {
        if (error instanceof Error && /user identifier mismatch/i.test(error.message)) {
          throw error;
        }
        requestUrl = url;
      }
    }

    const allowedStatuses = requiresAuth ? [401, 403] : [];
    const retries = this.getRetryCount(fetchConfig.method as string | undefined);
    let response = await httpClient.request(requestUrl, {
      ...fetchConfig,
      retries,
      allowedStatuses,
      operationName: this.describeOperation(fetchConfig.method as string | undefined, requestUrl),
    });

    if (response.status === 401 && requiresAuth) {
      const refreshedInfo = await this.getTokenAndRole(true);
      const newToken = refreshedInfo?.token;
      role = refreshedInfo?.role ?? null;
      userId = refreshedInfo?.userId ?? userId;

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
        requestUrl = this.sanitizeUserScopedUrl(url, userId ?? null);
        response = await httpClient.request(requestUrl, {
          ...fetchConfig,
          allowedStatuses,
          operationName: this.describeOperation(fetchConfig.method as string | undefined, requestUrl),
        });
      } else {
        this.handleUnauthorizedResponse(requestUrl);
      }
    }

    if (response.status === 403 && requiresAuth) {
      this.handleForbiddenResponse(requestUrl);
    }

    if (response.status === 401 && requiresAuth) {
      this.handleUnauthorizedResponse(requestUrl);
    }

    if (requiresAuth) {
      response = await this.enforceUserProfileResponsePolicy(requestUrl, response);
    }

    const data = await this.parseResponseData<T>(response, parseAs, requestUrl);

    return {
      ok: response.ok,
      status: response.status,
      json: () => response.clone().json(),
      response,
      data,
    };
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

type QueryParams = Record<string, string | number | boolean | null | undefined>;

const appendQueryParams = (rawUrl: string, params?: QueryParams): string => {
  if (!params) {
    return rawUrl;
  }

  const definedEntries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);
  if (definedEntries.length === 0) {
    return rawUrl;
  }

  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

  try {
    const parsedUrl = new URL(rawUrl, baseOrigin);
    for (const [key, value] of definedEntries) {
      parsedUrl.searchParams.set(key, String(value));
    }
    const serialized = parsedUrl.searchParams.toString();
    parsedUrl.search = serialized ? `?${serialized}` : '';
    const isRelative = !/^https?:/i.test(rawUrl);
    return isRelative ? `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` : parsedUrl.toString();
  } catch {
    const separator = rawUrl.includes('?') ? '&' : '?';
    const query = definedEntries
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    return `${rawUrl}${separator}${query}`;
  }
};

interface GetOptions extends Omit<RequestConfig, 'method' | 'body'> {
  params?: QueryParams;
}

type MutationOptions = Omit<RequestConfig, 'method'>;

const normalizeGetOptions = (options?: boolean | GetOptions): GetOptions => {
  if (typeof options === 'boolean') {
    return { requiresAuth: options };
  }
  return options ?? {};
};

const normalizeMutationOptions = (options?: boolean | MutationOptions): MutationOptions => {
  if (typeof options === 'boolean') {
    return { requiresAuth: options };
  }
  return options ?? {};
};

// Helper functions for common API calls
export const apiClient = {
  /**
   * GET request with optional authentication
   */
  get: async <T = unknown>(url: string, options?: boolean | GetOptions): Promise<ApiResult<T>> => {
    const normalizedOptions = normalizeGetOptions(options);
    const finalUrl = appendQueryParams(url, normalizedOptions.params);

    return authService.authenticatedFetch<T>(finalUrl, {
      ...normalizedOptions,
      method: 'GET',
      requiresAuth: normalizedOptions.requiresAuth ?? false,
      parseAs: normalizedOptions.parseAs ?? 'json',
    });
  },

  /**
   * POST request with optional authentication
   */
  post: async <T = unknown>(
    url: string,
    data: unknown,
    options?: boolean | MutationOptions,
  ): Promise<ApiResult<T>> => {
    const normalizedOptions = normalizeMutationOptions(options);

    const body = normalizedOptions.body ?? JSON.stringify(data);

    return authService.authenticatedFetch<T>(url, {
      ...normalizedOptions,
      method: 'POST',
      body,
      requiresAuth: normalizedOptions.requiresAuth ?? true,
      parseAs: normalizedOptions.parseAs ?? 'json',
    });
  },

  /**
   * PUT request with optional authentication
   */
  put: async <T = unknown>(
    url: string,
    data: unknown,
    options?: boolean | MutationOptions,
  ): Promise<ApiResult<T>> => {
    const normalizedOptions = normalizeMutationOptions(options);
    const body = normalizedOptions.body ?? JSON.stringify(data);

    return authService.authenticatedFetch<T>(url, {
      ...normalizedOptions,
      method: 'PUT',
      body,
      requiresAuth: normalizedOptions.requiresAuth ?? true,
      parseAs: normalizedOptions.parseAs ?? 'json',
    });
  },

  /**
   * DELETE request with optional authentication
   */
  delete: async <T = unknown>(
    url: string,
    options?: boolean | MutationOptions,
  ): Promise<ApiResult<T>> => {
    const normalizedOptions = normalizeMutationOptions(options);

    return authService.authenticatedFetch<T>(url, {
      ...normalizedOptions,
      method: 'DELETE',
      requiresAuth: normalizedOptions.requiresAuth ?? true,
      parseAs: normalizedOptions.parseAs ?? 'none',
    });
  },
};