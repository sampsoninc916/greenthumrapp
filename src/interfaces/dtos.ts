export const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
};

const isFiniteNumberLike = (value: unknown): boolean => {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed);
  }
  return false;
};

export interface PlantResponseDto {
  id: string;
  name: string;
  price: number | string;
  seller?: string;
  sellerId?: string;
  sellerAvatar?: string;
  sellerRating?: number | string;
  sellerReviewCount?: number | string;
  category?: string;
  species?: string;
  cultivar?: string;
  usdaZone?: string;
  lightPreference?: string;
  soilPreference?: string;
  condition?: string;
  description?: string;
  careInstructions?: string;
  location?: string;
  postedDate?: string;
  potSize?: string;
  height?: string;
  packagingNotes?: string;
  images?: string[];
  deliveryMethods?: string[];
  availableZipRanges?: Array<Record<string, unknown>>;
  livePlantWarranty?: Record<string, unknown> | null;
  compliance?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export const isPlantResponseDto = (value: unknown): value is PlantResponseDto => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.trim().length === 0) {
    return false;
  }
  if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    return false;
  }
  if (!isFiniteNumberLike(record.price)) {
    return false;
  }
  if (record.images !== undefined && !isStringArray(record.images)) {
    return false;
  }
  if (record.deliveryMethods !== undefined && !isStringArray(record.deliveryMethods)) {
    return false;
  }
  return true;
};

export interface UserConsentDto {
  termsAcceptedAt?: string | null;
  privacyAcceptedAt?: string | null;
  marketingEmailOptIn?: boolean;
  marketingSmsOptIn?: boolean;
  marketingGlobalUnsubscribed?: boolean;
  [key: string]: unknown;
}

export interface UserProfileResponseDto {
  userId: string;
  fullName?: string;
  joinedDate?: string;
  profilePic?: string;
  description?: string;
  subscription?: string;
  consents?: UserConsentDto | null;
  plantListings?: unknown;
  savedListings?: unknown;
  [key: string]: unknown;
}

export const isUserProfileResponseDto = (value: unknown): value is UserProfileResponseDto => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.userId !== 'string' || record.userId.trim().length === 0) {
    return false;
  }
  if (record.consents !== undefined && record.consents !== null && typeof record.consents !== 'object') {
    return false;
  }
  return true;
};

export const toBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return fallback;
};

export const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
