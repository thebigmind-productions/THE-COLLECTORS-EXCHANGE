import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import crypto from 'crypto';
import { ZodError } from 'zod';

// Real crypto is used throughout: signature verification is the thing under test,
// so the HMAC must not be stubbed out.
const { razorpayMock } = vi.hoisted(() => ({
  razorpayMock: {
    orders: { create: vi.fn() },
    payments: { fetch: vi.fn(), refund: vi.fn() },
  },
}));

vi.mock('razorpay', () => ({
  default: vi.fn(() => razorpayMock),
}));

// Real GOOGLE_MERCHANT_KEY / google-merchant-key.json can exist in a local dev
// checkout, so this MUST be mocked or fire-and-forget syncProductToGoogleAsync
// calls in the route below would hit the live Merchant Center with test data.
vi.mock('../../lib/googleMerchant.js', () => ({
  syncProductToGoogleAsync: vi.fn(),
}));

const { mockSendConversionEventAsync } = vi.hoisted(() => ({
  mockSendConversionEventAsync: vi.fn(),
}));

vi.mock('../../lib/metaConversions.js', async () => {
  const actual = await vi.importActual('../../lib/metaConversions.js');
  return { ...actual, sendConversionEventAsync: mockSendConversionEventAsync };
});

// Genuine gateway signature over a (gateway order, payment) pair.
const sign = (rpOrderId, rpPaymentId) =>
  crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${rpOrderId}|${rpPaymentId}`)
    .digest('hex');

function buildApp(mockPrisma) {
  const fastify = Fastify();
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Request validation failed',
        issues: error.issues,
      });
    }
    reply.status(error.statusCode || 500).send({ error: error.message });
  });
  fastify.decorate('prisma', mockPrisma);
  fastify.decorate('authenticate', async (req, reply) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return reply.status(401).send({ error: 'No token provided' });
    req.user = { sub: 'sb-123' };
    req.dbUser =
      token === 'seller'
        ? { id: 'seller-id', name: 'Seller', email: 'seller@test.com', role: 'user' }
        : { id: 'buyer-id', name: 'Buyer', email: 'buyer@test.com', role: 'user' };
  });
  return fastify;
}

describe('checkout routes', () => {
  let mockPrisma;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
    process.env.NODE_ENV = 'development';
    razorpayMock.orders.create.mockResolvedValue({ id: 'rp_order_123' });
    razorpayMock.payments.fetch.mockReset();
    razorpayMock.payments.refund.mockReset().mockResolvedValue({ id: 'rfnd_1' });
    mockPrisma = {
      cartItem: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      wishlistItem: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      notification: { create: vi.fn(), createMany: vi.fn() },
      // verify-payment runs claim+finalize in one interactive transaction; the
      // create-order tests override this with their own tx double.
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };
  });

  describe('POST /create-order', () => {
    const validBody = {
      shippingAddress: '123 St',
      city: 'Mum',
      state: 'MH',
      zipCode: '400001',
      phone: '9876543210',
      items: [{ productId: 'p1' }],
    };

    it('creates an order successfully', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          product: { id: 'p1', title: 'Test', price: 100, sellerId: 'seller-id' },
        },
      ]);
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          product: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p1',
              title: 'Test',
              price: 100,
              sellerId: 'seller-id',
              status: 'Approved',
            }),
          },
          order: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'order-1', displayId: 'HOR00001', items: [] }),
          },
        };
        return cb(tx);
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/create-order',
        payload: validBody,
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    // The recipient is not necessarily the account holder — gifts and office
    // deliveries are exactly why checkout asks for a name. It used to be
    // stripped by Zod and never reach the shipping label.
    it('writes the recipient name to buyerName so it reaches the shipping label', async () => {
      const orderCreate = vi
        .fn()
        .mockResolvedValue({ id: 'order-1', displayId: 'HOR00001', items: [] });
      mockPrisma.cartItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          product: { id: 'p1', title: 'Test', price: 100, sellerId: 'seller-id' },
        },
      ]);
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          product: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p1',
              title: 'Test',
              price: 100,
              sellerId: 'seller-id',
              status: 'Approved',
            }),
          },
          order: { findFirst: vi.fn().mockResolvedValue(null), create: orderCreate },
        }),
      );
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/create-order',
        payload: { ...validBody, recipientName: 'Priya Sharma' },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(200);
      expect(orderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ buyerName: 'Priya Sharma' }),
        }),
      );
    });

    it('falls back to the account holder when no recipient name is sent', async () => {
      const orderCreate = vi
        .fn()
        .mockResolvedValue({ id: 'order-1', displayId: 'HOR00001', items: [] });
      mockPrisma.cartItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          product: { id: 'p1', title: 'Test', price: 100, sellerId: 'seller-id' },
        },
      ]);
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          product: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p1',
              title: 'Test',
              price: 100,
              sellerId: 'seller-id',
              status: 'Approved',
            }),
          },
          order: { findFirst: vi.fn().mockResolvedValue(null), create: orderCreate },
        }),
      );
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/create-order',
        payload: validBody,
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(200);
      expect(orderCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ buyerName: 'Buyer' }) }),
      );
    });

    it('calculates platformFee from commissionPercent in the order response', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          product: {
            id: 'p1',
            title: 'Test',
            price: 200,
            commissionPercent: 20,
            sellerId: 'seller-id',
          },
        },
      ]);
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          product: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p1',
              title: 'Test',
              price: 200,
              commissionPercent: 20,
              sellerId: 'seller-id',
              status: 'Approved',
            }),
          },
          order: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'order-1', displayId: 'HOR00001', items: [] }),
          },
        };
        return cb(tx);
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/create-order',
        payload: validBody,
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(200);
      // 20% of 200 = 40
      expect(res.json().platformFee).toBe(40);
    });

    it('applies a product-scoped coupon only to eligible items and defers usage recording', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([
        { productId: 'p1', product: { id: 'p1' } },
        { productId: 'p2', product: { id: 'p2' } },
      ]);
      const products = {
        p1: { id: 'p1', title: 'A', price: 1000, sellerId: 'seller-id', status: 'Approved' },
        p2: { id: 'p2', title: 'B', price: 500, sellerId: 'seller-id', status: 'Approved' },
      };
      const couponUsageCreate = vi.fn();
      const orderCreate = vi.fn().mockImplementation(async ({ data }) => ({
        id: 'order-1',
        displayId: 'HOR00001',
        items: [],
        ...data,
      }));
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          product: { findUnique: vi.fn(async ({ where }) => products[where.id]) },
          coupon: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'c1',
              code: 'SAVE10',
              discountPercent: 10,
              productId: 'p1',
              minPurchase: 0,
              maxUses: 1,
              maxUsesPerUser: 1,
              isActive: true,
              expiresAt: null,
            }),
          },
          couponUsage: { count: vi.fn().mockResolvedValue(0), create: couponUsageCreate },
          order: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: orderCreate,
            count: vi.fn().mockResolvedValue(0),
          },
          $queryRaw: vi.fn().mockResolvedValue([{ id: 'c1' }]),
        };
        return cb(tx);
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/create-order',
        payload: {
          ...validBody,
          items: [{ productId: 'p1' }, { productId: 'p2' }],
          couponCode: 'SAVE10',
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(200);
      // 10% of the eligible product (1000) only — NOT 10% of the full 1500 cart
      expect(res.json().discountAmount).toBe(100);
      expect(res.json().amount).toBe(1400);
      // The CouponUsage audit row is still only written on successful payment.
      // (The coupon's usage LIMIT is reserved by the Order itself — see the
      // usage-limit tests below.)
      expect(couponUsageCreate).not.toHaveBeenCalled();
      // Order persisted the discounted total
      expect(orderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            couponId: 'c1',
            discountAmount: 100,
            totalAmount: 1400,
            subtotalBeforeDiscount: 1500,
          }),
        }),
      );
      // The discount must land on the ELIGIBLE item row, not just the order total:
      // p1 100 -> price 900, and its fee absorbs the whole 100 (10% of 1000 = 100
      // fee, minus the 100 discount = 0). p2 is untouched.
      const createdItems = orderCreate.mock.calls[0][0].data.items.create;
      expect(createdItems).toEqual([
        expect.objectContaining({ productId: 'p1', price: 900, platformFee: 0 }),
        expect.objectContaining({ productId: 'p2', price: 500, platformFee: 50 }),
      ]);
    });

    it('rejects a coupon whose minimum purchase is not met and rolls back the order', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([{ productId: 'p1', product: { id: 'p1' } }]);
      const orderCreate = vi.fn();
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          product: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p1',
              title: 'A',
              price: 100,
              sellerId: 'seller-id',
              status: 'Approved',
            }),
          },
          coupon: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'c1',
              code: 'BIG',
              discountPercent: 10,
              productId: null,
              minPurchase: 5000,
              maxUses: 0,
              maxUsesPerUser: 0,
              isActive: true,
              expiresAt: null,
            }),
          },
          couponUsage: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
          order: { findFirst: vi.fn().mockResolvedValue(null), create: orderCreate },
        };
        return cb(tx);
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/create-order',
        payload: { ...validBody, couponCode: 'BIG' },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(422);
      // Order was never created — invalid coupon rolls the whole transaction back
      expect(orderCreate).not.toHaveBeenCalled();
    });

    it('rejects purchase of a non-approved product', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([{ productId: 'p1', product: { id: 'p1' } }]);
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          product: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p1',
              title: 'A',
              price: 100,
              sellerId: 'seller-id',
              status: 'Rejected',
            }),
          },
          order: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
        };
        return cb(tx);
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/create-order',
        payload: validBody,
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 401 without dbUser', async () => {
      const app = buildApp(mockPrisma);
      app.ready();
      const fastify2 = Fastify();
      fastify2.decorate('prisma', mockPrisma);
      fastify2.decorate('authenticate', async (req, reply) => {
        req.user = { sub: 'sb-123' };
        req.dbUser = null;
      });
      await fastify2.register((await import('../../routes/checkout.js')).default);
      await fastify2.ready();
      const res = await fastify2.inject({
        method: 'POST',
        url: '/create-order',
        payload: validBody,
        headers: { authorization: 'Bearer token' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects duplicate productIds so the same one-of-a-kind item cannot be billed twice', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/create-order',
        payload: { ...validBody, items: [{ productId: 'p1' }, { productId: 'p1' }] },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(400);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns 400 with invalid body', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/create-order',
        payload: {},
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(400);
    });

    // displayId is read-then-incremented inside the transaction against a
    // @unique column. Two simultaneous checkouts both compute N+1; the loser
    // used to get a bare "Could not create order. Please try again."
    describe('concurrent displayId collision', () => {
      const displayIdConflict = async () => {
        const { Prisma } = await import('@prisma/client');
        return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['displayId'] },
        });
      };

      const txDouble = (orderCreate, lastDisplayId) => ({
        product: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'p1',
            title: 'Test',
            price: 100,
            sellerId: 'seller-id',
            status: 'Approved',
          }),
        },
        order: {
          findFirst: vi.fn().mockResolvedValue(lastDisplayId ? { displayId: lastDisplayId } : null),
          create: orderCreate,
        },
      });

      beforeEach(() => {
        mockPrisma.cartItem.findMany.mockResolvedValue([
          {
            productId: 'p1',
            product: { id: 'p1', title: 'Test', price: 100, sellerId: 'seller-id' },
          },
        ]);
      });

      it('retries and succeeds when a rival checkout takes the number first', async () => {
        const conflict = await displayIdConflict();
        const orderCreate = vi
          .fn()
          .mockRejectedValueOnce(conflict)
          .mockResolvedValue({ id: 'order-1', displayId: 'HOR00043', items: [] });
        // The rival has committed by the time we see P2002, so the retry's
        // re-read sees a higher max and computes a genuinely free number.
        mockPrisma.$transaction
          .mockImplementationOnce(async (cb) => cb(txDouble(orderCreate, 'HOR00041')))
          .mockImplementation(async (cb) => cb(txDouble(orderCreate, 'HOR00042')));

        const app = buildApp(mockPrisma);
        await app.register((await import('../../routes/checkout.js')).default);
        await app.ready();
        const res = await app.inject({
          method: 'POST',
          url: '/create-order',
          payload: validBody,
          headers: { authorization: 'Bearer buyer' },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().displayId).toBe('HOR00043');
        expect(orderCreate).toHaveBeenCalledTimes(2);
        expect(orderCreate.mock.calls[0][0].data.displayId).toBe('HOR00042');
        expect(orderCreate.mock.calls[1][0].data.displayId).toBe('HOR00043');
      });

      // The retry re-runs the whole closure. Its totals accumulate into
      // variables declared outside it, so a retry that did not reset them would
      // bill the buyer twice for the same one-of-a-kind item.
      it('does not double-count the order total across a retry', async () => {
        const conflict = await displayIdConflict();
        const orderCreate = vi
          .fn()
          .mockRejectedValueOnce(conflict)
          .mockResolvedValue({ id: 'order-1', displayId: 'HOR00002', items: [] });
        mockPrisma.$transaction.mockImplementation(async (cb) => cb(txDouble(orderCreate, null)));

        const app = buildApp(mockPrisma);
        await app.register((await import('../../routes/checkout.js')).default);
        await app.ready();
        const res = await app.inject({
          method: 'POST',
          url: '/create-order',
          payload: validBody,
          headers: { authorization: 'Bearer buyer' },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().amount).toBe(100);
        expect(orderCreate.mock.calls[1][0].data.totalAmount).toBe(100);
        expect(orderCreate.mock.calls[1][0].data.items.create).toHaveLength(1);
      });

      it('gives up after 3 attempts rather than looping', async () => {
        const conflict = await displayIdConflict();
        const orderCreate = vi.fn().mockRejectedValue(conflict);
        mockPrisma.$transaction.mockImplementation(async (cb) => cb(txDouble(orderCreate, null)));

        const app = buildApp(mockPrisma);
        await app.register((await import('../../routes/checkout.js')).default);
        await app.ready();
        const res = await app.inject({
          method: 'POST',
          url: '/create-order',
          payload: validBody,
          headers: { authorization: 'Bearer buyer' },
        });

        expect(res.statusCode).toBe(409);
        expect(orderCreate).toHaveBeenCalledTimes(3);
      });

      // A P2002 on any OTHER column is not a numbering race and must not be
      // retried — retrying it just repeats the same doomed write.
      it('does not retry a unique violation on a different column', async () => {
        const { Prisma } = await import('@prisma/client');
        const orderCreate = vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['paymentId'] },
          }),
        );
        mockPrisma.$transaction.mockImplementation(async (cb) => cb(txDouble(orderCreate, null)));

        const app = buildApp(mockPrisma);
        await app.register((await import('../../routes/checkout.js')).default);
        await app.ready();
        const res = await app.inject({
          method: 'POST',
          url: '/create-order',
          payload: validBody,
          headers: { authorization: 'Bearer buyer' },
        });

        expect(res.statusCode).toBe(409);
        expect(orderCreate).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ===========================================================================
  // Coupon discounts must be visible to the vendor payout.
  //
  // The payout run (admin.js /payouts/auto-create) pays
  // `(item.price - item.platformFee) * quantity` — it reads the ITEM, never the
  // order. A discount recorded only on Order.totalAmount is therefore invisible
  // to it: the platform collects the discounted total but disburses against the
  // full price, and loses the difference on every couponed sale.
  //
  // INVARIANT: sum(item payouts) + sum(platformFee) === Order.totalAmount, exactly.
  // ===========================================================================
  describe('POST /create-order — coupon payout reconciliation', () => {
    const validBody = {
      shippingAddress: '123 St',
      city: 'Mum',
      state: 'MH',
      zipCode: '400001',
      phone: '9876543210',
      items: [{ productId: 'p1' }],
    };

    // Mirrors admin.js:/payouts/auto-create and vendor.js exactly.
    const payoutOf = (items) =>
      items.reduce((s, i) => s + (i.price - i.platformFee) * i.quantity, 0);
    const feesOf = (items) => items.reduce((s, i) => s + i.platformFee * i.quantity, 0);

    // Drives a create-order with one product and one all-products coupon.
    const runCheckout = async ({ price, commissionPercent, discountPercent }) => {
      const orderCreate = vi.fn().mockImplementation(async ({ data }) => ({
        id: 'order-1',
        displayId: 'HOR00001',
        items: [],
        ...data,
      }));
      mockPrisma.cartItem.findMany.mockResolvedValue([{ productId: 'p1', product: { id: 'p1' } }]);
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          product: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p1',
              title: 'A',
              price,
              commissionPercent,
              sellerId: 'seller-id',
              status: 'Approved',
            }),
          },
          coupon: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'c1',
              code: 'SAVE',
              discountPercent,
              productId: null,
              minPurchase: 0,
              maxUses: 0,
              maxUsesPerUser: 0,
              isActive: true,
              expiresAt: null,
            }),
          },
          couponUsage: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
          order: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: orderCreate,
            count: vi.fn().mockResolvedValue(0),
          },
          $queryRaw: vi.fn().mockResolvedValue([{ id: 'c1' }]),
        }),
      );
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/create-order',
        payload: { ...validBody, couponCode: 'SAVE' },
        headers: { authorization: 'Bearer buyer' },
      });
      return { res, written: orderCreate.mock.calls[0]?.[0]?.data };
    };

    it('does not disburse more than it collected (the reported 20%-coupon leak)', async () => {
      // product 10,000, commission 10% -> fee 1,000. 20% coupon -> buyer pays 8,000.
      // Before the fix: item.price stayed 10,000, payout = 10,000 - 1,000 = 9,000
      // against 8,000 collected => 1,000 lost on every such sale.
      const { res, written } = await runCheckout({
        price: 10000,
        commissionPercent: 10,
        discountPercent: 20,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().amount).toBe(8000); // what the buyer is charged
      expect(written.totalAmount).toBe(8000);

      const items = written.items.create;
      expect(items[0].price).toBe(8000); // the discount reached the item row
      expect(items[0].platformFee).toBe(-1000); // the platform funded its own promo

      expect(payoutOf(items)).toBe(9000); // vendor still gets their agreed payout
      expect(payoutOf(items) + feesOf(items)).toBe(written.totalAmount); // reconciles
    });

    it('reconciles at discountPercent 100, where the buyer pays nothing', async () => {
      // schemas/coupon.js permits discountPercent: 100. Buyer pays 0; the vendor
      // is still owed 9,000 and the platform pays all of it out of pocket.
      const { res, written } = await runCheckout({
        price: 10000,
        commissionPercent: 10,
        discountPercent: 100,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().amount).toBe(0);
      expect(written.totalAmount).toBe(0);

      const items = written.items.create;
      expect(payoutOf(items)).toBe(9000);
      expect(feesOf(items)).toBe(-9000);
      expect(payoutOf(items) + feesOf(items)).toBe(0); // === totalAmount
    });

    it('reconciles exactly on a fractional discount (no paise created or destroyed)', async () => {
      // 10,001 @ 33% = 3300.33 — a discount that does not land on a round rupee.
      const { res, written } = await runCheckout({
        price: 10001,
        commissionPercent: 10,
        discountPercent: 33,
      });

      expect(res.statusCode).toBe(200);
      expect(written.discountAmount).toBe(3300.33);
      expect(written.totalAmount).toBe(6700.67); // 10001 - 3300.33, to the paise
      expect(res.json().amount).toBe(6700.67); // and that is what the gateway is asked for

      const items = written.items.create;
      // Compared in paise: the invariant is exact, not approximate.
      const paise = (r) => Math.round(r * 100);
      expect(paise(payoutOf(items)) + paise(feesOf(items))).toBe(paise(written.totalAmount));
      expect(payoutOf(items)).toBe(9000.9); // 10001 - 1000.10, untouched by the coupon
    });
  });

  // ===========================================================================
  // Coupon usage limits must actually be enforceable.
  //
  // create-order used to count CouponUsage rows — but that row is not written
  // until verify-payment, so every concurrent checkout read 0 and a maxUses:1
  // coupon could be attached to N orders and then all N verified.
  // ===========================================================================
  describe('POST /create-order — coupon usage limits', () => {
    const validBody = {
      shippingAddress: '123 St',
      city: 'Mum',
      state: 'MH',
      zipCode: '400001',
      phone: '9876543210',
      items: [{ productId: 'p1' }],
    };

    const coupon = (overrides = {}) => ({
      id: 'c1',
      code: 'ONCE',
      discountPercent: 10,
      productId: null,
      minPurchase: 0,
      maxUses: 1,
      maxUsesPerUser: 0,
      isActive: true,
      expiresAt: null,
      ...overrides,
    });

    const buildTx = ({ couponRow, orderCount, orderCreate, queryRaw }) => ({
      product: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'p1',
          title: 'A',
          price: 1000,
          sellerId: 'seller-id',
          status: 'Approved',
        }),
      },
      coupon: { findUnique: vi.fn().mockResolvedValue(couponRow) },
      couponUsage: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
      order: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: orderCreate,
        count: orderCount,
      },
      $queryRaw: queryRaw,
    });

    const post = async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      return app.inject({
        method: 'POST',
        url: '/create-order',
        payload: { ...validBody, couponCode: 'ONCE' },
        headers: { authorization: 'Bearer buyer' },
      });
    };

    it('takes the coupon row lock BEFORE counting — a count-then-insert would race', async () => {
      // Under Read Committed, two concurrent checkouts both read count=0 and both
      // insert. The FOR UPDATE lock is the whole mechanism: it must be acquired
      // before the count, or waiting transactions still act on a stale number.
      const queryRaw = vi.fn().mockResolvedValue([{ id: 'c1' }]);
      const orderCount = vi.fn().mockResolvedValue(0);
      mockPrisma.cartItem.findMany.mockResolvedValue([{ productId: 'p1', product: { id: 'p1' } }]);
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb(
          buildTx({
            couponRow: coupon(),
            orderCount,
            orderCreate: vi.fn().mockResolvedValue({ id: 'o1', displayId: 'HOR00001', items: [] }),
            queryRaw,
          }),
        ),
      );

      expect((await post()).statusCode).toBe(200);

      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(queryRaw.mock.calls[0][0].join('?')).toMatch(/FOR UPDATE/);
      expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        orderCount.mock.invocationCallOrder[0],
      );
    });

    it('rejects a maxUses:1 coupon once another order already holds it', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([{ productId: 'p1', product: { id: 'p1' } }]);
      const orderCreate = vi.fn();
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb(
          buildTx({
            couponRow: coupon(),
            orderCount: vi.fn().mockResolvedValue(1), // one order already holds it
            orderCreate,
            queryRaw: vi.fn().mockResolvedValue([{ id: 'c1' }]),
          }),
        ),
      );

      const res = await post();
      expect(res.statusCode).toBe(422);
      expect(res.json().error).toBe('Coupon usage limit reached');
      expect(orderCreate).not.toHaveBeenCalled();
    });

    it('enforces maxUsesPerUser against the orders this user already holds', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([{ productId: 'p1', product: { id: 'p1' } }]);
      const orderCreate = vi.fn();
      // maxUses is unlimited, so only the per-user count runs — and this buyer
      // already holds one order with the coupon.
      const orderCount = vi.fn().mockResolvedValue(1);
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb(
          buildTx({
            couponRow: coupon({ maxUses: 0, maxUsesPerUser: 1 }),
            orderCount,
            orderCreate,
            queryRaw: vi.fn().mockResolvedValue([{ id: 'c1' }]),
          }),
        ),
      );

      const res = await post();
      expect(res.statusCode).toBe(422);
      expect(res.json().error).toMatch(/already used this coupon/);
      expect(orderCreate).not.toHaveBeenCalled();
      // the per-user count must be scoped to the buyer, not global
      expect(orderCount).toHaveBeenCalledTimes(1);
      expect(orderCount.mock.calls[0][0].where).toMatchObject({ userId: 'buyer-id' });
    });

    it('THE RACE: a maxUses:1 coupon cannot be claimed by a second checkout', async () => {
      // Replays the reported exploit against a fake DB that behaves like the real
      // one: the coupon lock serializes the two checkouts, so the second sees the
      // first's committed order. Under the old CouponUsage-based count this fake
      // would return 0 both times (no usage row exists until verify-payment) and
      // BOTH checkouts would succeed.
      const orders = [];
      mockPrisma.cartItem.findMany.mockResolvedValue([{ productId: 'p1', product: { id: 'p1' } }]);
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb(
          buildTx({
            couponRow: coupon(),
            // Counts committed orders holding the coupon — what create-order writes.
            orderCount: vi.fn(
              async ({ where }) =>
                orders.filter(
                  (o) =>
                    o.couponId === where.couponId && (!where.userId || o.userId === where.userId),
                ).length,
            ),
            orderCreate: vi.fn(async ({ data }) => {
              orders.push(data);
              return { id: `o${orders.length}`, displayId: 'HOR00001', items: [], ...data };
            }),
            queryRaw: vi.fn().mockResolvedValue([{ id: 'c1' }]),
          }),
        ),
      );

      const first = await post();
      const second = await post();

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(422);
      expect(second.json().error).toBe('Coupon usage limit reached');
      // Exactly one order ever got the discount.
      expect(orders.filter((o) => o.couponId === 'c1')).toHaveLength(1);
    });

    it('does not count orders that were cancelled or refunded — those release the coupon', async () => {
      const orderCount = vi.fn().mockResolvedValue(0);
      mockPrisma.cartItem.findMany.mockResolvedValue([{ productId: 'p1', product: { id: 'p1' } }]);
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb(
          buildTx({
            couponRow: coupon(),
            orderCount,
            orderCreate: vi.fn().mockResolvedValue({ id: 'o1', displayId: 'HOR00001', items: [] }),
            queryRaw: vi.fn().mockResolvedValue([{ id: 'c1' }]),
          }),
        ),
      );

      expect((await post()).statusCode).toBe(200);
      expect(orderCount.mock.calls[0][0].where).toMatchObject({
        couponId: 'c1',
        status: { not: 'Cancelled' },
        paymentStatus: { notIn: ['Failed', 'Refunded'] },
      });
    });

    it('skips the lock entirely for an unlimited coupon', async () => {
      const queryRaw = vi.fn();
      mockPrisma.cartItem.findMany.mockResolvedValue([{ productId: 'p1', product: { id: 'p1' } }]);
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb(
          buildTx({
            couponRow: coupon({ maxUses: 0, maxUsesPerUser: 0 }),
            orderCount: vi.fn().mockResolvedValue(0),
            orderCreate: vi.fn().mockResolvedValue({ id: 'o1', displayId: 'HOR00001', items: [] }),
            queryRaw,
          }),
        ),
      );

      expect((await post()).statusCode).toBe(200);
      expect(queryRaw).not.toHaveBeenCalled(); // no limit to enforce, no need to serialize
    });
  });

  describe('POST /verify-payment', () => {
    it('verifies payment successfully', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'buyer-id',
        paymentStatus: 'Pending',
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'order-1',
        paymentStatus: 'Paid',
        status: 'Processing',
        items: [],
      });
      const app = buildApp(mockPrisma);
      app.addHook('onRoute', () => {});
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      process.env.NODE_ENV = 'development';
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_1',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: 'sig_1',
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it('claims the product atomically and clears carts on success', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce({
          id: 'order-1',
          userId: 'buyer-id',
          paymentStatus: 'Pending',
          paymentMethod: 'online',
          items: [{ productId: 'p1' }],
        })
        .mockResolvedValue({
          id: 'order-1',
          paymentStatus: 'Paid',
          status: 'Processing',
          totalAmount: 100,
          items: [{ productId: 'p1' }],
        });
      mockPrisma.product.updateMany = vi.fn().mockResolvedValue({ count: 1 });
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', status: 'Sold', isPublished: true, title: 'Item', price: 100 },
      ]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      process.env.NODE_ENV = 'development';
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: { orderId: 'order-1' },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      // Guarded claim only flips an Approved product to Sold
      expect(mockPrisma.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1', status: 'Approved' },
          data: { status: 'Sold' },
        }),
      );
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1' } });
      expect(mockSendConversionEventAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'Purchase',
          eventId: 'order-1',
          customData: expect.objectContaining({
            value: 100,
            currency: 'INR',
            content_ids: ['p1'],
          }),
          userData: expect.objectContaining({
            em: expect.any(String),
          }),
        }),
      );
    });

    it('does not fire a Purchase event when the verify call is just a no-op echo of an already-finalized order', async () => {
      // Both requests read Pending; the first one wins the guarded finalize, so
      // this one's gate matches 0 rows and it just echoes the already-Paid order.
      mockPrisma.order.findUnique
        .mockResolvedValueOnce({
          id: 'order-1',
          userId: 'buyer-id',
          paymentStatus: 'Pending',
          paymentMethod: 'online',
          items: [{ productId: 'p1' }],
        })
        .mockResolvedValue({
          id: 'order-1',
          status: 'Processing',
          paymentStatus: 'Paid',
          items: [{ productId: 'p1' }],
        });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      process.env.NODE_ENV = 'development';
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: { orderId: 'order-1' },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockSendConversionEventAsync).not.toHaveBeenCalled();
    });

    it('cancels the order and flags a refund when an item is already sold', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'buyer-id',
        paymentStatus: 'Pending',
        paymentMethod: 'online',
        items: [{ productId: 'p1' }],
      });
      mockPrisma.product.updateMany = vi.fn().mockResolvedValue({ count: 0 }); // another order already claimed it
      const orderUpdate = vi.fn().mockResolvedValue({});
      mockPrisma.order.update = orderUpdate;
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      process.env.NODE_ENV = 'development';
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: { orderId: 'order-1' },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().refundRequired).toBe(true);
      expect(orderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Cancelled', paymentStatus: 'Refunded' }),
        }),
      );
    });

    it('returns 404 when order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: { orderId: 'bad-id' },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when order belongs to another user', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'other-id',
        paymentStatus: 'Pending',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_1',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: 'sig_1',
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 422 when already paid', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'buyer-id',
        paymentStatus: 'Paid',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: { orderId: 'order-1' },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  // Every listing is one-of-a-kind, so a sale is not a stock change — it is the
  // permanent disappearance of something other people had saved, and the only
  // income event the seller has. Both used to happen in total silence.
  describe('finalizeOrder — sale announcements', () => {
    const pendingOrder = {
      id: 'order-1',
      displayId: 'HOR00042',
      userId: 'buyer-id',
      paymentStatus: 'Pending',
      paymentMethod: 'online',
      items: [{ productId: 'p1' }],
    };
    const finalizedOrder = {
      id: 'order-1',
      displayId: 'HOR00042',
      paymentStatus: 'Paid',
      status: 'Processing',
      totalAmount: 60000,
      items: [{ productId: 'p1' }],
    };

    const arrange = ({ order = pendingOrder, final = finalizedOrder, products } = {}) => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(order).mockResolvedValue(final);
      mockPrisma.product.findMany.mockResolvedValue(
        products || [
          {
            id: 'p1',
            title: 'Rolex Submariner 5513',
            sellerId: 'seller-id',
            price: 60000,
            status: 'Sold',
          },
        ],
      );
    };

    const verify = async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      process.env.NODE_ENV = 'development';
      return app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: { orderId: 'order-1' },
        headers: { authorization: 'Bearer buyer' },
      });
    };

    // Every row handed to createMany across the whole finalize, flattened.
    const written = () => mockPrisma.notification.createMany.mock.calls.flatMap((c) => c[0].data);

    it('tells a shopper whose cart the item was silently pulled from', async () => {
      arrange();
      mockPrisma.cartItem.findMany.mockResolvedValue([{ userId: 'u2', productId: 'p1' }]);
      const res = await verify();

      expect(res.statusCode).toBe(200);
      const note = written().find((n) => n.userId === 'u2');
      expect(note).toBeDefined();
      expect(note.title).toBe('A Saved Item Has Sold');
      expect(note.message).toContain('Rolex Submariner 5513');
      expect(note.message).toContain('your cart');
    });

    it('reads the affected users BEFORE the rows are deleted', async () => {
      arrange();
      const callOrder = [];
      mockPrisma.cartItem.findMany.mockImplementation(async () => {
        callOrder.push('read');
        return [{ userId: 'u2', productId: 'p1' }];
      });
      mockPrisma.cartItem.deleteMany.mockImplementation(async () => {
        callOrder.push('delete');
        return { count: 1 };
      });
      await verify();

      expect(callOrder).toEqual(['read', 'delete']);
    });

    it('does not tell the buyer their own purchase vanished from their cart', async () => {
      arrange();
      mockPrisma.cartItem.findMany.mockResolvedValue([]);
      await verify();

      expect(mockPrisma.cartItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: { not: 'buyer-id' } }),
        }),
      );
      expect(written().some((n) => n.userId === 'buyer-id')).toBe(false);
    });

    it('sends ONE notice naming both places when the item was in cart and wishlist', async () => {
      arrange();
      mockPrisma.cartItem.findMany.mockResolvedValue([{ userId: 'u2', productId: 'p1' }]);
      mockPrisma.wishlistItem.findMany.mockResolvedValue([{ userId: 'u2', productId: 'p1' }]);
      await verify();

      const forU2 = written().filter((n) => n.userId === 'u2');
      expect(forU2).toHaveLength(1);
      expect(forU2[0].message).toContain('your cart and wishlist');
    });

    it('tells the seller their item sold, naming the order', async () => {
      arrange();
      await verify();

      const note = written().find((n) => n.userId === 'seller-id');
      expect(note).toBeDefined();
      expect(note.title).toBe('Your Item Has Sold');
      expect(note.message).toContain('Rolex Submariner 5513');
      expect(note.message).toContain('HOR00042');
    });

    it('groups a multi-item order into one notice per seller', async () => {
      arrange({
        order: { ...pendingOrder, items: [{ productId: 'p1' }, { productId: 'p2' }] },
        final: { ...finalizedOrder, items: [{ productId: 'p1' }, { productId: 'p2' }] },
        products: [
          { id: 'p1', title: 'Rolex 5513', sellerId: 'seller-id', price: 60000 },
          { id: 'p2', title: 'Omega 145.022', sellerId: 'seller-id', price: 40000 },
        ],
      });
      await verify();

      const forSeller = written().filter((n) => n.userId === 'seller-id');
      expect(forSeller).toHaveLength(1);
      expect(forSeller[0].title).toBe('Your Items Have Sold');
      expect(forSeller[0].message).toContain('Rolex 5513');
      expect(forSeller[0].message).toContain('Omega 145.022');
    });

    it('still notifies the seller when nobody else had the item saved', async () => {
      arrange();
      mockPrisma.cartItem.findMany.mockResolvedValue([]);
      mockPrisma.wishlistItem.findMany.mockResolvedValue([]);
      await verify();

      expect(written()).toEqual([expect.objectContaining({ userId: 'seller-id' })]);
    });

    it('writes nothing a second time when the order was already finalized', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValue({ ...finalizedOrder, status: 'Processing' });
      // The guarded gate matches nothing: someone else already finalized.
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });
      await verify();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  // These exercise the LIVE gateway path (real keys configured, real HMAC).
  describe('POST /verify-payment (live gateway verification)', () => {
    // Order worth ₹1000, paid through gateway order rp_order_own.
    const liveOrder = {
      id: 'order-1',
      userId: 'buyer-id',
      status: 'Pending',
      paymentStatus: 'Pending',
      paymentMethod: 'online',
      paymentOrderId: 'rp_order_own',
      totalAmount: 1000,
      items: [{ productId: 'p1' }],
    };

    const capturedPayment = {
      status: 'captured',
      amount: 100000, // ₹1000 in paise
      currency: 'INR',
      order_id: 'rp_order_own',
    };

    async function buildLiveApp() {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      return app;
    }

    it('verifies a genuine, correctly-priced payment for its own order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(liveOrder);
      razorpayMock.payments.fetch.mockResolvedValue(capturedPayment);
      const app = await buildLiveApp();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_order_own',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: sign('rp_order_own', 'pay_1'),
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      // Finalize is gated on the order not having been finalized yet. 'Failed'
      // is in the gate because it is an ATTEMPT that failed, not the order: a
      // declined or dismissed attempt stamps Failed, and the retry that
      // succeeds must still be able to finalize the same order.
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'order-1',
            status: 'Pending',
            paymentStatus: { in: ['Pending', 'Failed'] },
          },
          data: expect.objectContaining({ paymentStatus: 'Paid', paymentId: 'pay_1' }),
        }),
      );
    });

    it('rejects a genuine signature captured from a DIFFERENT order', async () => {
      // The attacker paid ₹1 for rp_order_cheap and holds a real gateway
      // signature for it, then replays that triple against this ₹1000 order.
      mockPrisma.order.findUnique.mockResolvedValue(liveOrder);
      const app = await buildLiveApp();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_order_cheap',
          razorpayPaymentId: 'pay_cheap',
          razorpaySignature: sign('rp_order_cheap', 'pay_cheap'), // genuinely valid!
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Payment does not belong to this order');
      // Rejected before the signature check even runs — nothing was finalized
      expect(razorpayMock.payments.fetch).not.toHaveBeenCalled();
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.product.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a forged signature and marks the payment Failed', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(liveOrder);
      const app = await buildLiveApp();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_order_own',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: 'deadbeef',
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Invalid payment signature');
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { paymentStatus: 'Failed' } }),
      );
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a payment whose captured amount does not match the order total', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(liveOrder);
      // Signature is genuine and bound to the right order, but only ₹1 moved.
      razorpayMock.payments.fetch.mockResolvedValue({ ...capturedPayment, amount: 100 });
      const app = await buildLiveApp();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_order_own',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: sign('rp_order_own', 'pay_1'),
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Payment does not match this order');
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.product.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a payment that was authorized but never captured', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(liveOrder);
      razorpayMock.payments.fetch.mockResolvedValue({ ...capturedPayment, status: 'authorized' });
      const app = await buildLiveApp();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_order_own',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: sign('rp_order_own', 'pay_1'),
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(400);
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('rejects when the gateway cannot confirm the payment', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(liveOrder);
      razorpayMock.payments.fetch.mockRejectedValue(new Error('not found'));
      const app = await buildLiveApp();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_order_own',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: sign('rp_order_own', 'pay_1'),
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(400);
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('is idempotent: a second concurrent verify reports success without cancelling the paid order', async () => {
      // Both requests read Pending; the first one wins the guarded finalize, so
      // this one's gate matches 0 rows.
      mockPrisma.order.findUnique
        .mockResolvedValueOnce(liveOrder)
        .mockResolvedValue({ ...liveOrder, status: 'Processing', paymentStatus: 'Paid' });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });
      razorpayMock.payments.fetch.mockResolvedValue(capturedPayment);
      const app = await buildLiveApp();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_order_own',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: sign('rp_order_own', 'pay_1'),
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().order.paymentStatus).toBe('Paid');
      // The loser must not claim products, cancel/refund, or re-notify the buyer
      expect(mockPrisma.product.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('actually refunds through the gateway when an item is already sold', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(liveOrder);
      razorpayMock.payments.fetch.mockResolvedValue(capturedPayment);
      mockPrisma.product.updateMany.mockResolvedValue({ count: 0 }); // claimed by someone else
      const app = await buildLiveApp();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_order_own',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: sign('rp_order_own', 'pay_1'),
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(409);
      expect(razorpayMock.payments.refund).toHaveBeenCalledWith(
        'pay_1',
        expect.objectContaining({ notes: expect.objectContaining({ orderId: 'order-1' }) }),
      );
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Cancelled', paymentStatus: 'Refunded' }),
        }),
      );
      expect(res.json().refundPending).toBe(false);
    });

    it('does not claim Refunded in the ledger when the gateway refund fails', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(liveOrder);
      razorpayMock.payments.fetch.mockResolvedValue(capturedPayment);
      razorpayMock.payments.refund.mockRejectedValue(new Error('gateway down'));
      mockPrisma.product.updateMany.mockResolvedValue({ count: 0 });
      const app = await buildLiveApp();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_order_own',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: sign('rp_order_own', 'pay_1'),
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().refundPending).toBe(true);
      // We still hold the money — the order stays Paid rather than lying
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Cancelled', paymentStatus: 'Paid' }),
        }),
      );
    });

    it('rejects a replayed payment that is already bound to another order', async () => {
      const { Prisma } = await import('@prisma/client');
      mockPrisma.order.findUnique.mockResolvedValue(liveOrder);
      razorpayMock.payments.fetch.mockResolvedValue(capturedPayment);
      mockPrisma.order.updateMany.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['paymentId'] },
        }),
      );
      const app = await buildLiveApp();
      const res = await app.inject({
        method: 'POST',
        url: '/verify-payment',
        payload: {
          orderId: 'order-1',
          razorpayOrderId: 'rp_order_own',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: sign('rp_order_own', 'pay_1'),
        },
        headers: { authorization: 'Bearer buyer' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('This payment has already been used');
      // The unique constraint fires before any product is touched
      expect(mockPrisma.product.updateMany).not.toHaveBeenCalled();
    });
  });

  // The webhook is the safety net for the case the buyer's browser can never
  // cover: money captured, then the tab closes / the phone loses signal before
  // /verify-payment is reached.
  describe('POST /razorpay-webhook', () => {
    const WEBHOOK_SECRET = 'whsec_test';

    // Deliberately hand-written rather than JSON.stringify'd: the odd spacing
    // and the non-ASCII rupee sign only survive if the route hashes the exact
    // bytes it received. Re-serialising request.body would change both.
    const capturedBody =
      '{"event":"payment.captured",  "payload":{"payment":{"entity":' +
      '{"id":"pay_hook_1","order_id":"rp_order_own","amount":100000,' +
      '"currency":"INR","status":"captured","notes":{"memo":"Café ₹1,000"}}}}}';

    const failedBody = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_hook_2',
            order_id: 'rp_order_own',
            amount: 100000,
            currency: 'INR',
            status: 'failed',
            error_description: 'Your card was declined by the issuing bank.',
          },
        },
      },
    });

    const webhookSign = (body, secret = WEBHOOK_SECRET) =>
      crypto.createHmac('sha256', secret).update(body).digest('hex');

    const pendingOrder = {
      id: 'order-1',
      displayId: 'HOR00001',
      userId: 'buyer-id',
      status: 'Pending',
      paymentStatus: 'Pending',
      paymentMethod: 'online',
      paymentOrderId: 'rp_order_own',
      totalAmount: 1000,
      items: [{ productId: 'p1' }],
      user: { id: 'buyer-id', email: 'buyer@test.com', phone: '9876543210' },
    };

    const finalizedOrder = {
      id: 'order-1',
      displayId: 'HOR00001',
      status: 'Processing',
      paymentStatus: 'Paid',
      totalAmount: 1000,
      items: [{ productId: 'p1' }],
    };

    beforeEach(() => {
      process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    });

    async function buildWebhookApp() {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/checkout.js')).default);
      await app.ready();
      return app;
    }

    const post = (app, body, signature) =>
      app.inject({
        method: 'POST',
        url: '/razorpay-webhook',
        payload: body,
        headers: {
          'content-type': 'application/json',
          ...(signature === null ? {} : { 'x-razorpay-signature': signature }),
        },
      });

    it('fails closed with 503 when no webhook secret is configured', async () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, webhookSign(capturedBody));
      expect(res.statusCode).toBe(503);
      // Nothing was looked up, let alone finalized
      expect(mockPrisma.order.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a request with no signature header', async () => {
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, null);
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Missing webhook signature');
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a forged signature', async () => {
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, 'deadbeef');
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Invalid webhook signature');
      expect(mockPrisma.order.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a signature made with the wrong secret', async () => {
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, webhookSign(capturedBody, 'not_the_secret'));
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Invalid webhook signature');
    });

    it('rejects a body that was tampered with after signing', async () => {
      const app = await buildWebhookApp();
      const signature = webhookSign(capturedBody);
      const tampered = capturedBody.replace('"amount":100000', '"amount":1');
      const res = await post(app, tampered, signature);
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Invalid webhook signature');
      expect(mockPrisma.order.findFirst).not.toHaveBeenCalled();
    });

    it('verifies against the RAW bytes, not a re-serialised body', async () => {
      // capturedBody has spacing and unicode that JSON.stringify(request.body)
      // would not reproduce, so this only passes if the raw stream was kept.
      expect(JSON.stringify(JSON.parse(capturedBody))).not.toBe(capturedBody);
      mockPrisma.order.findFirst.mockResolvedValue(pendingOrder);
      mockPrisma.order.findUnique.mockResolvedValue(finalizedOrder);
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, webhookSign(capturedBody));
      expect(res.statusCode).toBe(200);
      expect(res.json().handled).toBe('finalized');
    });

    it('finalizes a captured payment the browser never reported', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(pendingOrder);
      mockPrisma.order.findUnique.mockResolvedValue(finalizedOrder);
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', status: 'Sold', title: 'Item', price: 1000 },
      ]);
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, webhookSign(capturedBody));

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        received: true,
        orderId: 'order-1',
        handled: 'finalized',
      });
      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { paymentOrderId: 'rp_order_own' } }),
      );
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentStatus: 'Paid',
            status: 'Processing',
            paymentId: 'pay_hook_1',
          }),
        }),
      );
      // The item is claimed and pulled out of everyone's cart, exactly as the
      // browser path would have done.
      expect(mockPrisma.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1', status: 'Approved' } }),
      );
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1' } });
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'buyer-id', title: 'Order Confirmed' }),
        }),
      );
    });

    it('IDEMPOTENCY: a webhook delivered after the browser already verified changes nothing', async () => {
      // The guarded gate matches 0 rows because the order is no longer Pending.
      mockPrisma.order.findFirst.mockResolvedValue(pendingOrder);
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.order.findUnique.mockResolvedValue(finalizedOrder);
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, webhookSign(capturedBody));

      expect(res.statusCode).toBe(200);
      expect(res.json().handled).toBe('already_finalized');
      // No second claim, no second notification, no cancel/refund
      expect(mockPrisma.product.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
      expect(razorpayMock.payments.refund).not.toHaveBeenCalled();
    });

    it('IDEMPOTENCY: two deliveries of the same webhook finalize only once', async () => {
      mockPrisma.order.findFirst
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValue({ ...pendingOrder, status: 'Processing', paymentStatus: 'Paid' });
      mockPrisma.order.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValue({ count: 0 });
      mockPrisma.order.findUnique.mockResolvedValue(finalizedOrder);
      const app = await buildWebhookApp();
      const signature = webhookSign(capturedBody);

      const first = await post(app, capturedBody, signature);
      const second = await post(app, capturedBody, signature);

      expect(first.json().handled).toBe('finalized');
      expect(second.json().handled).toBe('already_finalized');
      // Claimed once, announced once.
      expect(mockPrisma.product.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it('refunds through the gateway when the webhook loses the race for the item', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(pendingOrder);
      mockPrisma.product.updateMany.mockResolvedValue({ count: 0 }); // already Sold
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, webhookSign(capturedBody));

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ handled: 'sold_out_refunded', refundPending: false });
      expect(razorpayMock.payments.refund).toHaveBeenCalledWith(
        'pay_hook_1',
        expect.objectContaining({ notes: expect.objectContaining({ orderId: 'order-1' }) }),
      );
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Cancelled', paymentStatus: 'Refunded' }),
        }),
      );
    });

    it('refuses to mark an order paid when the captured amount does not match', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ ...pendingOrder, totalAmount: 5000 });
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, webhookSign(capturedBody));
      expect(res.statusCode).toBe(200);
      expect(res.json().ignored).toBe('payment does not match order');
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.product.updateMany).not.toHaveBeenCalled();
    });

    it('asks for a retry when no order carries the gateway order id', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, webhookSign(capturedBody));
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('marks a failed attempt and tells the buyer why, once', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(pendingOrder);
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      const app = await buildWebhookApp();
      const res = await post(app, failedBody, webhookSign(failedBody));

      expect(res.statusCode).toBe(200);
      expect(res.json().handled).toBe('marked_failed');
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', status: 'Pending', paymentStatus: 'Pending' },
        data: { paymentStatus: 'Failed' },
      });
      const notification = mockPrisma.notification.create.mock.calls[0][0].data;
      expect(notification.userId).toBe('buyer-id');
      expect(notification.message).toContain('HOR00001');
      expect(notification.message).toContain('you have not been charged');
      expect(notification.message).toContain('declined by the issuing bank');
      // A failed attempt never claims stock or touches the ledger's totals
      expect(mockPrisma.product.updateMany).not.toHaveBeenCalled();
    });

    it('does not re-notify when a payment.failed is delivered twice', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(pendingOrder);
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 }); // nothing left to change
      const app = await buildWebhookApp();
      const res = await post(app, failedBody, webhookSign(failedBody));
      expect(res.statusCode).toBe(200);
      expect(res.json().handled).toBe('no_change');
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('a retry that succeeds still finalizes an order a failed attempt stamped Failed', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ ...pendingOrder, paymentStatus: 'Failed' });
      mockPrisma.order.findUnique.mockResolvedValue(finalizedOrder);
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, webhookSign(capturedBody));
      expect(res.statusCode).toBe(200);
      expect(res.json().handled).toBe('finalized');
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentStatus: { in: ['Pending', 'Failed'] } }),
        }),
      );
    });

    it('acknowledges an event it does not handle without touching the order', async () => {
      const body = JSON.stringify({ event: 'refund.processed', payload: {} });
      const app = await buildWebhookApp();
      const res = await post(app, body, webhookSign(body));
      expect(res.statusCode).toBe(200);
      expect(res.json().ignored).toBe('unhandled event');
      expect(mockPrisma.order.findFirst).not.toHaveBeenCalled();
    });

    it('never finalizes a cash-on-delivery order from a gateway capture', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ ...pendingOrder, paymentMethod: 'cod' });
      const app = await buildWebhookApp();
      const res = await post(app, capturedBody, webhookSign(capturedBody));
      expect(res.statusCode).toBe(200);
      expect(res.json().ignored).toBe('cod order');
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });
  });
});
