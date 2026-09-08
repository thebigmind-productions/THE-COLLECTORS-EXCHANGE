import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { ZodError } from 'zod';

// Real GOOGLE_MERCHANT_KEY / google-merchant-key.json can exist in a local dev
// checkout, so this MUST be mocked or fire-and-forget syncProductToGoogleAsync
// calls in the routes below would hit the live Merchant Center with test data.
vi.mock('../../lib/googleMerchant.js', () => ({
  syncProductToGoogleAsync: vi.fn(),
}));

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
      token === 'admin'
        ? { id: 'admin-id', role: 'admin', name: 'Admin', email: 'admin@test.com' }
        : token === 'curator'
          ? { id: 'curator-id', role: 'curator' }
          : token === 'superadmin'
            ? { id: 'superadmin-id', role: 'admin' }
            : { id: 'user-id', role: 'user' };
  });
  fastify.decorate('authenticateAdmin', async (req, reply) => {
    await fastify.authenticate(req, reply);
    if (reply.sent) return;
    if (!req.dbUser || (req.dbUser.role !== 'admin' && req.dbUser.role !== 'curator')) {
      return reply.status(403).send({ error: 'Access denied: Admin or Curator role required' });
    }
  });
  fastify.decorate('authenticateSuperAdmin', async (req, reply) => {
    await fastify.authenticate(req, reply);
    if (reply.sent) return;
    if (!req.dbUser || req.dbUser.role !== 'admin') {
      return reply.status(403).send({ error: 'Access denied: Super Admin role required' });
    }
  });
  return fastify;
}

describe('admin routes', () => {
  let mockPrisma;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      user: { count: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
      product: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        create: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      order: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        aggregate: vi.fn(),
      },
      vendor: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
      contactMessage: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      notification: { create: vi.fn() },
      auditLog: { create: vi.fn() },
      payout: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      cartItem: { deleteMany: vi.fn() },
      wishlistItem: { deleteMany: vi.fn() },
      orderItem: { deleteMany: vi.fn() },
      productView: { deleteMany: vi.fn() },
      cartEvent: { deleteMany: vi.fn() },
      checkoutEvent: { deleteMany: vi.fn() },
      auctionBid: { deleteMany: vi.fn() },
      auction: { delete: vi.fn() },
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
    };
  });

  describe('GET /stats/overview', () => {
    it('returns dashboard stats', async () => {
      mockPrisma.user.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2);
      mockPrisma.product.count.mockResolvedValue(50);
      mockPrisma.order.count.mockResolvedValue(25);
      // H1: inventory count queries
      mockPrisma.product.count
        .mockResolvedValueOnce(10) // totalProducts
        .mockResolvedValueOnce(5) // soldInventoryCount
        .mockResolvedValueOnce(2) // pendingAndInReviewCount
        .mockResolvedValueOnce(3); // approvedCount
      // H2: aggregate queries
      mockPrisma.product.aggregate
        .mockResolvedValueOnce({ _sum: { price: 50000 } }) // inventoryRevenueAll
        .mockResolvedValueOnce({ _sum: { price: 15000 } }); // inventoryRevenueSoldProducts
      mockPrisma.order.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: 12000 } }); // onlinePaidRevenue
      // M1: unread contact messages
      mockPrisma.contactMessage.count.mockResolvedValue(3);
      // H2: offline sold revenue
      mockPrisma.$queryRaw.mockResolvedValue([{ offlineRevenue: 3000 }]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/stats/overview',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().totalUsers).toBe(10);
      expect(res.json().pendingKyc).toBe(2);
    });
  });

  describe('GET /stats/analytics', () => {
    it('returns analytics data', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.product.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/stats/analytics',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    // A payout is money. Walking PAID back to PENDING would re-queue an
    // already-disbursed payout and notify the vendor a second time.
    it('refuses to move a PAID payout back to PENDING', async () => {
      mockPrisma.payout.findUnique.mockResolvedValue({
        id: 'po1',
        status: 'PAID',
        paidAt: new Date(),
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payouts/po1/status',
        payload: { status: 'PENDING' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(409);
      expect(mockPrisma.payout.update).not.toHaveBeenCalled();
    });

    // FAILED is recoverable on purpose: a bounced transfer should be retryable
    // without creating a duplicate payout record.
    it('allows retrying a FAILED payout', async () => {
      mockPrisma.payout.findUnique.mockResolvedValue({
        id: 'po1',
        status: 'FAILED',
        paidAt: null,
      });
      mockPrisma.payout.update.mockResolvedValue({
        id: 'po1',
        amount: 5000,
        status: 'PROCESSING',
        vendor: { userId: 'uid' },
      });
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payouts/po1/status',
        payload: { status: 'PROCESSING' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('404s when the payout does not exist', async () => {
      mockPrisma.payout.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payouts/nope/status',
        payload: { status: 'PAID' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
    });

    // Re-saving PAID must not keep moving the disbursement date forward.
    it('does not re-stamp paidAt when already PAID', async () => {
      const originalPaidAt = new Date('2026-01-01T00:00:00.000Z');
      mockPrisma.payout.findUnique.mockResolvedValue({
        id: 'po1',
        status: 'PAID',
        paidAt: originalPaidAt,
      });
      mockPrisma.payout.update.mockResolvedValue({
        id: 'po1',
        amount: 5000,
        status: 'PAID',
        paidAt: originalPaidAt,
        vendor: { userId: 'uid' },
      });
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payouts/po1/status',
        payload: { status: 'PAID' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.payout.update.mock.calls[0][0].data.paidAt).toBeUndefined();
    });
  });

  describe('GET /kyc/requests', () => {
    it('returns KYC requests', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/kyc/requests',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /kyc/requests/:id', () => {
    it('returns single KYC request', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid', name: 'Test' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/kyc/requests/uid',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 404 when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/kyc/requests/nonexistent',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /kyc/requests/:id/approve', () => {
    it('approves KYC request', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uid',
        kycData: { companyName: 'Test Corp' },
        type: 'company',
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          user: { update: vi.fn().mockResolvedValue({ id: 'uid', kycStatus: 'verified' }) },
          vendor: { upsert: vi.fn().mockResolvedValue({ id: 'v1' }) },
        };
        return cb(tx);
      });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/kyc/requests/uid/approve',
        payload: {},
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 404 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/kyc/requests/nonexistent/approve',
        payload: {},
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /kyc/requests/:id/reject', () => {
    it('rejects KYC request', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid', kycData: {} });
      mockPrisma.user.update.mockResolvedValue({ id: 'uid', kycStatus: 'none' });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/kyc/requests/uid/reject',
        payload: { reason: 'Bad docs' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    // Regression: the reject handler used to write a fresh kycData object, wiping
    // every document path and identity field the seller had uploaded. They were
    // then shown a pristine empty form with nothing to correct.
    it('preserves the previously submitted kycData', async () => {
      const submitted = {
        aadhaar: '1234',
        pan: 'ABCDE1234F',
        companyName: 'Test Corp',
        gst: '29ABCDE1234F1Z5',
        founderName: 'A Founder',
        aadhaarDoc: 'kyc/sb-123/aadhaar.pdf',
        panDoc: 'kyc/sb-123/pan.pdf',
      };
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid', kycData: submitted });
      mockPrisma.user.update.mockResolvedValue({ id: 'uid', kycStatus: 'none' });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/kyc/requests/uid/reject',
        payload: { reason: 'Aadhaar scan unreadable' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      const { data } = mockPrisma.user.update.mock.calls[0][0];
      expect(data.kycStatus).toBe('none');
      expect(data.kycData).toMatchObject(submitted);
      expect(data.kycData.rejectionReason).toBe('Aadhaar scan unreadable');
      expect(typeof data.kycData.rejectedAt).toBe('string');
    });

    it('tolerates a null kycData', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid', kycData: null });
      mockPrisma.user.update.mockResolvedValue({ id: 'uid', kycStatus: 'none' });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/kyc/requests/uid/reject',
        payload: { reason: 'Missing documents' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      const { data } = mockPrisma.user.update.mock.calls[0][0];
      expect(data.kycData.rejectionReason).toBe('Missing documents');
    });

    it('returns 404 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/kyc/requests/nonexistent/reject',
        payload: { reason: 'Bad docs' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('returns 400 without reason', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/kyc/requests/uid/reject',
        payload: {},
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /users/:id/ban', () => {
    it('bans user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid' });
      mockPrisma.user.update.mockResolvedValue({ id: 'uid', banned: true });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/users/uid/ban',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 404 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/users/nonexistent/ban',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /users/:id/unban', () => {
    it('unbans user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid' });
      mockPrisma.user.update.mockResolvedValue({ id: 'uid', banned: false });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/users/uid/unban',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /users', () => {
    it('returns users list', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/users',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /users/:id', () => {
    it('returns single user detail', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uid',
        products: [],
        cart: [],
        wishlist: [],
        vendor: null,
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/users/uid',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /vendor/:userId/type', () => {
    it('toggles vendor type', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid' });
      mockPrisma.vendor.upsert.mockResolvedValue({ id: 'v1', type: 'BULK' });
      mockPrisma.auditLog.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/vendor/uid/type',
        payload: { type: 'BULK' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 400 with invalid type', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/vendor/uid/type',
        payload: { type: 'INVALID' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /users/:id/role', () => {
    it('updates user role', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({ id: 'uid', role: 'curator' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/users/other-id/role',
        payload: { role: 'curator' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 422 when changing own role', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/users/admin-id/role',
        payload: { role: 'user' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 400 with invalid role', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/users/other-id/role',
        payload: { role: 'superadmin' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /products', () => {
    it('returns products list', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/products',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /products/:id', () => {
    it('returns single product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        seller: { id: 's1', name: 'S' },
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/products/p1',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 404 when not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/products/nonexistent',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /products/:id/review', () => {
    it('starts review', async () => {
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', status: 'In_Review' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/products/p1/review',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /products/:id/approve', () => {
    it('approves product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        status: 'Pending',
        sellerId: 's1',
        title: 'Test',
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', status: 'Approved' });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/products/p1/approve',
        headers: { authorization: 'Bearer superadmin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 422 when product is sold', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', status: 'Sold' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/products/p1/approve',
        headers: { authorization: 'Bearer superadmin' },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('PATCH /products/:id/reject', () => {
    it('rejects product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        status: 'Pending',
        sellerId: 's1',
        title: 'Test',
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', status: 'Rejected' });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/products/p1/reject',
        payload: { reason: 'Bad quality' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 400 without reason', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', status: 'Pending' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/products/p1/reject',
        payload: {},
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /products/:id/sold', () => {
    it('marks product as sold', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        status: 'Approved',
        sellerId: 's1',
        title: 'Test',
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', status: 'Sold', isPublished: false });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/products/p1/sold',
        headers: { authorization: 'Bearer superadmin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /products/:id/authenticity', () => {
    it('updates authenticity status', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', status: 'Pending' });
      mockPrisma.product.update.mockResolvedValue({
        id: 'p1',
        authenticityStatus: 'Verified',
        status: 'Approved',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/products/p1/authenticity',
        payload: { status: 'Verified' },
        headers: { authorization: 'Bearer superadmin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 400 with invalid status', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', status: 'Pending' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/products/p1/authenticity',
        payload: { status: 'INVALID' },
        headers: { authorization: 'Bearer superadmin' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /products/:id', () => {
    it('deletes product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', status: 'Pending' });
      mockPrisma.cartItem.deleteMany.mockResolvedValue({});
      mockPrisma.wishlistItem.deleteMany.mockResolvedValue({});
      mockPrisma.orderItem.deleteMany.mockResolvedValue({});
      mockPrisma.productView.deleteMany.mockResolvedValue({});
      mockPrisma.cartEvent.deleteMany.mockResolvedValue({});
      mockPrisma.checkoutEvent.deleteMany.mockResolvedValue({});
      mockPrisma.product.delete.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'DELETE',
        url: '/products/p1',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 404 when not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'DELETE',
        url: '/products/nonexistent',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /products/:id (update)', () => {
    it('updates product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', brand: 'Rolex' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/products/p1',
        payload: { brand: 'Rolex' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /brands', () => {
    it('returns brands list', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ brand: 'Rolex' }, { brand: 'Patek' }]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/brands',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /orders', () => {
    it('returns orders list', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/orders',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /orders/:id', () => {
    it('returns single order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'o1', user: {}, items: [] });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/orders/o1',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /orders/:id/status', () => {
    it('updates order status', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: 'Processing',
        paymentStatus: 'Paid',
        paymentMethod: 'online',
        items: [],
      });
      mockPrisma.order.update.mockResolvedValue({ id: 'o1', status: 'Shipped', userId: 'uid' });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/status',
        payload: { status: 'Shipped' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('rejects an illegal transition (Delivered -> Processing)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: 'Delivered',
        paymentStatus: 'Paid',
        paymentMethod: 'online',
        items: [],
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/status',
        payload: { status: 'Processing' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('restores inventory and flags refund when cancelling a paid order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: 'Processing',
        paymentStatus: 'Paid',
        paymentMethod: 'online',
        items: [{ productId: 'p1' }],
      });
      mockPrisma.product.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', status: 'Approved', isPublished: true, title: 'Item', price: 100 },
      ]);
      mockPrisma.order.update.mockResolvedValue({ id: 'o1', status: 'Cancelled', userId: 'uid' });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/status',
        payload: { status: 'Cancelled' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['p1'] }, status: 'Sold' },
          data: { status: 'Approved' },
        }),
      );
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Cancelled', paymentStatus: 'Refunded' }),
        }),
      );
    });

    it('marks a COD order paid when delivered', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: 'Shipped',
        paymentStatus: 'Pending',
        paymentMethod: 'cod',
        items: [],
      });
      mockPrisma.order.update.mockResolvedValue({ id: 'o1', status: 'Delivered', userId: 'uid' });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/status',
        payload: { status: 'Delivered' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Delivered', paymentStatus: 'Paid' }),
        }),
      );
    });

    it('marks a whatsapp order paid when delivered, same as COD', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: 'Shipped',
        paymentStatus: 'Pending',
        paymentMethod: 'whatsapp',
        items: [],
      });
      mockPrisma.order.update.mockResolvedValue({ id: 'o1', status: 'Delivered', userId: 'uid' });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/status',
        payload: { status: 'Delivered' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Delivered', paymentStatus: 'Paid' }),
        }),
      );
    });

    it('returns 400 with invalid status', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/status',
        payload: { status: 'INVALID' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /orders/:id/mark-paid', () => {
    it('marks a whatsapp order as paid', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        paymentMethod: 'whatsapp',
        paymentStatus: 'Pending',
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'o1',
        paymentMethod: 'whatsapp',
        paymentStatus: 'Paid',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/mark-paid',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { paymentStatus: 'Paid' },
      });
    });

    it('refuses a cod order — it is paid on delivery, not marked manually', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        paymentMethod: 'cod',
        paymentStatus: 'Pending',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/mark-paid',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(422);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('refuses an order that is already paid', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        paymentMethod: 'whatsapp',
        paymentStatus: 'Paid',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/mark-paid',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(422);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/missing/mark-paid',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /orders/:id/ship', () => {
    it('ships order with tracking ID', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: 'Processing',
        userId: 'uid',
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'o1',
        status: 'Shipped',
        trackingID: 'TRK123',
        userId: 'uid',
      });
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/ship',
        payload: { trackingID: 'TRK123' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('refuses to ship a cancelled order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: 'Cancelled',
        userId: 'uid',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/ship',
        payload: { trackingID: 'TRK123' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 400 without tracking ID', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/o1/ship',
        payload: {},
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /payouts/auto-create', () => {
    it('auto-creates payouts', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/payouts/auto-create',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('pays net commission and stamps items paidOut (idempotent)', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'o1',
          items: [
            {
              id: 'oi1',
              price: 1000,
              platformFee: 100,
              quantity: 1,
              product: { sellerId: 'seller-x' },
            },
          ],
        },
      ]);
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1', userId: 'seller-x' });
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          payout: { create: vi.fn().mockResolvedValue({ id: 'p1' }) },
          orderItem: { updateMany: txUpdateMany },
        }),
      );
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/payouts/auto-create',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      // net = (1000 - 100 commission) x 1
      expect(res.json().created[0]).toMatchObject({ amount: 900, items: 1 });
      // items marked paid out so a future run can't re-pay them
      expect(txUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['oi1'] } },
          data: { paidOut: true, payoutId: 'p1' },
        }),
      );
    });
  });

  describe('POST /payouts', () => {
    it('creates payout', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v1', userId: 'uid' });
      mockPrisma.payout.create.mockResolvedValue({ id: 'po1', amount: 5000 });
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/payouts',
        payload: {
          vendorId: 'v1',
          amount: 5000,
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31',
        },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /payouts/:id/status', () => {
    it('updates payout status', async () => {
      mockPrisma.payout.findUnique.mockResolvedValue({
        id: 'po1',
        status: 'PENDING',
        paidAt: null,
      });
      mockPrisma.payout.update.mockResolvedValue({
        id: 'po1',
        amount: 5000,
        status: 'PAID',
        paidAt: new Date(),
        vendor: { userId: 'uid' },
      });
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/payouts/po1/status',
        payload: { status: 'PAID' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /payouts', () => {
    it('returns payouts list', async () => {
      mockPrisma.payout.findMany.mockResolvedValue([]);
      mockPrisma.payout.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/payouts',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /products/tce-store', () => {
    it('returns TCE store products', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/products/tce-store',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /products', () => {
    it('creates TCE product', async () => {
      mockPrisma.product.create.mockResolvedValue({
        id: 'p1',
        title: 'TCE Product',
        status: 'Approved',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/products',
        payload: {
          title: 'TCE Product',
          category: 'Timepieces',
          description: 'Desc',
          condition: 'Mint',
          price: 10000,
          image: 'https://img.com/1.jpg',
        },
        headers: { authorization: 'Bearer superadmin' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 400 with missing fields', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/products',
        payload: {},
        headers: { authorization: 'Bearer superadmin' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 with invalid category', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/products',
        payload: {
          title: 'TCE Product',
          category: 'Invalid',
          description: 'Desc',
          condition: 'Mint',
          price: 10000,
        },
        headers: { authorization: 'Bearer superadmin' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /stats/vendor-rankings', () => {
    it('returns vendor rankings sorted by listings', async () => {
      mockPrisma.vendor.findMany.mockResolvedValue([
        {
          id: 'v1',
          userId: 'u1',
          type: 'SINGLE',
          rating: 4.5,
          ratingCount: 10,
          user: { id: 'u1', name: 'Alice', email: 'a@test.com' },
          _count: { ratings: 10 },
        },
        {
          id: 'v2',
          userId: 'u2',
          type: 'COMPANY',
          rating: 3.0,
          ratingCount: 5,
          user: { id: 'u2', name: 'Bob', email: 'b@test.com' },
          _count: { ratings: 5 },
        },
      ]);
      mockPrisma.product.groupBy
        .mockResolvedValueOnce([
          { sellerId: 'u1', _count: { id: 15 } },
          { sellerId: 'u2', _count: { id: 8 } },
        ]) // listings
        .mockResolvedValueOnce([{ sellerId: 'u1', _count: { id: 5 } }]); // sold
      mockPrisma.$queryRaw.mockResolvedValue([{ sellerId: 'u1', revenue: 50000 }]);

      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/stats/vendor-rankings',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.sortBy).toBe('listings');
      expect(body.count).toBe(2);
      expect(body.data[0].vendor.name).toBe('Alice');
      expect(body.data[0].listingsCount).toBe(15);
    });

    it('accepts sortBy=revenue', async () => {
      mockPrisma.vendor.findMany.mockResolvedValue([
        {
          id: 'v1',
          userId: 'u1',
          type: 'SINGLE',
          rating: 0,
          ratingCount: 0,
          user: { id: 'u1', name: 'A', email: 'a@t.com' },
          _count: { ratings: 0 },
        },
      ]);
      mockPrisma.product.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockPrisma.$queryRaw.mockResolvedValue([{ sellerId: 'u1', revenue: 10000 }]);

      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/stats/vendor-rankings?sortBy=revenue',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().sortBy).toBe('revenue');
    });

    it('returns 403 for non-admin', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/stats/vendor-rankings',
        headers: { authorization: 'Bearer user' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /contact-messages', () => {
    it('returns contact messages with total', async () => {
      mockPrisma.contactMessage.findMany.mockResolvedValue([
        {
          id: 'cm1',
          name: 'Test',
          email: 't@t.com',
          subject: 'Hi',
          message: 'Hello',
          read: false,
          createdAt: new Date(),
        },
      ]);
      mockPrisma.contactMessage.count.mockResolvedValue(1);

      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/contact-messages',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().total).toBe(1);
      expect(res.json().data).toHaveLength(1);
    });

    it('filters by UNREAD status', async () => {
      mockPrisma.contactMessage.findMany.mockResolvedValue([]);
      mockPrisma.contactMessage.count.mockResolvedValue(0);

      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/contact-messages?status=UNREAD',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.contactMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ read: false }) }),
      );
    });
  });

  describe('GET /contact-messages/:id', () => {
    it('returns message and marks as read', async () => {
      mockPrisma.contactMessage.findUnique.mockResolvedValue({
        id: 'cm1',
        name: 'T',
        email: 't@t.com',
        subject: 'S',
        message: 'M',
        read: false,
      });
      mockPrisma.contactMessage.update.mockResolvedValue({});

      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/contact-messages/cm1',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().read).toBe(true);
      expect(mockPrisma.contactMessage.update).toHaveBeenCalled();
    });

    it('returns 404 when not found', async () => {
      mockPrisma.contactMessage.findUnique.mockResolvedValue(null);

      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/contact-messages/missing',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /contact-messages/:id', () => {
    it('marks message as read', async () => {
      mockPrisma.contactMessage.findUnique.mockResolvedValue({
        id: 'cm1',
        read: false,
      });
      mockPrisma.contactMessage.update.mockResolvedValue({});

      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/contact-messages/cm1',
        payload: { read: true },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.contactMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ read: true }) }),
      );
    });

    it('returns 404 when not found', async () => {
      mockPrisma.contactMessage.findUnique.mockResolvedValue(null);

      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/contact-messages/missing',
        payload: { read: true },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /products/:id/sold', () => {
    it('marks product as sold', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'u1',
        status: 'Approved',
        quantity: 1,
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', status: 'Sold' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/admin.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/products/p1/sold',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
