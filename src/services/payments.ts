export interface CardPaymentMethod {
  type: 'card';
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvc: string;
}

export interface PaymentPayload {
  amount: number;
  currency: string;
  paymentMethod: CardPaymentMethod;
  billingDetails?: {
    name?: string;
    email?: string;
  };
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  errorMessage?: string;
}

const PAYMENT_ENDPOINT = import.meta.env.VITE_PAYMENTS_ENDPOINT as string | undefined;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const processPayment = async (payload: PaymentPayload): Promise<PaymentResult> => {
  try {
    if (payload.amount <= 0) {
      return { success: false, errorMessage: 'Payment amount must be greater than zero.' };
    }

    if (PAYMENT_ENDPOINT) {
      const response = await fetch(PAYMENT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Payment request failed.');
      }

      const data = (await response.json()) as PaymentResult;

      if (!data.success) {
        return {
          success: false,
          errorMessage: data.errorMessage || 'Payment was not successful.'
        };
      }

      return data;
    }

    await wait(1000);

    const sanitizedCard = payload.paymentMethod.cardNumber.replace(/\s+/g, '');
    if (sanitizedCard.length < 12) {
      return { success: false, errorMessage: 'The card number appears to be invalid.' };
    }

    if (!payload.paymentMethod.expMonth || !payload.paymentMethod.expYear) {
      return { success: false, errorMessage: 'Card expiration is required.' };
    }

    return {
      success: true,
      transactionId: `test_${Date.now()}`
    };
  } catch (error) {
    console.error('Payment processing error', error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'An unknown error occurred while processing the payment.'
    };
  }
};
