/**
 * Public read of the comparison-platform list — consumed by the product page
 * (to render the "Compare Elsewhere" widget) and by a seller's own listing
 * form (to know which platforms it can attach a link/price for). Only active
 * platforms and only the fields a shopper/seller needs; admin management
 * (including inactive platforms) lives at /api/admin/comparison-platforms.
 */
export default async function comparisonPlatformsRoutes(fastify) {
  const { prisma } = fastify;

  fastify.get('/', async () => {
    const platforms = await prisma.comparisonPlatform.findMany({
      where: { active: true },
      select: { id: true, name: true, logoUrl: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return { data: platforms };
  });
}
