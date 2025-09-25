# Analytics Event Naming Conventions

This project uses [Mixpanel](https://mixpanel.com/) for product analytics. Event names and payloads follow a consistent structure so that future instrumentation remains predictable and queryable.

## Naming rules

- **snake_case for events.** Use lowercase words separated by underscores (e.g., `listing_viewed`).
- **Start with the actor or domain.** Prefix events with the entity performing the action (`user_signup_*`, `cart_*`, `checkout_*`).
- **Action as suffix.** End the event with a past-tense verb that describes what happened (`_started`, `_completed`, `_failed`).
- **Stage qualifiers in payloads.** When additional context is needed, include a `stage` field in the payload instead of mutating the event name.
- **Stable property names.** Prefer generic property names (`plantId`, `deliveryMethod`, `itemCount`) that can be reused across events.
- **Console fallback.** In development, the analytics helper logs events to the console when Mixpanel is not configured.

## Core events

| Event | Fired from | Purpose | Key properties |
| --- | --- | --- | --- |
| `user_signup_started` | `SignupPage` | User submitted the registration form with valid inputs. | `username`, `email`, `role`, `marketingEmailOptIn`, `marketingSmsOptIn`, `stage`
| `user_signup_succeeded` | `SignupPage` | Account creation call succeeded. | Same as above plus `method`
| `user_signup_failed` | `SignupPage` | Signup or confirmation failed. | Same as above plus `error`
| `user_signup_confirmed` | `SignupPage` | Confirmation code accepted and login succeeded. | Same as `user_signup_started`
| `listing_viewed` | `PlantDetailModal` | Buyer opened a plant listing modal/page. | `plantId`, `plantName`, `category`, `price`, `sellerId`, `location`
| `cart_item_added` | `PlantDetailModal` | Plant added from a listing view. | `plantId`, `plantName`, `category`, `price`, `sellerId`, `location`, `quantity`, `actionContext`
| `cart_quantity_updated` | `CartPage` | Quantity adjusted in the cart. | Same as above plus `previousQuantity`, `nextQuantity`
| `cart_item_removed` | `CartPage` | Plant removed from the cart. | Same as `cart_item_added`
| `cart_delivery_option_selected` | `CartPage` | Buyer chose a delivery method. | `deliveryMethod`, `previousMethod`
| `checkout_started` | `CartPage`, `CheckoutPage` | Checkout flow began (navigation or payment attempt). | `total`, `itemCount`, `deliveryMethod`, `paymentMethod`, `stage`
| `checkout_failed` | `CheckoutPage` | Payment attempt failed or threw an exception. | Same as `checkout_started` plus `error`
| `checkout_completed` | `CheckoutPage` | Payment succeeded. | Same as `checkout_started` plus `transactionId`
| `purchase_completed` | `OrderConfirmationPage` | Order confirmation rendered. | `orderId`, `total`, `itemCount`, `deliveryMethod`, `paymentMethod`

## Adding new events

1. Use the helper in `src/services/analytics.ts` so that future SDK changes are centralized.
2. Keep payload keys type-safe by extending the exported TypeScript types when needed.
3. Update this document with any new high-signal events so downstream consumers have a single source of truth.
