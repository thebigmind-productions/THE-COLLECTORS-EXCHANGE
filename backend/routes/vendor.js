import {
  orderTotalFromItems,
  payoutFromItems,
  platformFeeFromItems,
  toRupees,
  toPaise,
} from '../lib/money.js';
import { PayoutDetailsSchema, maskUpiId } from '../schemas/vendor.js';

/**
 * Every Vendor scalar that existed BEFORE the payout-UPI migration.
 *
 * Used only by the fallback path in `findVendor()` below — see the long comment
 * there for why this list has to be spelled out rather than left to Prisma.
 */
const VENDOR_COLUMNS_PRE_PAYOUT_MIGRATION = {
  id: true,
  userId: true,
  type: true,
  status: true,
  maxListings: true,
  companyName: true,
  gst: true,
  founderName: true,
  aadhaar: true,
  pan: true,
  aadhaarDoc: true,
  panDoc: true,
  gstDoc: true,
  incorporationDoc: true,
  agreementAccepted: true,
  agreementSignedAt: true,
  agreementSignedByName: true,
  signedAgreementDoc: true,
  pickupAddress: true,
  pickupCity: true,
  pickupState: true,
  pickupZip: true,
  pickupContactName: true,
  pickupPhone: true,
  pickupVerified: true,
  pickupVerifiedAt: true,
  pickupVerifiedBy: true,
  rating: true,
  ratingCount: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Does this error mean the payout-UPI columns are not in the database yet?
 *
 * Prisma raises P2022 for Postgres 42703 (undefined_column) and puts the column
 * in `meta.column`. The message check is a belt-and-braces fallback for driver
 * versions that surface it differently.
 */
function isMissingPayoutColumnError(err) {
  if (!err) return false;
  const column = String(err?.meta?.column ?? '');
  if (err.code === 'P2022') return column === '' || column.includes('payoutUpi');
  return String(err.message ?? '').includes('payoutUpi');
}

/**
 * Vendor Routes
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function vendorRoutes(fastify) {
  const { prisma } = fastify;

  // ── Deploying ahead of the migration ──────────────────────────────────────
  // `Vendor.payoutUpi / payoutUpiName / payoutUpiUpdatedAt` are in
  // schema.prisma and in docs/migrations/2026-09-04-payout-upi-and-outbox.sql,
  // but that migration is applied by hand by the owner and has NOT been run.
  //
  // That matters because the generated Prisma client names every scalar it
  // knows about in its SELECT list. A bare `vendor.findUnique()` against a
  // database without those three columns therefore fails outright with P2022 —
  // which would take down the vendor profile page, the stats card, the payout
  // list and the pickup-address form, none of which have anything to do with
  // payouts.
  //
  // So every vendor read goes through `findVendor()`. It tries the full row
  // once; if the columns are missing it flips this flag and from then on reads
  // an explicit pre-migration column list. One wasted query per process, after
  // which the whole dashboard works exactly as it did before — just with the
  // payout block reporting "not available yet" instead of a UPI. Once the
  // migration is applied the flag never flips and there is no cost at all.
  let payoutColumnsPresent = true;

  async function findVendor(where) {
    if (payoutColumnsPresent) {
      try {
        return await prisma.vendor.findUnique({ where });
      } catch (err) {
        if (!isMissingPayoutColumnError(err)) throw err;
        fastify.log?.warn?.(
          'Vendor.payoutUpi columns are absent — the payout-UPI migration has not been applied. Serving vendor reads without them.',
        );
        payoutColumnsPresent = false;
      }
    }
    return prisma.vendor.findUnique({
      where,
      select: VENDOR_COLUMNS_PRE_PAYOUT_MIGRATION,
    });
  }

  /**
   * The payout-destination view of a vendor row, safe to send to the client:
   * never the raw UPI ID, and explicit about the "column not there yet" case so
   * the UI can say so rather than silently claiming nothing is on file.
   */
  function payoutDetails(vendor) {
    if (!payoutColumnsPresent) {
      return {
        payoutUpiMasked: null,
        payoutUpiName: null,
        payoutUpiUpdatedAt: null,
        payoutDetailsAvailable: false,
      };
    }
    return {
      payoutUpiMasked: maskUpiId(vendor?.payoutUpi),
      payoutUpiName: vendor?.payoutUpiName ?? null,
      payoutUpiUpdatedAt: vendor?.payoutUpiUpdatedAt ?? null,
      payoutDetailsAvailable: true,
    };
  }

  /** Strip the raw UPI ID out of any vendor row before it leaves the server. */
  function withoutRawUpi(vendor) {
    if (!vendor) return vendor;
    /* eslint-disable-next-line no-unused-vars */
    const { payoutUpi, ...rest } = vendor;
    return rest;
  }

  // Get current logged-in user's vendor profile
  fastify.get('/profile', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const dbUser = request.dbUser;
    if (!dbUser) {
      return reply.status(401).send({ error: 'User profile not synchronized' });
    }

    const vendor = await findVendor({ userId: dbUser.id });

    if (!vendor) {
      return reply
        .status(404)
        .send({ error: 'Vendor profile not found. You must complete KYC first.' });
    }

    // Fetch active listing count. Must stay in step with the same filter in
    // products.js (create) — a Sold or Rejected listing no longer occupies a slot.
    const activeCount = await prisma.product.count({
      where: {
        sellerId: dbUser.id,
        status: { in: ['Pending', 'In_Review', 'Approved'] },
      },
    });

    // Which of this seller's Sold listings were self-marked offline rather than
    // bought through the Exchange (same rule as `getOfflineSold` below). The
    // seller UI needs the distinction so it never invites someone to "restore" a
    // listing that a paying buyer actually purchased.
    const offlineSold = await prisma.product.findMany({
      where: { sellerId: dbUser.id, status: 'Sold', orderItems: { none: {} } },
      select: { id: true },
    });

    return {
      ...withoutRawUpi(vendor),
      ...payoutDetails(vendor),
      activeCount,
      offlineSoldIds: offlineSold.map((p) => p.id),
    };
  });

  // Get vendor specific sales statistics
  fastify.get('/stats', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const dbUser = request.dbUser;
    if (!dbUser) {
      return reply.status(401).send({ error: 'User profile not synchronized' });
    }

    const vendor = await findVendor({ userId: dbUser.id });

    if (!vendor) {
      return reply.status(404).send({ error: 'Vendor profile not found' });
    }

    // Fetch all products sold by this seller
    const products = await prisma.product.findMany({
      where: { sellerId: dbUser.id },
      select: { id: true },
    });

    const productIds = products.map((p) => p.id);

    // Fetch order items matching this vendor's products & offline-sold products
    const [orderItems, offlineSold] = await Promise.all([
      prisma.orderItem.findMany({
        where: {
          productId: { in: productIds },
          order: { status: { not: 'Cancelled' } },
        },
        include: { order: true },
      }),
      getOfflineSold(prisma, dbUser.id, null),
    ]);

    // Calculate statistics including both online order items and unrecorded offline sales
    const offlineRevenue = toRupees(offlineSold.reduce((sum, p) => sum + toPaise(p.price), 0));
    const offlineCount = offlineSold.length;

    const orderSales = orderTotalFromItems(orderItems);
    const totalSales = toRupees(toPaise(orderSales) + toPaise(offlineRevenue));
    const totalPlatformFees = platformFeeFromItems(orderItems);
    const totalItemsSold = orderItems.reduce((acc, item) => acc + item.quantity, 0) + offlineCount;
    const uniqueOrders = new Set(orderItems.map((item) => item.orderId)).size + offlineCount;

    return {
      totalSales,
      totalPlatformFees,
      netEarnings: payoutFromItems(orderItems),
      totalItemsSold,
      uniqueOrders,
      offlineSaleCount: offlineCount,
      offlineRevenue,
    };
  });

  // Helper: compute date filter from period string
  function getPeriodFilter(period) {
    const now = new Date();
    switch (period) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '10d':
        return new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      case '15d':
        return new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'quarterly':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '6m':
        return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }

  // Helper: get offline-sold products (marked Sold by admin, no order items)
  async function getOfflineSold(prisma, sellerId, dateFilter) {
    const where = {
      sellerId,
      status: 'Sold',
      orderItems: { none: {} },
    };
    if (dateFilter) where.updatedAt = { gte: dateFilter };
    return prisma.product.findMany({ where });
  }

  // Get vendor analytics overview
  fastify.get(
    '/analytics/overview',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const dbUser = request.dbUser;
      const { period = '30d' } = request.query;
      const dateFilter = getPeriodFilter(period);

      const vendor = await findVendor({ userId: dbUser.id });
      if (!vendor) return reply.status(404).send({ error: 'Vendor profile not found' });

      const productIds = (
        await prisma.product.findMany({
          where: { sellerId: dbUser.id },
          select: { id: true },
        })
      ).map((p) => p.id);

      const orderWhere = {
        productId: { in: productIds },
        ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
      };

      const [orderItems, offlineSold] = await Promise.all([
        prisma.orderItem.findMany({
          where: {
            ...orderWhere,
            order: { status: { not: 'Cancelled' } },
          },
          include: { order: true },
        }),
        getOfflineSold(prisma, dbUser.id, dateFilter),
      ]);

      // Same rule as /stats: every figure comes off the item rows, and netEarnings
      // is the payout formula itself — never `revenue - fees`.
      const orderRevenue = orderTotalFromItems(orderItems);
      const orderPlatformFees = platformFeeFromItems(orderItems);
      const orderNetEarnings = payoutFromItems(orderItems);
      const orderItemsSold = orderItems.reduce((acc, item) => acc + item.quantity, 0);
      const uniqueOrders = new Set(orderItems.map((item) => item.orderId)).size;

      const paidItems = orderItems.filter((item) => item.order.paymentStatus === 'Paid');
      const paidRevenue = orderTotalFromItems(paidItems);
      const paidPlatformFees = platformFeeFromItems(paidItems);

      const offlineRevenue = toRupees(offlineSold.reduce((sum, p) => sum + toPaise(p.price), 0));
      const offlineCount = offlineSold.length;

      const pendingPayouts = await prisma.payout.aggregate({
        where: { vendorId: vendor.id, status: { in: ['PENDING', 'PROCESSING'] } },
        _sum: { amount: true },
      });

      const totalListings = await prisma.product.count({ where: { sellerId: dbUser.id } });
      const activeListings = await prisma.product.count({
        where: { sellerId: dbUser.id, status: 'Approved', isPublished: true },
      });

      return {
        orderCount: uniqueOrders + offlineCount,
        saleCount: orderItemsSold + offlineCount,
        totalRevenue: toRupees(toPaise(orderRevenue) + toPaise(offlineRevenue)),
        totalPlatformFees: orderPlatformFees,
        netEarnings: orderNetEarnings,
        paidRevenue: toRupees(toPaise(paidRevenue) + toPaise(offlineRevenue)),
        paidPlatformFees,
        pendingPayout: pendingPayouts._sum.amount || 0,
        totalListings,
        activeListings,
        offlineSaleCount: offlineCount,
        offlineRevenue,
      };
    },
  );

  // Get customer interest funnel
  fastify.get(
    '/analytics/interest',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const dbUser = request.dbUser;
      const { period = '30d' } = request.query;
      const dateFilter = getPeriodFilter(period);

      const productIds = (
        await prisma.product.findMany({
          where: { sellerId: dbUser.id },
          select: { id: true },
        })
      ).map((p) => p.id);

      const eventWhere = {
        productId: { in: productIds },
        ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
      };

      const [totalViews, uniqueViewers, cartAdds, checkoutStarts] = await Promise.all([
        prisma.productView.count({ where: eventWhere }),
        prisma.productView
          .groupBy({
            by: ['sessionId'],
            where: { ...eventWhere, sessionId: { not: null } },
            _count: true,
          })
          .then((r) => r.length),
        prisma.cartEvent.count({ where: { ...eventWhere, action: 'ADD' } }),
        prisma.checkoutEvent.count({ where: eventWhere }),
      ]);

      return { totalViews, uniqueViewers, cartAdds, checkoutStarts };
    },
  );

  // Get sales graph data (time-series grouped by day)
  fastify.get(
    '/analytics/sales-graph',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const dbUser = request.dbUser;
      const { period = '30d' } = request.query;
      const dateFilter = getPeriodFilter(period);

      const productIds = (
        await prisma.product.findMany({
          where: { sellerId: dbUser.id },
          select: { id: true },
        })
      ).map((p) => p.id);

      const [orderItems, offlineSold] = await Promise.all([
        prisma.orderItem.findMany({
          where: {
            productId: { in: productIds },
            ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
            order: { status: { not: 'Cancelled' } },
          },
          include: { order: true },
          orderBy: { createdAt: 'asc' },
        }),
        getOfflineSold(prisma, dbUser.id, dateFilter),
      ]);

      const useMonthly = !period || period === 'all' || period === '1y' || period === '6m';
      const groupMap = new Map();
      for (const item of orderItems) {
        const key = useMonthly
          ? item.createdAt.toISOString().slice(0, 7) // YYYY-MM
          : item.createdAt.toISOString().split('T')[0]; // day
        if (!groupMap.has(key)) {
          groupMap.set(key, { date: key, sales: 0, orders: new Set(), items: 0 });
        }
        const entry = groupMap.get(key);
        entry.sales += item.price * item.quantity;
        entry.orders.add(item.orderId);
        entry.items += item.quantity;
      }

      // Add offline-sold products to graph
      for (const product of offlineSold) {
        const key = useMonthly
          ? product.updatedAt.toISOString().slice(0, 7)
          : product.updatedAt.toISOString().split('T')[0];
        if (!groupMap.has(key)) {
          groupMap.set(key, { date: key, sales: 0, orders: new Set(), items: 0 });
        }
        const entry = groupMap.get(key);
        entry.sales += product.price;
        entry.orders.add(`offline-${product.id}`);
        entry.items += 1;
      }

      const graphData = Array.from(groupMap.values()).map((d) => ({
        date: d.date,
        sales: d.sales,
        orders: d.orders.size,
        items: d.items,
      }));

      return graphData;
    },
  );

  // Get top-selling products
  fastify.get(
    '/analytics/top-products',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const dbUser = request.dbUser;
      const { period = '30d', limit = 10 } = request.query;
      const dateFilter = getPeriodFilter(period);

      const productIds = (
        await prisma.product.findMany({
          where: { sellerId: dbUser.id },
          select: { id: true },
        })
      ).map((p) => p.id);

      const [orderItems, offlineSold] = await Promise.all([
        prisma.orderItem.findMany({
          where: {
            productId: { in: productIds },
            ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
            order: { status: { not: 'Cancelled' } },
          },
          include: { product: true },
        }),
        getOfflineSold(prisma, dbUser.id, dateFilter),
      ]);

      const productMap = new Map();
      for (const item of orderItems) {
        if (!productMap.has(item.productId)) {
          productMap.set(item.productId, {
            id: item.productId,
            title: item.product.title,
            image: item.product.image,
            price: item.product.price,
            totalRevenue: 0,
            quantitySold: 0,
            orderCount: new Set(),
          });
        }
        const entry = productMap.get(item.productId);
        entry.totalRevenue += item.price * item.quantity;
        entry.quantitySold += item.quantity;
        entry.orderCount.add(item.orderId);
      }

      // Add offline-sold products
      for (const product of offlineSold) {
        if (!productMap.has(product.id)) {
          productMap.set(product.id, {
            id: product.id,
            title: product.title,
            image: product.image,
            price: product.price,
            totalRevenue: 0,
            quantitySold: 0,
            orderCount: new Set(),
          });
        }
        const entry = productMap.get(product.id);
        entry.totalRevenue += product.price;
        entry.quantitySold += 1;
        entry.orderCount.add(`offline-${product.id}`);
      }

      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, parseInt(limit, 10))
        .map((p) => ({ ...p, orderCount: p.orderCount.size }));

      return topProducts;
    },
  );

  // Get vendor payouts with filters
  fastify.get(
    '/payouts',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const dbUser = request.dbUser;
      const { status, from, to, page = 1, limit = 20 } = request.query;

      const vendor = await findVendor({ userId: dbUser.id });
      if (!vendor) return reply.status(404).send({ error: 'Vendor profile not found' });

      const where = { vendorId: vendor.id };
      if (status) where.status = status;
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to);
      }

      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const [payouts, total] = await Promise.all([
        prisma.payout.findMany({
          where,
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

  // Update vendor pickup address
  fastify.patch(
    '/pickup-address',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const dbUser = request.dbUser;
      const { pickupAddress, pickupCity, pickupState, pickupZip, pickupContactName, pickupPhone } =
        request.body || {};

      const vendor = await findVendor({ userId: dbUser.id });
      if (!vendor) return reply.status(404).send({ error: 'Vendor profile not found' });

      const updatedVendor = await prisma.vendor.update({
        where: { userId: dbUser.id },
        data: {
          ...(pickupAddress !== undefined && { pickupAddress }),
          ...(pickupCity !== undefined && { pickupCity }),
          ...(pickupState !== undefined && { pickupState }),
          ...(pickupZip !== undefined && { pickupZip }),
          ...(pickupContactName !== undefined && { pickupContactName }),
          ...(pickupPhone !== undefined && { pickupPhone }),
        },
        // Explicit select, not for privacy but for deployability: an unqualified
        // update RETURNs every scalar Prisma knows about, which would name the
        // payout-UPI columns and fail on a database that has not had the
        // migration applied. Nothing here needs them anyway.
        select: VENDOR_COLUMNS_PRE_PAYOUT_MIGRATION,
      });

      return { message: 'Pickup address updated', vendor: updatedVendor };
    },
  );

  // Update where the seller's payout money actually goes.
  //
  // Mirrors /pickup-address deliberately — same shape, same auth, same 404 —
  // because it answers the same class of question ("where does this physically
  // go?") and sits next to it in the dashboard.
  fastify.patch(
    '/payout-details',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const dbUser = request.dbUser;

      // Parsed by hand rather than with `.parse()`: the global ZodError handler
      // in server.js answers with a generic `error: 'Validation Error'`, and the
      // whole point of validating a UPI ID is to tell the seller *what* is wrong
      // with the one they typed.
      const parsed = PayoutDetailsSchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message || 'Invalid payout details' });
      }
      const { payoutUpi, payoutUpiName } = parsed.data;

      const vendor = await findVendor({ userId: dbUser.id });
      if (!vendor) return reply.status(404).send({ error: 'Vendor profile not found' });

      if (!payoutColumnsPresent) {
        return reply.status(503).send({
          error:
            'Payout details cannot be saved yet — this feature is waiting on a database update. Please try again later.',
        });
      }

      let updated;
      try {
        updated = await prisma.vendor.update({
          where: { userId: dbUser.id },
          data: {
            payoutUpi,
            payoutUpiName,
            payoutUpiUpdatedAt: new Date(),
          },
          select: {
            payoutUpi: true,
            payoutUpiName: true,
            payoutUpiUpdatedAt: true,
          },
        });
      } catch (err) {
        // findVendor() may never have been forced down the fallback path in this
        // process (a cached vendor read, a fresh Lambda), so the write is where
        // the missing columns first show up. Same answer, and flip the flag so
        // the profile route stops promising the feature is available.
        if (!isMissingPayoutColumnError(err)) throw err;
        payoutColumnsPresent = false;
        return reply.status(503).send({
          error:
            'Payout details cannot be saved yet — this feature is waiting on a database update. Please try again later.',
        });
      }

      // Only ever the masked value goes back over the wire.
      return {
        message: 'Payout details updated',
        payoutUpiMasked: maskUpiId(updated.payoutUpi),
        payoutUpiName: updated.payoutUpiName ?? null,
        payoutUpiUpdatedAt: updated.payoutUpiUpdatedAt ?? null,
        payoutDetailsAvailable: true,
      };
    },
  );

  // The order items that make up one payout, so a seller can check the sum.
  //
  // Payout.note says "Auto-created from N delivered item(s)" and the amount is a
  // single number; without this a seller has no way to tell *which* sales they
  // were just paid for, and no way to notice one is missing.
  fastify.get(
    '/payouts/:id/items',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const dbUser = request.dbUser;
      const { id } = request.params;

      const vendor = await findVendor({ userId: dbUser.id });
      if (!vendor) return reply.status(404).send({ error: 'Vendor profile not found' });

      const payout = await prisma.payout.findUnique({ where: { id } });
      // 404 rather than 403 for someone else's payout: a vendor should not be
      // able to probe which payout ids exist.
      if (!payout || payout.vendorId !== vendor.id) {
        return reply.status(404).send({ error: 'Payout not found' });
      }

      const items = await prisma.orderItem.findMany({
        // payoutId alone would be enough given the ownership check above; the
        // sellerId clause is defence in depth against a mis-assigned payoutId
        // ever surfacing another seller's sale here.
        where: { payoutId: id, product: { sellerId: dbUser.id } },
        include: {
          product: { select: { id: true, title: true, image: true } },
          order: { select: { displayId: true, status: true, createdAt: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        payout,
        items: items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price,
          platformFee: item.platformFee,
          // Exactly the arithmetic admin.js disburses on: (price - fee) * qty.
          payout: payoutFromItems([item]),
          status: item.status,
          createdAt: item.createdAt,
          product: item.product,
          order: item.order,
        })),
        totals: {
          itemCount: items.length,
          gross: orderTotalFromItems(items),
          platformFee: platformFeeFromItems(items),
          payout: payoutFromItems(items),
        },
      };
    },
  );

  // Rate a vendor (buyers after purchase, one rating per user)
  fastify.post(
    '/rate',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const dbUser = request.dbUser;
      const { vendorId, rating } = request.body;

      if (!vendorId || !rating || rating < 1 || rating > 5) {
        return reply.status(400).send({ error: 'Valid vendorId and rating (1-5) required' });
      }

      const vendor = await findVendor({ id: vendorId });
      if (!vendor) return reply.status(404).send({ error: 'Vendor not found' });

      // Check user purchased from this vendor
      const vendorProductIds = (
        await prisma.product.findMany({
          where: { sellerId: vendor.userId },
          select: { id: true },
        })
      ).map((p) => p.id);

      const purchasedItem = await prisma.orderItem.findFirst({
        where: {
          productId: { in: vendorProductIds },
          order: { userId: dbUser.id, paymentStatus: 'Paid', status: { not: 'Cancelled' } },
        },
      });
      if (!purchasedItem) {
        return reply
          .status(403)
          .send({ error: 'You must purchase from this vendor before rating' });
      }

      // Check for existing rating
      const existingRating = await prisma.rating.findUnique({
        where: { userId_vendorId: { userId: dbUser.id, vendorId } },
      });
      if (existingRating) {
        return reply.status(422).send({ error: 'You have already rated this vendor' });
      }

      await prisma.$transaction(async (tx) => {
        // Narrow select on purpose: this runs inside a transaction with `tx`, so
        // it cannot go through findVendor(), and reading the whole row would
        // name the payout-UPI columns in the SELECT list.
        const currentVendor = await tx.vendor.findUnique({
          where: { id: vendorId },
          select: { rating: true, ratingCount: true },
        });
        await tx.rating.create({
          data: { userId: dbUser.id, vendorId, rating },
        });
        const prevRating = currentVendor.rating * currentVendor.ratingCount;
        const newCount = currentVendor.ratingCount + 1;
        const newRating = (prevRating + rating) / newCount;
        await tx.vendor.update({
          where: { id: vendorId },
          data: { rating: newRating, ratingCount: newCount },
        });
      });

      return { message: 'Rating submitted' };
    },
  );

  // Get vendor's sold orders (orders containing vendor's products)
  fastify.get(
    '/orders',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const dbUser = request.dbUser;
      const productIds = (
        await prisma.product.findMany({
          where: { sellerId: dbUser.id },
          select: { id: true },
        })
      ).map((p) => p.id);

      const orderItems = await prisma.orderItem.findMany({
        where: { productId: { in: productIds } },
        include: {
          order: { include: { user: { select: { name: true } } } },
          product: { select: { id: true, title: true, image: true, price: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return orderItems;
    },
  );

  // Vendor marks order item as shipped with tracking ID
  fastify.patch(
    '/orders/:orderItemId/ship',
    { preValidation: [fastify.authenticate, fastify.requireDbUser] },
    async (request, reply) => {
      const { orderItemId } = request.params;
      const { trackingID } = request.body;
      const dbUser = request.dbUser;

      const orderItem = await prisma.orderItem.findUnique({
        where: { id: orderItemId },
        include: { product: true, order: { include: { items: true } } },
      });

      if (!orderItem) return reply.status(404).send({ error: 'Order item not found' });
      if (orderItem.product.sellerId !== dbUser.id)
        return reply.status(403).send({ error: 'Not your product' });
      if (orderItem.status === 'Shipped')
        return reply.status(422).send({ error: 'Already marked as shipped' });

      // The order must be a confirmed, non-terminal order. Blocks shipping an
      // unpaid/unconfirmed (Pending) order and reviving a Cancelled/Delivered one.
      if (orderItem.order.status === 'Pending') {
        return reply
          .status(422)
          .send({ error: 'Cannot ship: this order has not been paid/confirmed yet' });
      }
      if (['Cancelled', 'Delivered'].includes(orderItem.order.status)) {
        return reply
          .status(422)
          .send({ error: `Cannot ship a ${orderItem.order.status.toLowerCase()} order` });
      }

      // Update the individual order item status only
      await prisma.orderItem.update({
        where: { id: orderItemId },
        data: { status: 'Shipped', trackingID: trackingID || null },
      });

      // Roll the order up to Shipped only once every item is shipped AND the order
      // is still in Processing (re-checked so a concurrent cancel isn't overwritten).
      const allItems = await prisma.orderItem.findMany({
        where: { orderId: orderItem.orderId },
      });
      const allShipped = allItems.every((item) => item.status === 'Shipped');
      if (allShipped) {
        const freshOrder = await prisma.order.findUnique({
          where: { id: orderItem.orderId },
          select: { status: true },
        });
        if (freshOrder?.status === 'Processing') {
          await prisma.order.update({
            where: { id: orderItem.orderId },
            data: { status: 'Shipped' },
          });
        }
      }

      return { message: 'Marked as shipped', trackingID };
    },
  );
}
