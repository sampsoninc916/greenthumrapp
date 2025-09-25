import * as Sentry from '@sentry/browser';
import type { Event, EventHint, SeverityLevel } from '@sentry/types';

type TelemetryTags = Record<string, string>;
type TelemetryExtra = Record<string, unknown>;

type TelemetryOptions = {
  message?: string;
  tags?: TelemetryTags;
  extra?: TelemetryExtra;
  fingerprint?: string[];
  level?: SeverityLevel;
};

type ApiErrorContext = {
  endpoint?: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
  extra?: TelemetryExtra;
};

const PII_KEY_PATTERN = /(password|secret|token|session|email|phone|address|ssn|credit|card|authorization)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const DIGIT_PATTERN = /\b(?:\d[ -]?){9,}\b/g;

const telemetryConfig = {
  dsn: typeof import.meta !== 'undefined' ? (import.meta.env.VITE_TELEMETRY_DSN as string | undefined) : undefined,
  environment:
    (typeof import.meta !== 'undefined' && (import.meta.env.VITE_TELEMETRY_ENVIRONMENT as string | undefined)) ||
    (typeof import.meta !== 'undefined' ? (import.meta.env.MODE as string | undefined) : undefined) ||
    'development',
  release:
    (typeof import.meta !== 'undefined' && (import.meta.env.VITE_APP_RELEASE as string | undefined)) ||
    (typeof import.meta !== 'undefined' && (import.meta.env.VITE_APP_VERSION as string | undefined)) ||
    'unknown',
  alerting: {
    token: typeof import.meta !== 'undefined' ? (import.meta.env.VITE_TELEMETRY_ALERT_TOKEN as string | undefined) : undefined,
    orgSlug: typeof import.meta !== 'undefined' ? (import.meta.env.VITE_TELEMETRY_ALERT_ORG as string | undefined) : undefined,
    projectSlug:
      typeof import.meta !== 'undefined' ? (import.meta.env.VITE_TELEMETRY_ALERT_PROJECT as string | undefined) : undefined,
  },
};

let initialized = false;
let sentryEnabled = false;

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const isProduction = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.MODE === 'production';
    }
  } catch {
    // ignore
  }

  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  } catch {
    return false;
  }
};

const sanitizeString = (value: string) =>
  value
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(DIGIT_PATTERN, (match) => (match.length >= 9 ? '[REDACTED_DIGITS]' : match));

const sanitizeValue = (value: unknown): unknown => {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEY_PATTERN.test(key)) {
        result[key] = '[REDACTED]';
        continue;
      }

      result[key] = sanitizeValue(nestedValue);
    }

    return result;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  return value;
};

const sanitizeEvent = (event: Event): Event => {
  if (event.user) {
    const safeUser: Record<string, unknown> = {};
    if (event.user.id) {
      safeUser.id = sanitizeString(String(event.user.id));
    }
    if (event.user.username) {
      safeUser.username = sanitizeString(String(event.user.username));
    }
    event.user = safeUser;
  }

  if (event.request) {
    event.request = sanitizeValue(event.request) as Event['request'];
  }

  if (event.extra) {
    event.extra = sanitizeValue(event.extra) as Event['extra'];
  }

  if (event.contexts) {
    event.contexts = sanitizeValue(event.contexts) as Event['contexts'];
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      data: sanitizeValue(breadcrumb.data) as Record<string, unknown> | undefined,
      message: breadcrumb.message ? sanitizeString(breadcrumb.message) : breadcrumb.message,
    }));
  }

  return event;
};

const withScope = (callback: () => void, options?: TelemetryOptions) => {
  if (!sentryEnabled) {
    callback();
    return;
  }

  Sentry.withScope((scope) => {
    if (options?.tags) {
      for (const [key, value] of Object.entries(options.tags)) {
        scope.setTag(key, sanitizeString(String(value)));
      }
    }

    if (options?.extra) {
      scope.setContext('details', sanitizeValue(options.extra) as Record<string, unknown>);
    }

    if (options?.fingerprint) {
      scope.setFingerprint(options.fingerprint);
    }

    if (options?.level) {
      scope.setLevel(options.level);
    }

    if (options?.message) {
      scope.setExtra('message', sanitizeString(options.message));
    }

    callback();
  });
};

const ensureInitialized = () => {
  if (!initialized) {
    initializeTelemetry();
  }
};

const synchronizeAlertingRules = async () => {
  if (!isBrowser) {
    return;
  }

  const { token, orgSlug, projectSlug } = telemetryConfig.alerting;
  if (!token || !orgSlug || !projectSlug) {
    return;
  }

  const alertRules = [
    {
      name: 'App error spike',
      aggregate: 'count()',
      query: 'event.type:error',
      thresholdType: 'above',
      timeWindow: 5,
      resolveThreshold: 1,
    },
    {
      name: 'API failures detected',
      aggregate: 'count()',
      query: 'event.type:error tag:category:api',
      thresholdType: 'above',
      timeWindow: 5,
      resolveThreshold: 1,
    },
  ];

  try {
    await Promise.all(
      alertRules.map((rule) =>
        fetch(`https://sentry.io/api/0/projects/${orgSlug}/${projectSlug}/alerts/metric-rules/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: rule.name,
            aggregate: rule.aggregate,
            query: rule.query,
            timeWindow: rule.timeWindow,
            thresholdType: rule.thresholdType,
            thresholdPeriod: 1,
            resolveThreshold: rule.resolveThreshold,
            projects: [projectSlug],
            owner: null,
          }),
        })
      )
    );
  } catch (error) {
    if (!isProduction()) {
      console.warn('Failed to synchronize telemetry alerting rules', error);
    }
  }
};

export const initializeTelemetry = () => {
  if (initialized || !isBrowser) {
    initialized = true;
    return;
  }

  initialized = true;

  if (!telemetryConfig.dsn) {
    if (!isProduction()) {
      console.info('Telemetry disabled: missing DSN.');
    }
    return;
  }

  Sentry.init({
    dsn: telemetryConfig.dsn,
    environment: telemetryConfig.environment,
    release: telemetryConfig.release,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    beforeSend(event, hint) {
      const sanitizedEvent = sanitizeEvent(event as Event);
      if (hint?.originalException && hint.originalException instanceof Error) {
        const error = hint.originalException;
        if (PII_KEY_PATTERN.test(error.message)) {
          error.message = '[REDACTED]';
        }
      }
      return sanitizedEvent as typeof event;
    },
  });

  sentryEnabled = true;

  void synchronizeAlertingRules();
};

const normalizeError = (error: unknown, fallbackMessage?: string): Error => {
  if (error instanceof Error) {
    return error;
  }

  const message = fallbackMessage ?? 'Unknown error';
  try {
    return new Error(message, { cause: error });
  } catch {
    const normalized = new Error(message);
    (normalized as unknown as Record<string, unknown>).cause = error;
    return normalized;
  }
};

const logToConsole = (message: string, error: Error) => {
  if (!isProduction()) {
    console.error(message, error);
  }
};

const captureException = (error: unknown, options?: TelemetryOptions) => {
  ensureInitialized();

  const fallbackMessage = options?.message ?? 'Unhandled exception';
  const normalizedError = normalizeError(error, fallbackMessage);

  if (!sentryEnabled) {
    logToConsole(fallbackMessage, normalizedError);
    return;
  }

  withScope(
    () => {
      Sentry.captureException(normalizedError);
    },
    options
  );
};

const captureMessage = (message: string, options?: TelemetryOptions) => {
  ensureInitialized();

  if (!sentryEnabled) {
    logToConsole(message, new Error(message));
    return;
  }

  withScope(
    () => {
      Sentry.captureMessage(sanitizeString(message), options?.level);
    },
    options
  );
};

const captureApiError = (error: unknown, context: ApiErrorContext = {}) => {
  const { endpoint, method, statusCode, requestId, extra } = context;

  const tags: TelemetryTags = {
    category: 'api',
  };

  if (endpoint) {
    tags.endpoint = endpoint;
  }

  if (method) {
    tags.method = method;
  }

  if (statusCode !== undefined) {
    tags.statusCode = String(statusCode);
  }

  captureException(error, {
    message: 'API interaction failed',
    tags,
    extra: {
      requestId,
      ...extra,
    },
  });
};

export const telemetryService = {
  initialize: initializeTelemetry,
  captureException,
  captureMessage,
  captureApiError,
};

