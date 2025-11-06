/// <reference types="vitest" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock, captureExceptionMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock('../../config/amplify', () => ({
  API_ENDPOINTS: {
    EMAIL_SUBSCRIBE: 'https://api.example.com/email/subscribe',
    EMAIL_UNSUBSCRIBE: 'https://api.example.com/email/unsubscribe',
    EMAIL_LIFECYCLE: 'https://api.example.com/email/lifecycle',
    EMAIL_TEMPLATES_SYNC: 'https://api.example.com/email/templates-sync',
    EMAIL_CONSENT: 'https://api.example.com/email/consent',
  },
}));

vi.mock('../httpClient', () => ({
  httpClient: {
    request: requestMock,
  },
  createDeserializationError: (endpoint: string, error: unknown) => {
    const normalized = new Error(`Failed to deserialize response from ${endpoint}`);
    (normalized as any).cause = error;
    return normalized;
  },
}));

vi.mock('../telemetry', () => ({
  telemetryService: {
    captureException: captureExceptionMock,
  },
}));

import { emailService } from '../email';
import { API_ENDPOINTS } from '../../config/amplify';

type SubscribePayload = Parameters<typeof emailService.subscribeToMarketingList>[0];

describe('emailService', () => {
  const defaultEndpoints = { ...API_ENDPOINTS };

  beforeEach(() => {
    Object.assign(API_ENDPOINTS, defaultEndpoints);
    requestMock.mockReset();
    captureExceptionMock.mockReset();
  });

  afterEach(() => {
    Object.assign(API_ENDPOINTS, defaultEndpoints);
  });

  const baseSubscribePayload: SubscribePayload = {
    email: 'grower@example.com',
    source: 'waitlist',
    consent: {
      email: 'grower@example.com',
      marketingConsent: true,
      gdprConsent: true,
      consentAt: '2024-01-01T00:00:00.000Z',
      consentSource: 'waitlist-modal',
    },
  };

  it('rejects subscription attempts without GDPR consent', async () => {
    const payload = {
      ...baseSubscribePayload,
      consent: {
        ...baseSubscribePayload.consent,
        gdprConsent: false,
      },
    } as SubscribePayload;

    await expect(emailService.subscribeToMarketingList(payload)).rejects.toThrow('GDPR-compliant consent');
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('queues subscription when the ESP endpoint is not configured', async () => {
    (API_ENDPOINTS as any).EMAIL_SUBSCRIBE = '';
    (API_ENDPOINTS as any).EMAIL_CONSENT = '';

    const result = await emailService.subscribeToMarketingList(baseSubscribePayload);

    expect(result).toEqual({
      status: 'queued',
      message: 'Thanks for joining! We will add you as soon as email is configured.',
    });
    expect(requestMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('subscribes a contact and records consent when endpoints are available', async () => {
    requestMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ subscriptionId: 'sub-123', status: 'pending', message: 'Custom message' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await emailService.subscribeToMarketingList(baseSubscribePayload);

    expect(result).toEqual({
      subscriptionId: 'sub-123',
      status: 'pending',
      message: 'Custom message',
    });

    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      API_ENDPOINTS.EMAIL_SUBSCRIBE,
      expect.objectContaining({
        method: 'POST',
        operationName: 'email.subscribe',
      }),
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      API_ENDPOINTS.EMAIL_CONSENT,
      expect.objectContaining({
        method: 'POST',
        operationName: 'email.consent.record',
      }),
    );
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('sends lifecycle emails after synchronizing templates', async () => {
    requestMock.mockResolvedValue(new Response(null, { status: 204 }));

    await emailService.sendLifecycleEmail('welcome', {
      email: 'newuser@example.com',
      fullName: 'New Grower',
    });

    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      API_ENDPOINTS.EMAIL_TEMPLATES_SYNC,
      expect.objectContaining({
        method: 'POST',
        operationName: 'email.templates.sync',
      }),
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      API_ENDPOINTS.EMAIL_LIFECYCLE,
      expect.objectContaining({
        method: 'POST',
        operationName: 'email.lifecycle.welcome',
      }),
    );
  });

  it('schedules review reminder emails for a future date', async () => {
    requestMock.mockResolvedValue(new Response(null, { status: 204 }));

    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    await emailService.scheduleReviewReminder(
      {
        email: 'buyer@example.com',
        orderId: 'order-123',
        reviewUrl: 'https://example.com/review',
      },
      3,
    );

    vi.useRealTimers();

    expect(requestMock).toHaveBeenCalled();
    const lifecycleCall = requestMock.mock.calls[requestMock.mock.calls.length - 1];
    expect(lifecycleCall?.[0]).toBe(API_ENDPOINTS.EMAIL_LIFECYCLE);
    const body = JSON.parse((lifecycleCall?.[1] as RequestInit).body as string);
    expect(body.payload.daysSinceDelivery).toBe(3);
    expect(new Date(body.sendAt).getTime()).toBe(now + 3 * 24 * 60 * 60 * 1000);
  });
});
