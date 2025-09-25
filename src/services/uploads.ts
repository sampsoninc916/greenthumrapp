import { API_ENDPOINTS } from '../config/amplify';
import { authService } from './auth';
import { telemetryService } from './telemetry';

export interface PresignUploadRequestItem {
  clientUploadId: string;
  fileName: string;
  contentType: string;
  contentLength: number;
}

export interface PresignedUploadTarget {
  clientUploadId: string;
  key: string;
  uploadUrl: string;
  headers?: Record<string, string>;
}

export const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BATCH_UPLOAD_BYTES = 200 * 1024 * 1024;

interface PresignResponseBody {
  uploads?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isPresignedTarget = (value: unknown): value is PresignedUploadTarget => {
  if (!isRecord(value)) {
    return false;
  }

  const { clientUploadId, key, uploadUrl, headers } = value;

  if (typeof clientUploadId !== 'string' || !clientUploadId) {
    return false;
  }

  if (typeof key !== 'string' || !key) {
    return false;
  }

  if (typeof uploadUrl !== 'string' || !uploadUrl) {
    return false;
  }

  if (headers !== undefined) {
    if (!isRecord(headers)) {
      return false;
    }

    for (const [headerKey, headerValue] of Object.entries(headers)) {
      if (typeof headerKey !== 'string' || typeof headerValue !== 'string') {
        return false;
      }
    }
  }

  return true;
};

const extractPresignedTargets = (payload: unknown): PresignedUploadTarget[] => {
  if (!isRecord(payload)) {
    throw new Error('Upload endpoint returned an unexpected response format.');
  }

  const uploads = (payload as PresignResponseBody).uploads;
  if (!Array.isArray(uploads)) {
    throw new Error('Upload endpoint did not include presigned upload descriptors.');
  }

  const parsed: PresignedUploadTarget[] = [];
  uploads.forEach((entry, index) => {
    if (!isPresignedTarget(entry)) {
      throw new Error(`Upload descriptor at index ${index} is invalid.`);
    }
    parsed.push(entry);
  });

  return parsed;
};

class UploadsService {
  async createPresignedUploads(files: PresignUploadRequestItem[]): Promise<PresignedUploadTarget[]> {
    if (files.length === 0) {
      return [];
    }

    const largestFile = files.reduce<PresignUploadRequestItem | null>((current, file) => {
      if (!current || file.contentLength > current.contentLength) {
        return file;
      }
      return current;
    }, null);

    if (largestFile && largestFile.contentLength > MAX_UPLOAD_FILE_BYTES) {
      const maxMb = Math.floor(MAX_UPLOAD_FILE_BYTES / (1024 * 1024));
      throw new Error(
        `"${largestFile.fileName}" is larger than the maximum allowed upload size of ${maxMb}MB.`,
      );
    }

    const totalBytes = files.reduce((acc, file) => acc + (file.contentLength || 0), 0);
    if (totalBytes > MAX_BATCH_UPLOAD_BYTES) {
      const maxMb = Math.floor(MAX_BATCH_UPLOAD_BYTES / (1024 * 1024));
      throw new Error(`Upload batch exceeds the ${maxMb}MB limit. Upload fewer files at once.`);
    }

    if (!API_ENDPOINTS.UPLOADS_CREATE) {
      throw new Error('Upload endpoint is not configured.');
    }

    const headers = new Headers();
    headers.set('X-Upload-Total-Bytes', String(totalBytes));
    headers.set('X-Upload-Max-File-Bytes', String(MAX_UPLOAD_FILE_BYTES));

    const response = await authService.authenticatedFetch(API_ENDPOINTS.UPLOADS_CREATE, {
      method: 'POST',
      body: JSON.stringify({ files }),
      requiresAuth: true,
      parseAs: 'json',
      headers,
    });

    if (!response.ok) {
      const message = `Failed to obtain upload URLs (status ${response.status}).`;
      throw new Error(message);
    }

    const payload = response.data ?? (await response.json());
    return extractPresignedTargets(payload);
  }

  async cleanupUploads(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    if (!API_ENDPOINTS.UPLOADS_CLEANUP) {
      console.warn('Upload cleanup endpoint is not configured; skipping cleanup.');
      return;
    }

    try {
      const response = await authService.authenticatedFetch(API_ENDPOINTS.UPLOADS_CLEANUP, {
        method: 'POST',
        body: JSON.stringify({ keys }),
        requiresAuth: true,
        parseAs: 'none',
      });

      if (!response.ok) {
        console.warn('Upload cleanup request failed.', { status: response.status });
      }
    } catch (error) {
      telemetryService.captureException(error, {
        message: 'Failed to clean up uploaded media keys after error',
        tags: {
          feature: 'uploads',
          operation: 'cleanup',
        },
        extra: {
          keyCount: keys.length,
        },
      });
    }
  }
}

export const uploadsService = new UploadsService();
