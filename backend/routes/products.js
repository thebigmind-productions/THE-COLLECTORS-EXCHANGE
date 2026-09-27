import {
  ProductSchema,
  ProductIdParam,
  PriceRangeSchema,
  resolveProductSort,
  searchKeywordTokens,
} from '../schemas/product.js';
import { syncProductToMetaAsync } from '../lib/metaCatalog.js';
import { syncProductToGoogleAsync } from '../lib/googleMerchant.js';

/**
 * `adminNotes` holds admin-only free-text values for admin-defined custom
 * columns. It must never reach the public catalogue or a seller. Prisma is
 * configured to omit it globally (plugins/prisma.js), so this is a second
 * belt-and-braces strip applied to every response this router sends.
 */
function withoutAdminNotes(product) {
  if (!product || typeof product !== 'object') return product;
  const { adminNotes: _adminNotes, ...rest } = product;
  return rest;
}

/**
 * Only admin/curator may read or write admin-only fields.
 */
function isPrivileged(dbUser) {
  return dbUser?.role === 'admin' || dbUser?.role === 'curator';
}

/**
 * Product Routes
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function productRoutes(fastify) {
  const { prisma } = fastify;

  // Get all products (Public catalog)
  fastify.get('/', async (request, reply) => {
    const { category, search, condition, sellerId, page, limit, listingCategory, sort } =
      request.query;

    let priceRange;
    try {
      priceRange = PriceRangeSchema.parse({
        minPrice: request.query.minPrice,
        maxPrice: request.query.maxPrice,
      });
    } catch (err) {
      return reply.status(400).send({
        error: err?.issues?.[0]?.message || 'Invalid price filter',
      });
    }

    const where = {};

    // Public catalog: show Approved and Sold products
    // UNLESS querying own seller listings
    if (sellerId) {
      where.sellerId = sellerId;
      const token = request.headers.authorization?.split(' ')[1];
      let isOwner = false;
      if (token) {
        try {
          await fastify.authenticate(request, reply);
          if (reply.sent) return;
          if (request.dbUser && request.dbUser.id === sellerId) {
            isOwner = true;
          }
        } catch {
          // Suppress and treat as guest
        }
      }

      if (!isOwner) {
        where.status = { in: ['Approved', 'Sold'] };
        // A seller's public storefront is still the public catalogue — it must
        // obey the same publish gate as the un-scoped listing below.
        where.isPublished = true;
      }
    } else {
      where.status = { in: ['Approved', 'Sold'] };
      // `isPublished` is the owner's explicit "this may be shown publicly"
      // switch. Without it the catalogue served every Approved product,
      // including the ones deliberately taken down — the Meta and Google feeds
      // (lib/metaCatalog.js, lib/googleMerchant.js) always honoured it, so the
      // storefront was the only surface leaking them.
      where.isPublished = true;
    }

    if (category && category !== 'all') {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (listingCategory) {
      where.listingCategory = listingCategory;
    }

    if (condition) {
      where.condition = { equals: condition, mode: 'insensitive' };
    }

    if (priceRange.minPrice !== undefined || priceRange.maxPrice !== undefined) {
      where.price = {
        ...(priceRange.minPrice !== undefined ? { gte: priceRange.minPrice } : {}),
        ...(priceRange.maxPrice !== undefined ? { lte: priceRange.maxPrice } : {}),
      };
    }

    if (search) {
      const keywordTokens = searchKeywordTokens(search);
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        // `brand` is shown on the product page and is what shoppers actually
        // type ("rolex", "omega"), so it has to be searchable.
        { brand: { contains: search, mode: 'insensitive' } },
        ...(keywordTokens.length > 0 ? [{ keywords: { hasSome: keywordTokens } }] : []),
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

    try {
      // Higher commissionPercent = boosted visibility in catalog. Sold items
      // must sort after Approved ones globally (not just within a page), so
      // this has to happen in the query, not client-side per-page — the where
      // clause above only ever admits 'Approved' or 'Sold' here, and those
      // sort correctly in that order alphabetically.
      //
      // An explicit ?sort= replaces the tie-breakers but never the status
      // grouping, and is resolved through the whitelist in schemas/product.js —
      // an unknown key falls back to the default rather than erroring, so an
      // old or hand-edited URL still renders a catalogue.
      const sortOrderBy = resolveProductSort(sort);
      const orderBy = sellerId
        ? (sortOrderBy ?? { createdAt: 'desc' })
        : sortOrderBy
          ? [{ status: 'asc' }, ...sortOrderBy]
          : [{ status: 'asc' }, { commissionPercent: 'desc' }, { createdAt: 'desc' }];

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy,
          include: { seller: { select: { name: true, type: true, role: true } } },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.product.count({ where }),
      ]);
      return {
        products: products.map(withoutAdminNotes),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    } catch (dbError) {
      request.log.error(
        { prismaError: dbError.message, stack: dbError.stack },
        'Product query failed',
      );
      return reply.status(500).send({ error: dbError.message });
    }
  });

  // Get product counts per category
  fastify.get('/category-counts', async (request, reply) => {
    try {
      // Must use the same visibility rule as GET / above, or the "N in stock"
      // badge counts listings the catalogue refuses to show.
      //
      // Narrower than the listing route on purpose: that one admits 'Sold' so
      // sold pieces stay browsable, but this number is labelled "in stock", so
      // counting Sold inflated it (Timepieces read 26 while only 17 were
      // actually available).
      const counts = await prisma.product.groupBy({
        by: ['category'],
        where: { status: 'Approved', isPublished: true },
        _count: { id: true },
      });
      const result = {};
      counts.forEach((c) => {
        result[c.category] = c._count.id;
      });
      return result;
    } catch (dbError) {
      request.log.error({ prismaError: dbError.message }, 'Category counts query failed');
      return reply.status(500).send({ error: dbError.message });
    }
  });

  // Get product by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = ProductIdParam.parse(request.params);
    const product = await prisma.product.findFirst({
      // Same publish gate as the listing route — a direct /product/:id link must
      // not be a back door into a listing the owner unpublished.
      where: { id, status: { in: ['Approved', 'Sold'] }, isPublished: true },
      include: {
        seller: {
          select: {
            name: true,
            type: true,
            role: true,
            // Seller trust signal for the storefront (avg star rating + count)
            vendor: { select: { rating: true, ratingCount: true } },
          },
        },
      },
    });

    if (!product) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    return withoutAdminNotes(product);
  });

  // Add new product
  fastify.post('/', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const productData = ProductSchema.parse(request.body);
    const dbUser = request.dbUser;

    if (!dbUser) {
      return reply.status(401).send({ error: 'User profile not synchronized' });
    }

    // Verify sellerId matches logged-in user CUID
    if (productData.sellerId !== dbUser.id) {
      return reply.status(403).send({ error: 'Seller ID mismatch' });
    }

    // Verify KYC status
    if (dbUser.kycStatus !== 'verified') {
      return reply
        .status(403)
        .send({ error: 'Seller KYC verification is required to list products.' });
    }

    // Fetch or create vendor profile
    let vendor = dbUser.vendor;
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          userId: dbUser.id,
          type: dbUser.type === 'company' ? 'BULK' : 'SINGLE',
          status: 'APPROVED',
          maxListings: dbUser.type === 'company' ? 999999 : 5,
        },
      });
    }

    if (vendor.status !== 'APPROVED') {
      return reply.status(403).send({ error: `Vendor account status: ${vendor.status}` });
    }

    // Check active listing count for SINGLE type vendor
    if (vendor.type === 'SINGLE') {
      const activeCount = await prisma.product.count({
        where: {
          sellerId: dbUser.id,
          status: { in: ['Pending', 'In_Review', 'Approved'] },
        },
      });

      if (activeCount >= vendor.maxListings) {
        return reply.status(422).send({
          error: `Listing limit reached. Single sellers can have at most ${vendor.maxListings} active products.`,
        });
      }
    }

    const newProduct = await prisma.product.create({
      data: {
        ...productData,
        images: productData.images || [],
        keywords: productData.keywords || [],
        commissionPercent: productData.commissionPercent ?? 10,
        authenticityStatus: 'Pending',
        status: 'Pending',
        isPublished: false,
        isVerified: false, // trust badge — set by admin at approval only, never by seller input
        listingCategory: 'normal', // curation tier — admin-only, a seller can't self-promote
        adminNotes: {}, // admin-only custom columns, never seller-set
      },
    });
    return reply.status(201).send(withoutAdminNotes(newProduct));
  });

  // Update product
  fastify.put('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = ProductIdParam.parse(request.params);
    const productData = ProductSchema.partial().parse(request.body);
    const dbUser = request.dbUser;

    if (!dbUser) {
      return reply.status(401).send({ error: 'User profile not synchronized' });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    // Prevent modifying a sold product
    if (existingProduct.status === 'Sold') {
      return reply.status(422).send({ error: 'Cannot modify a sold product' });
    }

    // Ensure user is the owner or an admin
    if (
      existingProduct.sellerId !== dbUser.id &&
      dbUser.role !== 'admin' &&
      dbUser.role !== 'curator'
    ) {
      return reply.status(403).send({ error: 'Not authorized to update this product' });
    }

    // A seller must still hold KYC verification to edit their listings (an edit
    // re-enters the review pipeline). Admins/curators are exempt.
    if (dbUser.role !== 'admin' && dbUser.role !== 'curator' && dbUser.kycStatus !== 'verified') {
      return reply
        .status(403)
        .send({ error: 'Seller KYC verification is required to edit listings.' });
    }

    // Admin-only fields are stripped from every payload up front and only
    // re-applied for admin/curator, so a seller can never write them.
    const {
      sellerId: _sellerId,
      adminNotes: incomingAdminNotes,
      listingCategory: incomingListingCategory,
      ...safeData
    } = productData;
    const updateData = { ...safeData };

    // If updated by seller, reset approval status back to Pending
    if (dbUser.role !== 'admin' && dbUser.role !== 'curator') {
      updateData.status = 'Pending';
      updateData.isPublished = false;
      updateData.authenticityStatus = 'Pending';
      updateData.isVerified = false; // edited listing must be re-verified; drop the trust badge
    } else {
      if (incomingAdminNotes !== undefined) updateData.adminNotes = incomingAdminNotes;
      if (incomingListingCategory !== undefined)
        updateData.listingCategory = incomingListingCategory;
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    // Covers both directions: a field edit while still live, and a seller
    // edit that pulls an already-live listing back into review.
    const wasLive = existingProduct.status === 'Approved' && existingProduct.isPublished;
    const isLive = updatedProduct.status === 'Approved' && updatedProduct.isPublished;
    if (wasLive || isLive) {
      syncProductToMetaAsync(updatedProduct);
      syncProductToGoogleAsync(updatedProduct);
    }

    return isPrivileged(dbUser) ? updatedProduct : withoutAdminNotes(updatedProduct);
  });

  // Delete product
  fastify.delete('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = ProductIdParam.parse(request.params);
    const dbUser = request.dbUser;

    if (!dbUser) {
      return reply.status(401).send({ error: 'User profile not synchronized' });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    // Ensure user is the owner or an admin
    if (existingProduct.sellerId !== dbUser.id && dbUser.role !== 'admin') {
      return reply.status(403).send({ error: 'Not authorized to delete this product' });
    }

    if (existingProduct.status === 'Approved' && existingProduct.isPublished) {
      syncProductToMetaAsync({ ...existingProduct, status: 'Rejected', isPublished: false });
      syncProductToGoogleAsync({ ...existingProduct, status: 'Rejected', isPublished: false });
    }

    await prisma.product.delete({
      where: { id },
    });

    return reply.status(204).send();
  });

  // Bulk create products (for BULK vendors)
  fastify.post('/bulk', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { products } = request.body;
    const dbUser = request.dbUser;

    if (!dbUser) {
      return reply.status(401).send({ error: 'User profile not synchronized' });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return reply.status(400).send({ error: 'Products array is required and must not be empty.' });
    }

    if (products.length > 100) {
      return reply
        .status(422)
        .send({ error: 'Batch limit exceeded. Maximum 100 products per bulk request.' });
    }

    if (dbUser.kycStatus !== 'verified') {
      return reply.status(403).send({ error: 'Seller KYC verification is required.' });
    }

    let vendor =
      dbUser.vendor ||
      (await prisma.vendor.create({
        data: {
          userId: dbUser.id,
          type: 'BULK',
          status: 'APPROVED',
          maxListings: 999999,
        },
      }));

    if (vendor.type !== 'BULK') {
      return reply.status(403).send({ error: 'Bulk upload is only available for BULK vendors.' });
    }

    // Same vendor-status gate the single-create path enforces — a SUSPENDED /
    // REJECTED / PENDING vendor must not be able to publish via the bulk path.
    if (vendor.status !== 'APPROVED') {
      return reply.status(403).send({ error: `Vendor account status: ${vendor.status}` });
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < products.length; i++) {
      const item = products[i];
      try {
        const parsed = ProductSchema.parse({
          ...item,
          sellerId: dbUser.id,
          price: parseFloat(item.price),
          commissionPercent: item.commissionPercent ? parseInt(item.commissionPercent, 10) : 10,
          keywords: item.keywords
            ? typeof item.keywords === 'string'
              ? item.keywords
                  .split(',')
                  .map((k) => k.trim())
                  .filter(Boolean)
              : item.keywords
            : [],
          images: item.images || (item.image ? [item.image] : []),
        });
        const product = await prisma.product.create({
          data: {
            ...parsed,
            images: parsed.images || [],
            keywords: parsed.keywords || [],
            commissionPercent: parsed.commissionPercent ?? 10,
            authenticityStatus: 'Pending',
            status: 'Pending',
            isPublished: false,
            isVerified: false, // trust badge — admin-only, never seller-set
            listingCategory: 'normal', // curation tier — admin-only, never seller-set
            adminNotes: {}, // admin-only custom columns, never seller-set
          },
        });
        created.push(withoutAdminNotes(product));
      } catch (err) {
        errors.push({
          row: i + 1,
          title: item.title || '(no title)',
          error: err.message || 'Validation failed',
        });
      }
    }

    return { created: created.length, errors, products: created };
  });

  // Mark product as sold (supports quantity decrement for multi-quantity items)
  fastify.patch(
    '/:id/sold',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const { id } = ProductIdParam.parse(request.params);
      const sellQty = request.body?.quantity || 1;
      const dbUser = request.dbUser;
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ error: 'Product not found' });
      if (existing.sellerId !== dbUser.id)
        return reply.status(403).send({ error: 'Not your product' });
      if (existing.status === 'Sold')
        return reply.status(422).send({ error: 'Product is already sold' });
      if (existing.status !== 'Approved') {
        return reply.status(422).send({ error: 'Only approved listings can be marked as sold' });
      }
      if (sellQty < 1 || sellQty > existing.quantity) {
        return reply
          .status(422)
          .send({ error: `Quantity must be between 1 and ${existing.quantity}` });
      }

      const remaining = existing.quantity - sellQty;
      if (remaining <= 0) {
        const updated = await prisma.product.update({
          where: { id },
          data: { status: 'Sold', quantity: 0 },
        });
        // A sold-out listing has to leave every shopper's cart and wishlist,
        // exactly as the admin mark-as-sold (routes/admin.js) and the checkout
        // finalisation (routes/checkout.js) already do. Left behind, it stays
        // priced into the cart total and checkout dies on
        // "Product not available: <title>".
        await prisma.cartItem.deleteMany({ where: { productId: id } });
        await prisma.wishlistItem.deleteMany({ where: { productId: id } });
        syncProductToMetaAsync(updated);
        syncProductToGoogleAsync(updated);
        return withoutAdminNotes(updated);
      }
      const updated = await prisma.product.update({ where: { id }, data: { quantity: remaining } });
      return withoutAdminNotes(updated);
    },
  );
}
