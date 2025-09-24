import { API_ENDPOINTS } from '../config/amplify';
import { apiClient } from './auth';

const ensureEndpoint = (endpoint: string | undefined, key: keyof typeof API_ENDPOINTS) => {
  if (!endpoint) {
    throw new Error(`Missing API endpoint configuration for ${key}`);
  }
  return endpoint;
};

export type MessageParticipantRole = 'buyer' | 'seller' | 'system';

export interface ThreadMessage {
  id: string;
  threadId: string;
  body: string;
  senderId: string;
  senderType?: MessageParticipantRole;
  createdAt?: string;
  status?: 'pending' | 'sent' | 'delivered' | 'read';
}

export interface MessageThread {
  id: string;
  plantId: string;
  sellerId: string;
  buyerId?: string;
  createdAt?: string;
  messages?: ThreadMessage[];
  unreadCount?: number;
}

export interface StartThreadPayload {
  plantId: string;
  sellerId: string;
  initialMessage?: string;
}

export interface SendMessagePayload {
  threadId: string;
  body: string;
  attachments?: unknown[];
}

const startThread = async (payload: StartThreadPayload): Promise<MessageThread> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.MESSAGES_THREADS, 'MESSAGES_THREADS');
  const { data } = await apiClient.post<MessageThread>(endpoint, payload, { requiresAuth: true });

  if (!data) {
    throw new Error('Empty response received when starting conversation.');
  }

  return {
    ...data,
    messages: data.messages ?? [],
  };
};

const sendMessage = async (payload: SendMessagePayload): Promise<ThreadMessage> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.MESSAGES_SEND, 'MESSAGES_SEND');
  const { data } = await apiClient.post<ThreadMessage>(endpoint, payload, { requiresAuth: true });

  if (!data) {
    throw new Error('Empty response received after sending message.');
  }

  return data;
};

const markThreadRead = async (threadId: string): Promise<void> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.MESSAGES_MARK_READ, 'MESSAGES_MARK_READ');
  await apiClient.post<null>(endpoint, { threadId }, { requiresAuth: true, parseAs: 'none' });
};

const getUnreadCount = async (): Promise<number> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.MESSAGES_UNREAD_COUNT, 'MESSAGES_UNREAD_COUNT');
  const { data } = await apiClient.get<{ unreadCount?: number }>(endpoint, { requiresAuth: true });

  return data?.unreadCount ?? 0;
};

export const messagesService = {
  startThread,
  sendMessage,
  markThreadRead,
  getUnreadCount,
};

