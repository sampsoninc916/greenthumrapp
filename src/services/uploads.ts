import { API_ENDPOINTS } from '../config/amplify';
import { authService } from './auth';

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

    if (!API_ENDPOINTS.UPLOADS_CREATE) {
      throw new Error('Upload endpoint is not configured.');
    }

    const response = await authService.authenticatedFetch(API_ENDPOINTS.UPLOADS_CREATE, {
      method: 'POST',
      body: JSON.stringify({ files }),
      requiresAuth: true,
      parseAs: 'json',
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
      console.error('Failed to clean up uploaded media keys after error.', error);
    }
  }
}

export const uploadsService = new UploadsService();
