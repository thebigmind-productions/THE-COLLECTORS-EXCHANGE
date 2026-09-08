import { z } from 'zod';

export const CreateOrderItemSchema = z.object({
  productId: z.string().min(1),
  // Every listing is a unique one-of-a-kind item; quantity can only ever be 1.
  quantity: z.literal(1).optional().default(1),
});

export const CreateOrderSchema = z.object({
  // Who the parcel is addressed to, which is not necessarily the account
  // holder — gifts and office deliveries are the whole reason it is collected.
  // Zod strips unknown keys, so leaving this out silently dropped it: checkout
  // asked for it, the confirmation screen echoed it back from local state, and
  // ops only ever saw the account name on the label.
  // Optional rather than required only so a browser still running the previous
  // bundle cannot be 400'd mid-checkout; the route falls back to the account
  // holder's name, which is what ops saw before this existed.
  recipientName: z.string().trim().min(1, 'Recipient name cannot be blank').optional(),
  shippingAddress: z.string().min(1, 'Shipping address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  // Every Indian PIN code is exactly six digits. `min(1)` meant "4" was a valid
  // PIN as far as the server was concerned, and an unroutable address is only
  // discovered days later at the courier's sorting hub. Trimmed first because a
  // phone keyboard and a paste both leave stray whitespace.
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'PIN code must be 6 digits'),
  // `min(10)` accepted "abcdefghij". An Indian mobile number is ten digits and
  // always starts 6, 7, 8 or 9 — 2-5 are landline trunk prefixes that no courier
  // SMS or delivery call will ever reach. The client normalises "+91 " and a
  // leading 0 away before it gets here; anything still carrying them is a bad
  // number, not a formatting difference, so this deliberately does not strip.
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9'),
  // Every listing is one-of-a-kind, so the same productId can never appear twice
  // in one order — repeating it would bill the same watch more than once.
  items: z
    .array(CreateOrderItemSchema)
    .min(1, 'At least one item is required')
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, {
      message: 'Duplicate items are not allowed',
    }),
  paymentMethod: z.enum(['online', 'cod']).default('online'),
  couponCode: z.string().optional(),
});

export const ValidateCouponSchema = z.object({
  code: z
    .string()
    .min(1)
    .transform((s) => s.toUpperCase()),
  items: z
    .array(
      z.object({
        productId: z.string(),
        price: z.number().positive(),
        quantity: z.number().int().positive().optional().default(1),
      }),
    )
    .min(1),
});

export const VerifyPaymentSchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
});
