import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Readable } from 'stream';
import { Prisma } from '@prisma/client';
import {
  CreateOrderSchema,
  VerifyPaymentSchema,
  ValidateCouponSchema,
} from '../schemas/checkout.js';
import {
  applyDiscountToItems,
  orderTotalFromItems,
  platformFeeFromItems,
  toPaise,
} from '../lib/money.js';
import { claimCouponUse, OrderError } from '../lib/coupon.js';
import { syncProductToMetaAsync } from '../lib/metaCatalog.js';
import { buildUserData, sendConversionEventAsync } from '../lib/metaConversions.js';
import { syncProductToGoogleAsync } from '../lib/googleMerchant.js';

/**
 * Last line of defence for the money invariant:
 *
 *     sum(item payouts) + sum(platformFee) == Order.totalAmount
 *
 * Payout is `price - platformFee` per unit, so this reduces to
 * `sum(price * qty) == totalAmount` (the fee term cancels — see lib/money.js).
 * Checked in paise. If it ever trips, the order is refused rather than written:
 * a failed checkout is recoverable, an order that quietly disburses more than it
 * collected is not.
 */
function assertOrderReconciles(totalAmount, items) {
  const itemsPaise = items.reduce((sum, i) => sum + toPaise(i.price) * i.quantity, 0);
  if (itemsPaise !== toPaise(totalAmount)) {
    throw new OrderError(
      500,
      'Order failed an internal consistency check and was not created. Please try again.',
    );
  }
}

// Every order is priced and captured in this currency; the gateway is asked to
// confirm it back to us on verification.
const CURRENCY = 'INR';

/**
 * `Order.displayId` (HOR00001) is derived read-then-increment inside the
 * checkout transaction, and the column is @unique. Under Read Committed two
 * concurrent checkouts both read the same max and both try to write N+1; the
 * loser gets P2002 and, before this, a bare "Could not create order."
 *
 * WHY A RETRY AND NOT A SEQUENCE: a Postgres sequence is the stronger fix, but
 * it is a schema/migration change and this work is explicitly not allowed to
 * migrate. A retry needs no DDL and is correct for this failure specifically:
 * the only way to receive P2002 on displayId is for the competing transaction
 * to have already COMMITTED, so the very next read sees its row and computes a
 * genuinely free number. Attempts are capped so a systemic problem surfaces as
 * an error rather than as a hot loop.
 */
const MAX_DISPLAY_ID_ATTEMPTS = 3;

const isDisplayIdCollision = (err) => {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target : [target];
  return fields.some((f) => typeof f === 'string' && f.includes('displayId'));
};

// Constant-time comparison of two hex signatures. A plain !== leaks how many
// leading bytes matched, which is enough to forge a signature byte by byte.
const signaturesMatch = (a, b) => {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Fastify parses the body into an object before any handler sees it, and a
 * signature computed over a RE-SERIALISED object is worthless — key order,
 * unicode escaping and number formatting all differ from what the gateway
 * signed. So for the webhook route (and only that route) we drain the incoming
 * stream ourselves, keep the exact bytes on `request.rawBody`, and hand Fastify
 * an identical replacement stream to parse as usual.
 *
 * Scoped as a route-level `preParsing` hook rather than a content-type parser so
 * that every other checkout route keeps Fastify's normal JSON handling.
 */
export async function captureRawBody(request, reply, payload) {
  const chunks = [];
  for await (const chunk of payload) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks);
  request.rawBody = raw;

  const replayed = Readable.from(raw.length > 0 ? [raw] : []);
  // Fastify uses this to enforce bodyLimit; the bytes are unchanged, so report
  // the length we actually read.
  replayed.receivedEncodedLength = raw.length;
  return replayed;
}

/**
 * Promote a Pending order to paid + Processing, claim its one-of-a-kind items,
 * clear them from every cart/wishlist and tell the buyer — exactly once, no
 * matter how many callers race to do it.
 *
 * TWO independent paths reach this, and either one alone is enough to complete
 * the order: the buyer's browser posting to /verify-payment from the Razorpay
 * `handler` callback, and Razorpay's server posting to /razorpay-webhook. That
 * redundancy is the point — a phone that loses signal the instant after payment
 * no longer leaves captured money against a Pending order forever.
 *
 * Idempotency rests on two database guarantees rather than on ordering or luck:
 *
 *   1. the guarded `order.updateMany` below only matches an order that has not
 *      been finalized yet, so of N concurrent callers exactly one does the work
 *      and the losers fall through to `alreadyFinalized` having touched nothing;
 *   2. `Order.paymentId` is unique, so one gateway payment can never be applied
 *      to a second order — Prisma raises P2002 and the whole transaction, every
 *      product claim included, rolls back.
 *
 * Finalizing also announces the sale to everyone it affects, inside the same
 * transaction as the claim so an order can never commit without its notices:
 * the buyer (below), every OTHER user who had the item in a cart or wishlist and
 * is about to find it gone, and the seller of each item.
 *
 * The gate accepts paymentStatus 'Failed' as well as 'Pending' because a failed
 * attempt is per-attempt, not per-order: Razorpay lets the buyer retry the same
 * gateway order, and an order stamped Failed by a dismissed/declined attempt
 * must still be finalizable when the retry succeeds.
 *
 * @returns {Promise<
 *   | { status: 'finalized', order: object, alreadyFinalized: boolean }
 *   | { status: 'already_processed', message: string }
 *   | { status: 'payment_reused' }
 *   | { status: 'sold_out', soldOut: string[], refundRequired: boolean, refundPending: boolean }
 * >}
 */
export async function finalizeOrder({
  prisma,
  razorpay,
  log,
  order,
  isCOD,
  paymentId,
  paymentSignature,
  buyer = null,
  requestContext = null,
}) {
  const orderId = order.id;
  const buyerId = buyer?.id ?? order.userId ?? null;

  const soldOutProductIds = [];
  let alreadyFinalized = false;
  let updatedOrder = null;

  try {
    updatedOrder = await prisma.$transaction(async (tx) => {
      const gate = await tx.order.updateMany({
        where: { id: orderId, status: 'Pending', paymentStatus: { in: ['Pending', 'Failed'] } },
        data: {
          paymentStatus: isCOD ? 'Pending' : 'Paid',
          status: 'Processing',
          paymentId: isCOD
            ? null
            : paymentId || `pay_mock_${Math.random().toString(36).substring(2, 11)}`,
          paymentSignature: isCOD
            ? null
            : paymentSignature || `sig_mock_${Math.random().toString(36).substring(2, 11)}`,
        },
      });

      if (gate.count === 0) {
        // Someone else finalized this order between our read and this write.
        const current = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        });
        if (!current || current.status === 'Cancelled') {
          throw new OrderError(422, 'Order has already been processed');
        }
        alreadyFinalized = true;
        return current;
      }

      for (const item of order.items || []) {
        // Only flips Approved -> Sold; a count of 0 means another paid order
        // already claimed this item.
        const claim = await tx.product.updateMany({
          where: { id: item.productId, status: 'Approved' },
          data: { status: 'Sold' },
        });
        if (claim.count !== 1) soldOutProductIds.push(item.productId);
      }

      if (soldOutProductIds.length > 0) {
        // Roll the whole thing back — the finalize and every claim we just made.
        throw new OrderError(409, 'One or more items in your order are no longer available');
      }

      // Every listing here is one-of-a-kind, so a sale is not a stock change —
      // it is the permanent disappearance of something other people had saved.
      // Read who those people are BEFORE the deletes below wipe the rows, and
      // read the titles/sellers off the products, because `order.items` carries
      // only productIds.
      const claimedProductIds = (order.items || []).map((i) => i.productId);
      const claimedProducts =
        claimedProductIds.length > 0
          ? await tx.product.findMany({
              where: { id: { in: claimedProductIds } },
              select: { id: true, title: true, sellerId: true },
            })
          : [];
      const productById = new Map(claimedProducts.map((p) => [p.id, p]));

      // The buyer already gets an "Order Confirmed" notice; do not also tell
      // them the thing they just bought was removed from their own cart.
      const savedRowFilter = { productId: { in: claimedProductIds } };
      if (buyerId) savedRowFilter.userId = { not: buyerId };
      const [cartRows, wishlistRows] =
        claimedProductIds.length > 0
          ? await Promise.all([
              tx.cartItem.findMany({
                where: savedRowFilter,
                select: { userId: true, productId: true },
              }),
              tx.wishlistItem.findMany({
                where: savedRowFilter,
                select: { userId: true, productId: true },
              }),
            ])
          : [[], []];

      // Remove claimed items from every user's cart and wishlist
      for (const item of order.items || []) {
        await tx.cartItem.deleteMany({ where: { productId: item.productId } });
        await tx.wishlistItem.deleteMany({ where: { productId: item.productId } });
      }

      const finalOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      const displayId = finalOrder?.displayId || order.displayId || '';
      const pendingNotifications = [];

      // 1. Everyone who lost a saved item. Without this the row simply vanishes
      //    between two visits and reads as the site having lost it.
      //
      //    A struck-through "no longer available" cart row would be kinder, but
      //    CartItem/WishlistItem have no availability column and the schema is
      //    fixed here — faking it by leaving the row and reading Product.status
      //    at render time would mean every cart page carrying dead rows forever,
      //    with no point at which they are cleared. So: delete, and tell them.
      const savedByUser = new Map(); // userId -> Map<productId, {cart, wishlist}>
      const noteSaved = (rows, key) => {
        for (const row of rows || []) {
          if (!row?.userId || !productById.has(row.productId)) continue;
          if (!savedByUser.has(row.userId)) savedByUser.set(row.userId, new Map());
          const perProduct = savedByUser.get(row.userId);
          const entry = perProduct.get(row.productId) || { cart: false, wishlist: false };
          entry[key] = true;
          perProduct.set(row.productId, entry);
        }
      };
      noteSaved(cartRows, 'cart');
      noteSaved(wishlistRows, 'wishlist');

      for (const [userId, perProduct] of savedByUser) {
        for (const [productId, where] of perProduct) {
          const title = productById.get(productId)?.title || 'An item you saved';
          const place =
            where.cart && where.wishlist
              ? 'your cart and wishlist'
              : where.cart
                ? 'your cart'
                : 'your wishlist';
          pendingNotifications.push({
            userId,
            title: 'A Saved Item Has Sold',
            message: `"${title}" has been sold to another collector, so it has been removed from ${place}. Every piece on the Exchange is one of a kind — nothing was lost from your account.`,
          });
        }
      }

      // 2. The seller. Nothing anywhere else tells them their listing sold.
      const soldBySeller = new Map(); // sellerId -> string[] titles
      for (const productId of claimedProductIds) {
        const product = productById.get(productId);
        if (!product?.sellerId) continue;
        if (!soldBySeller.has(product.sellerId)) soldBySeller.set(product.sellerId, []);
        soldBySeller.get(product.sellerId).push(product.title || 'your listing');
      }
      for (const [sellerId, titles] of soldBySeller) {
        const orderRef = displayId ? ` (order ${displayId})` : '';
        pendingNotifications.push({
          userId: sellerId,
          title: titles.length > 1 ? 'Your Items Have Sold' : 'Your Item Has Sold',
          message:
            titles.length > 1
              ? `${titles.length} of your listings have sold${orderRef}: ${titles
                  .map((t) => `"${t}"`)
                  .join(
                    ', ',
                  )}. Please prepare them for dispatch — we will confirm pickup details shortly.`
              : `"${titles[0]}" has sold${orderRef}. Please prepare it for dispatch — we will confirm pickup details shortly.`,
        });
      }

      if (pendingNotifications.length > 0) {
        await tx.notification.createMany({ data: pendingNotifications });
      }

      // Record coupon usage (if coupon was applied)
      if (finalOrder?.couponId && buyerId) {
        const existingUsage = await tx.couponUsage.findFirst({
          where: { couponId: finalOrder.couponId, orderId: finalOrder.id },
        });
        if (!existingUsage) {
          await tx.couponUsage.create({
            data: {
              couponId: finalOrder.couponId,
              orderId: finalOrder.id,
              userId: buyerId,
            },
          });
        }
      }

      return finalOrder;
    });
  } catch (err) {
    if (err instanceof OrderError) {
      if (err.statusCode !== 409) {
        return { status: 'already_processed', message: err.message };
      }
      // Sold out — fall through to the refund/cancel path below.
    } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // paymentId is unique — this payment has already been applied elsewhere.
      log.error(
        { prismaCode: err.code, prismaMeta: err.meta, orderId },
        'Payment has already been used for another order',
      );
      return { status: 'payment_reused' };
    } else {
      throw err;
    }
  }

  if (soldOutProductIds.length > 0) {
    // The transaction rolled back, so nothing is claimed and the order is still
    // Pending — but the buyer's money is already captured. Refund it for real
    // before touching the ledger; never write "Refunded" over money we still hold.
    let paymentStatus = 'Failed';
    let refundPending = false;

    if (!isCOD) {
      paymentStatus = 'Refunded';
      if (razorpay && paymentId) {
        try {
          await razorpay.payments.refund(paymentId, {
            notes: { orderId, reason: 'Item no longer available' },
          });
        } catch (refundErr) {
          // We still hold the money, so "Refunded" would be a lie. Leave the
          // order Paid + Cancelled — a deliberately inconsistent pair ops can
          // query for — and shout about it in the logs.
          log.error(
            { err: refundErr, orderId, paymentId },
            'REFUND FAILED for sold-out order — payment is still captured, order left Paid and needs a manual refund',
          );
          paymentStatus = 'Paid';
          refundPending = true;
        }
      }
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'Cancelled',
        paymentStatus,
      },
    });
    if (buyerId) {
      await prisma.notification.create({
        data: {
          userId: buyerId,
          title: 'Order Could Not Be Completed',
          message: isCOD
            ? 'One or more items in your order were no longer available, so the order was cancelled.'
            : 'One or more items in your order were no longer available. Your payment will be refunded.',
        },
      });
    }
    return {
      status: 'sold_out',
      soldOut: soldOutProductIds,
      refundRequired: !isCOD,
      refundPending,
    };
  }

  // Notify buyer that order is confirmed. Skipped when this call is just a
  // no-op echo of an order another caller already finalized (and notified).
  if (!alreadyFinalized) {
    const soldProductIds = (updatedOrder.items || []).map((i) => i.productId);
    if (soldProductIds.length > 0) {
      const soldProducts = await prisma.product.findMany({
        where: { id: { in: soldProductIds } },
      });
      soldProducts.forEach((p) => {
        syncProductToMetaAsync(p);
        syncProductToGoogleAsync(p);
      });

      sendConversionEventAsync({
        eventName: 'Purchase',
        eventId: updatedOrder.id,
        eventSourceUrl: `${process.env.FRONTEND_URL || 'https://thecollectorsexchange.in'}/checkout`,
        userData: buildUserData({
          email: buyer?.email,
          phone: buyer?.phone,
          externalId: buyerId,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        }),
        customData: {
          value: updatedOrder.totalAmount,
          currency: CURRENCY,
          content_type: 'product',
          content_ids: soldProductIds,
          contents: soldProducts.map((p) => ({ id: p.id, quantity: 1, item_price: p.price })),
        },
      });
    }

    if (buyerId) {
      await prisma.notification.create({
        data: {
          userId: buyerId,
          title: 'Order Confirmed',
          message: isCOD
            ? 'Your order has been placed. Keep cash ready — payment will be collected on delivery.'
            : 'Your order has been placed and payment received. We will process it shortly.',
        },
      });
    }
  }

  return { status: 'finalized', order: updatedOrder, alreadyFinalized };
}

/**
 * Checkout and Payment Routes
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function checkoutRoutes(fastify) {
  const { prisma } = fastify;

  // Helper to get Razorpay instance
  const getRazorpayInstance = () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret || keyId.includes('xxxx') || keySecret.includes('your-')) {
      // Simulated/Mock mode fallback
      return null;
    }

    return new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  };

  // Validate coupon against cart items (no order needed)
  fastify.post(
    '/validate-coupon',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const { code, items } = ValidateCouponSchema.parse(request.body);

      const coupon = await prisma.coupon.findUnique({ where: { code } });
      if (!coupon) {
        return reply.status(404).send({ valid: false, error: 'Coupon not found' });
      }
      if (!coupon.isActive) {
        return reply.status(422).send({ valid: false, error: 'Coupon is no longer active' });
      }
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return reply.status(422).send({ valid: false, error: 'Coupon has expired' });
      }

      let eligibleTotal = 0;
      for (const item of items) {
        if (!coupon.productId || item.productId === coupon.productId) {
          eligibleTotal += item.price * (item.quantity || 1);
        }
      }

      if (eligibleTotal === 0) {
        return reply
          .status(422)
          .send({ valid: false, error: 'Coupon does not apply to any items in your cart' });
      }

      if (coupon.minPurchase > 0 && eligibleTotal < coupon.minPurchase) {
        return reply.status(422).send({
          valid: false,
          error: `Minimum purchase of ₹${coupon.minPurchase.toLocaleString('en-IN')} required`,
        });
      }

      const discountPercent = coupon.discountPercent;
      const discountAmount = Math.round(((eligibleTotal * discountPercent) / 100) * 100) / 100;

      return {
        valid: true,
        couponCode: coupon.code,
        discountPercent,
        discountAmount,
        eligibleTotal,
      };
    },
  );

  // Create payment order
  fastify.post(
    '/create-order',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const dbUser = request.dbUser;
      if (!dbUser) {
        return reply.status(401).send({ error: 'User profile not synchronized' });
      }

      const {
        recipientName,
        shippingAddress,
        city,
        state,
        zipCode,
        phone,
        items,
        paymentMethod,
        couponCode,
      } = CreateOrderSchema.parse(request.body);

      // The name that goes on the parcel. Falls back to the account holder so a
      // client that does not send one behaves exactly as before.
      const buyerName = recipientName || dbUser.name || null;

      // Fetch user's cart to cross-reference against submitted items
      const cartItems = await prisma.cartItem.findMany({
        where: { userId: dbUser.id },
        include: { product: true },
      });
      const cartProductIds = new Set(cartItems.map((ci) => ci.productId));

      // Calculate total amount on backend to prevent fraud
      let totalAmount = 0;
      let totalPlatformFee = 0;
      let discountPercent = 0;
      let discountAmount = 0;
      const orderItemsData = [];

      const runCreateOrderTransaction = () =>
        prisma.$transaction(async (tx) => {
          for (const item of items) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
            });

            if (!product) {
              throw new OrderError(404, `Product not found: ${item.productId}`);
            }

            if (product.status === 'Sold') {
              throw new OrderError(422, `Product not available: ${product.title}`);
            }

            // Only approved listings can be purchased
            if (product.status !== 'Approved') {
              throw new OrderError(422, `Product not available for purchase: ${product.title}`);
            }

            // Verify item is in user's cart
            if (!cartProductIds.has(product.id)) {
              throw new OrderError(422, `Product ${product.title} is not in your cart`);
            }

            // Prevent seller buying their own product
            if (product.sellerId === dbUser.id) {
              throw new OrderError(422, 'You cannot purchase your own product');
            }

            // Listings are unique one-of-a-kind items — never trust a client
            // quantity; a single order line can only ever be one unit.
            const qty = 1;
            const itemPrice = product.price;
            const commPct = product.commissionPercent ?? 10;
            const fee = Math.round(((itemPrice * commPct) / 100) * 100) / 100; // round to 2 decimals

            totalAmount += itemPrice * qty;
            totalPlatformFee += fee * qty;
            orderItemsData.push({
              productId: product.id,
              quantity: qty,
              price: itemPrice,
              commissionPercent: commPct,
              platformFee: fee,
            });
          }

          // Validate & apply coupon inside the transaction so an invalid coupon
          // rolls back the order (no orphaned Pending order) and the discount is
          // computed against eligible items only.
          let couponData = {};
          if (couponCode) {
            const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
            if (!coupon) {
              throw new OrderError(404, 'Coupon not found');
            }
            if (!coupon.isActive) {
              throw new OrderError(422, 'Coupon is no longer active');
            }
            if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
              throw new OrderError(422, 'Coupon has expired');
            }

            await claimCouponUse(tx, coupon, dbUser.id);

            // Discount applies only to items the coupon is scoped to
            const isEligible = (oi) => !coupon.productId || oi.productId === coupon.productId;
            let eligibleTotal = 0;
            for (const oi of orderItemsData) {
              if (isEligible(oi)) eligibleTotal += oi.price * oi.quantity;
            }
            if (eligibleTotal === 0) {
              throw new OrderError(422, 'Coupon does not apply to any items in your cart');
            }
            if (coupon.minPurchase > 0 && eligibleTotal < coupon.minPurchase) {
              throw new OrderError(
                422,
                `Minimum purchase of ₹${coupon.minPurchase.toLocaleString('en-IN')} required`,
              );
            }

            discountPercent = coupon.discountPercent;
            discountAmount = Math.round(((eligibleTotal * discountPercent) / 100) * 100) / 100;

            // Push the discount down into the item rows. Writing it only onto
            // Order.totalAmount (what this used to do) made it invisible to the
            // payout, which reads price/platformFee off the ITEM — the platform
            // then collected the discounted total but disbursed against the full
            // undiscounted price, losing the discount on every couponed sale.
            const discounted = applyDiscountToItems(orderItemsData, discountAmount, isEligible);
            orderItemsData.splice(0, orderItemsData.length, ...discounted);
            totalPlatformFee = platformFeeFromItems(orderItemsData);

            // The items are now the single source of truth for what the buyer
            // owes, so derive the total from them rather than re-deriving it.
            const couponFinalAmount = orderTotalFromItems(orderItemsData);
            assertOrderReconciles(couponFinalAmount, orderItemsData);

            couponData = {
              couponId: coupon.id,
              discountPercent,
              discountAmount,
              subtotalBeforeDiscount: totalAmount,
              totalAmount: couponFinalAmount,
            };
          }

          // Generate sequential display ID (HOR00001, HOR00002, ...)
          const lastOrder = await tx.order.findFirst({
            orderBy: { displayId: 'desc' },
            select: { displayId: true },
          });
          let nextSeq = 1;
          if (lastOrder?.displayId) {
            const num = parseInt(lastOrder.displayId.replace('HOR', ''), 10);
            if (!isNaN(num)) nextSeq = num + 1;
          }
          const displayId = 'HOR' + String(nextSeq).padStart(5, '0');

          return await tx.order.create({
            data: {
              userId: dbUser.id,
              displayId,
              status: 'Pending',
              totalAmount,
              buyerName,
              shippingAddress,
              city,
              state,
              zipCode,
              phone,
              paymentStatus: 'Pending',
              paymentMethod: paymentMethod || 'online',
              ...couponData,
              items: {
                create: orderItemsData,
              },
            },
            include: {
              items: true,
            },
          });
        });

      let dbOrder;
      try {
        for (let attempt = 1; ; attempt++) {
          // The accumulators live outside the closure because the response is
          // built from them afterwards, so each attempt has to start from zero:
          // a rolled-back attempt must not leave half-summed totals or a
          // duplicate set of item rows behind for the retry to re-count.
          totalAmount = 0;
          totalPlatformFee = 0;
          discountPercent = 0;
          discountAmount = 0;
          orderItemsData.length = 0;

          try {
            dbOrder = await runCreateOrderTransaction();
            break;
          } catch (err) {
            if (isDisplayIdCollision(err) && attempt < MAX_DISPLAY_ID_ATTEMPTS) {
              request.log.warn(
                { attempt, userId: dbUser.id },
                'displayId collided with a concurrent checkout — retrying order creation',
              );
              continue;
            }
            throw err;
          }
        }
      } catch (err) {
        if (err instanceof OrderError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          request.log.error(
            { prismaCode: err.code, prismaMeta: err.meta, route: 'create-order' },
            'Prisma error in checkout',
          );
          return reply.status(409).send({
            error: 'Database Error',
            message: 'Could not create order. Please try again.',
          });
        }
        throw err;
      }

      // Coupon (if any) was validated, limit-checked and applied atomically inside
      // the transaction above; the order now holds the coupon's use. The
      // CouponUsage audit row is still written on successful payment.
      //
      // Derive the amount the gateway is asked for from the item rows — the same
      // source the order total and the payouts come from — so the buyer can never
      // be charged something the ledger doesn't reconcile to.
      const finalAmount = orderTotalFromItems(orderItemsData);
      assertOrderReconciles(finalAmount, orderItemsData);

      // Initialize Razorpay Order (skip for COD)
      const razorpay = getRazorpayInstance();
      let razorpayOrderId = null;

      if (paymentMethod === 'cod') {
        razorpayOrderId = null;
      } else if (razorpay) {
        try {
          const options = {
            amount: Math.round(finalAmount * 100),
            currency: CURRENCY,
            receipt: `receipt_order_${dbOrder.id}`,
          };
          const rpOrder = await razorpay.orders.create(options);
          razorpayOrderId = rpOrder.id;

          await prisma.order.update({
            where: { id: dbOrder.id },
            data: { paymentOrderId: razorpayOrderId },
          });
        } catch (err) {
          request.log.error(err);
          return reply.status(500).send({ error: 'Failed to create payment gateway order' });
        }
      } else if (process.env.NODE_ENV === 'production') {
        return reply.status(500).send({ error: 'Payment gateway not configured' });
      } else {
        razorpayOrderId = `order_mock_${Math.random().toString(36).substring(2, 11)}`;
        await prisma.order.update({
          where: { id: dbOrder.id },
          data: { paymentOrderId: razorpayOrderId },
        });
      }

      return {
        success: true,
        orderId: dbOrder.id,
        // Human-quotable reference (HOR00001). The buyer needs this the moment
        // anything goes wrong, which is long before the confirmation screen.
        displayId: dbOrder.displayId,
        amount: finalAmount,
        platformFee: totalPlatformFee,
        razorpayOrderId,
        isMock: !razorpay && paymentMethod !== 'cod',
        isCOD: paymentMethod === 'cod',
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
        couponApplied: !!couponCode,
        discountPercent,
        discountAmount,
        user: {
          name: dbUser.name,
          email: dbUser.email,
          phone: phone || dbUser.phone || '',
        },
      };
    },
  );

  // Verify payment signature
  fastify.post(
    '/verify-payment',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const dbUser = request.dbUser;
      if (!dbUser) {
        return reply.status(401).send({ error: 'User profile not synchronized' });
      }

      const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
        VerifyPaymentSchema.parse(request.body);

      const dbOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!dbOrder) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      if (dbOrder.userId !== dbUser.id) {
        return reply.status(403).send({ error: 'This order does not belong to you' });
      }

      if (dbOrder.paymentStatus === 'Paid') {
        return reply.status(422).send({ error: 'Order has already been paid' });
      }

      // Prevent re-processing an order that's already been confirmed
      if (['Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(dbOrder.status)) {
        return reply.status(422).send({ error: 'Order has already been processed' });
      }

      const razorpay = getRazorpayInstance();
      const isCOD = dbOrder.paymentMethod === 'cod';

      if (isCOD) {
        // COD orders: skip signature verification, mark as confirmed
        console.log(`[COD] Payment on delivery confirmed for order ${orderId}`);
      } else if (razorpay) {
        // Live verification.
        //
        // The signature only proves the gateway signed *some* (gateway order,
        // payment) pair — it says nothing about WHICH order was paid. Bind the
        // payment to the gateway order we created for this db order first, or a
        // genuine signature from a cheap order can be replayed to pay off an
        // expensive one.
        if (!dbOrder.paymentOrderId || razorpayOrderId !== dbOrder.paymentOrderId) {
          request.log.error(
            { orderId, razorpayOrderId, expected: dbOrder.paymentOrderId },
            'Payment order id does not match the order being verified',
          );
          return reply.status(400).send({ error: 'Payment does not belong to this order' });
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        const hmac = crypto.createHmac('sha256', keySecret);
        hmac.update(razorpayOrderId + '|' + razorpayPaymentId);
        const generatedSignature = hmac.digest('hex');

        if (!signaturesMatch(generatedSignature, razorpaySignature)) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: 'Failed',
            },
          });
          return reply.status(400).send({ error: 'Invalid payment signature' });
        }

        // A valid signature still doesn't prove money moved, or how much. Ask the
        // gateway what it actually captured. Deliberately done BEFORE the
        // transaction below — an external HTTP call inside an interactive
        // transaction would burn the (5s) transaction timeout.
        let payment;
        try {
          payment = await razorpay.payments.fetch(razorpayPaymentId);
        } catch (err) {
          request.log.error(
            { err, orderId, razorpayPaymentId },
            'Could not fetch payment from gateway during verification',
          );
          return reply.status(400).send({ error: 'Could not confirm payment with the gateway' });
        }

        // Gateway amounts are in the minor unit (paise) — mirror the exact
        // conversion create-order used when the gateway order was opened.
        const expectedAmount = Math.round(dbOrder.totalAmount * 100);
        if (
          payment?.status !== 'captured' ||
          Number(payment?.amount) !== expectedAmount ||
          payment?.currency !== CURRENCY ||
          payment?.order_id !== dbOrder.paymentOrderId
        ) {
          // Leave the order Pending: this is a real payment that simply doesn't
          // match, so ops need to see it rather than have it silently marked Failed.
          request.log.error(
            {
              orderId,
              razorpayPaymentId,
              expected: {
                status: 'captured',
                amount: expectedAmount,
                currency: CURRENCY,
                order_id: dbOrder.paymentOrderId,
              },
              actual: {
                status: payment?.status,
                amount: payment?.amount,
                currency: payment?.currency,
                order_id: payment?.order_id,
              },
            },
            'Captured payment does not match the order — refusing to mark it paid',
          );
          return reply.status(400).send({ error: 'Payment does not match this order' });
        }
      } else if (process.env.NODE_ENV === 'production') {
        return reply.status(500).send({ error: 'Payment gateway not configured' });
      } else {
        // Mock verification (dev only)
        console.log(`[SIMULATION] Verification bypassed for order ${orderId} (Mock Mode)`);
      }

      // Claim every one-of-a-kind item AND finalize the order in one transaction.
      // Shared verbatim with the Razorpay webhook — see finalizeOrder() above for
      // why running both paths against the same order is safe.
      const result = await finalizeOrder({
        prisma,
        razorpay,
        log: request.log,
        order: dbOrder,
        isCOD,
        paymentId: razorpayPaymentId,
        paymentSignature: razorpaySignature,
        buyer: dbUser,
        requestContext: { ip: request.ip, userAgent: request.headers['user-agent'] },
      });

      if (result.status === 'already_processed') {
        return reply.status(422).send({ error: result.message });
      }

      if (result.status === 'payment_reused') {
        return reply.status(400).send({ error: 'This payment has already been used' });
      }

      if (result.status === 'sold_out') {
        return reply.status(409).send({
          error: 'One or more items in your order are no longer available',
          soldOut: result.soldOut,
          refundRequired: result.refundRequired,
          refundPending: result.refundPending,
          orderId: dbOrder.id,
          displayId: dbOrder.displayId,
          amount: dbOrder.totalAmount,
        });
      }

      return {
        success: true,
        message: isCOD
          ? 'Order placed successfully. Pay on delivery.'
          : 'Payment verified and order is now being processed',
        order: result.order,
      };
    },
  );

  /**
   * Razorpay server-to-server webhook — the safety net behind /verify-payment.
   *
   * Contract:
   *   POST /api/checkout/razorpay-webhook
   *   Headers: X-Razorpay-Signature: <hex HMAC-SHA256 of the raw body>
   *   Body:    the standard Razorpay webhook envelope
   *            { event, payload: { payment: { entity: {...} } } }
   *   Auth:    the signature IS the authentication — no bearer token, and this
   *            route deliberately does not run fastify.authenticate.
   *
   * Responses:
   *   503 — RAZORPAY_WEBHOOK_SECRET is not set. We fail closed: an unverifiable
   *         webhook can mark orders paid, so refusing the request is the only
   *         safe answer.
   *   400 — signature missing, body empty, or the HMAC does not match.
   *   404 — no order carries this gateway order id. Returned (rather than a
   *         quiet 200) so Razorpay retries: it covers the narrow window where
   *         the webhook beats our own paymentOrderId write.
   *   200 — everything else, INCLUDING sold-out refunds and duplicate
   *         deliveries. The work is done or deliberately skipped, so telling
   *         Razorpay to retry would achieve nothing.
   */
  fastify.post(
    '/razorpay-webhook',
    { preParsing: captureRawBody, config: { rawBody: true } },
    async (request, reply) => {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!secret) {
        request.log.error(
          { route: 'razorpay-webhook' },
          'RAZORPAY_WEBHOOK_SECRET is not configured — refusing to process webhooks rather than trusting an unverified payload',
        );
        return reply.status(503).send({ error: 'Webhook processing is not configured' });
      }

      const signature = request.headers['x-razorpay-signature'];
      if (!signature) {
        return reply.status(400).send({ error: 'Missing webhook signature' });
      }

      const raw = request.rawBody;
      if (!raw || raw.length === 0) {
        return reply.status(400).send({ error: 'Empty webhook body' });
      }

      // HMAC over the EXACT bytes the gateway signed. Re-serialising
      // request.body here would silently break verification.
      const expectedSignature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      if (!signaturesMatch(expectedSignature, signature)) {
        request.log.error({ route: 'razorpay-webhook' }, 'Webhook signature verification failed');
        return reply.status(400).send({ error: 'Invalid webhook signature' });
      }

      const event = request.body?.event;
      if (event !== 'payment.captured' && event !== 'payment.failed') {
        return reply.send({ received: true, ignored: 'unhandled event' });
      }

      const entity = request.body?.payload?.payment?.entity;
      if (!entity?.order_id) {
        return reply.send({ received: true, ignored: 'no gateway order id on payload' });
      }

      const dbOrder = await prisma.order.findFirst({
        where: { paymentOrderId: entity.order_id },
        include: { items: true, user: true },
      });

      if (!dbOrder) {
        request.log.error(
          { route: 'razorpay-webhook', event, gatewayOrderId: entity.order_id },
          'Razorpay webhook for a gateway order that matches no order — asking for a retry',
        );
        return reply.status(404).send({ error: 'No order found for this payment order id' });
      }

      if (event === 'payment.failed') {
        // Guarded so repeat deliveries (Razorpay sends one per failed attempt)
        // cannot overwrite an order that has since been paid, and so the buyer
        // is told once rather than once per attempt.
        const gate = await prisma.order.updateMany({
          where: { id: dbOrder.id, status: 'Pending', paymentStatus: 'Pending' },
          data: { paymentStatus: 'Failed' },
        });

        if (gate.count > 0 && dbOrder.userId) {
          const reason = entity.error_description
            ? ` Reason given by the bank: ${entity.error_description}`
            : '';
          await prisma.notification.create({
            data: {
              userId: dbOrder.userId,
              title: 'Payment Was Not Completed',
              message: `Your payment for order ${dbOrder.displayId} did not go through, so you have not been charged.${reason} The order is saved — you can pay for it from My Orders.`,
            },
          });
        }

        return reply.send({
          received: true,
          orderId: dbOrder.id,
          handled: gate.count > 0 ? 'marked_failed' : 'no_change',
        });
      }

      // payment.captured from here on.
      if (dbOrder.paymentMethod === 'cod') {
        request.log.error(
          { route: 'razorpay-webhook', orderId: dbOrder.id },
          'Gateway captured a payment against an order marked cash-on-delivery — not finalizing',
        );
        return reply.send({ received: true, ignored: 'cod order' });
      }

      // The payload is signature-verified, so its amounts are as trustworthy as
      // a payments.fetch — but they still have to match what we billed. A
      // mismatch is a real captured payment that does not belong here: leave the
      // order alone for ops and do not ask for a retry that cannot help.
      const expectedAmount = Math.round(dbOrder.totalAmount * 100);
      if (
        entity.status !== 'captured' ||
        Number(entity.amount) !== expectedAmount ||
        entity.currency !== CURRENCY
      ) {
        request.log.error(
          {
            route: 'razorpay-webhook',
            orderId: dbOrder.id,
            paymentId: entity.id,
            expected: { status: 'captured', amount: expectedAmount, currency: CURRENCY },
            actual: { status: entity.status, amount: entity.amount, currency: entity.currency },
          },
          'Captured payment does not match the order — refusing to mark it paid',
        );
        return reply.send({ received: true, ignored: 'payment does not match order' });
      }

      const result = await finalizeOrder({
        prisma,
        razorpay: getRazorpayInstance(),
        log: request.log,
        order: dbOrder,
        isCOD: false,
        paymentId: entity.id,
        // The webhook envelope is signed as a whole; there is no per-payment
        // handler signature to record, so mark where the finalize came from.
        paymentSignature: `webhook:${event}`,
        buyer: dbOrder.user,
        requestContext: null,
      });

      if (result.status === 'sold_out') {
        return reply.send({
          received: true,
          orderId: dbOrder.id,
          handled: 'sold_out_refunded',
          refundPending: result.refundPending,
        });
      }

      if (result.status === 'payment_reused' || result.status === 'already_processed') {
        return reply.send({ received: true, orderId: dbOrder.id, handled: result.status });
      }

      return reply.send({
        received: true,
        orderId: dbOrder.id,
        handled: result.alreadyFinalized ? 'already_finalized' : 'finalized',
      });
    },
  );
}
