import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { Plant } from '../interfaces/Plant';

export type DeliveryMethod = 'pickup' | 'local-delivery' | 'shipping';

export interface DeliveryOption {
  id: DeliveryMethod;
  label: string;
  description: string;
  cost: number;
  estimatedTime: string;
}

export interface CartItem {
  plant: Plant;
  quantity: number;
}

export interface CartTotals {
  subtotal: number;
  delivery: number;
  total: number;
  itemCount: number;
}

interface CartContextValue {
  items: CartItem[];
  deliveryOptions: DeliveryOption[];
  selectedDeliveryOption: DeliveryOption | null;
  totals: CartTotals;
  addItem: (plant: Plant, quantity?: number) => void;
  updateItemQuantity: (plantId: string, quantity: number) => void;
  removeItem: (plantId: string) => void;
  setDeliveryOption: (method: DeliveryMethod) => void;
  clearCart: () => void;
  isInCart: (plantId: string) => boolean;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const CART_STORAGE_KEY = 'thumr.cart.items';
const DELIVERY_STORAGE_KEY = 'thumr.cart.delivery';

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: 'pickup',
    label: 'Local pickup',
    description: 'Coordinate with the seller for a pickup time that works for you both.',
    cost: 0,
    estimatedTime: 'Ready within 1-2 days'
  },
  {
    id: 'local-delivery',
    label: 'Local delivery',
    description: 'Seller will deliver within a 10 mile radius of their location.',
    cost: 9.99,
    estimatedTime: 'Delivers in 2-3 days'
  },
  {
    id: 'shipping',
    label: 'Standard shipping',
    description: 'Packaged with care and shipped with tracking information.',
    cost: 14.99,
    estimatedTime: 'Arrives in 4-6 days'
  }
];

const isDeliveryMethod = (value: string): value is DeliveryMethod => {
  return DELIVERY_OPTIONS.some((option) => option.id === value);
};

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider = ({ children }: CartProviderProps) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<DeliveryMethod>('pickup');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const storedItems = window.localStorage.getItem(CART_STORAGE_KEY);
      if (storedItems) {
        const parsedItems = JSON.parse(storedItems) as CartItem[];
        if (Array.isArray(parsedItems)) {
          setItems(
            parsedItems.filter((item): item is CartItem => {
              return Boolean(item?.plant?.id) && typeof item?.quantity === 'number';
            })
          );
        }
      }
    } catch (error) {
      console.warn('Unable to parse stored cart items', error);
    }

    try {
      const storedDelivery = window.localStorage.getItem(DELIVERY_STORAGE_KEY);
      if (storedDelivery && isDeliveryMethod(storedDelivery)) {
        setSelectedDeliveryMethod(storedDelivery);
      }
    } catch (error) {
      console.warn('Unable to parse stored delivery option', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(DELIVERY_STORAGE_KEY, selectedDeliveryMethod);
  }, [selectedDeliveryMethod]);

  const addItem = useCallback((plant: Plant, quantity = 1) => {
    setItems((previousItems) => {
      const existingItem = previousItems.find((item) => item.plant.id === plant.id);

      if (existingItem) {
        return previousItems.map((item) =>
          item.plant.id === plant.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...previousItems, { plant, quantity }];
    });
  }, []);

  const updateItemQuantity = useCallback((plantId: string, quantity: number) => {
    setItems((previousItems) =>
      previousItems
        .map((item) =>
          item.plant.id === plantId
            ? { ...item, quantity: quantity <= 0 ? 0 : quantity }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((plantId: string) => {
    setItems((previousItems) => previousItems.filter((item) => item.plant.id !== plantId));
  }, []);

  const setDeliveryOption = useCallback((method: DeliveryMethod) => {
    if (isDeliveryMethod(method)) {
      setSelectedDeliveryMethod(method);
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setSelectedDeliveryMethod('pickup');
  }, []);

  const selectedDeliveryOption = useMemo(() => {
    return DELIVERY_OPTIONS.find((option) => option.id === selectedDeliveryMethod) ?? null;
  }, [selectedDeliveryMethod]);

  const totals = useMemo<CartTotals>(() => {
    const subtotal = items.reduce((accumulator, item) => {
      return accumulator + item.plant.price * item.quantity;
    }, 0);

    const itemCount = items.reduce((accumulator, item) => accumulator + item.quantity, 0);

    const delivery = selectedDeliveryOption?.cost ?? 0;

    return {
      subtotal,
      delivery,
      total: subtotal + delivery,
      itemCount
    };
  }, [items, selectedDeliveryOption]);

  const isInCart = useCallback(
    (plantId: string) => items.some((item) => item.plant.id === plantId),
    [items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      deliveryOptions: DELIVERY_OPTIONS,
      selectedDeliveryOption,
      totals,
      addItem,
      updateItemQuantity,
      removeItem,
      setDeliveryOption,
      clearCart,
      isInCart
    }),
    [
      items,
      selectedDeliveryOption,
      totals,
      addItem,
      updateItemQuantity,
      removeItem,
      setDeliveryOption,
      clearCart,
      isInCart
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
