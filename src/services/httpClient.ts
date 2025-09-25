import { toast } from 'sonner';
import { telemetryService } from './telemetry';

export interface HttpRequestOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
  allowedStatuses?: number[];
  suppressToast?: boolean;
  operationName?: string;
}

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ApiErrorContext {
  endpoint: string;
  status: number;
  message: string;
  details?: unknown;
  cause?: unknown;
  operationName?: string;
}

export class ApiError extends Error {
  readonly endpoint: string;
  readonly status: number;
  readonly details?: unknown;
  readonly operationName?: string;

  constructor({ endpoint, status, message, details, cause, operationName }: ApiErrorContext) {
    super(message);
    this.name = 'ApiError';
    this.endpoint = endpoint;
    this.status = status;
    this.details = details;
    this.operationName = operationName;
    if (cause !== undefined) {
      (this as any).cause = cause;
    }
  }
}

export const logApiError = (error: ApiError, suppressToast = false) => {
  telemetryService.captureApiError(error, {
    endpoint: error.endpoint,
    statusCode: error.status,
    extra: {
      operationName: error.operationName,
      details: error.details,
    },
  });

  if (!suppressToast) {
    toast.error(error.message);
  }
};

export const createDeserializationError = (endpoint: string, cause: unknown): ApiError => {
  return new ApiError({
    endpoint,
    status: 0,
    message: 'Received an unexpected response from the server.',
    details: cause instanceof Error ? { message: cause.message } : cause,
    cause,
    operationName: 'deserialize',
  });
};

const shouldRetryRequest = (status: number, method: string | undefined, attempt: number, maxRetries: number) => {
  if (attempt >= maxRetries) {
    return false;
  }

  if (!method || !IDEMPOTENT_METHODS.has(method.toUpperCase())) {
    return false;
  }

  return RETRYABLE_STATUS_CODES.has(status) || (status >= 500 && status < 600);
};

const cloneRequestInit = (options: HttpRequestOptions): RequestInit => {
  const { retries, retryDelayMs, allowedStatuses, suppressToast, operationName, ...fetchOptions } = options;
  const headers = fetchOptions.headers ? new Headers(fetchOptions.headers as HeadersInit) : undefined;
  return { ...fetchOptions, headers } satisfies RequestInit;
};

export class HttpClient {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = globalThis.fetch) {
    this.fetchImpl = fetchImpl;
  }

  async request(url: string, options: HttpRequestOptions = {}): Promise<Response> {
    const {
      retries = 0,
      retryDelayMs = 400,
      allowedStatuses = [],
      suppressToast = false,
      operationName,
    } = options;

    const method = (options.method ?? 'GET').toUpperCase();
    let attempt = 0;

    while (true) {
      try {
        const response = await this.fetchImpl(url, cloneRequestInit(options));

        if (!response.ok && !allowedStatuses.includes(response.status)) {
          const error = await this.buildApiError(url, response, operationName);
          const retry = shouldRetryRequest(response.status, method, attempt, retries);

          if (retry) {
            attempt += 1;
            console.warn('[API] Retrying request', {
              endpoint: url,
              status: response.status,
              attempt,
              maxRetries: retries,
              operationName,
            });
            await delay(retryDelayMs * attempt);
            continue;
          }

          logApiError(error, suppressToast);
          throw error;
        }

        return response;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }

        const retry = attempt < retries;
        if (retry) {
          attempt += 1;
          console.warn('[API] Retrying after network failure', {
            endpoint: url,
            attempt,
            maxRetries: retries,
            operationName,
          });
          await delay(retryDelayMs * attempt);
          continue;
        }

        const networkError = new ApiError({
          endpoint: url,
          status: 0,
          message: 'Network error while contacting the server. Please try again.',
          details: error instanceof Error ? { message: error.message } : error,
          cause: error,
          operationName,
        });
        logApiError(networkError, suppressToast);
        throw networkError;
      }
    }
  }

  private async buildApiError(url: string, response: Response, operationName?: string): Promise<ApiError> {
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    let message = `Request failed with status ${response.status}`;
    let details: unknown = undefined;

    try {
      const clone = response.clone();
      const rawText = await clone.text();
      if (rawText) {
        if (contentType.includes('application/json')) {
          try {
            const parsed = JSON.parse(rawText);
            details = parsed;
            if (parsed && typeof parsed === 'object' && typeof (parsed as any).message === 'string') {
              message = (parsed as any).message as string;
            }
          } catch (parseError) {
            details = { rawBody: rawText, parseError: parseError instanceof Error ? parseError.message : parseError };
          }
        } else {
          details = rawText;
          if (rawText.trim().length > 0) {
            message = rawText.trim();
          }
        }
      }
    } catch (readError) {
      details = readError instanceof Error ? { message: readError.message } : readError;
    }

    return new ApiError({
      endpoint: url,
      status: response.status,
      message,
      details,
      operationName,
    });
  }
}

export const httpClient = new HttpClient();
