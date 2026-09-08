import { Prisma } from '@prisma/client';
import {
  CreateComparisonPlatformSchema,
  UpdateComparisonPlatformSchema,
  ComparisonPlatformIdParam,
} from '../schemas/comparisonPlatform.js';

/**
 * Admin CRUD for the comparison-platform reference list (eBay, Chrono24, ...).
 * Mirrors qrAdmin.js — a small admin-managed lookup table, no relation to
 * Product (a product's actual comparison entries live in Product.comparisons,
 * a Json array keyed by this model's id).
 */
export default async function adminComparisonPlatformsRoutes(fastify) {
  const { prisma } = fastify;
  const adminAuth = { preValidation: [fastify.authenticateAdmin] };

  fastify.get('/', adminAuth, async () => {
    const platforms = await prisma.comparisonPlatform.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return { data: platforms };
  });

  fastify.post('/', adminAuth, async (request, reply) => {
    const body = CreateComparisonPlatformSchema.parse(request.body);
    try {
      const platform = await prisma.comparisonPlatform.create({ data: body });
      return reply.status(201).send({ data: platform });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.status(409).send({ error: 'A platform with that name already exists' });
      }
      throw err;
    }
  });

  fastify.patch('/:id', adminAuth, async (request, reply) => {
    const { id } = ComparisonPlatformIdParam.parse(request.params);
    const body = UpdateComparisonPlatformSchema.parse(request.body);
    if (!Object.keys(body).length) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    try {
      const platform = await prisma.comparisonPlatform.update({ where: { id }, data: body });
      return reply.send({ data: platform });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.status(409).send({ error: 'A platform with that name already exists' });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.status(404).send({ error: 'Platform not found' });
      }
      throw err;
    }
  });

  fastify.delete('/:id', adminAuth, async (request, reply) => {
    const { id } = ComparisonPlatformIdParam.parse(request.params);
    try {
      await prisma.comparisonPlatform.delete({ where: { id } });
      return reply.send({ success: true });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.status(404).send({ error: 'Platform not found' });
      }
      throw err;
    }
  });
}
