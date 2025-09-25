import { API_ENDPOINTS } from '../config/amplify';
import { createDeserializationError, httpClient } from './httpClient';
import { telemetryService } from './telemetry';

type SubscriptionIncentive = {
  type: string;
  description: string;
  value?: string;
};

type ConsentMetadata = Record<string, unknown> | undefined;

type ConsentRecord = {
  email: string;
  marketingConsent: boolean;
  gdprConsent: boolean;
  consentAt: string;
  consentSource: string;
  ipAddress?: string;
  metadata?: ConsentMetadata;
};

interface SubscribePayload {
  email: string;
  fullName?: string;
  source?: string;
  tags?: string[];
  incentives?: SubscriptionIncentive[];
  consent: ConsentRecord;
  metadata?: Record<string, unknown>;
}

interface SubscribeResponse {
  subscriptionId?: string;
  status?: 'subscribed' | 'pending' | 'queued';
  message?: string;
}

interface UnsubscribePayload {
  email: string;
  reason?: string;
  gdprDelete?: boolean;
  consentSource?: string;
}

interface UnsubscribeResponse {
  status?: 'unsubscribed' | 'not_found' | 'queued';
  message?: string;
}

type LifecycleEventPayloadMap = {
  welcome: {
    email: string;
    fullName?: string;
    incentive?: string;
  };
  waitlist_confirmation: {
    email: string;
    firstName?: string;
    incentive?: string;
    channel?: string;
  };
  review_reminder: {
    email: string;
    orderId: string;
    reviewUrl: string;
    daysSinceDelivery?: number;
  };
};

type LifecycleEvent = keyof LifecycleEventPayloadMap;

interface LifecycleEmailOptions {
  sendAt?: string;
}

const TEMPLATE_DEFINITIONS: Record<LifecycleEvent, { templateId: string; name: string; description: string; serverPath: string }>
  = {
    welcome: {
      templateId: 'welcome-new-grower',
      name: 'Welcome to Thumr',
      description: 'Sent immediately after a grower confirms their account.',
      serverPath: 'server/email-templates/welcome.html',
    },
    waitlist_confirmation: {
      templateId: 'waitlist-confirmation',
      name: 'Waitlist confirmation',
      description: 'Confirms a subscriber has joined the waitlist and reiterates their incentive.',
      serverPath: 'server/email-templates/waitlist-confirmation.html',
    },
    review_reminder: {
      templateId: 'post-purchase-review-reminder',
      name: 'Review reminder',
      description: 'Reminds buyers to review their latest order after delivery.',
      serverPath: 'server/email-templates/review-reminder.html',
    },
  };

let templatesSynchronized = false;

const parseJsonResponse = async <T>(response: Response, endpoint: string): Promise<T | null> => {
  if (response.status === 204) {
    return null;
  }

  const rawBody = await response.text();
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch (error) {
    throw createDeserializationError(endpoint, error);
  }
};

const ensureTemplatesConfigured = async (): Promise<boolean> => {
  if (templatesSynchronized) {
    return true;
  }

  const endpoint = API_ENDPOINTS.EMAIL_TEMPLATES_SYNC;
  if (!endpoint) {
    templatesSynchronized = true;
    console.info('[email] Template sync endpoint not configured; skipping server synchronization.');
    return false;
  }

  try {
    await httpClient.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templates: Object.entries(TEMPLATE_DEFINITIONS).map(([event, template]) => ({
          event,
          ...template,
        })),
      }),
      operationName: 'email.templates.sync',
    });

    templatesSynchronized = true;
    return true;
  } catch (error) {
    telemetryService.captureException(error, {
      message: 'Failed to synchronize email templates',
      tags: {
        feature: 'email',
        operation: 'sync-templates',
      },
    });
    return false;
  }
};

const recordConsent = async (consent: ConsentRecord): Promise<void> => {
  const endpoint = API_ENDPOINTS.EMAIL_CONSENT;
  if (!endpoint) {
    console.info('[email] Consent endpoint not configured; consent stored locally only.');
    return;
  }

  try {
    await httpClient.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(consent),
      operationName: 'email.consent.record',
    });
  } catch (error) {
    telemetryService.captureException(error, {
      message: 'Failed to persist consent with ESP',
      tags: {
        feature: 'email',
        operation: 'record-consent',
      },
      extra: {
        email: consent.email,
      },
    });
    throw error;
  }
};

const subscribeToMarketingList = async (payload: SubscribePayload): Promise<SubscribeResponse> => {
  const endpoint = API_ENDPOINTS.EMAIL_SUBSCRIBE;
  const consentRecord: ConsentRecord = {
    ...payload.consent,
    consentAt: payload.consent.consentAt || new Date().toISOString(),
  };

  if (!consentRecord.gdprConsent) {
    throw new Error('GDPR-compliant consent is required before subscribing.');
  }

  if (!endpoint) {
    await recordConsent(consentRecord).catch(() => undefined);
    console.info('[email] Subscription endpoint not configured; consent captured without ESP sync.');
    return {
      status: 'queued',
      message: 'Thanks for joining! We will add you as soon as email is configured.',
    };
  }

  try {
    const response = await httpClient.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        consent: consentRecord,
        tags: payload.tags?.filter((tag) => typeof tag === 'string' && tag.length > 0),
      }),
      operationName: 'email.subscribe',
    });

    const parsed = await parseJsonResponse<SubscribeResponse>(response, endpoint);
    await recordConsent(consentRecord).catch(() => undefined);
    return {
      subscriptionId: parsed?.subscriptionId,
      status: parsed?.status ?? (response.ok ? 'subscribed' : 'queued'),
      message:
        parsed?.message ??
        (parsed?.status === 'pending'
          ? 'Check your inbox to confirm your subscription.'
          : 'You are on the list!'),
    };
  } catch (error) {
    telemetryService.captureException(error, {
      message: 'Failed to subscribe contact to marketing list',
      tags: {
        feature: 'email',
        operation: 'subscribe',
      },
      extra: {
        email: payload.email,
        source: payload.source,
      },
    });
    throw error;
  }
};

const unsubscribe = async (payload: UnsubscribePayload): Promise<UnsubscribeResponse> => {
  const endpoint = API_ENDPOINTS.EMAIL_UNSUBSCRIBE;
  const consentRecord: ConsentRecord = {
    email: payload.email,
    marketingConsent: false,
    gdprConsent: true,
    consentAt: new Date().toISOString(),
    consentSource: payload.consentSource ?? 'unsubscribe',
    metadata: {
      reason: payload.reason,
      gdprDelete: payload.gdprDelete ?? false,
    },
  };

  if (!endpoint) {
    await recordConsent(consentRecord).catch(() => undefined);
    console.info('[email] Unsubscribe endpoint not configured; consent updated locally.');
    return {
      status: 'queued',
      message: 'Your preferences are updated. Please allow a moment for changes to apply.',
    };
  }

  try {
    const response = await httpClient.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      operationName: 'email.unsubscribe',
    });

    const parsed = await parseJsonResponse<UnsubscribeResponse>(response, endpoint);
    await recordConsent(consentRecord).catch(() => undefined);
    return {
      status: parsed?.status ?? 'unsubscribed',
      message: parsed?.message ?? 'You have been unsubscribed.',
    };
  } catch (error) {
    telemetryService.captureException(error, {
      message: 'Failed to unsubscribe contact',
      tags: {
        feature: 'email',
        operation: 'unsubscribe',
      },
      extra: {
        email: payload.email,
      },
    });
    throw error;
  }
};

const sendLifecycleEmail = async <T extends LifecycleEvent>(
  event: T,
  payload: LifecycleEventPayloadMap[T],
  options: LifecycleEmailOptions = {},
): Promise<void> => {
  const endpoint = API_ENDPOINTS.EMAIL_LIFECYCLE;
  if (!endpoint) {
    console.info('[email] Lifecycle endpoint not configured; skipping email send.', { event });
    return;
  }

  await ensureTemplatesConfigured();

  const template = TEMPLATE_DEFINITIONS[event];
  try {
    await httpClient.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        templateId: template.templateId,
        payload,
        sendAt: options.sendAt,
      }),
      operationName: `email.lifecycle.${event}`,
    });
  } catch (error) {
    telemetryService.captureException(error, {
      message: 'Failed to send lifecycle email',
      tags: {
        feature: 'email',
        operation: `lifecycle-${event}`,
      },
      extra: {
        templateId: template.templateId,
        email: (payload as { email: string }).email,
      },
    });
    throw error;
  }
};

const scheduleReviewReminder = async (
  payload: LifecycleEventPayloadMap['review_reminder'],
  daysFromNow: number,
): Promise<void> => {
  const sendAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
  await sendLifecycleEmail('review_reminder', { ...payload, daysSinceDelivery: daysFromNow }, { sendAt });
};

export const emailService = {
  ensureTemplatesConfigured,
  subscribeToMarketingList,
  unsubscribe,
  sendLifecycleEmail,
  scheduleReviewReminder,
  recordConsent,
};

export type {
  SubscribePayload,
  SubscribeResponse,
  UnsubscribePayload,
  UnsubscribeResponse,
  ConsentRecord,
  SubscriptionIncentive,
  LifecycleEvent,
  LifecycleEmailOptions,
  LifecycleEventPayloadMap,
};
