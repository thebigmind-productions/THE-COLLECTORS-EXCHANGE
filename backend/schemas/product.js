import { z } from 'zod';

export const CATEGORIES = [
  'Timepieces',
  'Accessories',
  'Collectibles',
  'Antiques',
  'Toys & Pop Culture',
  'Jewelry',
];

// Matches the ListingCategory enum in prisma/schema.prisma
export const LISTING_CATEGORIES = ['normal', 'featured', 'most_rare'];

const SpecItemSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

// One entry per third-party marketplace (see ComparisonPlatform) where the
// same/similar item is also listed. `price` is optional — a link with no
// price still lets a shopper click through and compare for themselves.
const ComparisonItemSchema = z.object({
  platformId: z.string().min(1),
  url: z.string().url(),
  price: z.number().positive().optional(),
});

/**
 * Admin-only free-text values for admin-defined custom columns, keyed by
 * column id, e.g. { "col_abc123": "paid in cash" }.
 * Writable by admin/curator only — the product routes strip it from any
 * payload sent by a seller.
 */
export const AdminNotesSchema = z.record(z.string(), z.string());

export const ProductSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  category: z.enum(CATEGORIES),
  brand: z.string().nullable().optional(),
  // Curation tier — admin/curator controlled; the product routes force
  // 'normal' on seller-created listings.
  listingCategory: z.enum(LISTING_CATEGORIES).optional(),
  description: z.string().min(1),
  condition: z.string().min(1),
  price: z.number().positive(),
  quantity: z.number().int().min(1).optional().default(1),
  image: z.string().url(),
  images: z.array(z.string().url()).optional(),
  keywords: z.array(z.string()).optional(),
  specs: z.array(SpecItemSchema).optional().default([]),
  comparisons: z.array(ComparisonItemSchema).optional().default([]),
  isVerified: z.boolean().optional(),
  authenticityStatus: z.string().optional(),
  commissionPercent: z.number().min(10).max(25).optional().default(10),
  // Accepted for admin/curator updates only — stripped for sellers in routes/products.js
  adminNotes: AdminNotesSchema.optional(),
  sellerId: z.string(),
});

export const ProductIdParam = z.object({
  id: z.string(),
});

/**
 * Public catalogue sort keys mapped to the Prisma `orderBy` fragment each one
 * produces. This is a strict whitelist and the ONLY place a sort key becomes
 * a Prisma ordering — a value that is not a key here is ignored and the
 * catalogue falls back to its default ordering. User input is never
 * interpolated into a Prisma `orderBy`.
 */
export const PRODUCT_SORT_ORDER_BY = Object.freeze({
  newest: [{ createdAt: 'desc' }],
  price_asc: [{ price: 'asc' }, { createdAt: 'desc' }],
  price_desc: [{ price: 'desc' }, { createdAt: 'desc' }],
});

export const PRODUCT_SORT_OPTIONS = Object.freeze(Object.keys(PRODUCT_SORT_ORDER_BY));

/**
 * Resolve a caller-supplied sort key to its whitelisted `orderBy`.
 * @param {unknown} sort
 * @returns {Array<Record<string, 'asc' | 'desc'>> | null} null when the key is
 *   absent or not whitelisted, meaning "use the default ordering".
 */
export function resolveProductSort(sort) {
  if (typeof sort !== 'string') return null;
  // Object.hasOwn guards against inherited keys like "constructor".
  if (!Object.hasOwn(PRODUCT_SORT_ORDER_BY, sort)) return null;
  return PRODUCT_SORT_ORDER_BY[sort];
}

// Query-string prices arrive as strings; an absent or blank value means
// "no bound", anything else must be a real, finite, non-negative number.
const optionalPrice = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().finite().nonnegative().optional(),
);

export const PriceRangeSchema = z
  .object({
    minPrice: optionalPrice,
    maxPrice: optionalPrice,
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: 'minPrice must not be greater than maxPrice',
  });

/**
 * Split a free-text search string into normalised keyword tokens.
 *
 * `keywords` is a scalar string array, so Prisma can only do exact
 * element matching on it. `{ has: search }` (the previous behaviour) required
 * the shopper to type one whole keyword with exactly the stored casing, which
 * essentially never happened. Tokenising and including the lowercase form of
 * every token — plus the whole trimmed phrase — makes `hasSome` actually fire
 * for normally-typed input.
 * @param {string} search
 * @returns {string[]}
 */
export function searchKeywordTokens(search) {
  if (typeof search !== 'string') return [];
  const trimmed = search.trim();
  if (!trimmed) return [];
  const tokens = new Set();
  const add = (value) => {
    if (value) {
      tokens.add(value);
      tokens.add(value.toLowerCase());
    }
  };
  add(trimmed);
  trimmed
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .forEach(add);
  return [...tokens];
}

export const AdminProductUpdateSchema = z.object({
  brand: z.string().nullable().optional(),
  listingCategory: z.enum(LISTING_CATEGORIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  quantity: z.number().int().min(1).optional(),
  condition: z.string().min(1).optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  specs: z.array(SpecItemSchema).optional(),
  comparisons: z.array(ComparisonItemSchema).optional(),
  commissionPercent: z.number().min(10).max(25).optional(),
  // Admin-defined custom column values (admin routes are already admin-gated)
  adminNotes: AdminNotesSchema.optional(),
});
