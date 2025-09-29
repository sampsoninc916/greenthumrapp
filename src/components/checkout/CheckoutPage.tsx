import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import type { CheckoutAddress } from '../../interfaces/Checkout';
import { formatCurrency } from '../../utils/currency';
import { processPayment } from '../../services/payments';
import { analyticsService } from '../../services/analytics';
import { telemetryService } from '../../services/telemetry';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface PaymentFormState {
  cardNumber: string;
  expiry: string;
  cvc: string;
}

const initialAddress: CheckoutAddress = {
  fullName: '',
  email: '',
  street: '',
  city: '',
  state: '',
  postalCode: '',
  instructions: ''
};

const initialPayment: PaymentFormState = {
  cardNumber: '',
  expiry: '',
  cvc: ''
};

export const CheckoutPage = () => {
  const { items, totals, selectedDeliveryOption, deliveryOptions } = useCart();
  const navigate = useNavigate();
  const [address, setAddress] = useState<CheckoutAddress>(initialAddress);
  const [payment, setPayment] = useState<PaymentFormState>(initialPayment);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart', { replace: true });
    }
  }, [items.length, navigate]);

  const formattedTotals = useMemo(
    () => ({
      subtotal: formatCurrency(totals.subtotal),
      delivery: formatCurrency(totals.delivery),
      total: formatCurrency(totals.total)
    }),
    [totals]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!address.fullName || !address.email || !address.street || !address.city || !address.state || !address.postalCode) {
      setErrorMessage('Please complete your contact and delivery address details.');
      return;
    }

    if (!payment.cardNumber || !payment.expiry || !payment.cvc) {
      setErrorMessage('Payment details are required to complete your order.');
      return;
    }

    const [expMonth = '', expYear = ''] = payment.expiry.split('/').map((part) => part.trim());

    setIsProcessing(true);
    try {
      const checkoutEventContext = {
        total: totals.total,
        itemCount: totals.itemCount,
        deliveryMethod: selectedDeliveryOption?.id ?? deliveryOptions[0]?.id ?? null,
        paymentMethod: 'card',
      };

      analyticsService.trackCheckoutStarted({
        ...checkoutEventContext,
        stage: 'payment_attempt',
      });

      const paymentResult = await processPayment({
        amount: totals.total,
        currency: 'USD',
        paymentMethod: {
          type: 'card',
          cardNumber: payment.cardNumber,
          expMonth,
          expYear,
          cvc: payment.cvc
        },
        billingDetails: {
          name: address.fullName,
          email: address.email
        },
        metadata: {
          items: String(totals.itemCount),
          deliveryMethod: selectedDeliveryOption?.id ?? deliveryOptions[0]?.id ?? 'pickup'
        }
      });

      if (!paymentResult.success) {
        const message = paymentResult.errorMessage ?? 'Something went wrong while processing the payment.';
        setErrorMessage(message);
        analyticsService.trackCheckoutFailed({
          ...checkoutEventContext,
          stage: 'payment_failed',
          error: message,
        });
        return;
      }

      analyticsService.trackCheckoutCompleted({
        ...checkoutEventContext,
        stage: 'payment_succeeded',
        transactionId: paymentResult.transactionId,
      });

      navigate('/checkout/confirmation', {
        replace: true,
        state: {
          orderId: paymentResult.transactionId ?? `order_${Date.now()}`,
          address: { ...address },
          totals: { ...totals },
          items: items.map((item) => ({ ...item })),
          deliveryOption: selectedDeliveryOption ?? deliveryOptions[0] ?? null,
          placedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown checkout error';
      analyticsService.trackCheckoutFailed({
        total: totals.total,
        itemCount: totals.itemCount,
        deliveryMethod: selectedDeliveryOption?.id ?? deliveryOptions[0]?.id ?? null,
        paymentMethod: 'card',
        stage: 'exception',
        error: message,
      });

      telemetryService.captureException(error, {
        message: 'Checkout submission failed',
        tags: {
          feature: 'checkout',
          operation: 'submit-order',
        },
        extra: {
          itemCount: totals.itemCount,
          totalAmount: totals.total,
        },
      });
      setErrorMessage('We were unable to submit your order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-green-800">Checkout</h1>
            <p className="text-muted-foreground">
              Provide your delivery details and payment information to reserve your plants.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/cart')}>
            Back to cart
          </Button>
        </div>

        <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Delivery & payment</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-medium text-green-900">Contact information</h2>
                    <p className="text-sm text-muted-foreground">
                      We'll email your receipt and share updates on your delivery status.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="checkout-full-name">Full name</Label>
                      <Input
                        id="checkout-full-name"
                        autoComplete="name"
                        value={address.fullName}
                        onChange={(event) => setAddress((previous) => ({ ...previous, fullName: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkout-email">Email</Label>
                      <Input
                        id="checkout-email"
                        type="email"
                        autoComplete="email"
                        value={address.email}
                        onChange={(event) => setAddress((previous) => ({ ...previous, email: event.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-medium text-green-900">Delivery address</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedDeliveryOption?.label ?? 'Select your preferred delivery option in the cart.'}
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="checkout-street">Street address</Label>
                      <Input
                        id="checkout-street"
                        autoComplete="street-address"
                        value={address.street}
                        onChange={(event) => setAddress((previous) => ({ ...previous, street: event.target.value }))}
                        required
                      />
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="checkout-city">City</Label>
                        <Input
                          id="checkout-city"
                          autoComplete="address-level2"
                          value={address.city}
                          onChange={(event) => setAddress((previous) => ({ ...previous, city: event.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="checkout-state">State</Label>
                        <Input
                          id="checkout-state"
                          autoComplete="address-level1"
                          value={address.state}
                          onChange={(event) => setAddress((previous) => ({ ...previous, state: event.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="checkout-postal">Postal code</Label>
                        <Input
                          id="checkout-postal"
                          autoComplete="postal-code"
                          value={address.postalCode}
                          onChange={(event) => setAddress((previous) => ({ ...previous, postalCode: event.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="checkout-instructions">Delivery instructions (optional)</Label>
                      <Textarea
                        id="checkout-instructions"
                        rows={3}
                        value={address.instructions ?? ''}
                        onChange={(event) => setAddress((previous) => ({ ...previous, instructions: event.target.value }))}
                        placeholder="Share helpful notes for the delivery, like gate codes or drop-off preferences."
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-medium text-green-900">Payment details</h2>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                      Payments are securely processed. No sensitive card data is stored on Thumr.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="checkout-card-number">Card number</Label>
                      <Input
                        id="checkout-card-number"
                        inputMode="numeric"
                        placeholder="4242 4242 4242 4242"
                        value={payment.cardNumber}
                        onChange={(event) => setPayment((previous) => ({ ...previous, cardNumber: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="checkout-expiry">Expiration</Label>
                        <Input
                          id="checkout-expiry"
                          placeholder="MM/YY"
                          value={payment.expiry}
                          onChange={(event) => setPayment((previous) => ({ ...previous, expiry: event.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="checkout-cvc">CVC</Label>
                        <Input
                          id="checkout-cvc"
                          inputMode="numeric"
                          placeholder="CVC"
                          value={payment.cvc}
                          onChange={(event) => setPayment((previous) => ({ ...previous, cvc: event.target.value }))}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertTitle>Checkout error</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => navigate('/cart')} disabled={isProcessing}>
                    Review cart
                  </Button>
                  <Button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : `Pay ${formattedTotals.total}`}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-sm h-fit">
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.plant.plantId} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-green-900">{item.plant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty {item.quantity} · {formatCurrency(item.plant.price)}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-green-700">
                      {formatCurrency(item.plant.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium">{formattedTotals.subtotal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Delivery</span>
                  <span className="font-medium">{formattedTotals.delivery}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{selectedDeliveryOption?.label}</span>
                  <span className="text-xs text-muted-foreground">{selectedDeliveryOption?.estimatedTime}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-lg font-semibold text-green-800">
                  <span>Total due</span>
                  <span>{formattedTotals.total}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
