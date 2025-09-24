import { API_ENDPOINTS } from '../config/amplify';
import { apiClient } from './auth';

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
  const { data } = await apiClient.post<SubmitReviewResponse>(endpoint, payload, {
    requiresAuth: true,
  });

  if (!data) {
    throw new Error('Empty response received after submitting review.');
  }

  return data;
};

const getReviewSummary = async (plantId: string): Promise<ReviewSummary> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.REVIEWS_SUMMARY, 'REVIEWS_SUMMARY');
  const url = `${endpoint}?plantId=${encodeURIComponent(plantId)}`;
  const { data } = await apiClient.get<ReviewSummary | undefined>(url, { requiresAuth: true });

  return data ?? {};
};

export const reviewsService = {
  submitReview,
  getReviewSummary,
};

