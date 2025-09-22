import type { CartItem, CartTotals, DeliveryOption } from '../contexts/CartContext';

export interface CheckoutAddress {
  fullName: string;
  email: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  instructions?: string;
}

export interface OrderConfirmationState {
  orderId: string;
  address: CheckoutAddress;
  totals: CartTotals;
  items: CartItem[];
  deliveryOption: DeliveryOption | null;
  placedAt: string;
}
