type AnalyticsPayload = Record<string, unknown> | undefined;

const isDevelopment = () => {
  try {
    return typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE !== 'production';
  } catch {
    return true;
  }
};

const emitConsoleFallback = (eventName: string, payload: AnalyticsPayload) => {
  if (isDevelopment()) {
    console.info(`[analytics] ${eventName}`, payload ?? {});
  }
};

const track = (eventName: string, payload?: Record<string, unknown>) => {
  try {
    if (typeof window !== 'undefined') {
      const anyWindow = window as unknown as {
        analytics?: { track?: (name: string, details?: Record<string, unknown>) => void };
        gtag?: (...args: unknown[]) => void;
      };

      if (anyWindow.analytics?.track) {
        anyWindow.analytics.track(eventName, payload);
        return;
      }

      if (typeof anyWindow.gtag === 'function') {
        anyWindow.gtag('event', eventName, payload ?? {});
        return;
      }
    }
  } catch (error) {
    console.warn('Analytics tracking failed', error);
  }

  emitConsoleFallback(eventName, payload);
};

export const analyticsService = {
  track,
};

