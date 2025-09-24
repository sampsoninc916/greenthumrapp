import { Amplify } from 'aws-amplify';
import { CookieStorage } from '@aws-amplify/core';

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return fallback;
};

const toNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const SESSION_STRATEGIES = ['amplify-cookie', 'token-exchange'] as const;
type SessionStrategy = (typeof SESSION_STRATEGIES)[number];

const rawStrategy = (import.meta.env.VITE_AUTH_SESSION_STRATEGY as string | undefined)?.toLowerCase();
const sessionStrategy: SessionStrategy = SESSION_STRATEGIES.includes(rawStrategy as SessionStrategy)
  ? (rawStrategy as SessionStrategy)
  : 'amplify-cookie';

const SAME_SITE_OPTIONS = ['strict', 'lax', 'none'] as const;
type SameSiteOption = (typeof SAME_SITE_OPTIONS)[number];

const parseSameSite = (value: string | undefined): SameSiteOption => {
  if (!value) {
    return 'strict';
  }
  const normalized = value.trim().toLowerCase() as SameSiteOption;
  return SAME_SITE_OPTIONS.includes(normalized) ? normalized : 'strict';
};

const cookieExpiresRaw = toNumber(import.meta.env.VITE_AUTH_COOKIE_EXPIRES_DAYS, 7);
const cookieExpires = Number.isFinite(cookieExpiresRaw) && cookieExpiresRaw > 0 ? cookieExpiresRaw : undefined;

const idleTimeoutMinutes = toNumber(import.meta.env.VITE_AUTH_IDLE_TIMEOUT_MINUTES, 15);
const idleTimeoutMs = idleTimeoutMinutes > 0 ? Math.round(idleTimeoutMinutes * 60 * 1000) : 0;

export const SECURITY_CONFIG = {
  SESSION_STRATEGY: sessionStrategy,
  COOKIE_STORAGE: {
    domain: import.meta.env.VITE_AUTH_COOKIE_DOMAIN || undefined,
    path: import.meta.env.VITE_AUTH_COOKIE_PATH || '/',
    sameSite: parseSameSite(import.meta.env.VITE_AUTH_COOKIE_SAME_SITE),
    secure: toBoolean(import.meta.env.VITE_AUTH_COOKIE_SECURE, true),
    expires: cookieExpires,
  },
  TOKEN_EXCHANGE_ENDPOINT: import.meta.env.VITE_AUTH_TOKEN_EXCHANGE_ENDPOINT || '',
  SESSION_TOKEN_ENDPOINT: import.meta.env.VITE_AUTH_SESSION_TOKEN_ENDPOINT || '',
  SESSION_LOGOUT_ENDPOINT: import.meta.env.VITE_AUTH_SESSION_LOGOUT_ENDPOINT || '',
  IDLE_TIMEOUT_MS: idleTimeoutMs,
  TOKEN_REFRESH_BUFFER: 300, // 5 minutes
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBERS: true,
  PASSWORD_REQUIRE_SPECIAL: true,
} as const;

const appendPath = (base: string | undefined, path: string): string => {
  if (!base) {
    return '';
  }
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalizedBase}${path}`;
};

// API endpoints configuration
export const API_ENDPOINTS = {
  PLANTS_READ: import.meta.env.VITE_API_PLANTS_READ,
  PLANTS_WRITE: import.meta.env.VITE_API_PLANTS_WRITE,
  PLANTS_UPDATE: import.meta.env.VITE_API_PLANTS_UPDATE,
  UPLOAD_SCAN: import.meta.env.VITE_API_UPLOAD_SCAN,
  USERS_READ: appendPath(import.meta.env.VITE_API_USERS_READ, '/me'),
  USERS_WRITE: import.meta.env.VITE_API_USERS_WRITE,
  USERS_UPDATE: appendPath(import.meta.env.VITE_API_USERS_UPDATE, '/me'),
  MESSAGES_THREADS: import.meta.env.VITE_API_MESSAGES_THREADS,
  MESSAGES_SEND: import.meta.env.VITE_API_MESSAGES_SEND,
  MESSAGES_MARK_READ: import.meta.env.VITE_API_MESSAGES_MARK_READ,
  MESSAGES_UNREAD_COUNT: import.meta.env.VITE_API_MESSAGES_UNREAD_COUNT,
  REVIEWS_SUBMIT: import.meta.env.VITE_API_REVIEWS_SUBMIT,
  REVIEWS_SUMMARY: import.meta.env.VITE_API_REVIEWS_SUMMARY,
  ADMIN_USERS: import.meta.env.VITE_API_ADMIN_USERS,
  ADMIN_LISTINGS: import.meta.env.VITE_API_ADMIN_LISTINGS,
  ADMIN_DISPUTES: import.meta.env.VITE_API_ADMIN_DISPUTES,
  ADMIN_AUDIT: import.meta.env.VITE_API_ADMIN_AUDIT,
};

const baseAmplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_AWS_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_AWS_USER_POOL_CLIENT_ID,
      region: import.meta.env.VITE_AWS_REGION
    }
  }
};

const REQUIRED_COGNITO_ENV_KEYS = [
  'VITE_AWS_USER_POOL_ID',
  'VITE_AWS_USER_POOL_CLIENT_ID',
  'VITE_AWS_REGION',
] as const;

const REQUIRED_API_ENDPOINT_KEYS = [
  'PLANTS_READ',
  'PLANTS_WRITE',
  'PLANTS_UPDATE',
  'UPLOAD_SCAN',
  'USERS_READ',
  'USERS_WRITE',
  'USERS_UPDATE',
  'MESSAGES_THREADS',
  'MESSAGES_SEND',
  'MESSAGES_MARK_READ',
  'MESSAGES_UNREAD_COUNT',
  'REVIEWS_SUBMIT',
  'REVIEWS_SUMMARY',
  'ADMIN_USERS',
  'ADMIN_LISTINGS',
  'ADMIN_DISPUTES',
  'ADMIN_AUDIT',
] as const satisfies Array<keyof typeof API_ENDPOINTS>;

const API_ENV_KEY_MAP: Record<(typeof REQUIRED_API_ENDPOINT_KEYS)[number], string> = {
  PLANTS_READ: 'VITE_API_PLANTS_READ',
  PLANTS_WRITE: 'VITE_API_PLANTS_WRITE',
  PLANTS_UPDATE: 'VITE_API_PLANTS_UPDATE',
  UPLOAD_SCAN: 'VITE_API_UPLOAD_SCAN',
  USERS_READ: 'VITE_API_USERS_READ',
  USERS_WRITE: 'VITE_API_USERS_WRITE',
  USERS_UPDATE: 'VITE_API_USERS_UPDATE',
  MESSAGES_THREADS: 'VITE_API_MESSAGES_THREADS',
  MESSAGES_SEND: 'VITE_API_MESSAGES_SEND',
  MESSAGES_MARK_READ: 'VITE_API_MESSAGES_MARK_READ',
  MESSAGES_UNREAD_COUNT: 'VITE_API_MESSAGES_UNREAD_COUNT',
  REVIEWS_SUBMIT: 'VITE_API_REVIEWS_SUBMIT',
  REVIEWS_SUMMARY: 'VITE_API_REVIEWS_SUMMARY',
  ADMIN_USERS: 'VITE_API_ADMIN_USERS',
  ADMIN_LISTINGS: 'VITE_API_ADMIN_LISTINGS',
  ADMIN_DISPUTES: 'VITE_API_ADMIN_DISPUTES',
  ADMIN_AUDIT: 'VITE_API_ADMIN_AUDIT',
};

const validateRequiredConfig = () => {
  const envSource = import.meta.env as Record<string, string | undefined>;

  const missingCognito = REQUIRED_COGNITO_ENV_KEYS.filter((key) => {
    const value = envSource[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missingCognito.length > 0) {
    const message = `Missing required AWS Cognito configuration values: ${missingCognito.join(', ')}`;
    console.error(message);
    throw new Error(message);
  }

  const missingEndpoints = (REQUIRED_API_ENDPOINT_KEYS as ReadonlyArray<keyof typeof API_ENDPOINTS>).filter((key) => {
    const value = API_ENDPOINTS[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missingEndpoints.length > 0) {
    const envKeys = missingEndpoints.map((key) => API_ENV_KEY_MAP[key]);
    const message = `Missing required API endpoints: ${envKeys.join(', ')}`;
    console.error(message);
    throw new Error(message);
  }
};

// Configure Amplify once at app initialization
export const configureAmplify = () => {
  validateRequiredConfig();

  const cognitoConfig: Record<string, unknown> = {
    ...baseAmplifyConfig.Auth.Cognito
  };

  if (SECURITY_CONFIG.SESSION_STRATEGY === 'amplify-cookie') {
    const { COOKIE_STORAGE } = SECURITY_CONFIG;
    const cookieStorage = new CookieStorage({
      path: COOKIE_STORAGE.path,
      sameSite: COOKIE_STORAGE.sameSite,
      secure: COOKIE_STORAGE.secure,
      ...(COOKIE_STORAGE.domain ? { domain: COOKIE_STORAGE.domain } : {}),
      ...(typeof COOKIE_STORAGE.expires === 'number' ? { expires: COOKIE_STORAGE.expires } : {}),
    });

    cognitoConfig.storage = cookieStorage;
  }

  Amplify.configure({
    Auth: {
      Cognito: cognitoConfig as any
    }
  });
};
