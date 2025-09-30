export type TelemetryTags = Record<string, string>;
export type TelemetryExtra = Record<string, unknown>;

export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

export type TelemetryOptions = {
  message?: string;
  tags?: TelemetryTags;
  extra?: TelemetryExtra;
  fingerprint?: string[];
  level?: SeverityLevel;
};

export type ApiErrorContext = {
  endpoint?: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
  extra?: TelemetryExtra;
};

let initialized = false;

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

const logTelemetry = (message: string, details?: unknown) => {
  if (!isProduction()) {
    if (details !== undefined) {
      console.info(`[telemetry disabled] ${message}`, details);
    } else {
      console.info(`[telemetry disabled] ${message}`);
    }
  }
};

const ensureInitialized = () => {
  if (!initialized) {
    initialized = true;
    logTelemetry('Telemetry has been disabled. Events will be logged to the console in non-production environments.');
  }
};

const captureException = (error: unknown, options?: TelemetryOptions) => {
  ensureInitialized();

  const message = options?.message ?? 'Unhandled exception';
  const normalizedError = normalizeError(error, message);

  logTelemetry(message, {
    error: normalizedError,
    tags: options?.tags,
    extra: options?.extra,
    fingerprint: options?.fingerprint,
    level: options?.level,
  });
};

const captureMessage = (message: string, options?: TelemetryOptions) => {
  ensureInitialized();

  logTelemetry(message, {
    tags: options?.tags,
    extra: options?.extra,
    fingerprint: options?.fingerprint,
    level: options?.level,
  });
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
  initialize: ensureInitialized,
  captureException,
  captureMessage,
  captureApiError,
};
