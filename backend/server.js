import Fastify from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import dotenv from 'dotenv';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import rbacPlugin from './plugins/rbac.js';
import productRoutes from './routes/products.js';
import galleryRoutes from './routes/gallery.js';
import cartRoutes from './routes/cart.js';
import wishlistRoutes from './routes/wishlist.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import adminKycRoutes from './routes/adminKyc.js';
import vendorRoutes from './routes/vendor.js';
import checkoutRoutes from './routes/checkout.js';
import auctionRoutes from './routes/auction.js';
import analyticsRoutes from './routes/analytics.js';
import contactRoutes from './routes/contact.js';
import testimonialRoutes from './routes/testimonials.js';
import blogRoutes from './routes/blog.js';
import blogAiRoutes from './routes/blog-ai.js';
import googleMerchantRoutes from './routes/googleMerchant.js';
import metaCatalogRoutes from './routes/metaCatalog.js';
import couponRoutes from './routes/coupon.js';
import reviewRoutes from './routes/reviews.js';
import qrRoutes from './routes/qr.js';
import qrAdminRoutes from './routes/qrAdmin.js';
import comparisonPlatformsRoutes from './routes/comparisonPlatforms.js';
import adminComparisonPlatformsRoutes from './routes/adminComparisonPlatforms.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL environment variable');
  process.exit(1);
}

// Same behaviour as `logger: true` (pino at default level/transport), plus a
// redaction guardrail. Fastify does not log headers or bodies by default, so
// nothing leaks today - this exists so that turning on request/response body
// logging (or a route logging `request.body` explicitly) cannot quietly start
// writing bearer tokens, cookies or KYC/PII into CloudWatch.
const fastify = Fastify({
  logger: {
    redact: {
      paths: [
        // Credentials
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'headers.authorization',
        'headers.cookie',
        // PII / secrets that could appear in a logged body or error payload
        'password',
        '*.password',
        '*.*.password',
        'aadhaar',
        '*.aadhaar',
        '*.*.aadhaar',
        'pan',
        '*.pan',
        '*.*.pan',
        'phone',
        '*.phone',
        '*.*.phone',
        'email',
        '*.email',
        '*.*.email',
        'kycData',
        '*.kycData',
        '*.*.kycData',
      ],
      censor: '[REDACTED]',
    },
  },
});

// Register Security & Utility Plugins
fastify.register(helmet, {
  contentSecurityPolicy: false, // Disables CSP if serving static files, customize as needed
});
fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});
fastify.register(cors, {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5176',
    'https://thecollectorsexchange.in',
    'https://tce-admin.pages.dev',
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
});

// Zod Error Handler
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: 'Request validation failed',
      issues: error.issues,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    request.log.error(
      { prismaCode: error.code, prismaMeta: error.meta },
      'Prisma known request error',
    );
    return reply
      .status(409)
      .send({ error: 'Database Error', message: 'A database error occurred. Please try again.' });
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    request.log.error({ prismaMessage: error.message }, 'Prisma validation error');
    return reply
      .status(400)
      .send({ error: 'Database Validation Error', message: 'Invalid data provided.' });
  }

  // Default handler for other errors
  request.log.error({ err: error.message, stack: error.stack }, 'Unhandled error');
  reply.status(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
  });
});

// Core Dependencies & Auth Plugins
fastify.register(prismaPlugin);
fastify.register(authPlugin);
fastify.register(rbacPlugin);

// Register Routes
fastify.register(productRoutes, { prefix: '/api/products' });
fastify.register(galleryRoutes, { prefix: '/api/gallery' });
fastify.register(cartRoutes, { prefix: '/api/cart' });
fastify.register(wishlistRoutes, { prefix: '/api/wishlist' });
fastify.register(userRoutes, { prefix: '/api/users' });
fastify.register(adminRoutes, { prefix: '/api/admin' });
fastify.register(adminKycRoutes, { prefix: '/api/admin' });
fastify.register(vendorRoutes, { prefix: '/api/vendor' });
fastify.register(checkoutRoutes, { prefix: '/api/checkout' });
fastify.register(auctionRoutes, { prefix: '/api/auctions' });
fastify.register(analyticsRoutes, { prefix: '/api/analytics' });
fastify.register(contactRoutes, { prefix: '/api/contact' });
fastify.register(testimonialRoutes, { prefix: '/api/testimonials' });
fastify.register(blogRoutes, { prefix: '/api/blog' });
fastify.register(blogAiRoutes, { prefix: '/api/blog/ai' });
fastify.register(googleMerchantRoutes, { prefix: '/api' });
fastify.register(metaCatalogRoutes, { prefix: '/api' });
fastify.register(couponRoutes, { prefix: '/api' });
fastify.register(reviewRoutes, { prefix: '/api/reviews' });
fastify.register(qrRoutes, { prefix: '/api/qr' });
fastify.register(qrAdminRoutes, { prefix: '/api/admin/qr' });
fastify.register(comparisonPlatformsRoutes, { prefix: '/api/comparison-platforms' });
fastify.register(adminComparisonPlatformsRoutes, { prefix: '/api/admin/comparison-platforms' });

fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Export for Lambda adapter; start() runs only in standalone mode (local dev / Render)
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

if (!isLambda) {
  const start = async () => {
    try {
      const port = process.env.PORT || 3000;
      await fastify.listen({ port, host: '0.0.0.0' });
      fastify.log.info(`Server listening on port ${port}`);
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  };
  start();
}

export default fastify;
