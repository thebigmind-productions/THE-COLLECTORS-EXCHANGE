import { describe, it, expect } from 'vitest';
import {
  ProductSchema,
  ProductIdParam,
  AdminProductUpdateSchema,
  CATEGORIES,
  PRODUCT_SORT_OPTIONS,
  PriceRangeSchema,
  resolveProductSort,
  searchKeywordTokens,
} from '../../schemas/product.js';

describe('CATEGORIES', () => {
  it('contains expected categories', () => {
    expect(CATEGORIES).toContain('Timepieces');
    expect(CATEGORIES).toContain('Jewelry');
  });
});

describe('ProductSchema', () => {
  const valid = {
    title: 'Vintage Watch',
    category: 'Timepieces',
    description: 'A beautiful vintage watch',
    condition: 'Excellent',
    price: 15000,
    image: 'https://example.com/watch.jpg',
    sellerId: 'seller-123',
  };

  it('passes with valid minimal data', () => {
    expect(() => ProductSchema.parse(valid)).not.toThrow();
  });

  it('passes with all optional fields', () => {
    const data = {
      ...valid,
      id: 'prod-1',
      images: ['https://example.com/img2.jpg'],
      keywords: ['vintage', 'watch'],
      isVerified: true,
      authenticityStatus: 'Verified',
    };
    expect(() => ProductSchema.parse(data)).not.toThrow();
  });

  it('fails with empty title', () => {
    expect(() => ProductSchema.parse({ ...valid, title: '' })).toThrow();
  });

  it('fails with missing title', () => {
    const { title: _title, ...rest } = valid;
    expect(() => ProductSchema.parse(rest)).toThrow();
  });

  it('fails with invalid category', () => {
    expect(() => ProductSchema.parse({ ...valid, category: 'InvalidCategory' })).toThrow();
  });

  it('fails with empty description', () => {
    expect(() => ProductSchema.parse({ ...valid, description: '' })).toThrow();
  });

  it('fails with empty condition', () => {
    expect(() => ProductSchema.parse({ ...valid, condition: '' })).toThrow();
  });

  it('fails with negative price', () => {
    expect(() => ProductSchema.parse({ ...valid, price: -100 })).toThrow();
  });

  it('fails with zero price', () => {
    expect(() => ProductSchema.parse({ ...valid, price: 0 })).toThrow();
  });

  it('fails with invalid image URL', () => {
    expect(() => ProductSchema.parse({ ...valid, image: 'not-a-url' })).toThrow();
  });

  it('fails with invalid image in images array', () => {
    expect(() => ProductSchema.parse({ ...valid, images: ['not-a-url'] })).toThrow();
  });

  it('fails without sellerId', () => {
    const { sellerId: _sellerId, ...rest } = valid;
    expect(() => ProductSchema.parse(rest)).toThrow();
  });

  // ---- commissionPercent ----

  it('defaults commissionPercent to 10 when not provided', () => {
    const result = ProductSchema.parse(valid);
    expect(result.commissionPercent).toBe(10);
  });

  it('passes with commissionPercent = 10 (minimum)', () => {
    expect(() => ProductSchema.parse({ ...valid, commissionPercent: 10 })).not.toThrow();
  });

  it('passes with commissionPercent = 25 (maximum)', () => {
    expect(() => ProductSchema.parse({ ...valid, commissionPercent: 25 })).not.toThrow();
  });

  it('passes with commissionPercent = 18 (mid-range)', () => {
    expect(() => ProductSchema.parse({ ...valid, commissionPercent: 18 })).not.toThrow();
  });

  it('fails with commissionPercent below 10', () => {
    expect(() => ProductSchema.parse({ ...valid, commissionPercent: 5 })).toThrow();
  });

  it('fails with commissionPercent above 25', () => {
    expect(() => ProductSchema.parse({ ...valid, commissionPercent: 30 })).toThrow();
  });

  it('fails with commissionPercent as non-integer string', () => {
    expect(() => ProductSchema.parse({ ...valid, commissionPercent: '20' })).toThrow();
  });

  // ---- comparisons (competitor pricing) ----

  it('defaults comparisons to an empty array', () => {
    expect(ProductSchema.parse(valid).comparisons).toEqual([]);
  });

  it('passes with a valid comparison entry', () => {
    const result = ProductSchema.parse({
      ...valid,
      comparisons: [{ platformId: 'plat-1', url: 'https://ebay.com/item/1', price: 12000 }],
    });
    expect(result.comparisons).toEqual([
      { platformId: 'plat-1', url: 'https://ebay.com/item/1', price: 12000 },
    ]);
  });

  it('allows a comparison entry with no price', () => {
    expect(() =>
      ProductSchema.parse({
        ...valid,
        comparisons: [{ platformId: 'plat-1', url: 'https://ebay.com/item/1' }],
      }),
    ).not.toThrow();
  });

  it('fails with an invalid comparison URL', () => {
    expect(() =>
      ProductSchema.parse({
        ...valid,
        comparisons: [{ platformId: 'plat-1', url: 'not-a-url' }],
      }),
    ).toThrow();
  });

  it('fails with a comparison entry missing platformId', () => {
    expect(() =>
      ProductSchema.parse({
        ...valid,
        comparisons: [{ url: 'https://ebay.com/item/1' }],
      }),
    ).toThrow();
  });

  it('fails with a negative comparison price', () => {
    expect(() =>
      ProductSchema.parse({
        ...valid,
        comparisons: [{ platformId: 'plat-1', url: 'https://ebay.com/item/1', price: -1 }],
      }),
    ).toThrow();
  });
});

describe('AdminProductUpdateSchema — commissionPercent', () => {
  it('passes with commissionPercent = 10', () => {
    expect(() => AdminProductUpdateSchema.parse({ commissionPercent: 10 })).not.toThrow();
  });

  it('passes with commissionPercent = 25', () => {
    expect(() => AdminProductUpdateSchema.parse({ commissionPercent: 25 })).not.toThrow();
  });

  it('fails with commissionPercent = 9', () => {
    expect(() => AdminProductUpdateSchema.parse({ commissionPercent: 9 })).toThrow();
  });

  it('fails with commissionPercent = 26', () => {
    expect(() => AdminProductUpdateSchema.parse({ commissionPercent: 26 })).toThrow();
  });
});

describe('ProductIdParam', () => {
  it('passes with valid id', () => {
    expect(() => ProductIdParam.parse({ id: 'abc123' })).not.toThrow();
  });

  it('fails without id', () => {
    expect(() => ProductIdParam.parse({})).toThrow();
  });
});

describe('AdminProductUpdateSchema', () => {
  it('passes with empty object (all optional)', () => {
    expect(() => AdminProductUpdateSchema.parse({})).not.toThrow();
  });

  it('passes with valid fields', () => {
    const data = {
      brand: 'Rolex',
      category: 'Timepieces',
      title: 'Updated',
      description: 'Desc',
      price: 100,
      condition: 'Mint',
      image: 'https://img.jpg',
      images: ['https://img2.jpg'],
      keywords: ['luxury'],
      listingCategory: 'featured',
    };
    expect(() => AdminProductUpdateSchema.parse(data)).not.toThrow();
  });

  it('fails with invalid category', () => {
    expect(() => AdminProductUpdateSchema.parse({ category: 'Invalid' })).toThrow();
  });

  it('fails with empty title (min 1)', () => {
    expect(() => AdminProductUpdateSchema.parse({ title: '' })).toThrow();
  });

  it('fails with non-positive price', () => {
    expect(() => AdminProductUpdateSchema.parse({ price: 0 })).toThrow();
  });

  it('fails with empty condition', () => {
    expect(() => AdminProductUpdateSchema.parse({ condition: '' })).toThrow();
  });

  it('fails with an invalid listingCategory', () => {
    expect(() => AdminProductUpdateSchema.parse({ listingCategory: 'Featured' })).toThrow();
  });

  it('accepts every listingCategory enum value', () => {
    for (const value of ['normal', 'featured', 'most_rare']) {
      expect(() => AdminProductUpdateSchema.parse({ listingCategory: value })).not.toThrow();
    }
  });
});

describe('AdminProductUpdateSchema — adminNotes (custom columns)', () => {
  it('accepts a flat record of custom column id -> free text', () => {
    const data = {
      adminNotes: { col_abc123: 'paid in cash', col_def456: 'needs polish' },
    };
    expect(() => AdminProductUpdateSchema.parse(data)).not.toThrow();
    expect(AdminProductUpdateSchema.parse(data).adminNotes.col_abc123).toBe('paid in cash');
  });

  it('accepts an empty record (all custom columns cleared)', () => {
    expect(() => AdminProductUpdateSchema.parse({ adminNotes: {} })).not.toThrow();
  });

  it('fails when adminNotes is not an object', () => {
    expect(() => AdminProductUpdateSchema.parse({ adminNotes: 'paid in cash' })).toThrow();
    expect(() => AdminProductUpdateSchema.parse({ adminNotes: ['a'] })).toThrow();
  });

  it('fails when a custom column value is not a string', () => {
    expect(() => AdminProductUpdateSchema.parse({ adminNotes: { col_abc123: 42 } })).toThrow();
    expect(() =>
      AdminProductUpdateSchema.parse({ adminNotes: { col_abc123: { nested: 'no' } } }),
    ).toThrow();
  });

  it('is optional', () => {
    expect(AdminProductUpdateSchema.parse({ brand: 'Rolex' }).adminNotes).toBeUndefined();
  });
});

describe('resolveProductSort', () => {
  it('maps every whitelisted key to a Prisma orderBy array', () => {
    expect(resolveProductSort('newest')).toEqual([{ createdAt: 'desc' }]);
    expect(resolveProductSort('price_asc')).toEqual([{ price: 'asc' }, { createdAt: 'desc' }]);
    expect(resolveProductSort('price_desc')).toEqual([{ price: 'desc' }, { createdAt: 'desc' }]);
  });

  it('exposes exactly the three public sort options', () => {
    expect([...PRODUCT_SORT_OPTIONS]).toEqual(['newest', 'price_asc', 'price_desc']);
  });

  // The whole point of the whitelist: nothing the caller types can ever become
  // a Prisma ordering, including prototype keys that `in` would have accepted.
  it.each(['price', 'createdAt', 'commissionPercent', '', 'constructor', '__proto__', 'toString'])(
    'returns null for the non-whitelisted key %s',
    (key) => {
      expect(resolveProductSort(key)).toBeNull();
    },
  );

  it.each([undefined, null, 42, {}, ['newest']])('returns null for the non-string %s', (value) => {
    expect(resolveProductSort(value)).toBeNull();
  });
});

describe('PriceRangeSchema', () => {
  it('coerces query-string numbers', () => {
    expect(PriceRangeSchema.parse({ minPrice: '2000', maxPrice: '500000' })).toEqual({
      minPrice: 2000,
      maxPrice: 500000,
    });
  });

  it('treats absent and blank bounds as no bound', () => {
    expect(PriceRangeSchema.parse({})).toEqual({});
    expect(PriceRangeSchema.parse({ minPrice: '', maxPrice: '' })).toEqual({});
  });

  it('accepts a one-sided bound', () => {
    expect(PriceRangeSchema.parse({ minPrice: '2000' })).toEqual({ minPrice: 2000 });
    expect(PriceRangeSchema.parse({ maxPrice: '2000' })).toEqual({ maxPrice: 2000 });
  });

  it('accepts zero as a lower bound', () => {
    expect(PriceRangeSchema.parse({ minPrice: '0' })).toEqual({ minPrice: 0 });
  });

  it.each(['abc', '-1', 'NaN', 'Infinity'])('rejects the bad bound %s', (value) => {
    expect(() => PriceRangeSchema.parse({ minPrice: value })).toThrow();
  });

  it('rejects an inverted range', () => {
    expect(() => PriceRangeSchema.parse({ minPrice: '9000', maxPrice: '100' })).toThrow(
      /minPrice must not be greater than maxPrice/,
    );
  });

  it('accepts an equal range', () => {
    expect(PriceRangeSchema.parse({ minPrice: '100', maxPrice: '100' })).toEqual({
      minPrice: 100,
      maxPrice: 100,
    });
  });
});

describe('searchKeywordTokens', () => {
  // `{ has: search }` was an exact, case-sensitive whole-array-element match,
  // so typed input essentially never matched a keyword.
  it('lowercases and includes the whole phrase plus each token', () => {
    const tokens = searchKeywordTokens('Rolex Submariner');
    expect(tokens).toContain('rolex');
    expect(tokens).toContain('submariner');
    expect(tokens).toContain('rolex submariner');
    expect(tokens).toContain('Rolex Submariner');
  });

  it('splits on commas as well as whitespace and drops empties', () => {
    expect(searchKeywordTokens('rolex,  ,submariner')).toEqual(
      expect.arrayContaining(['rolex', 'submariner']),
    );
    expect(searchKeywordTokens('rolex,  ,submariner')).not.toContain('');
  });

  it('deduplicates an already-lowercase single token', () => {
    expect(searchKeywordTokens('rolex')).toEqual(['rolex']);
  });

  it.each(['', '   ', null, undefined, 42])('returns [] for %s', (value) => {
    expect(searchKeywordTokens(value)).toEqual([]);
  });
});
