import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// Real GOOGLE_MERCHANT_KEY / google-merchant-key.json can exist in a local dev
// checkout, so this MUST be mocked or fire-and-forget syncProductToGoogleAsync
// calls in the routes below would hit the live Merchant Center with test data.
vi.mock('../../lib/googleMerchant.js', () => ({
  syncProductToGoogleAsync: vi.fn(),
}));

function buildApp(mockPrisma) {
  const fastify = Fastify();
  fastify.decorate('prisma', mockPrisma);
  fastify.decorate('authenticate', async (req, reply) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return reply.status(401).send({ error: 'No token provided' });
    if (token === 'banned')
      return reply.status(403).send({ error: 'Your account has been banned' });
    req.user = { sub: 'sb-123' };
    const dbUser =
      token === 'admin'
        ? {
            id: 'admin-id',
            role: 'admin',
            kycStatus: 'verified',
            vendor: { id: 'v1', type: 'SINGLE', status: 'APPROVED', maxListings: 5 },
          }
        : token === 'curator'
          ? { id: 'curator-id', role: 'curator', kycStatus: 'verified', vendor: null }
          : token === 'vendor'
            ? {
                id: 'vendor-id',
                role: 'user',
                kycStatus: 'verified',
                vendor: { id: 'v2', type: 'SINGLE', status: 'APPROVED', maxListings: 5 },
              }
            : token === 'bulk-vendor'
              ? {
                  id: 'bulk-vendor-id',
                  role: 'user',
                  kycStatus: 'verified',
                  vendor: { id: 'v3', type: 'BULK', status: 'APPROVED', maxListings: 999999 },
                }
              : token === 'bulk-suspended'
                ? {
                    id: 'bulk-susp-id',
                    role: 'user',
                    kycStatus: 'verified',
                    vendor: { id: 'v4', type: 'BULK', status: 'SUSPENDED', maxListings: 999999 },
                  }
                : token === 'no-kyc'
                  ? { id: 'user-id', role: 'user', kycStatus: 'none', vendor: null }
                  : token === 'other-user'
                    ? { id: 'other-id', role: 'user', kycStatus: 'verified', vendor: null }
                    : null;
    if (dbUser && dbUser.banned) return reply.status(403).send({ error: 'banned' });
    req.dbUser = dbUser;
    if (!dbUser && token !== 'no-db') return reply.status(401).send({ error: 'not found' });
  });
  fastify.decorate('requireDbUser', async (req, reply) => {
    if (!req.dbUser) return reply.status(401).send({ error: 'User profile not synchronized' });
  });
  return fastify;
}

describe('products routes', () => {
  let mockPrisma;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      $queryRaw: vi.fn(),
      product: {
        count: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        groupBy: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      vendor: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      cartItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      wishlistItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
  });

  describe('GET /', () => {
    it('returns products list with pagination', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', title: 'Test', seller: { name: 'Seller' } },
      ]);
      mockPrisma.product.count.mockResolvedValue(1);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/' });
      expect(res.statusCode).toBe(200);
      expect(res.json().products).toHaveLength(1);
      expect(res.json().total).toBe(1);
    });

    it('filters by category', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/?category=Timepieces' });
      expect(res.statusCode).toBe(200);
    });

    it('filters by search', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/?search=watch' });
      expect(res.statusCode).toBe(200);
    });

    it('sorts public catalog by commissionPercent DESC then createdAt DESC', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'p2',
          title: 'High Comm',
          price: 100,
          commissionPercent: 25,
          seller: { name: 'S' },
          status: 'Approved',
        },
        {
          id: 'p1',
          title: 'Low Comm',
          price: 100,
          commissionPercent: 10,
          seller: { name: 'S' },
          status: 'Approved',
        },
      ]);
      mockPrisma.product.count.mockResolvedValue(2);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/' });
      expect(res.statusCode).toBe(200);
      expect(res.json().products[0].id).toBe('p2');
      expect(res.json().products[1].id).toBe('p1');
    });

    it('returns 500 on DB error', async () => {
      mockPrisma.product.findMany.mockRejectedValue(new Error('DB error'));
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/' });
      expect(res.statusCode).toBe(500);
    });

    // Regression: the public catalogue served every Approved product, including
    // the 28 the owner had explicitly unpublished on 2026-08-30. Only the Meta
    // and Google feeds honoured isPublished, so nothing surfaced it.
    it('serves only published products to the public catalogue', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      await app.inject({ method: 'GET', url: '/' });
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['Approved', 'Sold'] },
            isPublished: true,
          }),
        }),
      );
      expect(mockPrisma.product.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ isPublished: true }),
      });
    });

    it("applies the publish gate to another seller's public storefront", async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      await app.inject({ method: 'GET', url: '/?sellerId=someone-else' });
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sellerId: 'someone-else', isPublished: true }),
        }),
      );
    });

    it('lets a seller see their own unpublished listings', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      await app.inject({
        method: 'GET',
        url: '/?sellerId=vendor-id',
        headers: { authorization: 'Bearer vendor' },
      });
      const { where } = mockPrisma.product.findMany.mock.calls[0][0];
      expect(where).toEqual({ sellerId: 'vendor-id' });
    });

    it('searches brand as well as title, description and keywords', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      await app.inject({ method: 'GET', url: '/?search=Submariner' });
      const { where } = mockPrisma.product.findMany.mock.calls[0][0];
      expect(where.OR).toEqual([
        { title: { contains: 'Submariner', mode: 'insensitive' } },
        { description: { contains: 'Submariner', mode: 'insensitive' } },
        { brand: { contains: 'Submariner', mode: 'insensitive' } },
        { keywords: { hasSome: ['Submariner', 'submariner'] } },
      ]);
    });

    it('matches keywords on lowercased tokens rather than the whole raw phrase', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      await app.inject({ method: 'GET', url: '/?search=Rolex%20Submariner' });
      const { where } = mockPrisma.product.findMany.mock.calls[0][0];
      const tokens = where.OR.at(-1).keywords.hasSome;
      expect(tokens).toContain('rolex');
      expect(tokens).toContain('submariner');
      expect(tokens).toContain('rolex submariner');
    });

    it('keeps the default commission ordering when no sort is given', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      await app.inject({ method: 'GET', url: '/' });
      expect(mockPrisma.product.findMany.mock.calls[0][0].orderBy).toEqual([
        { status: 'asc' },
        { commissionPercent: 'desc' },
        { createdAt: 'desc' },
      ]);
    });

    it.each([
      ['newest', [{ status: 'asc' }, { createdAt: 'desc' }]],
      ['price_asc', [{ status: 'asc' }, { price: 'asc' }, { createdAt: 'desc' }]],
      ['price_desc', [{ status: 'asc' }, { price: 'desc' }, { createdAt: 'desc' }]],
    ])('maps sort=%s to its whitelisted orderBy', async (sort, expected) => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      await app.inject({ method: 'GET', url: `/?sort=${sort}` });
      expect(mockPrisma.product.findMany.mock.calls[0][0].orderBy).toEqual(expected);
    });

    it.each(['price', 'commissionPercent desc', 'constructor', '__proto__'])(
      'ignores the non-whitelisted sort key %s and falls back to the default',
      async (sort) => {
        mockPrisma.product.findMany.mockResolvedValue([]);
        mockPrisma.product.count.mockResolvedValue(0);
        const app = buildApp(mockPrisma);
        await app.register((await import('../../routes/products.js')).default);
        await app.ready();
        const res = await app.inject({
          method: 'GET',
          url: `/?sort=${encodeURIComponent(sort)}`,
        });
        expect(res.statusCode).toBe(200);
        expect(mockPrisma.product.findMany.mock.calls[0][0].orderBy).toEqual([
          { status: 'asc' },
          { commissionPercent: 'desc' },
          { createdAt: 'desc' },
        ]);
      },
    );

    it('filters by minPrice and maxPrice', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      await app.inject({ method: 'GET', url: '/?minPrice=2000&maxPrice=500000' });
      expect(mockPrisma.product.findMany.mock.calls[0][0].where.price).toEqual({
        gte: 2000,
        lte: 500000,
      });
    });

    it('accepts a one-sided price bound', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      await app.inject({ method: 'GET', url: '/?minPrice=2000' });
      expect(mockPrisma.product.findMany.mock.calls[0][0].where.price).toEqual({ gte: 2000 });
    });

    it('does not add a price filter when no bound is given', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      await app.inject({ method: 'GET', url: '/' });
      expect(mockPrisma.product.findMany.mock.calls[0][0].where.price).toBeUndefined();
    });

    it.each(['minPrice=abc', 'minPrice=-5', 'minPrice=9000&maxPrice=100'])(
      'returns 400 for the invalid price filter %s',
      async (qs) => {
        const app = buildApp(mockPrisma);
        await app.register((await import('../../routes/products.js')).default);
        await app.ready();
        const res = await app.inject({ method: 'GET', url: `/?${qs}` });
        expect(res.statusCode).toBe(400);
        expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
      },
    );
  });

  describe('GET /category-counts', () => {
    it('counts only published products that are still in stock', async () => {
      mockPrisma.product.groupBy.mockResolvedValue([
        { category: 'Accessories', _count: { id: 2 } },
      ]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/category-counts' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ Accessories: 2 });
      expect(mockPrisma.product.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'Approved', isPublished: true },
        }),
      );
    });

    // The badge above the category grid reads "N in stock". Sold listings are
    // still browsable in the catalogue, so counting them inflated the badge
    // (Timepieces showed 26 for 17 actually available).
    it('excludes Sold listings from the in-stock count', async () => {
      mockPrisma.product.groupBy.mockResolvedValue([]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      await app.inject({ method: 'GET', url: '/category-counts' });
      const { where } = mockPrisma.product.groupBy.mock.calls[0][0];
      const statuses = Array.isArray(where.status?.in) ? where.status.in : [where.status];
      expect(statuses).not.toContain('Sold');
    });
  });

  describe('GET /:id', () => {
    it('returns product by id', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        title: 'Test',
        seller: { name: 'S' },
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/p1' });
      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe('p1');
    });

    it('returns 404 when not found', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/nonexistent' });
      expect(res.statusCode).toBe(404);
    });

    // A direct /product/:id link must not be a back door into an unpublished
    // listing that the catalogue itself refuses to list.
    it('requires isPublished on the public detail lookup', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/p1' });
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1', status: { in: ['Approved', 'Sold'] }, isPublished: true },
        }),
      );
    });
  });

  describe('POST /', () => {
    const validProduct = {
      title: 'Watch',
      category: 'Timepieces',
      description: 'Desc',
      condition: 'Mint',
      price: 1000,
      image: 'https://img.com/1.jpg',
      sellerId: 'vendor-id',
    };

    it('creates a product', async () => {
      mockPrisma.product.create.mockResolvedValue({
        id: 'new-p',
        ...validProduct,
        images: [],
        keywords: [],
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: validProduct,
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('creates a product with custom commissionPercent', async () => {
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.create.mockResolvedValue({
        id: 'new-p',
        ...validProduct,
        commissionPercent: 20,
        images: [],
        keywords: [],
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { ...validProduct, commissionPercent: 20 },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('returns 401 without auth', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'POST', url: '/', payload: validProduct });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 when sellerId mismatches', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { ...validProduct, sellerId: 'wrong-id' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 when KYC not verified', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { ...validProduct, sellerId: 'user-id' },
        headers: { authorization: 'Bearer no-kyc' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 422 when listing limit reached for SINGLE vendor', async () => {
      mockPrisma.product.count.mockResolvedValue(5);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: validProduct,
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('PUT /:id', () => {
    it('updates a product as owner', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Pending',
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', title: 'Updated' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PUT',
        url: '/p1',
        payload: { title: 'Updated' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 404 when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PUT',
        url: '/nonexistent',
        payload: { title: 'Updated' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when the owner is not KYC-verified', async () => {
      // 'no-kyc' token: id 'user-id', kycStatus 'none' — owns the product but unverified
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'user-id',
        status: 'Pending',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PUT',
        url: '/p1',
        payload: { title: 'Updated' },
        headers: { authorization: 'Bearer no-kyc' },
      });
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });

    it('returns 422 when product is sold', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Sold',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PUT',
        url: '/p1',
        payload: { title: 'Updated' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 403 when not owner and not admin', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'other-id',
        status: 'Pending',
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PUT',
        url: '/p1',
        payload: { title: 'Updated' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('updates commissionPercent on an owned product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Approved',
      });
      mockPrisma.product.update.mockResolvedValue({
        id: 'p1',
        title: 'Updated',
        commissionPercent: 20,
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PUT',
        url: '/p1',
        payload: { commissionPercent: 20 },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('strips adminNotes when a seller tries to write it', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Pending',
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', title: 'Updated' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PUT',
        url: '/p1',
        payload: { title: 'Updated', adminNotes: { col_abc123: 'hacked' } },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.product.update.mock.calls[0][0].data).not.toHaveProperty('adminNotes');
    });

    it('strips listingCategory when a seller tries to self-promote', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Pending',
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', title: 'Updated' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PUT',
        url: '/p1',
        payload: { title: 'Updated', listingCategory: 'featured' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.product.update.mock.calls[0][0].data).not.toHaveProperty('listingCategory');
    });

    it('lets an admin write adminNotes and listingCategory', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Pending',
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', title: 'Updated' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PUT',
        url: '/p1',
        payload: {
          adminNotes: { col_abc123: 'paid in cash' },
          listingCategory: 'most_rare',
        },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      const { data } = mockPrisma.product.update.mock.calls[0][0];
      expect(data.adminNotes).toEqual({ col_abc123: 'paid in cash' });
      expect(data.listingCategory).toBe('most_rare');
    });

    it('never returns adminNotes to a seller', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Pending',
      });
      mockPrisma.product.update.mockResolvedValue({
        id: 'p1',
        title: 'Updated',
        adminNotes: { col_abc123: 'internal' },
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PUT',
        url: '/p1',
        payload: { title: 'Updated' },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).not.toHaveProperty('adminNotes');
    });
  });

  describe('adminNotes is never public', () => {
    it('is stripped from the public catalogue list', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', title: 'Test', adminNotes: { col_abc123: 'internal' } },
      ]);
      mockPrisma.product.count.mockResolvedValue(1);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/' });
      expect(res.statusCode).toBe(200);
      expect(res.json().products[0]).not.toHaveProperty('adminNotes');
    });

    it('is stripped from the public product detail', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        title: 'Test',
        adminNotes: { col_abc123: 'internal' },
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/p1' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).not.toHaveProperty('adminNotes');
    });
  });

  describe('DELETE /:id', () => {
    it('deletes product as owner', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', sellerId: 'vendor-id' });
      mockPrisma.product.delete.mockResolvedValue({});
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'DELETE',
        url: '/p1',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(204);
    });

    it('returns 404 when not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'DELETE',
        url: '/nope',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when not owner nor admin', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', sellerId: 'other-id' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'DELETE',
        url: '/p1',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /bulk', () => {
    it('creates products in bulk', async () => {
      mockPrisma.product.create.mockResolvedValue({ id: 'new' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/bulk',
        payload: {
          products: [
            {
              title: 'Watch',
              category: 'Timepieces',
              description: 'Desc',
              condition: 'Mint',
              price: 100,
              image: 'https://img.com/1.jpg',
            },
          ],
        },
        headers: { authorization: 'Bearer bulk-vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().created).toBe(1);
    });

    it('returns 400 with empty products', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/bulk',
        payload: { products: [] },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 422 when over 100 products', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/bulk',
        payload: {
          products: Array(101).fill({
            title: 'a',
            category: 'Timepieces',
            description: 'd',
            condition: 'c',
            price: 1,
            image: 'https://img.com/1.jpg',
          }),
        },
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 403 when KYC not verified', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/bulk',
        payload: {
          products: [
            {
              title: 'Watch',
              category: 'Timepieces',
              description: 'Desc',
              condition: 'Mint',
              price: 100,
              image: 'https://img.com/1.jpg',
            },
          ],
        },
        headers: { authorization: 'Bearer no-kyc' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 when the bulk vendor is SUSPENDED', async () => {
      mockPrisma.product.create.mockResolvedValue({ id: 'new' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/bulk',
        payload: {
          products: [
            {
              title: 'Watch',
              category: 'Timepieces',
              description: 'Desc',
              condition: 'Mint',
              price: 100,
              image: 'https://img.com/1.jpg',
            },
          ],
        },
        headers: { authorization: 'Bearer bulk-suspended' },
      });
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /:id/sold', () => {
    it('marks product as sold when qty=1 (no body)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Approved',
        quantity: 1,
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', status: 'Sold', quantity: 0 });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/p1/sold',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'Sold', quantity: 0 },
      });
    });

    // Regression: the listing used to stay in every shopper's cart after the
    // seller marked it sold — still priced into the total, and checkout then
    // failed with the raw "Product not available: <title>".
    it('purges the sold-out product from every cart and wishlist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Approved',
        quantity: 1,
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', status: 'Sold', quantity: 0 });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/p1/sold',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1' } });
      expect(mockPrisma.wishlistItem.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'p1' },
      });
    });

    it('leaves carts alone when stock remains after a partial sale', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Approved',
        quantity: 5,
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', quantity: 4 });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/p1/sold',
        headers: { authorization: 'Bearer vendor' },
        body: { quantity: 1 },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.cartItem.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.wishlistItem.deleteMany).not.toHaveBeenCalled();
    });

    it('decrements quantity when selling qty=1 from multi-qty product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Approved',
        quantity: 5,
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', quantity: 4 });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/p1/sold',
        headers: { authorization: 'Bearer vendor' },
        body: { quantity: 1 },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { quantity: 4 },
      });
    });

    it('marks Sold when selling entire remaining qty', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Approved',
        quantity: 3,
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', status: 'Sold', quantity: 0 });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/p1/sold',
        headers: { authorization: 'Bearer vendor' },
        body: { quantity: 3 },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'Sold', quantity: 0 },
      });
    });

    it('returns 422 when requested qty exceeds available', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Approved',
        quantity: 2,
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/p1/sold',
        headers: { authorization: 'Bearer vendor' },
        body: { quantity: 5 },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 404 when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/nope/sold',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when not the seller', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'other-id',
        status: 'Approved',
        quantity: 1,
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/p1/sold',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 422 when already sold', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Sold',
        quantity: 0,
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/p1/sold',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 422 when the product is not yet Approved (cannot self-publish via sold)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sellerId: 'vendor-id',
        status: 'Pending',
        quantity: 1,
      });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/products.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/p1/sold',
        headers: { authorization: 'Bearer vendor' },
      });
      expect(res.statusCode).toBe(422);
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });
  });
});
