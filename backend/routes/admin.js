import {
  KYCRequestIdParam,
  KYCApprovalSchema,
  KYCRejectionSchema,
  CreatePayoutSchema,
  UpdatePayoutStatusSchema,
  ManualOrderSchema,
} from '../schemas/admin.js';
import { CATEGORIES, AdminProductUpdateSchema } from '../schemas/product.js';
import { syncProductToMetaAsync } from '../lib/metaCatalog.js';
import { syncProductToGoogleAsync } from '../lib/googleMerchant.js';

class ManualOrderError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Admin Routes
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function adminRoutes(fastify) {
  const { prisma } = fastify;

  // ============== DASHBOARD STATS ==============

  // Get dashboard stats
  fastify.get(
    '/stats/overview',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const [
        totalUsers,
        pendingKyc,
        totalProducts,
        totalOrders,
        // ---------- H1: Inventory counts ----------
        totalSoldInventoryCount,
        pendingAndInReviewCount,
        approvedCount,
        // ---------- H2: Revenue totals ----------
        inventoryRevenueAll,
        inventoryRevenueSoldProducts,
        onlinePaidRevenue,
        unreadContactMessages,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { kycStatus: 'pending' } }),
        prisma.product.count({ where: { status: { not: 'Rejected' } } }),
        prisma.order.count(),
        // H1: Sold status
        prisma.product.count({ where: { status: 'Sold' } }),
        // H1 helper: Pending + In_Review
        prisma.product.count({
          where: { OR: [{ status: 'Pending' }, { status: 'In_Review' }] },
        }),
        // H1 helper: Approved (publicly visible)
        prisma.product.count({ where: { status: 'Approved' } }),
        // H2: SUM price of non-Rejected products in inventory (total inventory value if sold at list)
        prisma.product.aggregate({ _sum: { price: true }, where: { status: { not: 'Rejected' } } }),
        // H2: SUM price of status=Sold products (covers offline sales too)
        prisma.product.aggregate({
          _sum: { price: true },
          where: { status: 'Sold' },
        }),
        // H2: SUM paid order totals (actual online revenue captured)
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { paymentStatus: 'Paid' },
        }),
        // Bonus (for M1 Dashboard unread card)
        prisma.contactMessage.count({ where: { read: false } }),
      ]);

      // Available for sale = Approved + Pending + In_Review (all non-Sold, non-Rejected)
      const totalAvailableInventoryCount = pendingAndInReviewCount + approvedCount;

      // Inventory revenue for available-only = (total value) minus (sold items list value)
      const totalInventoryRevenue = inventoryRevenueAll._sum.price ?? 0;
      const totalSoldProductListValue = inventoryRevenueSoldProducts._sum.price ?? 0;
      const totalAvailableRevenue = totalInventoryRevenue - totalSoldProductListValue;

      // Actual captured Sold Revenue = online paid orders + (offline-sold products sum,
      // which are the status=Sold products with NO OrderItem attached to them).
      // Per existing analytics pattern, avoid double-counting: only sum Product.price
      // for status=Sold rows that are NOT represented in OrderItem.
      const offlineSoldRows = await prisma.$queryRaw`
        SELECT COALESCE(SUM(p."price"), 0) as "offlineRevenue"
        FROM "Product" p
        LEFT JOIN "OrderItem" oi ON oi."productId" = p."id"
        WHERE p."status" = 'Sold'::"ProductStatus" AND oi."id" IS NULL
      `;
      const offlineRevenue = Number(offlineSoldRows?.[0]?.offlineRevenue ?? 0);
      const onlineRevenue = Number(onlinePaidRevenue._sum.totalAmount ?? 0);
      const totalSoldRevenue = onlineRevenue + offlineRevenue;

      return {
        // ---------- Existing fields (never remove) ----------
        totalUsers,
        pendingKyc,
        totalProducts,
        totalOrders,
        // ---------- H1: NEW inventory count fields ----------
        totalInventoryCount: totalProducts,
        totalSoldInventoryCount,
        totalAvailableInventoryCount,
        // ---------- H2: NEW revenue totals ----------
        totalInventoryRevenue,
        totalSoldRevenue,
        totalAvailableRevenue,
        totalSoldRevenueOnline: onlineRevenue,
        totalSoldRevenueOffline: offlineRevenue,
        // ---------- M1: NEW unread contact messages ----------
        unreadContactMessages,
      };
    },
  );

  // Get analytics data for dashboard charts
  fastify.get(
    '/stats/analytics',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [revenueData, userGrowth, ordersByStatus, productsByCategory, offlineSold] =
        await Promise.all([
          // Daily revenue for last 30 days from paid orders
          prisma.$queryRaw`
                SELECT DATE(o."createdAt") as date, SUM(o."totalAmount") as revenue
                FROM "Order" o
                WHERE o."paymentStatus" = 'Paid'::"PaymentStatus" AND o."createdAt" >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(o."createdAt")
                ORDER BY date ASC
            `,
          // User signups per day for last 30 days
          prisma.$queryRaw`
                SELECT DATE(u."createdAt") as date, COUNT(*) as count
                FROM "User" u
                WHERE u."createdAt" >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(u."createdAt")
                ORDER BY date ASC
            `,
          // Orders by status
          prisma.$queryRaw`
                SELECT o."status", COUNT(*) as count
                FROM "Order" o
                GROUP BY o."status"
            `,
          // Products by category
          prisma.$queryRaw`
                SELECT p."category", COUNT(*) as count
                FROM "Product" p
                GROUP BY p."category"
            `,
          // Offline-sold products (no order items)
          prisma.product.findMany({
            where: {
              status: 'Sold',
              orderItems: { none: {} },
              updatedAt: { gte: thirtyDaysAgo },
            },
            select: { price: true, updatedAt: true },
          }),
        ]);

      // Merge offline-sold products into revenueData by date
      const revenueMap = new Map();
      for (const row of revenueData) {
        const dateStr =
          typeof row.date === 'object' && row.date instanceof Date
            ? row.date.toISOString().split('T')[0]
            : String(row.date).split('T')[0];
        revenueMap.set(dateStr, Number(row.revenue));
      }
      for (const product of offlineSold) {
        const dateStr = product.updatedAt.toISOString().split('T')[0];
        revenueMap.set(dateStr, (revenueMap.get(dateStr) || 0) + product.price);
      }
      const mergedRevenue = Array.from(revenueMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, revenue]) => ({ date, revenue }));

      return { revenueData: mergedRevenue, userGrowth, ordersByStatus, productsByCategory };
    },
  );

  // ============== VENDOR RANKINGS (H3) ==============

  fastify.get(
    '/stats/vendor-rankings',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { sortBy = 'listings', limit = 20 } = request.query ?? {};

      const validSorts = new Set(['listings', 'revenue', 'sold', 'avgRating', 'reviewCount']);
      const safeSort = validSorts.has(sortBy) ? sortBy : 'listings';
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);

      const vendors = await prisma.vendor.findMany({
        where: { status: 'APPROVED' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { ratings: true },
          },
        },
      });

      const vendorUserIds = vendors.map((v) => v.userId);

      const [listingCountsRaw, soldCountsRaw, revenueRows] = await Promise.all([
        // Listings per vendor (total products, any status)
        prisma.product.groupBy({
          by: ['sellerId'],
          _count: { id: true },
          where: { sellerId: { in: vendorUserIds } },
        }),
        // Sold products per vendor
        prisma.product.groupBy({
          by: ['sellerId'],
          _count: { id: true },
          where: { sellerId: { in: vendorUserIds }, status: 'Sold' },
        }),
        // Realized revenue per vendor: sum OrderItem.price * quantity
        //  for products where Order.Order.paymentStatus = 'Paid'
        prisma.$queryRaw`
          SELECT p."sellerId",
                 COALESCE(SUM(oi."price" * oi."quantity"), 0) as "revenue"
          FROM "OrderItem" oi
          JOIN "Order" o ON o."id" = oi."orderId"
          JOIN "Product" p ON p."id" = oi."productId"
          WHERE o."paymentStatus" = 'Paid'::"PaymentStatus"
            AND p."sellerId" = ANY(${vendorUserIds}::text[])
          GROUP BY p."sellerId"
        `,
      ]);

      const listingByUser = new Map(listingCountsRaw.map((r) => [r.sellerId, r._count.id]));
      const soldByUser = new Map(soldCountsRaw.map((r) => [r.sellerId, r._count.id]));
      const revenueByUser = new Map(revenueRows.map((r) => [r.sellerId, Number(r.revenue ?? 0)]));

      const ranked = vendors.map((v) => {
        const listingsCount = listingByUser.get(v.userId) ?? 0;
        const productsSold = soldByUser.get(v.userId) ?? 0;
        const totalRevenue = revenueByUser.get(v.userId) ?? 0;
        const avgRating = v.ratingCount && v.ratingCount > 0 ? v.rating : 0;
        const reviewCount = v.ratingCount ?? 0;

        return {
          vendor: {
            vendorId: v.id,
            userId: v.userId,
            name: v.user?.name ?? 'Unknown',
            email: v.user?.email ?? '',
            vendorType: v.type,
          },
          listingsCount,
          productsSold,
          totalRevenue,
          avgRating,
          reviewCount,
        };
      });

      ranked.sort((a, b) => {
        switch (safeSort) {
          case 'revenue':
            return b.totalRevenue - a.totalRevenue;
          case 'sold':
            return b.productsSold - a.productsSold;
          case 'avgRating':
            return b.avgRating - a.avgRating;
          case 'reviewCount':
            return b.reviewCount - a.reviewCount;
          case 'listings':
          default:
            return b.listingsCount - a.listingsCount;
        }
      });

      return {
        sortBy: safeSort,
        count: ranked.length,
        data: ranked.slice(0, safeLimit),
      };
    },
  );

  // ============== CONTACT MESSAGES (M1) ==============

  fastify.get(
    '/contact-messages',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { status, search, limit = 100, offset = 0 } = request.query ?? {};

      const where = {};
      if (status === 'UNREAD') where.read = false;
      if (status === 'READ') where.read = true;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.contactMessage.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: Number(offset) || 0,
          take: Math.min(Math.max(Number(limit) || 100, 1), 500),
        }),
        prisma.contactMessage.count({ where }),
      ]);

      return { total, data: rows };
    },
  );

  fastify.get(
    '/contact-messages/:id',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const msg = await prisma.contactMessage.findUnique({
        where: { id: request.params.id },
      });
      if (!msg) return reply.status(404).send({ error: 'Message not found' });
      if (!msg.read) {
        await prisma.contactMessage.update({
          where: { id: msg.id },
          data: { read: true },
        });
        msg.read = true;
      }
      return msg;
    },
  );

  fastify.patch(
    '/contact-messages/:id',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const adminId = request.user?.sub ?? request.dbUser?.id ?? 'unknown';
      const msg = await prisma.contactMessage.findUnique({
        where: { id: request.params.id },
      });
      if (!msg) return reply.status(404).send({ error: 'Message not found' });

      const data = {};
      if (typeof request.body.read === 'boolean') data.read = request.body.read;
      // This used to run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` via
      // $executeRawUnsafe on every reply, as self-healing scaffolding from when
      // the ContactMessage columns were still being rolled out. Removed:
      //
      //  - schema.prisma already declares replyText/repliedAt/repliedBy/status,
      //    and reads of `status` work in production, so the columns exist.
      //  - It made a routine operator action take an ACCESS EXCLUSIVE lock on
      //    the table, and swallowed every error, so a genuine failure was
      //    indistinguishable from the no-op case.
      //  - Worst of it: it required the application's database role to hold
      //    ALTER TABLE. An app that can reshape its own schema turns any future
      //    SQL flaw into a schema-modification flaw. Least privilege says the
      //    runtime role should not be able to do this at all.
      //
      // Schema changes belong in a migration (see docs/migrations/), applied
      // deliberately before the code that depends on them ships.
      if (typeof request.body.replyText === 'string') {
        data.replyText = request.body.replyText;
        data.repliedAt = new Date();
        data.repliedBy = adminId;
        data.status = 'REPLIED';
      }
      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ error: 'No fields provided to update' });
      }

      const updated = await prisma.contactMessage.update({
        where: { id: msg.id },
        data,
      });
      return updated;
    },
  );

  // ============== KYC MANAGEMENT ==============

  // Get all KYC requests with filters
  fastify.get(
    '/kyc/requests',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { status, search } = request.query;

      // Build filter conditions
      const where = {};

      // Filter by KYC status
      if (status && status !== 'all') {
        where.kycStatus = status;
      }

      // Search by name or email
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          type: true,
          role: true,
          kycStatus: true,
          kycData: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return users;
    },
  );

  // Get single KYC request detail
  fastify.get(
    '/kyc/requests/:id',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = KYCRequestIdParam.parse(request.params);

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          type: true,
          role: true,
          kycStatus: true,
          kycData: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return user;
    },
  );

  // Approve KYC request
  fastify.patch(
    '/kyc/requests/:id/approve',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = KYCRequestIdParam.parse(request.params);
      const { notes } = KYCApprovalSchema.parse(request.body);

      const existingUser = await prisma.user.findUnique({
        where: { id },
      });
      if (!existingUser) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const updatedUser = await prisma.$transaction(async (tx) => {
        const currentKycData =
          typeof existingUser.kycData === 'object' && existingUser.kycData !== null
            ? existingUser.kycData
            : {};

        const user = await tx.user.update({
          where: { id },
          data: {
            kycStatus: 'verified',
            kycData: {
              ...currentKycData,
              adminNotes: notes || '',
              approvedAt: new Date().toISOString(),
            },
          },
        });

        // Auto-upsert Vendor Profile
        await tx.vendor.upsert({
          where: { userId: id },
          update: { status: 'APPROVED' },
          create: {
            userId: id,
            type: user.type === 'company' ? 'BULK' : 'SINGLE',
            status: 'APPROVED',
            maxListings: user.type === 'company' ? 999999 : 5,
            companyName: user.type === 'company' ? currentKycData.companyName || null : null,
            gst: user.type === 'company' ? currentKycData.gst || null : null,
            founderName: user.type === 'company' ? currentKycData.founderName || null : null,
            aadhaar: user.type === 'individual' ? currentKycData.aadhaar || null : null,
            pan: user.type === 'individual' ? currentKycData.pan || null : null,
            aadhaarDoc: currentKycData.aadhaarDoc || null,
            panDoc: currentKycData.panDoc || null,
            gstDoc: currentKycData.gstDoc || null,
            incorporationDoc: currentKycData.incorporationDoc || null,
            agreementAccepted: currentKycData.agreementAccepted === true,
            agreementSignedAt: currentKycData.agreementSignedAt
              ? new Date(currentKycData.agreementSignedAt)
              : null,
            agreementSignedByName: currentKycData.agreementSignedByName || null,
            signedAgreementDoc: currentKycData.signedAgreementDoc || null,
          },
        });

        return user;
      });

      // Send KYC approved notification
      await prisma.notification.create({
        data: {
          userId: id,
          title: 'KYC Verified ✓',
          message:
            'Your identity has been verified. You can now list items on The Collectors Exchange.',
        },
      });

      return {
        message: 'KYC request approved successfully',
        user: updatedUser,
      };
    },
  );

  // Reject KYC request
  fastify.patch(
    '/kyc/requests/:id/reject',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = KYCRequestIdParam.parse(request.params);
      const { reason } = KYCRejectionSchema.parse(request.body);

      const existingUser = await prisma.user.findUnique({
        where: { id },
      });
      if (!existingUser) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Preserve previously submitted KYC data (documents, aadhaar/pan, company
      // details) so a rejected seller can correct only the failing item instead
      // of re-uploading everything.
      const currentKycData =
        typeof existingUser.kycData === 'object' && existingUser.kycData !== null
          ? existingUser.kycData
          : {};

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          kycStatus: 'none',
          kycData: {
            ...currentKycData,
            rejectionReason: reason,
            rejectedAt: new Date().toISOString(),
          },
        },
      });

      // Send KYC rejected notification
      await prisma.notification.create({
        data: {
          userId: id,
          title: 'KYC Verification Update',
          message: `Your verification was not approved. Reason: ${reason}. Please resubmit with correct documents.`,
        },
      });

      return {
        message: 'KYC request rejected',
        user: updatedUser,
      };
    },
  );

  // ============== USER MANAGEMENT ==============

  // Ban user
  fastify.patch(
    '/users/:id/ban',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { banned: true },
      });

      await prisma.notification.create({
        data: {
          userId: id,
          title: 'Account Banned',
          message: 'Your account has been banned. Please contact support for more information.',
        },
      });

      return { message: 'User banned successfully', user: updatedUser };
    },
  );

  // Unban user
  fastify.patch(
    '/users/:id/unban',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { banned: false },
      });

      await prisma.notification.create({
        data: {
          userId: id,
          title: 'Account Unbanned',
          message:
            'Your account has been reinstated. You can now use The Collectors Exchange normally.',
        },
      });

      return { message: 'User unbanned successfully', user: updatedUser };
    },
  );

  fastify.get('/users', { preValidation: [fastify.authenticateAdmin] }, async (request, reply) => {
    const { role, search } = request.query;

    const where = {};

    if (role && role !== 'all') {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        type: true,
        role: true,
        kycStatus: true,
        banned: true,
        createdAt: true,
        updatedAt: true,
        vendor: {
          select: {
            id: true,
            type: true,
            status: true,
            maxListings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users;
  });

  // Get single user detail
  fastify.get(
    '/users/:id',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          products: true,
          cart: { include: { product: true } },
          wishlist: { include: { product: true } },
          vendor: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return user;
    },
  );

  // Toggle vendor type (BULK / SINGLE)
  fastify.patch(
    '/vendor/:userId/type',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { userId } = request.params;
      const { type } = request.body || {};

      if (!type || !['SINGLE', 'BULK'].includes(type)) {
        return reply.status(400).send({ error: 'Vendor type must be SINGLE or BULK' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const updatedVendor = await prisma.vendor.upsert({
        where: { userId },
        update: {
          type,
          maxListings: type === 'BULK' ? 999999 : 5,
          status: 'APPROVED',
        },
        create: {
          userId,
          type,
          maxListings: type === 'BULK' ? 999999 : 5,
          status: 'APPROVED',
        },
      });

      // Log action
      await prisma.auditLog.create({
        data: {
          adminId: request.dbUser?.id || 'SYSTEM',
          action: 'TOGGLE_VENDOR_TYPE',
          targetType: 'Vendor',
          targetId: updatedVendor.id,
          details: `Set vendor type to ${type} for user ${userId}`,
        },
      });

      return { message: `Vendor type set to ${type}`, vendor: updatedVendor };
    },
  );

  // Update user role — super admin only. Curators must not be able to grant
  // themselves (or any other account) admin access.
  fastify.patch(
    '/users/:id/role',
    { preValidation: [fastify.authenticateSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { role } = request.body;

      // Prevent self-demotion
      if (id === request.dbUser.id) {
        return reply.status(422).send({ error: 'Cannot change your own role' });
      }

      if (!['user', 'admin', 'curator'].includes(role)) {
        return reply.status(400).send({ error: 'Invalid role' });
      }

      await prisma.auditLog.create({
        data: {
          adminId: request.dbUser.id,
          action: 'CHANGE_USER_ROLE',
          targetType: 'User',
          targetId: id,
          details: `Changed role to ${role}`,
        },
      });

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role },
      });

      return { message: 'User role updated', user: updatedUser };
    },
  );

  // ============== PRODUCT MANAGEMENT ==============

  // Get all products with filters
  fastify.get(
    '/products',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { category, status, search } = request.query;

      const where = {};

      if (category && category !== 'all') {
        where.category = { equals: category, mode: 'insensitive' };
      }

      if (status && status !== 'all') {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { seller: { name: { contains: search, mode: 'insensitive' } } },
          { seller: { email: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const products = await prisma.product.findMany({
        where,
        // Admin-gated route: opt back into the globally-omitted admin-only
        // custom column values (see plugins/prisma.js).
        omit: { adminNotes: false },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return products;
    },
  );

  // Get single product detail
  fastify.get(
    '/products/:id',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const product = await prisma.product.findUnique({
        where: { id },
        // Admin-gated route: opt back into the globally-omitted admin-only
        // custom column values (see plugins/prisma.js).
        omit: { adminNotes: false },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              // The admin product page renders a Seller Information card with a
              // mailto: link and a phone number. Without these it showed an
              // empty link and "Not provided" on every listing, so an operator
              // could not contact a seller about their own product without
              // going hunting through Users. /orders/:id already selects both.
              email: true,
              phone: true,
            },
          },
          orderItems: {
            select: { id: true, orderId: true },
          },
        },
      });

      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      return product;
    },
  );

  // Start review
  fastify.patch(
    '/products/:id/review',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          status: 'In_Review',
          reviewedAt: new Date(),
        },
      });

      return { message: 'Product is now under review', product: updatedProduct };
    },
  );

  // Approve product (Publish) — super admin only
  fastify.patch(
    '/products/:id/approve',
    { preValidation: [fastify.authenticateSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const existingProduct = await prisma.product.findUnique({ where: { id } });
      if (existingProduct.status === 'Sold') {
        return reply.status(422).send({ error: 'Cannot approve a sold product' });
      }

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          status: 'Approved',
          isPublished: true,
          isVerified: true,
          authenticityStatus: 'Verified',
          rejectionReason: null,
          reviewedAt: new Date(),
        },
      });

      syncProductToMetaAsync(updatedProduct);
      syncProductToGoogleAsync(updatedProduct);

      // Notify seller
      await prisma.notification.create({
        data: {
          userId: updatedProduct.sellerId,
          title: 'Listing Approved ✓',
          message: `Your item "${updatedProduct.title}" has been verified and is now live on The Exchange.`,
        },
      });

      return { message: 'Product approved and published successfully', product: updatedProduct };
    },
  );

  // Reject product
  fastify.patch(
    '/products/:id/reject',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body || {};

      if (!reason) {
        return reply.status(400).send({ error: 'Rejection reason is required' });
      }

      const existingProduct = await prisma.product.findUnique({ where: { id } });
      if (existingProduct.status === 'Sold') {
        return reply.status(422).send({ error: 'Cannot reject a sold product' });
      }

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          status: 'Rejected',
          isPublished: false,
          isVerified: false,
          authenticityStatus: 'Rejected',
          rejectionReason: reason,
          reviewedAt: new Date(),
        },
      });

      // Only reaches Meta/Google if it was previously live there — otherwise it
      // was never pushed and there is nothing to delist.
      if (existingProduct.status === 'Approved' && existingProduct.isPublished) {
        syncProductToMetaAsync(updatedProduct);
        syncProductToGoogleAsync(updatedProduct);
      }

      // Notify seller
      await prisma.notification.create({
        data: {
          userId: updatedProduct.sellerId,
          title: 'Listing Requires Attention',
          message: `Your item "${updatedProduct.title}" was not approved. Reason: ${reason}. Please update and resubmit.`,
        },
      });

      return { message: 'Product rejected', product: updatedProduct };
    },
  );

  // Mark product as sold — admin only
  fastify.patch(
    '/products/:id/sold',
    { preValidation: [fastify.authenticateSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const existingProduct = await prisma.product.findUnique({ where: { id } });
      if (!existingProduct) return reply.status(404).send({ error: 'Product not found' });
      if (existingProduct.status === 'Sold')
        return reply.status(422).send({ error: 'Product is already sold' });

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: { status: 'Sold', isPublished: false },
      });

      syncProductToMetaAsync(updatedProduct);
      syncProductToGoogleAsync(updatedProduct);

      await prisma.notification.create({
        data: {
          userId: updatedProduct.sellerId,
          title: 'Item Sold',
          message: `Your item "${updatedProduct.title}" has been marked as sold.`,
        },
      });

      return { message: 'Product marked as sold', product: updatedProduct };
    },
  );

  // Update authenticity status — super admin only
  fastify.patch(
    '/products/:id/authenticity',
    { preValidation: [fastify.authenticateSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { status: authStatus } = request.body;

      const existingProduct = await prisma.product.findUnique({ where: { id } });
      if (existingProduct.status === 'Sold') {
        return reply.status(422).send({ error: 'Cannot modify authenticity of a sold product' });
      }

      const validStatuses = ['Pending', 'Verified', 'Rejected', 'Under_Review'];
      if (!validStatuses.includes(authStatus)) {
        return reply.status(400).send({ error: 'Invalid authenticity status' });
      }

      const data = {
        authenticityStatus: authStatus,
      };

      // Sync with workflow status
      if (authStatus === 'Verified') {
        data.status = 'Approved';
        data.isPublished = true;
        data.isVerified = true;
      } else if (authStatus === 'Rejected') {
        data.status = 'Rejected';
        data.isPublished = false;
        data.isVerified = false;
      }

      const updatedProduct = await prisma.product.update({
        where: { id },
        data,
      });

      if (authStatus === 'Verified') {
        syncProductToMetaAsync(updatedProduct);
        syncProductToGoogleAsync(updatedProduct);
      } else if (
        authStatus === 'Rejected' &&
        existingProduct.status === 'Approved' &&
        existingProduct.isPublished
      ) {
        syncProductToMetaAsync(updatedProduct);
        syncProductToGoogleAsync(updatedProduct);
      }

      return { message: 'Authenticity status updated', product: updatedProduct };
    },
  );

  // Delete product
  fastify.delete(
    '/products/:id',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      if (existing.status === 'Approved' && existing.isPublished) {
        syncProductToMetaAsync({ ...existing, status: 'Rejected', isPublished: false });
        syncProductToGoogleAsync({ ...existing, status: 'Rejected', isPublished: false });
      }

      // Delete related records first to avoid foreign key constraint errors
      await prisma.cartItem.deleteMany({ where: { productId: id } });
      await prisma.wishlistItem.deleteMany({ where: { productId: id } });
      await prisma.orderItem.deleteMany({ where: { productId: id } });
      await prisma.productView.deleteMany({ where: { productId: id } });
      await prisma.cartEvent.deleteMany({ where: { productId: id } });
      await prisma.checkoutEvent.deleteMany({ where: { productId: id } });
      if (existing.auction) {
        await prisma.auctionBid.deleteMany({ where: { auctionId: existing.auction.id } });
        await prisma.auction.delete({ where: { id: existing.auction.id } });
      }

      await prisma.product.delete({ where: { id } });

      return { message: 'Product deleted successfully' };
    },
  );

  // Update product (brand, listingCategory, etc.)
  fastify.patch(
    '/products/:id',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const data = AdminProductUpdateSchema.parse(request.body);

      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      // Admin-gated route (authenticateAdmin): adminNotes may be written here
      // and is echoed back so the admin table can render custom columns.
      const updated = await prisma.product.update({
        where: { id },
        data,
        omit: { adminNotes: false },
      });

      if (updated.status === 'Approved' && updated.isPublished) {
        syncProductToMetaAsync(updated);
        syncProductToGoogleAsync(updated);
      }

      return { message: 'Product updated successfully', product: updated };
    },
  );

  // Get all unique brands
  fastify.get('/brands', { preValidation: [fastify.authenticateAdmin] }, async (request, reply) => {
    const products = await prisma.product.findMany({
      where: { brand: { not: null } },
      select: { brand: true },
      distinct: ['brand'],
    });

    const brands = products.map((p) => p.brand).filter(Boolean);
    return brands;
  });

  // ============== ORDER MANAGEMENT ==============

  // Get all orders with filters
  fastify.get('/orders', { preValidation: [fastify.authenticateAdmin] }, async (request, reply) => {
    const { status, search } = request.query;

    const where = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { displayId: { contains: search, mode: 'insensitive' } },
        { buyerName: { contains: search, mode: 'insensitive' } },
        { buyerPhone: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders;
  });

  // Get single order detail
  fastify.get(
    '/orders/:id',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, type: true, role: true },
          },
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      return order;
    },
  );

  // Create manual order (cash/walk-in sale or backfill sold product)
  fastify.post(
    '/orders/manual',
    { preValidation: [fastify.authenticateSuperAdmin] },
    async (request, reply) => {
      const body = ManualOrderSchema.parse(request.body);
      const {
        productId,
        sellingPrice,
        buyerName,
        buyerPhone,
        buyerEmail,
        shippingAddress,
        city,
        state,
        zipCode,
        paymentMethod,
        soldAt,
        notes,
      } = body;

      // If buyer provided a real email, try to find an existing user account.
      // Walk-in / cash-sale buyers do NOT get a User record created.
      let buyerUser = null;
      if (buyerEmail) {
        buyerUser = await prisma.user.findFirst({
          where: { email: buyerEmail },
        });
      }

      // Validate product exists and is in correct state
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      // Allow: Approved products (normal punch) OR Sold products without order items (backfill)
      if (product.status !== 'Approved' && product.status !== 'Sold') {
        return reply.status(422).send({
          error: `Product must be Approved or Sold to create a manual order. Current status: ${product.status}`,
        });
      }

      // If already Sold, check it doesn't already have order items
      if (product.status === 'Sold') {
        const existingItems = await prisma.orderItem.findFirst({
          where: { productId: product.id },
        });
        if (existingItems) {
          return reply.status(422).send({
            error: 'This product already has an associated order. Cannot create a duplicate.',
          });
        }
      }

      const isBackfill = product.status === 'Sold';
      const commPct = product.commissionPercent ?? 10;
      const platformFee = Math.round(((sellingPrice * commPct) / 100) * 100) / 100;

      let order;
      try {
        order = await prisma.$transaction(async (tx) => {
          // Atomically claim the product BEFORE writing the order, mirroring the
          // checkout path. The guarded updateMany only flips Approved -> Sold; a count
          // of 0 means another punch (or a paid checkout) claimed it since we read it,
          // so this one-of-a-kind item can never be sold twice.
          if (!isBackfill) {
            const claim = await tx.product.updateMany({
              where: { id: productId, status: 'Approved' },
              data: { status: 'Sold' },
            });
            if (claim.count !== 1) {
              throw new ManualOrderError(
                422,
                'This product was just sold by another order. Refresh and try again.',
              );
            }
          } else {
            // Backfill path has no status transition to guard on, so re-check inside the
            // transaction that nothing attached an order while we were validating.
            const existingItem = await tx.orderItem.findFirst({ where: { productId } });
            if (existingItem) {
              throw new ManualOrderError(
                422,
                'This product already has an associated order. Cannot create a duplicate.',
              );
            }
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

          // Create the order. Backfilled sales carry their real sale date so revenue
          // reporting lands in the period the sale actually happened.
          const newOrder = await tx.order.create({
            data: {
              userId: buyerUser?.id || null,
              buyerName,
              buyerPhone,
              displayId,
              status: 'Delivered',
              totalAmount: sellingPrice,
              shippingAddress,
              city,
              state,
              zipCode,
              phone: buyerPhone,
              paymentStatus: 'Paid',
              paymentMethod: paymentMethod === 'cash' ? 'cod' : paymentMethod,
              isManual: true,
              ...(soldAt ? { createdAt: new Date(soldAt) } : {}),
              items: {
                create: [
                  {
                    productId: product.id,
                    quantity: 1,
                    price: sellingPrice,
                    commissionPercent: commPct,
                    platformFee,
                  },
                ],
              },
            },
            include: { items: true },
          });

          // Remove from all carts and wishlists
          await tx.cartItem.deleteMany({ where: { productId } });
          await tx.wishlistItem.deleteMany({ where: { productId } });

          // Create notification for buyer (only if they have a user account)
          if (buyerUser) {
            await tx.notification.create({
              data: {
                userId: buyerUser.id,
                title: 'Order Confirmed',
                message: `Your order #${displayId} has been confirmed and delivered. Thank you for your purchase.`,
              },
            });
          }

          return newOrder;
        });
      } catch (err) {
        if (err instanceof ManualOrderError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }

      if (!isBackfill) {
        syncProductToMetaAsync({ ...product, status: 'Sold' });
        syncProductToGoogleAsync({ ...product, status: 'Sold' });
      }

      // Audit log. `notes` has no column on Order, so it is only recorded here.
      request.log.info(
        {
          orderId: order.id,
          displayId: order.displayId,
          productId,
          adminId: request.dbUser.id,
          paymentMethod,
          sellingPrice,
          soldAt: order.createdAt.toISOString(),
          notes: notes || undefined,
        },
        'Manual order created by admin',
      );

      return {
        success: true,
        order,
        message: `Order ${order.displayId} created successfully`,
      };
    },
  );

  // Update order status
  fastify.patch(
    '/orders/:id/status',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { status } = request.body;

      const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({ error: 'Invalid order status' });
      }

      const existing = await prisma.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      // Forward-only status machine; terminal states (Delivered/Cancelled) are final.
      const allowedTransitions = {
        Pending: ['Processing', 'Cancelled'],
        Processing: ['Shipped', 'Delivered', 'Cancelled'],
        Shipped: ['Delivered', 'Cancelled'],
        Delivered: [],
        Cancelled: [],
      };
      if (status !== existing.status && !allowedTransitions[existing.status].includes(status)) {
        return reply
          .status(422)
          .send({ error: `Cannot change order from ${existing.status} to ${status}` });
      }

      const extraData = {};

      if (status === 'Cancelled' && existing.status !== 'Cancelled') {
        // Return each one-of-a-kind item to the sellable pool.
        const productIds = existing.items.map((i) => i.productId);
        if (productIds.length > 0) {
          await prisma.product.updateMany({
            where: { id: { in: productIds }, status: 'Sold' },
            data: { status: 'Approved' },
          });
          const restockedProducts = await prisma.product.findMany({
            where: { id: { in: productIds }, status: 'Approved' },
          });
          restockedProducts.forEach((p) => {
            syncProductToMetaAsync(p);
            syncProductToGoogleAsync(p);
          });
        }
        // No gateway is left to call — mark it Refunded as ledger truth and
        // let ops refund the buyer manually (UPI/bank transfer) outside the
        // system. Applies to historical 'online' orders paid before Razorpay
        // was removed; cod/whatsapp orders are never Paid before delivery, so
        // there is nothing to refund on cancellation.
        if (existing.paymentStatus === 'Paid') {
          extraData.paymentStatus = 'Refunded';
        }
      }

      if (
        status === 'Delivered' &&
        ['cod', 'whatsapp'].includes(existing.paymentMethod) &&
        existing.paymentStatus !== 'Paid'
      ) {
        // COD is collected on delivery; a WhatsApp order may not have been
        // marked paid yet either (see /orders/:id/mark-paid) — either way,
        // Delivered is the last safe point to make sure it's Paid so vendor
        // payouts include it.
        extraData.paymentStatus = 'Paid';
      }

      const updatedOrder = await prisma.order.update({
        where: { id },
        data: { status, ...extraData },
      });

      // Notify the buyer of status change
      const statusMessages = {
        Processing: 'Your order is being processed and will be shipped soon.',
        Shipped: 'Your order has been shipped! Track it in your account.',
        Delivered: 'Your order has been delivered. Thank you for your acquisition.',
        Cancelled: 'Your order has been cancelled. Contact support if you have questions.',
      };
      if (statusMessages[status]) {
        await prisma.notification.create({
          data: {
            userId: updatedOrder.userId,
            title: `Order ${status}`,
            message: statusMessages[status],
          },
        });
      }

      return { message: `Order marked as ${status}`, order: updatedOrder };
    },
  );

  // Ship order (with tracking ID)
  fastify.patch(
    '/orders/:id/ship',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { trackingID } = request.body;

      if (!trackingID) {
        return reply.status(400).send({ error: 'Tracking ID is required for shipping' });
      }

      const existing = await prisma.order.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Order not found' });
      }
      if (existing.status === 'Pending') {
        return reply.status(422).send({ error: 'Cannot ship: order payment is not confirmed' });
      }
      if (['Cancelled', 'Delivered'].includes(existing.status)) {
        return reply
          .status(422)
          .send({ error: `Cannot ship a ${existing.status.toLowerCase()} order` });
      }

      const updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          status: 'Shipped',
          trackingID,
        },
      });

      // Notify buyer with tracking ID
      await prisma.notification.create({
        data: {
          userId: updatedOrder.userId,
          title: 'Your Order Has Shipped 📦',
          message: `Your order is on its way! Tracking ID: ${trackingID}. Track at ${process.env.TRACKING_URL || 'https://www.delhivery.com'}.`,
        },
      });

      return { message: 'Order shipped successfully', order: updatedOrder };
    },
  );

  // Mark a WhatsApp-handoff order's payment as received. There is no gateway
  // or webhook behind this method, and payment is typically collected before
  // dispatch (not on delivery like COD) — so this is the only way an admin
  // can move it to Paid ahead of the Delivered auto-mark above.
  fastify.patch(
    '/orders/:id/mark-paid',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await prisma.order.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Order not found' });
      }
      if (existing.paymentMethod !== 'whatsapp') {
        return reply
          .status(422)
          .send({ error: 'Only WhatsApp orders can be marked paid this way' });
      }
      if (existing.paymentStatus === 'Paid') {
        return reply.status(422).send({ error: 'Order is already marked paid' });
      }

      const updatedOrder = await prisma.order.update({
        where: { id },
        data: { paymentStatus: 'Paid' },
      });

      return { message: 'Order marked as paid', order: updatedOrder };
    },
  );

  // ============== PAYOUT MANAGEMENT ==============

  // Auto-create payouts for delivered items (7+ days after delivery)
  fastify.post(
    '/payouts/auto-create',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const adminUser = request.dbUser;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Find delivered orders older than 7 days that still have un-paid-out items.
      // Idempotency is per OrderItem (paidOut flag), NOT a time window — so an order
      // can never be paid out twice no matter how much time passes.
      const deliveredOrders = await prisma.order.findMany({
        where: {
          status: 'Delivered',
          updatedAt: { lte: sevenDaysAgo },
          paymentStatus: 'Paid',
          items: { some: { paidOut: false } },
        },
        include: {
          items: {
            where: { paidOut: false },
            include: { product: { select: { sellerId: true } } },
          },
        },
      });

      // Group not-yet-paid items by vendor
      const vendorItems = {};
      for (const order of deliveredOrders) {
        for (const item of order.items) {
          const sellerId = item.product.sellerId;
          if (!vendorItems[sellerId]) vendorItems[sellerId] = [];
          vendorItems[sellerId].push(item);
        }
      }

      const created = [];
      const skipped = [];

      for (const [sellerId, items] of Object.entries(vendorItems)) {
        const vendor = await prisma.vendor.findUnique({ where: { userId: sellerId } });
        if (!vendor) {
          skipped.push({ sellerId, reason: 'No vendor profile' });
          continue;
        }

        // Pay the vendor NET of the platform commission already recorded per item
        // (platformFee is stored per-unit at checkout). Paying gross price*quantity
        // would overpay vendors by the full commission (10-25%).
        const totalAmount = items.reduce(
          (sum, item) => sum + (item.price - (item.platformFee || 0)) * item.quantity,
          0,
        );
        if (totalAmount <= 0) {
          skipped.push({ sellerId, reason: 'Zero amount' });
          continue;
        }

        const itemIds = items.map((i) => i.id);
        // Create the payout and stamp its items paidOut in one transaction so the
        // same items can't be swept into a second payout by a concurrent run.
        const payout = await prisma.$transaction(async (tx) => {
          const p = await tx.payout.create({
            data: {
              vendorId: vendor.id,
              amount: totalAmount,
              status: 'PENDING',
              periodStart: sevenDaysAgo,
              periodEnd: new Date(),
              note: `Auto-created from ${items.length} delivered item(s), 7+ days post-delivery`,
            },
          });
          await tx.orderItem.updateMany({
            where: { id: { in: itemIds } },
            data: { paidOut: true, payoutId: p.id },
          });
          return p;
        });

        await prisma.notification.create({
          data: {
            userId: sellerId,
            title: 'Payout Ready',
            message: `A payout of ₹${totalAmount.toLocaleString('en-IN')} has been created for your delivered items and is pending admin release.`,
          },
        });

        await prisma.auditLog.create({
          data: {
            adminId: adminUser?.id || 'SYSTEM',
            action: 'AUTO_CREATE_PAYOUT',
            targetType: 'Payout',
            targetId: payout.id,
            details: `Auto-created payout of ${totalAmount} for vendor ${vendor.id} (${items.length} items)`,
          },
        });

        created.push({
          vendorId: vendor.id,
          amount: totalAmount,
          payoutId: payout.id,
          items: items.length,
        });
      }

      return {
        message: `Auto-created ${created.length} payout(s), skipped ${skipped.length}`,
        created,
        skipped,
      };
    },
  );

  // Create a payout for a vendor
  fastify.post(
    '/payouts',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { vendorId, amount, periodStart, periodEnd, note } = CreatePayoutSchema.parse(
        request.body,
      );
      const adminUser = request.dbUser;

      const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
      if (!vendor) {
        return reply.status(404).send({ error: 'Vendor not found' });
      }

      const payout = await prisma.payout.create({
        data: {
          vendorId,
          amount: parseFloat(amount),
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          note: note || null,
        },
      });

      await prisma.auditLog.create({
        data: {
          adminId: adminUser?.id || 'SYSTEM',
          action: 'CREATE_PAYOUT',
          targetType: 'Payout',
          targetId: payout.id,
          details: `Created payout of ${amount} for vendor ${vendorId}`,
        },
      });

      await prisma.notification.create({
        data: {
          userId: vendor.userId,
          title: 'New Payout Created',
          message: `A payout of ₹${parseFloat(amount).toLocaleString('en-IN')} has been created for ${new Date(periodStart).toLocaleDateString()} — ${new Date(periodEnd).toLocaleDateString()}.`,
        },
      });

      return { message: 'Payout created successfully', payout };
    },
  );

  // Update payout status
  fastify.patch(
    '/payouts/:id/status',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { status } = UpdatePayoutStatusSchema.parse(request.body);
      const adminUser = request.dbUser;

      // A payout is money. The UI treats PAID and FAILED as final, but the API
      // accepted any status from any other, including walking PAID back to
      // PENDING - which would re-queue an already-disbursed payout and notify
      // the vendor a second time. FAILED is recoverable on purpose: a transfer
      // that bounced should be retryable without creating a duplicate record.
      const ALLOWED_PAYOUT_TRANSITIONS = {
        PENDING: ['PROCESSING', 'PAID', 'FAILED'],
        PROCESSING: ['PAID', 'FAILED'],
        PAID: [],
        FAILED: ['PENDING', 'PROCESSING'],
      };

      const existing = await prisma.payout.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Payout not found' });
      }

      if (existing.status !== status) {
        const allowed = ALLOWED_PAYOUT_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(status)) {
          return reply.status(409).send({
            error:
              existing.status === 'PAID'
                ? 'This payout is already marked paid and cannot be changed. Create a new payout instead.'
                : `Cannot change payout from ${existing.status} to ${status}.`,
          });
        }
      }

      const data = { status };
      // Stamp paidAt only on the transition into PAID, so re-saving PAID does
      // not keep moving the disbursement date forward.
      if (status === 'PAID' && !existing.paidAt) {
        data.paidAt = new Date();
      }

      const payout = await prisma.payout.update({
        where: { id },
        data,
        include: { vendor: true },
      });

      await prisma.auditLog.create({
        data: {
          adminId: adminUser?.id || 'SYSTEM',
          action: 'UPDATE_PAYOUT_STATUS',
          targetType: 'Payout',
          targetId: payout.id,
          details: `Updated payout ${id} status to ${status}`,
        },
      });

      const statusMessages = {
        PROCESSING: 'Your payout is now being processed.',
        PAID: `Your payout of ₹${payout.amount.toLocaleString('en-IN')} has been paid.`,
        FAILED: 'Your payout has failed. Please contact support.',
      };
      if (statusMessages[status]) {
        await prisma.notification.create({
          data: {
            userId: payout.vendor.userId,
            title: `Payout ${status}`,
            message: statusMessages[status],
          },
        });
      }

      return { message: 'Payout status updated', payout };
    },
  );

  // List all payouts
  fastify.get(
    '/payouts',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { status, vendorId, page = 1, limit = 20 } = request.query;

      const where = {};
      if (status) where.status = status;
      if (vendorId) where.vendorId = vendorId;

      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const [payouts, total] = await Promise.all([
        prisma.payout.findMany({
          where,
          include: { vendor: { include: { user: { select: { name: true, email: true } } } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit, 10),
        }),
        prisma.payout.count({ where }),
      ]);

      return {
        payouts,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / parseInt(limit, 10)),
        },
      };
    },
  );

  // Get TCE Store products (listed by super admin)
  fastify.get(
    '/products/tce-store',
    { preValidation: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const products = await prisma.product.findMany({
        where: { seller: { role: 'admin' } },
        include: { seller: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return { products };
    },
  );

  // Create product as TCE (super admin) — auto-verified, auto-published
  fastify.post(
    '/products',
    { preValidation: [fastify.authenticateSuperAdmin] },
    async (request, reply) => {
      const { title, category, description, condition, price, image, images, keywords, brand } =
        request.body;
      if (!title || !category || !description || !condition || !price) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }
      if (!CATEGORIES.includes(category)) {
        return reply
          .status(400)
          .send({ error: `Invalid category. Must be one of: ${CATEGORIES.join(', ')}` });
      }
      const product = await prisma.product.create({
        data: {
          title,
          category,
          description,
          condition,
          price: parseFloat(price),
          image: image || '',
          images: images || [],
          keywords: keywords || [],
          brand: brand || null,
          sellerId: request.dbUser.id,
          status: 'Approved',
          isPublished: true,
          isVerified: true,
          authenticityStatus: 'Verified',
        },
      });
      return product;
    },
  );
}
