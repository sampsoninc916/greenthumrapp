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
  const response = await apiClient.post(endpoint, payload, true);
  const data = await parseJsonResponse<MessageThread>(response, 'Unable to start conversation.');

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
  const response = await apiClient.post(endpoint, payload, true);
  const message = await parseJsonResponse<ThreadMessage>(response, 'Unable to send message.');

  if (!message) {
    throw new Error('Empty response received after sending message.');
  }

  return message;
};

const markThreadRead = async (threadId: string): Promise<void> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.MESSAGES_MARK_READ, 'MESSAGES_MARK_READ');
  const response = await apiClient.post(endpoint, { threadId }, true);
  await assertSuccess(response, 'Unable to update conversation status.');
};

const getUnreadCount = async (): Promise<number> => {
  const endpoint = ensureEndpoint(API_ENDPOINTS.MESSAGES_UNREAD_COUNT, 'MESSAGES_UNREAD_COUNT');
  const response = await apiClient.get(endpoint, true);
  const payload = await parseJsonResponse<{ unreadCount?: number }>(response, 'Unable to fetch unread conversations.');

  return payload?.unreadCount ?? 0;
};

export const messagesService = {
  startThread,
  sendMessage,
  markThreadRead,
  getUnreadCount,
};

