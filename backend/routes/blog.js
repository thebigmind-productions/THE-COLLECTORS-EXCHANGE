import { z } from 'zod';

const BlogSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  excerpt: z.string().min(1, 'Excerpt is required'),
  content: z.string().min(1, 'Content is required'),
  coverImage: z.string().optional().nullable(),
  author: z.string().min(1, 'Author is required'),
  authorId: z.string().optional().nullable(),
  authorAvatar: z.string().optional().nullable(),
  category: z.string().min(1, 'Category is required'),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional().default('DRAFT'),
  featured: z.boolean().optional().default(false),
  publishedAt: z.string().datetime().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  readingTime: z.number().int().optional().nullable(),
});

const computeReadingTime = (html) => {
  const text = html.replace(/<[^>]*>/g, '');
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
};

/**
 * Blog Routes
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function blogRoutes(fastify) {
  const { prisma } = fastify;

  // Public: get published posts
  fastify.get('/', async (request, reply) => {
    const { category, tag, search, page = '1', limit = '12', sort } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = { status: 'PUBLISHED' };
    if (category) where.category = category;
    if (tag) where.tags = { has: tag };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy =
      sort === 'views'
        ? [{ viewCount: 'desc' }, { featured: 'desc' }, { publishedAt: 'desc' }]
        : [{ featured: 'desc' }, { publishedAt: 'desc' }];

    const [posts, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      prisma.blog.count({ where }),
    ]);

    return { posts, total, page: parseInt(page), totalPages: Math.ceil(total / take) };
  });

  // Public: get single post by slug
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params;
    const post = await prisma.blog.findUnique({
      where: { slug, status: 'PUBLISHED' },
    });

    if (!post) {
      return reply.status(404).send({ error: 'Post not found' });
    }

    return post;
  });

  // Public: increment view count
  fastify.patch('/:slug/view', async (request, reply) => {
    const { slug } = request.params;
    try {
      await prisma.blog.update({
        where: { slug, status: 'PUBLISHED' },
        data: { viewCount: { increment: 1 } },
      });
    } catch {
      // slug not found or not published — silently ignore
    }
    return { ok: true };
  });

  // Admin: get all posts
  fastify.get(
    '/admin/all',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      if (request.dbUser.role !== 'admin' && request.dbUser.role !== 'curator') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { status, category, search } = request.query;
      const where = {};
      if (status) where.status = status;
      if (category) where.category = category;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } },
        ];
      }

      const posts = await prisma.blog.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
      });

      return posts;
    },
  );

  // Admin: create post
  fastify.post(
    '/',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      if (request.dbUser.role !== 'admin' && request.dbUser.role !== 'curator') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const data = BlogSchema.parse(request.body);
      const readingTime = data.readingTime || computeReadingTime(data.content);

      const post = await prisma.blog.create({
        data: {
          ...data,
          readingTime,
          publishedAt:
            data.status === 'PUBLISHED' ? data.publishedAt || new Date().toISOString() : null,
        },
      });

      return reply.status(201).send(post);
    },
  );

  // Admin: update post
  fastify.put(
    '/:id',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      if (request.dbUser.role !== 'admin' && request.dbUser.role !== 'curator') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { id } = request.params;
      const existing = await prisma.blog.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      const data = BlogSchema.partial().parse(request.body);
      if (data.content) {
        data.readingTime = computeReadingTime(data.content);
      }

      if (data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
        data.publishedAt = new Date().toISOString();
      }

      const post = await prisma.blog.update({ where: { id }, data });
      return post;
    },
  );

  // Admin: update post status
  fastify.patch(
    '/:id/status',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      if (request.dbUser.role !== 'admin' && request.dbUser.role !== 'curator') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { id } = request.params;
      const { status } = z
        .object({ status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) })
        .parse(request.body);

      const existing = await prisma.blog.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      const updateData = { status };
      if (status === 'PUBLISHED' && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }

      const post = await prisma.blog.update({ where: { id }, data: updateData });
      return post;
    },
  );

  // Admin: delete post
  fastify.delete(
    '/:id',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      if (request.dbUser.role !== 'admin' && request.dbUser.role !== 'curator') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { id } = request.params;
      const existing = await prisma.blog.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      await prisma.blog.delete({ where: { id } });
      return reply.status(204).send();
    },
  );
}
