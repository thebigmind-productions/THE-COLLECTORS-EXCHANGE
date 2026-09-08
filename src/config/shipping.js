/**
 * Single source of truth for shipping and returns timings.
 *
 * Four different promises used to be live at once (2-3 / 2-5 dispatch,
 * 5-7 / 5-10 delivery). The owner has chosen the most conservative pair —
 * dispatch 2-5 business days, delivery 5-10 business days — so the storefront
 * never quotes a window it cannot hold.
 */

/** Business days between payment confirmation and dispatch. */
export const DISPATCH_DAYS = '2-5';

/** Business days in transit for domestic deliveries. */
export const DELIVERY_DAYS = '5-10';

/** Hours a buyer has to inspect an item after delivery. */
export const INSPECTION_HOURS = 48;

/** Business days for an approved refund to reach the original payment method. */
export const REFUND_DAYS = '5-10';

export const DISPATCH_COPY = `Orders are processed within ${DISPATCH_DAYS} business days after payment confirmation.`;

export const DELIVERY_COPY = `Domestic deliveries typically arrive within ${DELIVERY_DAYS} business days.`;

export const SHIPPING_COST_COPY = 'Free insured shipping across India.';

export const INSPECTION_COPY = `${INSPECTION_HOURS}-hour inspection window from delivery.`;
