import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useCart, type DeliveryMethod } from '../../contexts/CartContext';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Separator } from '../ui/separator';
import { ImageWithFallback } from '../figma/ImageWithFallback';

export const CartPage = () => {
  const {
    items,
    totals,
    deliveryOptions,
    selectedDeliveryOption,
    updateItemQuantity,
    removeItem,
    setDeliveryOption
  } = useCart();
  const navigate = useNavigate();

  const cartIsEmpty = items.length === 0;

  const deliveryValue = selectedDeliveryOption?.id ?? deliveryOptions[0]?.id ?? 'pickup';

  const formattedTotals = useMemo(
    () => ({
      subtotal: formatCurrency(totals.subtotal),
      delivery: formatCurrency(totals.delivery),
      total: formatCurrency(totals.total)
    }),
    [totals]
  );

  if (cartIsEmpty) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-16">
        <div className="container mx-auto px-4 max-w-2xl text-center space-y-6">
          <h1 className="text-3xl font-semibold text-green-800">Your cart is waiting for a little green.</h1>
          <p className="text-muted-foreground">
            You haven't added any plants yet. Explore the marketplace to discover unique greens from local growers.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => navigate('/')}
            >
              Browse plants
            </Button>
            <Button variant="outline" onClick={() => navigate('/profile#saved')}>
              View saved listings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-green-800">Review your cart</h1>
            <p className="text-muted-foreground">
              {totals.itemCount} item{totals.itemCount === 1 ? '' : 's'} · {formattedTotals.subtotal}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => navigate('/')}>Continue shopping</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => navigate('/checkout')}
            >
              Proceed to checkout
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Plant selections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {items.map((item) => {
                const firstImage = Array.isArray(item.plant.images)
                  ? item.plant.images[0]
                  : item.plant.images;

                return (
                  <div key={item.plant.id} className="flex flex-col sm:flex-row gap-4">
                    <div className="w-full sm:w-32 h-32 rounded-lg overflow-hidden bg-green-100">
                      <ImageWithFallback
                        src={firstImage}
                        alt={item.plant.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                          <h2 className="text-lg font-medium text-green-900">{item.plant.name}</h2>
                          <p className="text-sm text-muted-foreground">{item.plant.category} · {item.plant.location}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-green-700">
                            {formatCurrency(item.plant.price * item.quantity)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(item.plant.price)} each
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <Label htmlFor={`quantity-${item.plant.id}`} className="text-sm font-medium">
                          Quantity
                        </Label>
                        <Input
                          id={`quantity-${item.plant.id}`}
                          type="number"
                          min={1}
                          className="w-24"
                          value={item.quantity}
                          onChange={(event) => {
                            const nextQuantity = Number.parseInt(event.target.value, 10);
                            updateItemQuantity(item.plant.id, Number.isNaN(nextQuantity) ? item.quantity : nextQuantity);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => removeItem(item.plant.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </div>

                      <Separator />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Delivery preference</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={deliveryValue}
                  onValueChange={(value) => setDeliveryOption(value as DeliveryMethod)}
                >
                  {deliveryOptions.map((option) => (
                    <Label
                      key={option.id}
                      className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 cursor-pointer hover:border-green-400"
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={option.id} className="mt-1" />
                        <div>
                          <p className="font-medium text-green-900">{option.label}</p>
                          <p className="text-sm text-muted-foreground">{option.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">{option.estimatedTime}</p>
                        </div>
                      </div>
                      <span className="font-medium text-green-700">{formatCurrency(option.cost)}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Order summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium">{formattedTotals.subtotal}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Delivery</span>
                  <span className="font-medium">{formattedTotals.delivery}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-lg font-semibold text-green-800">
                  <span>Total</span>
                  <span>{formattedTotals.total}</span>
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => navigate('/checkout')}
                >
                  Checkout
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
