import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

function buildApp(mockPrisma) {
  const fastify = Fastify();
  fastify.decorate('prisma', mockPrisma);
  fastify.decorate('authenticate', async (req, reply) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return reply.status(401).send({ error: 'No token provided' });
    req.user = { sub: 'sb-123' };
    req.dbUser =
      token === 'admin'
        ? { id: 'admin-id', role: 'admin' }
        : { id: 'vendor-user-id', role: 'user' };
  });
  fastify.decorate('requireDbUser', async (req, reply) => {
    if (!req.dbUser) return reply.status(401).send({ error: 'User profile not synchronized' });
  });
  return fastify;
}

describe('vendor routes', () => {
  let mockPrisma;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      vendor: { findUnique: vi.fn(), update: vi.fn() },
      product: { count: vi.fn(), findMany: vi.fn() },
      orderItem: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      order: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      payout: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), findUnique: vi.fn() },
      productView: { count: vi.fn(), groupBy: vi.fn() },
      cartEvent: { count: vi.fn() },
      checkoutEvent: { count: vi.fn() },
      rating: { findUnique: vi.fn(), create: vi.fn() },
      $transaction: vi.fn(),
    };
  });

  describe('GET /profile', () => {
    it('returns vendor profile', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({
        id: 'v1',
        type: 'SINGLE',
        status: 'APPROVED',
      });
      mockPrisma.product.count.mockResolvedValue(3);
      mockPrisma.product.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/profile',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().activeCount).toBe(3);
    });

    // The seller UI must not offer to "restore" a listing a real buyer bought, so
    // the profile reports which Sold listings have no order behind them.
    it('returns the ids of Sold listings that have no order items', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({
        id: 'v1',
        type: 'SINGLE',
        status: 'APPROVED',
      });
      mockPrisma.product.count.mockResolvedValue(2);
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'p-offline-1' }, { id: 'p-offline-2' }]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/profile',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().offlineSoldIds).toEqual(['p-offline-1', 'p-offline-2']);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: { sellerId: 'vendor-user-id', status: 'Sold', orderItems: { none: {} } },
        select: { id: true },
      });
    });

    // activeCount is what the seller UI gates new listings on, so the filter has
    // to match backend/routes/products.js exactly: Sold and Rejected free the slot.
    it('counts only Pending / In_Review / Approved listings as active', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({
        id: 'v1',
        type: 'SINGLE',
        status: 'APPROVED',
      });
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      await app.inject({
        method: 'GET',
        url: '/profile',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(mockPrisma.product.count).toHaveBeenCalledWith({
        where: {
          sellerId: 'vendor-user-id',
          status: { in: ['Pending', 'In_Review', 'Approved'] },
        },
      });
    });

    it('returns 401 without dbUser', async () => {
      const fastify2 = Fastify();
      fastify2.decorate('prisma', mockPrisma);
      fastify2.decorate('authenticate', async (req, reply) => {
        req.user = { sub: '' };
        req.dbUser = null;
      });
      fastify2.decorate('requireDbUser', async (req, reply) => {
        if (!req.dbUser) return reply.status(401).send({ error: 'User profile not synchronized' });
      });
      await fastify2.register((await import('../../routes/vendor.js')).default);
      await fastify2.ready();
      const res = await fastify2.inject({
        method: 'GET',
        url: '/profile',
        headers: { authorization: 'Bearer token' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 when vendor not found', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/profile',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /stats', () => {
    it('returns vendor stats', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      // First call: fetch product IDs; second call: getOfflineSold (empty)
      mockPrisma.product.findMany.mockResolvedValueOnce([{ id: 'p1' }]).mockResolvedValueOnce([]);
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { price: 100, quantity: 2, orderId: 'o1', platformFee: 20 },
      ]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/stats',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().totalSales).toBe(200);
    });

    it('returns totalPlatformFees and netEarnings in stats', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      // First call: fetch product IDs; second call: getOfflineSold (empty)
      mockPrisma.product.findMany.mockResolvedValueOnce([{ id: 'p1' }]).mockResolvedValueOnce([]);
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { price: 100, quantity: 1, orderId: 'o1', platformFee: 20 },
        { price: 200, quantity: 1, orderId: 'o2', platformFee: 50 },
      ]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/stats',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().totalSales).toBe(300);
      expect(res.json().totalPlatformFees).toBe(70);
      expect(res.json().netEarnings).toBe(230);
    });

    it('returns 404 without vendor', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/stats',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /analytics/overview', () => {
    it('returns analytics overview', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'p1' }]);
      mockPrisma.orderItem.findMany.mockResolvedValue([]);
      mockPrisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/analytics/overview',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns totalPlatformFees and netEarnings in analytics overview', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      mockPrisma.product.findMany
        .mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }])
        .mockResolvedValue([]);
      mockPrisma.orderItem.findMany.mockResolvedValue([
        {
          price: 100,
          quantity: 2,
          orderId: 'o1',
          platformFee: 20,
          createdAt: new Date(),
          order: { paymentStatus: 'Paid', status: 'Delivered' },
        },
        {
          price: 50,
          quantity: 1,
          orderId: 'o2',
          platformFee: 5,
          createdAt: new Date(),
          order: { paymentStatus: 'Pending', status: 'Processing' },
        },
      ]);
      mockPrisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mockPrisma.product.count.mockResolvedValue(2);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/analytics/overview',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().totalRevenue).toBe(250);
      // platformFee is stored PER UNIT, so it must be multiplied by quantity just
      // like price is. This previously summed the raw column (25), which both
      // under-reported the platform's take and made netEarnings (225) disagree
      // with what the payout run would actually pay out.
      expect(res.json().totalPlatformFees).toBe(45); // 20*2 + 5*1
      // === the payout formula in admin.js: sum((price - platformFee) * quantity)
      // = (100-20)*2 + (50-5)*1 = 205
      expect(res.json().netEarnings).toBe(205);
      // and the money reconciles: payouts + fees == revenue collected
      expect(res.json().netEarnings + res.json().totalPlatformFees).toBe(res.json().totalRevenue);
    });
  });

  describe('GET /analytics/interest', () => {
    it('returns interest data', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'p1' }]);
      mockPrisma.productView.count.mockResolvedValue(10);
      mockPrisma.productView.groupBy.mockResolvedValue([]);
      mockPrisma.cartEvent.count.mockResolvedValue(3);
      mockPrisma.checkoutEvent.count.mockResolvedValue(1);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/analytics/interest',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /analytics/sales-graph', () => {
    it('returns sales graph data', async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([{ id: 'p1' }]).mockResolvedValue([]);
      mockPrisma.orderItem.findMany.mockResolvedValue([
        {
          price: 100,
          quantity: 1,
          orderId: 'o1',
          createdAt: new Date('2024-01-15'),
          order: { status: 'Delivered' },
        },
      ]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/analytics/sales-graph',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /analytics/top-products', () => {
    it('returns top products', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'p1' }]);
      mockPrisma.orderItem.findMany.mockResolvedValue([
        {
          productId: 'p1',
          price: 100,
          quantity: 1,
          orderId: 'o1',
          product: { id: 'p1', title: 'Test', image: 'img.jpg', price: 100 },
        },
      ]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/analytics/top-products',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /payouts', () => {
    it('returns payouts with pagination', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      mockPrisma.payout.findMany.mockResolvedValue([{ id: 'po1', amount: 100 }]);
      mockPrisma.payout.count.mockResolvedValue(1);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/payouts',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /pickup-address', () => {
    it('updates pickup address', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      mockPrisma.vendor.update.mockResolvedValue({ id: 'v1', pickupAddress: 'New Addr' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/pickup-address',
        payload: { pickupAddress: 'New Addr' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 404 without vendor', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/pickup-address',
        payload: { pickupAddress: 'New' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /rate', () => {
    it('submits a rating', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1', userId: 'vendor-user-id' });
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'p1' }]);
      mockPrisma.orderItem.findFirst.mockResolvedValue({ id: 'oi1' });
      mockPrisma.rating.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          vendor: {
            findUnique: vi.fn().mockResolvedValue({ id: 'v1', rating: 4, ratingCount: 5 }),
            update: vi.fn(),
          },
          rating: { create: vi.fn() },
        };
        return cb(tx);
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/rate',
        payload: { vendorId: 'v1', rating: 5 },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 400 without vendorId or rating', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/rate',
        payload: {},
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 403 without prior purchase', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1', userId: 'vendor-user-id' });
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'p1' }]);
      mockPrisma.orderItem.findFirst.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/rate',
        payload: { vendorId: 'v1', rating: 5 },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /orders', () => {
    it('returns vendor orders', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'p1' }]);
      mockPrisma.orderItem.findMany.mockResolvedValue([
        {
          id: 'oi1',
          order: { user: { name: 'Buyer' } },
          product: { id: 'p1', title: 'Test', image: 'img.jpg', price: 100 },
        },
      ]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/orders',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /orders/:orderItemId/ship', () => {
    it('marks order item as shipped', async () => {
      mockPrisma.orderItem.findUnique.mockResolvedValue({
        id: 'oi1',
        product: { sellerId: 'vendor-user-id' },
        order: { id: 'o1', status: 'Processing', items: [] },
        status: 'Pending',
      });
      mockPrisma.orderItem.update.mockResolvedValue({ id: 'oi1', status: 'Shipped' });
      mockPrisma.orderItem.findMany.mockResolvedValue([{ status: 'Shipped' }]);
      mockPrisma.order.findUnique.mockResolvedValue({ status: 'Processing' });
      mockPrisma.order.update.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/oi1/ship',
        payload: { trackingID: 'TRK123' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'Shipped' } }),
      );
    });

    it('refuses to ship an item on a cancelled order', async () => {
      mockPrisma.orderItem.findUnique.mockResolvedValue({
        id: 'oi1',
        product: { sellerId: 'vendor-user-id' },
        order: { id: 'o1', status: 'Cancelled', items: [] },
        status: 'Pending',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/oi1/ship',
        payload: { trackingID: 'TRK123' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(422);
      expect(mockPrisma.orderItem.update).not.toHaveBeenCalled();
    });

    it('returns 404 when order item not found', async () => {
      mockPrisma.orderItem.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/oi1/ship',
        payload: { trackingID: 'TRK123' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(404);
    });

    it("returns 403 when not vendor's product", async () => {
      mockPrisma.orderItem.findUnique.mockResolvedValue({
        id: 'oi1',
        product: { sellerId: 'other-user' },
        order: { items: [] },
        status: 'Pending',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/oi1/ship',
        payload: { trackingID: 'TRK123' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(403);
    });
  });
  // ── Payout destination (UPI) ───────────────────────────────────────────────
  //
  // These columns exist in schema.prisma but the migration that adds them to the
  // database is applied by hand and has not been run yet, so half of what is
  // covered here is "what happens if this ships first".
  describe('PATCH /payout-details', () => {
    it('saves a valid UPI ID and returns only the masked value', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      mockPrisma.vendor.update.mockResolvedValue({
        payoutUpi: '9876543210@ybl',
        payoutUpiName: 'Asha Rao',
        payoutUpiUpdatedAt: new Date('2026-09-04T00:00:00Z'),
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payout-details',
        payload: { payoutUpi: '9876543210@ybl', payoutUpiName: 'Asha Rao' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().payoutUpiMasked).toBe('98******10@ybl');
      // The raw address must never come back out.
      expect(res.payload).not.toContain('9876543210@ybl');
      expect(mockPrisma.vendor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'vendor-user-id' },
          data: expect.objectContaining({
            payoutUpi: '9876543210@ybl',
            payoutUpiName: 'Asha Rao',
            payoutUpiUpdatedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('normalises case and surrounding whitespace', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      mockPrisma.vendor.update.mockResolvedValue({
        payoutUpi: 'asha.rao@okhdfcbank',
        payoutUpiName: null,
        payoutUpiUpdatedAt: new Date(),
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payout-details',
        payload: { payoutUpi: '  Asha.Rao@OKHDFCBANK  ' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.vendor.update.mock.calls[0][0].data.payoutUpi).toBe('asha.rao@okhdfcbank');
    });

    // The mistake this route exists to catch. An email address has a dot after
    // the '@'; no NPCI handle does.
    it('rejects an email address with an explanatory message', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payout-details',
        payload: { payoutUpi: 'someone@gmail.com' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/not an email address/i);
      expect(mockPrisma.vendor.update).not.toHaveBeenCalled();
    });

    it.each([
      ['no handle at all', 'justaname'],
      ['an empty handle', 'name@'],
      ['an empty local part', '@ybl'],
      ['two @ signs', 'a@b@ybl'],
      ['a space in the middle', 'asha rao@ybl'],
      ['a non-string', 12345],
      ['nothing at all', undefined],
    ])('rejects %s', async (_label, payoutUpi) => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payout-details',
        payload: { payoutUpi },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(400);
    });

    // Real UPI IDs vary a lot; validation must not be so tight that a legitimate
    // seller cannot be paid.
    it.each(['9876543210@ybl', 'asha.rao@okhdfcbank', 'asha-rao_1@paytm', 'ab@upi'])(
      'accepts the real-world UPI ID %s',
      async (payoutUpi) => {
        mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
        mockPrisma.vendor.update.mockResolvedValue({
          payoutUpi,
          payoutUpiName: null,
          payoutUpiUpdatedAt: new Date(),
        });
        const app = buildApp(mockPrisma);
        await app.register((await import('../../routes/vendor.js')).default);
        await app.ready();
        const res = await app.inject({
          method: 'PATCH',
          url: '/payout-details',
          payload: { payoutUpi },
          headers: { authorization: 'Bearer vendor' },
        });
        expect(res.statusCode).toBe(200);
      },
    );

    it('returns 404 without a vendor profile', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payout-details',
        payload: { payoutUpi: '9876543210@ybl' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(404);
    });

    // Deployed ahead of the migration: the write is the first thing to notice.
    it('answers 503 with a plain explanation when the columns do not exist yet', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      const missingColumn = Object.assign(new Error('column does not exist'), {
        code: 'P2022',
        meta: { column: 'Vendor.payoutUpi' },
      });
      mockPrisma.vendor.update.mockRejectedValue(missingColumn);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payout-details',
        payload: { payoutUpi: '9876543210@ybl' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().error).toMatch(/database update/i);
    });

    it('does not swallow an unrelated database error', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      mockPrisma.vendor.update.mockRejectedValue(new Error('connection reset'));
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payout-details',
        payload: { payoutUpi: '9876543210@ybl' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(500);
    });
  });

  describe('GET /profile payout destination', () => {
    it('reports the masked UPI and never the raw one', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({
        id: 'v1',
        payoutUpi: '9876543210@ybl',
        payoutUpiName: 'Asha Rao',
        payoutUpiUpdatedAt: new Date('2026-09-04T00:00:00Z'),
      });
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/profile',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.payoutUpiMasked).toBe('98******10@ybl');
      expect(body.payoutDetailsAvailable).toBe(true);
      expect(body.payoutUpi).toBeUndefined();
      expect(res.payload).not.toContain('9876543210@ybl');
    });

    it('reports no UPI on file as null rather than as unavailable', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1', payoutUpi: null });
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/profile',
        headers: { authorization: 'Bearer vendor' },
      });
      const body = res.json();
      expect(body.payoutUpiMasked).toBeNull();
      expect(body.payoutDetailsAvailable).toBe(true);
    });

    // The whole point of findVendor(): shipping this code before the owner runs
    // docs/migrations/2026-09-04-payout-upi-and-outbox.sql must not 500 the page.
    it('still serves the profile when the payout columns are missing', async () => {
      const missingColumn = Object.assign(new Error('column does not exist'), {
        code: 'P2022',
        meta: { column: 'Vendor.payoutUpi' },
      });
      mockPrisma.vendor.findUnique
        .mockRejectedValueOnce(missingColumn)
        .mockResolvedValue({ id: 'v1', companyName: 'Old Schema Ltd' });
      mockPrisma.product.count.mockResolvedValue(4);
      mockPrisma.product.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/profile',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.companyName).toBe('Old Schema Ltd');
      expect(body.activeCount).toBe(4);
      // The UI needs the difference between "nothing on file" and "cannot ask
      // yet", so it can say so instead of nagging for a UPI it could not store.
      expect(body.payoutDetailsAvailable).toBe(false);
      // The retry reads an explicit pre-migration column list.
      const retryArgs = mockPrisma.vendor.findUnique.mock.calls[1][0];
      expect(retryArgs.select.pickupAddress).toBe(true);
      expect(retryArgs.select.payoutUpi).toBeUndefined();
    });

    it('rethrows a genuine database failure instead of retrying', async () => {
      mockPrisma.vendor.findUnique.mockRejectedValue(new Error('connection reset'));
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/profile',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(500);
      expect(mockPrisma.vendor.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /payouts/:id/items', () => {
    const payout = {
      id: 'po1',
      vendorId: 'v1',
      amount: 18000,
      status: 'PENDING',
      note: 'Auto-created from 2 delivered item(s)',
    };

    it('returns the constituent items and totals that sum to the payout', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.orderItem.findMany.mockResolvedValue([
        {
          id: 'oi1',
          quantity: 1,
          price: 10000,
          platformFee: 1000,
          status: 'Delivered',
          createdAt: new Date('2026-08-01T00:00:00Z'),
          product: { id: 'p1', title: 'Rolex Datejust', image: 'a.jpg' },
          order: { displayId: 'TCE-1', status: 'Delivered', createdAt: new Date() },
        },
        {
          id: 'oi2',
          quantity: 1,
          price: 10000,
          platformFee: 1000,
          status: 'Delivered',
          createdAt: new Date('2026-08-02T00:00:00Z'),
          product: { id: 'p2', title: 'Omega Seamaster', image: 'b.jpg' },
          order: { displayId: 'TCE-2', status: 'Delivered', createdAt: new Date() },
        },
      ]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/payouts/po1/items',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.payout.note).toBe('Auto-created from 2 delivered item(s)');
      expect(body.items).toHaveLength(2);
      expect(body.items[0].payout).toBe(9000);
      // This is the sum the seller is checking: it has to be the payout amount.
      expect(body.totals).toEqual({
        itemCount: 2,
        gross: 20000,
        platformFee: 2000,
        payout: 18000,
      });
      // A seller can only ever be shown their own sales.
      expect(mockPrisma.orderItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { payoutId: 'po1', product: { sellerId: 'vendor-user-id' } },
        }),
      );
    });

    it("404s on another vendor's payout rather than revealing it exists", async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      mockPrisma.payout.findUnique.mockResolvedValue({ ...payout, vendorId: 'someone-else' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/payouts/po1/items',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.orderItem.findMany).not.toHaveBeenCalled();
    });

    it('404s on an unknown payout id', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      mockPrisma.payout.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/payouts/nope/items',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('404s without a vendor profile', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/payouts/po1/items',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.payout.findUnique).not.toHaveBeenCalled();
    });

    it('returns an empty breakdown rather than failing for a payout with no items', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.orderItem.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/vendor.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/payouts/po1/items',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().totals).toEqual({
        itemCount: 0,
        gross: 0,
        platformFee: 0,
        payout: 0,
      });
    });
  });
});
