export interface CheckoutPlant {
  id: string;
  name: string;
  price: number;
}

export interface CreateCheckoutSessionResponse {
  url?: string;
  checkoutUrl?: string;
}

const checkoutEndpoint = process.env.REACT_APP_STRIPE_CHECKOUT_ENDPOINT;

export const isStripeCheckoutConfigured = Boolean(checkoutEndpoint);

export async function createStripeCheckoutSession(
  plant: CheckoutPlant
): Promise<string> {
  if (!checkoutEndpoint) {
    throw new Error(
      'Stripe checkout is not configured. Set REACT_APP_STRIPE_CHECKOUT_ENDPOINT to your secure backend checkout endpoint.'
    );
  }

  const response = await fetch(checkoutEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plantId: plant.id,
      plantName: plant.name,
      amount: Math.round(plant.price * 100),
      currency: 'usd',
      successUrl: `${window.location.origin}/?checkout=success&plant=${encodeURIComponent(plant.id)}`,
      cancelUrl: `${window.location.origin}/?checkout=cancelled&plant=${encodeURIComponent(plant.id)}`,
    }),
  });

  if (!response.ok) {
    throw new Error('Unable to start Stripe checkout. Please try again.');
  }

  const checkoutSession = (await response.json()) as CreateCheckoutSessionResponse;
  const redirectUrl = checkoutSession.url ?? checkoutSession.checkoutUrl;

  if (!redirectUrl) {
    throw new Error('Stripe checkout did not return a redirect URL.');
  }

  return redirectUrl;
}
