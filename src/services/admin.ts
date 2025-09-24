import type { UserRole } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config/amplify';
import { apiClient } from './auth';
import type { LivePlantWarranty, PlantCompliance } from '../interfaces/Plant';

const ensureEndpoint = (endpoint: string | undefined, key: keyof typeof API_ENDPOINTS) => {
  if (!endpoint) {
    throw new Error(`Missing API endpoint configuration for ${key}`);
  }
  return endpoint;
};

const buildQueryString = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim().length > 0) {
      query.set(key, value);
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
};

export type UserStatus = 'active' | 'pending' | 'suspended' | 'under_review';
export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'taken_down' | 'flagged';
export type DisputeStatus = 'open' | 'investigating' | 'resolved' | 'escalated';
export type DisputeSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
  lastActiveAt?: string;
  reportsCount?: number;
  suspensionsCount?: number;
}

export interface AdminListing {
  id: string;
  title: string;
  status: ListingStatus;
  sellerId: string;
  sellerName?: string;
  category?: string;
  price?: number;
  submittedAt?: string;
  flaggedReason?: string;
  flaggedCount?: number;
  compliance?: PlantCompliance;
  livePlantWarranty?: LivePlantWarranty;
}

export interface AdminDispute {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerId: string;
  buyerName?: string;
  sellerId: string;
  sellerName?: string;
  status: DisputeStatus;
  severity?: DisputeSeverity;
  openedAt?: string;
  updatedAt?: string;
  summary?: string;
}

export interface AdminUserFilters {
  status?: UserStatus;
  role?: UserRole;
  query?: string;
}

export interface AdminListingFilters {
  status?: ListingStatus;
  flagged?: boolean;
  query?: string;
}

export interface AdminDisputeFilters {
  status?: DisputeStatus;
  severity?: DisputeSeverity;
  query?: string;
}

export interface AdminAuditEvent {
  action: string;
  entityType?: 'user' | 'listing' | 'dispute' | string;
  entityId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  message?: string;
}

const logAuditEvent = async (event: AdminAuditEvent): Promise<void> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.ADMIN_AUDIT, 'ADMIN_AUDIT');
  await apiClient.post<null>(endpoint, event, { requiresAuth: true, parseAs: 'none' });
};

const fetchUsers = async (filters: AdminUserFilters = {}): Promise<AdminUser[]> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.ADMIN_USERS, 'ADMIN_USERS');
  const query = buildQueryString({
    status: filters.status,
    role: filters.role,
    q: filters.query,
  });
  const { data } = await apiClient.get<AdminUser[]>(`${endpoint}${query}`, { requiresAuth: true });
  return data ?? [];
};

const updateUserStatus = async (userId: string, status: UserStatus, reason?: string): Promise<AdminUser> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.ADMIN_USERS, 'ADMIN_USERS');
  const { data } = await apiClient.put<AdminUser>(
    `${endpoint}/${encodeURIComponent(userId)}/status`,
    { status, reason },
    { requiresAuth: true },
  );
  if (!data) {
    throw new Error('No data returned after updating user status.');
  }

  await logAuditEvent({
    action: 'user.status_change',
    entityType: 'user',
    entityId: userId,
    metadata: { status, reason },
    message: reason,
  });

  return data;
};

const fetchListings = async (filters: AdminListingFilters = {}): Promise<AdminListing[]> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.ADMIN_LISTINGS, 'ADMIN_LISTINGS');
  const query = buildQueryString({
    status: filters.status,
    flagged: filters.flagged === undefined ? undefined : String(filters.flagged),
    q: filters.query,
  });
  const { data } = await apiClient.get<AdminListing[]>(`${endpoint}${query}`, { requiresAuth: true });
  return data ?? [];
};

const approveListing = async (listingId: string, notes?: string): Promise<AdminListing> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.ADMIN_LISTINGS, 'ADMIN_LISTINGS');
  const { data } = await apiClient.post<AdminListing>(
    `${endpoint}/${encodeURIComponent(listingId)}/approve`,
    { notes },
    { requiresAuth: true },
  );
  if (!data) {
    throw new Error('No data returned after approving listing.');
  }

  await logAuditEvent({
    action: 'listing.approved',
    entityType: 'listing',
    entityId: listingId,
    metadata: { notes },
    message: notes,
  });

  return data;
};

const takeDownListing = async (listingId: string, reason: string): Promise<AdminListing> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.ADMIN_LISTINGS, 'ADMIN_LISTINGS');
  const { data } = await apiClient.post<AdminListing>(
    `${endpoint}/${encodeURIComponent(listingId)}/takedown`,
    { reason },
    { requiresAuth: true },
  );
  if (!data) {
    throw new Error('No data returned after taking down listing.');
  }

  await logAuditEvent({
    action: 'listing.taken_down',
    entityType: 'listing',
    entityId: listingId,
    metadata: { reason },
    message: reason,
  });

  return data;
};

const fetchDisputes = async (filters: AdminDisputeFilters = {}): Promise<AdminDispute[]> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.ADMIN_DISPUTES, 'ADMIN_DISPUTES');
  const query = buildQueryString({
    status: filters.status,
    severity: filters.severity,
    q: filters.query,
  });
  const { data } = await apiClient.get<AdminDispute[]>(`${endpoint}${query}`, { requiresAuth: true });
  return data ?? [];
};

const resolveDispute = async (disputeId: string, resolutionNotes: string): Promise<AdminDispute> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.ADMIN_DISPUTES, 'ADMIN_DISPUTES');
  const { data } = await apiClient.post<AdminDispute>(
    `${endpoint}/${encodeURIComponent(disputeId)}/resolve`,
    { resolutionNotes },
    { requiresAuth: true },
  );
  if (!data) {
    throw new Error('No data returned after resolving dispute.');
  }

  await logAuditEvent({
    action: 'dispute.resolved',
    entityType: 'dispute',
    entityId: disputeId,
    metadata: { resolutionNotes },
    message: resolutionNotes,
  });

  return data;
};

const escalateDispute = async (disputeId: string, escalationReason: string): Promise<AdminDispute> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.ADMIN_DISPUTES, 'ADMIN_DISPUTES');
  const { data } = await apiClient.post<AdminDispute>(
    `${endpoint}/${encodeURIComponent(disputeId)}/escalate`,
    { escalationReason },
    { requiresAuth: true },
  );
  if (!data) {
    throw new Error('No data returned after escalating dispute.');
  }

  await logAuditEvent({
    action: 'dispute.escalated',
    entityType: 'dispute',
    entityId: disputeId,
    metadata: { escalationReason },
    message: escalationReason,
  });

  return data;
};

export const adminService = {
  fetchUsers,
  updateUserStatus,
  fetchListings,
  approveListing,
  takeDownListing,
  fetchDisputes,
  resolveDispute,
  escalateDispute,
  logAuditEvent,
};

