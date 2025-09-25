import mixpanel from 'mixpanel-browser';

type AnalyticsPayload = Record<string, unknown> | undefined;

type SignupPayloadBase = {
  username?: string;
  email?: string;
  role?: string;
  marketingEmailOptIn?: boolean;
  marketingSmsOptIn?: boolean;
  stage?: string;
};

type ListingViewPayload = {
  plantId: string;
  plantName?: string;
  price?: number;
  category?: string;
  sellerId?: string;
  location?: string;
};

type CartItemPayload = {
  plantId: string;
  plantName?: string;
  price?: number;
  quantity?: number;
  sellerId?: string;
  category?: string;
  location?: string;
  actionContext?: string;
};

type DeliverySelectionPayload = {
  deliveryMethod: string;
  previousMethod?: string;
};

type CheckoutPayload = {
  total: number;
  itemCount: number;
  deliveryMethod?: string | null;
  paymentMethod?: string;
  stage?: string;
  transactionId?: string;
};

type PurchasePayload = CheckoutPayload & {
  orderId: string;
};

const getEnvValue = (key: string): string | undefined => {
  try {
    const value = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env?.[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
};

const mixpanelToken = getEnvValue('VITE_MIXPANEL_TOKEN');

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

let hasInitializedMixpanel = false;

const initializeMixpanel = (): boolean => {
  if (hasInitializedMixpanel) {
    return true;
  }

  if (!mixpanelToken || typeof window === 'undefined') {
    return false;
  }

  try {
    mixpanel.init(mixpanelToken, {
      debug: isDevelopment(),
      track_pageview: false,
    });
    hasInitializedMixpanel = true;
    return true;
  } catch (error) {
    console.warn('Mixpanel initialization failed', error);
    return false;
  }
};

const track = (eventName: string, payload?: Record<string, unknown>) => {
  try {
    if (initializeMixpanel()) {
      mixpanel.track(eventName, payload);
      return;
    }
  } catch (error) {
    console.warn('Analytics tracking failed', error);
  }

  emitConsoleFallback(eventName, payload);
};

const identify = (userId: string, traits?: Record<string, unknown>) => {
  try {
    if (!userId || !initializeMixpanel()) {
      return;
    }

    mixpanel.identify(userId);

    if (traits && Object.keys(traits).length > 0) {
      mixpanel.people.set(traits);
    }
  } catch (error) {
    console.warn('Analytics identify failed', error);
  }
};

const alias = (aliasId: string, originalId?: string) => {
  try {
    if (!aliasId || !initializeMixpanel()) {
      return;
    }

    if (originalId) {
      mixpanel.alias(aliasId, originalId);
    } else {
      mixpanel.alias(aliasId);
    }
  } catch (error) {
    console.warn('Analytics alias failed', error);
  }
};

export const analyticsService = {
  track,
  identify,
  alias,
  trackSignupStarted(payload: SignupPayloadBase) {
    track('user_signup_started', payload);
  },
  trackSignupSucceeded(payload: SignupPayloadBase & { method?: string }) {
    track('user_signup_succeeded', payload);
  },
  trackSignupFailed(payload: SignupPayloadBase & { error: string }) {
    track('user_signup_failed', payload);
  },
  trackSignupConfirmed(payload: SignupPayloadBase) {
    track('user_signup_confirmed', payload);
  },
  trackListingViewed(payload: ListingViewPayload) {
    track('listing_viewed', payload);
  },
  trackCartItemAdded(payload: CartItemPayload) {
    track('cart_item_added', payload);
  },
  trackCartQuantityUpdated(payload: CartItemPayload & { previousQuantity: number; nextQuantity: number }) {
    track('cart_quantity_updated', payload);
  },
  trackCartItemRemoved(payload: CartItemPayload) {
    track('cart_item_removed', payload);
  },
  trackDeliveryOptionSelected(payload: DeliverySelectionPayload) {
    track('cart_delivery_option_selected', payload);
  },
  trackCheckoutStarted(payload: CheckoutPayload) {
    track('checkout_started', payload);
  },
  trackCheckoutCompleted(payload: CheckoutPayload) {
    track('checkout_completed', payload);
  },
  trackCheckoutFailed(payload: CheckoutPayload & { error: string }) {
    track('checkout_failed', payload);
  },
  trackPurchaseCompleted(payload: PurchasePayload) {
    track('purchase_completed', payload);
  },
};

export type { CheckoutPayload, DeliverySelectionPayload, ListingViewPayload, PurchasePayload, SignupPayloadBase };
