import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Leaf, Truck } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import type { OrderConfirmationState } from '../../interfaces/Checkout';
import { formatCurrency } from '../../utils/currency';
import { buildComplianceContext, getComplianceHighlights } from '../../utils/compliance';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';

export const OrderConfirmationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useCart();

  const orderState = location.state as OrderConfirmationState | undefined;

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  if (!orderState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Order details unavailable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                We couldn't find order information for this session. If you completed a purchase, check your email for a receipt
                or visit your profile for the latest updates.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => navigate('/')}>Return home</Button>
                <Button variant="outline" onClick={() => navigate('/cart')}>Go to cart</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { orderId, address, totals, items, deliveryOption, placedAt } = orderState;

  const formattedTotals = useMemo(
    () => ({
      subtotal: formatCurrency(totals.subtotal),
      delivery: formatCurrency(totals.delivery),
      total: formatCurrency(totals.total)
    }),
    [totals]
  );

  const placedDate = new Date(placedAt);
  const formattedPlacedDate = Number.isNaN(placedDate.getTime())
    ? null
    : placedDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-12">
      <div className="container mx-auto px-4 max-w-5xl space-y-8">
        <Card className="shadow-sm border-green-200 bg-white/90">
          <CardContent className="flex flex-col items-start gap-6 p-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <div>
                <h1 className="text-3xl font-semibold text-green-800">Order confirmed!</h1>
                <p className="text-muted-foreground">
                  Confirmation #{orderId}
                  {formattedPlacedDate ? ` · Placed ${formattedPlacedDate}` : ''}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground">
              Thank you for supporting the Thumr community. Your seller has been notified and will reach out soon to
              coordinate the next steps.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => navigate('/')}>Continue shopping</Button>
              <Button variant="outline" onClick={() => navigate('/profile')}>View profile</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Delivery details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-green-900">{address.fullName}</p>
                <p className="text-muted-foreground">{address.email}</p>
              </div>
              <Separator />
              <div className="space-y-1">
                <p>{address.street}</p>
                <p>
                  {address.city}, {address.state} {address.postalCode}
                </p>
              </div>
              {address.instructions && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-green-900">Notes:</span> {address.instructions}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Delivery method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-green-600" />
                <p className="font-medium text-green-900">{deliveryOption?.label ?? 'Delivery preference'}</p>
              </div>
              <p className="text-muted-foreground">{deliveryOption?.description}</p>
              <p className="text-xs text-muted-foreground">{deliveryOption?.estimatedTime}</p>
              <Separator />
              <div className="flex items-center justify-between">
                <span>Delivery cost</span>
                <span className="font-medium">{formattedTotals.delivery}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-3">
                {items.map((item) => {
                  const complianceContext = buildComplianceContext(
                    item.plant.compliance,
                    item.plant.livePlantWarranty,
                  );
                  const complianceHighlights = getComplianceHighlights(
                    item.plant.compliance,
                    item.plant.livePlantWarranty,
                  );

                  return (
                    <div key={item.plant.id} className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-green-900">{item.plant.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty {item.quantity} · {formatCurrency(item.plant.price)}
                        </p>
                        {complianceHighlights.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {complianceHighlights.map((highlight) => (
                              <Badge
                                key={`${item.plant.id}-${highlight}`}
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-emerald-800"
                              >
                                {highlight}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {complianceContext.phytosanitaryDetails && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {complianceContext.phytosanitaryDetails}
                          </p>
                        )}
                      </div>
                      <span className="font-medium text-green-700">
                        {formatCurrency(item.plant.price * item.quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium">{formattedTotals.subtotal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Delivery</span>
                  <span className="font-medium">{formattedTotals.delivery}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-base font-semibold text-green-800">
                <span>Total paid</span>
                <span>{formattedTotals.total}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Leaf className="h-3.5 w-3.5 text-green-600" />
                <span>Remember to coordinate with the seller for pick-up or delivery.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
