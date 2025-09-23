import { API_ENDPOINTS } from '../config/amplify';
import { apiClient } from './auth';

interface ApiErrorPayload {
  message?: string;
  [key: string]: unknown;
}

const safeJson = async <T>(response: Response): Promise<T | null> => {
  try {
    const text = await response.clone().text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const extractErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const data = await safeJson<ApiErrorPayload>(response);
  if (data?.message && typeof data.message === 'string') {
    return data.message;
  }
  return fallback;
};

const assertSuccess = async (response: Response, fallback: string) => {
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, fallback));
  }
};

const parseJsonResponse = async <T>(response: Response, fallback: string): Promise<T | undefined> => {
  await assertSuccess(response, fallback);

  if (response.status === 204) {
    return undefined;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
};

const ensureEndpoint = (endpoint: string | undefined, key: keyof typeof API_ENDPOINTS) => {
  if (!endpoint) {
    throw new Error(`Missing API endpoint configuration for ${key}`);
  }
  return endpoint;
};

export interface SubmitReviewPayload {
  plantId: string;
  rating: number;
  comment: string;
  orderId?: string;
}

export interface SubmitReviewResponse {
  reviewId?: string;
  plantId: string;
  rating: number;
  comment?: string;
  sellerRating?: number;
  totalReviews?: number;
}

export interface ReviewSummary {
  sellerRating?: number;
  totalReviews?: number;
}

const submitReview = async (payload: SubmitReviewPayload): Promise<SubmitReviewResponse> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.REVIEWS_SUBMIT, 'REVIEWS_SUBMIT');
  const response = await apiClient.post(endpoint, payload, true);
  const data = await parseJsonResponse<SubmitReviewResponse>(response, 'Unable to submit review.');

  if (!data) {
    throw new Error('Empty response received after submitting review.');
  }

  return data;
};

const getReviewSummary = async (plantId: string): Promise<ReviewSummary> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.REVIEWS_SUMMARY, 'REVIEWS_SUMMARY');
  const url = `${endpoint}?plantId=${encodeURIComponent(plantId)}`;
  const response = await apiClient.get(url, true);
  const summary = await parseJsonResponse<ReviewSummary>(response, 'Unable to fetch review summary.');

  return summary ?? {};
};

export const reviewsService = {
  submitReview,
  getReviewSummary,
};

