import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

function buildApp(mockPrisma) {
  const fastify = Fastify();
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Validation Error', issues: error.issues });
    }
    reply.status(error.statusCode || 500).send({ error: error.message });
  });
  fastify.decorate('prisma', mockPrisma);
  fastify.decorate('authenticateAdmin', async (req, reply) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token !== 'admin') return reply.status(403).send({ error: 'Access denied' });
  });
  return fastify;
}

function p2002(target) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

function p2025() {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

describe('admin comparison platform routes', () => {
  let mockPrisma;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      comparisonPlatform: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
  });

  describe('GET /', () => {
    it('lists platforms ordered by sortOrder then name', async () => {
      mockPrisma.comparisonPlatform.findMany.mockResolvedValue([
        { id: 'p1', name: 'eBay', sortOrder: 0 },
      ]);
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/adminComparisonPlatforms.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'GET',
        url: '/',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
      expect(mockPrisma.comparisonPlatform.findMany).toHaveBeenCalledWith({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    });

    it('requires admin', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/adminComparisonPlatforms.js')).default);
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/' });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /', () => {
    it('creates a platform', async () => {
      mockPrisma.comparisonPlatform.create.mockResolvedValue({ id: 'p1', name: 'Chrono24' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/adminComparisonPlatforms.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { name: 'Chrono24' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.name).toBe('Chrono24');
    });

    it('rejects a duplicate name with 409', async () => {
      mockPrisma.comparisonPlatform.create.mockRejectedValue(p2002(['name']));
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/adminComparisonPlatforms.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { name: 'eBay' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(409);
    });

    it('rejects a blank name', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/adminComparisonPlatforms.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { name: '' },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /:id', () => {
    it('updates a platform', async () => {
      mockPrisma.comparisonPlatform.update.mockResolvedValue({ id: 'p1', active: false });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/adminComparisonPlatforms.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/p1',
        payload: { active: false },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.active).toBe(false);
    });

    it('returns 400 with no fields to update', async () => {
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/adminComparisonPlatforms.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/p1',
        payload: {},
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for an unknown platform', async () => {
      mockPrisma.comparisonPlatform.update.mockRejectedValue(p2025());
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/adminComparisonPlatforms.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'PATCH',
        url: '/missing',
        payload: { active: false },
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /:id', () => {
    it('deletes a platform', async () => {
      mockPrisma.comparisonPlatform.delete.mockResolvedValue({ id: 'p1' });
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/adminComparisonPlatforms.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'DELETE',
        url: '/p1',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it('returns 404 for an unknown platform', async () => {
      mockPrisma.comparisonPlatform.delete.mockRejectedValue(p2025());
      const app = buildApp(mockPrisma);
      await app.register((await import('../../routes/adminComparisonPlatforms.js')).default);
      await app.ready();
      const res = await app.inject({
        method: 'DELETE',
        url: '/missing',
        headers: { authorization: 'Bearer admin' },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});

describe('public comparison platform route', () => {
  it('returns only active platforms with public-safe fields', async () => {
    const mockPrisma = {
      comparisonPlatform: {
        findMany: vi.fn().mockResolvedValue([{ id: 'p1', name: 'eBay', logoUrl: null }]),
      },
    };
    const fastify = Fastify();
    fastify.decorate('prisma', mockPrisma);
    await fastify.register((await import('../../routes/comparisonPlatforms.js')).default);
    await fastify.ready();
    const res = await fastify.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([{ id: 'p1', name: 'eBay', logoUrl: null }]);
    expect(mockPrisma.comparisonPlatform.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
  });
});
