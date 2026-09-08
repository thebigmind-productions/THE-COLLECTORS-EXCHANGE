/**
 * Site-wide SEO config — imported by BOTH the React app (src/components/SEO.jsx,
 * src/components/Header.jsx, the page components) and the Node build script
 * (`scripts/prerender-blogs.mjs`, which generates the static SEO shells in
 * `dist/` that crawlers and social scrapers actually read).
 *
 * Keep this module plain ESM: no React, no JSX, no imports, no `import.meta` —
 * the build script loads it directly with Node, so anything Node can't parse
 * breaks `npm run build`.
 *
 * The prerender script used to keep its own forked copies of `SITE_URL`,
 * the nav, and `CORE_PAGES`, and they drifted — copy removed here stayed live
 * in the prerendered HTML. Do not re-fork them.
 *
 * A lot of the copy below is deliberately TEMPORARY (the storefront is in a
 * stripped-down state right now — see docs/TEMPORARY_CHANGES_ROLLBACK.md).
 * That's exactly why it's shared: restoring the permanent copy later should be
 * one edit here, not the same edit in two files that are easy to miss.
 */
export const SITE_NAME = 'The Collectors Exchange';
export const SITE_URL = 'https://thecollectorsexchange.in';
export const TITLE_SEP = ' | ';
export const TWITTER_HANDLE = '@TCE_store';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

// Restored from the original authenticated-heritage-marketplace positioning
// (see docs/TEMPORARY_CHANGES_ROLLBACK.md #9).
export const DEFAULT_DESC =
  "India's trusted marketplace for authenticated vintage watches and rare pre-owned collectibles. Every piece verified, every seller vetted, every sale secure.";

/** Primary header navigation – keep labels aligned with sitelink targets.
 * Single source for the React header, the SiteNavigationSchema JSON-LD, and
 * the nav rendered into every prerendered static shell (the build script used
 * to keep a fork of this called DEFAULT_NAV). */
export const PRIMARY_NAV = [
  { name: 'About Us', path: '/about' },
  { name: 'The Exchange', path: '/category' },
  { name: 'Contact', path: '/contact' },
  { name: 'The Archive', path: '/archive' },
  { name: 'Vision', path: '/vision' },
];

export function buildPageTitle(title) {
  return title
    ? `${title}${TITLE_SEP}${SITE_NAME}`
    : `Vintage Watches & Rare Collectibles${TITLE_SEP}${SITE_NAME}`;
}

/**
 * Cloudflare Pages 308-redirects any directory-style path without a trailing
 * slash to the slash version (e.g. /category -> /category/). Sitemap and
 * canonical URLs must match the URL that actually serves 200, or Google
 * flags it as a redirect/canonical mismatch. Always append the slash except
 * for the bare root.
 */
export function buildCanonicalPath(path) {
  if (!path || path === '/') return '/';
  const [pathname, query] = path.split('?');
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return query ? `${normalized}?${query}` : normalized;
}

export function resolveImageUrl(image) {
  if (!image) return DEFAULT_OG_IMAGE;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/')) return `${SITE_URL}${image}`;
  return `${SITE_URL}/${image}`;
}

/** Core marketing pages prerendered at build time with full meta + schema.
 *
 * Consumed by the page components for their <SEO>/schema props AND iterated by
 * scripts/prerender-blogs.mjs to emit one static shell per entry. Entries the
 * build script must NOT emit a shell for are marked `skipPrerender: true`
 * rather than being deleted from one copy and not the other.
 *
 * `h1`, `intro` and `keywords` are React-only; the prerender script derives its
 * og:image from DEFAULT_OG_IMAGE and its nav from PRIMARY_NAV.
 */
export const CORE_PAGES = {
  '/': {
    title: 'Vintage Watches & Rare Collectibles',
    description:
      "India's trusted marketplace for authenticated vintage watches and rare pre-owned collectibles. Every piece verified, every seller vetted, every sale secure.",
    schemaType: null,
    h1: 'Authenticated Vintage Watches & Rare Collectibles',
    intro:
      "The Collectors Exchange is India's curated marketplace for verified pre-owned collectibles, antiques, and limited-edition timepieces. Every item is authenticated before listing.",
    breadcrumb: null,
  },
  '/about': {
    title: 'About Us',
    description:
      'The story behind The Collectors Exchange: how we source, verify, and authenticate vintage watches and heritage collectibles across India.',
    schemaType: 'AboutPage',
    h1: 'About The Collectors Exchange',
    intro:
      'We source authenticated vintage watches, collectibles, and antiques from trusted sellers across India. Every piece is verified by our curation team before it is listed on The Exchange.',
    breadcrumb: [
      { name: 'Home', url: '/' },
      { name: 'About Us', url: '/about' },
    ],
  },
  '/category': {
    title: 'The Exchange',
    description:
      'Browse authenticated vintage watches, timepieces, antiques, jewelry, and collectibles at The Exchange. Mid-range to rare pieces, every listing expert-verified.',
    keywords:
      'vintage watches for men, casio vintage watches for men, vintage watch for men, rolex vintage watches for men, omega vintage watches for men, vintage watches for men india, mens vintage watches for sale, vintage mens wrist watches for sale, antique vintage watches for men, casio ad01 vintage series watch for men & women',
    schemaType: 'CollectionPage',
    h1: 'Shop The Exchange',
    intro:
      'Browse verified vintage watches, timepieces, antiques, jewelry, and collectibles. Categories include Timepieces, Antiques, Jewelry, Collectibles, Accessories, and Toys & Pop Culture.',
    breadcrumb: [
      { name: 'Home', url: '/' },
      { name: 'The Exchange', url: '/category' },
    ],
  },
  '/contact': {
    title: 'Contact Us',
    description:
      'Contact The Collectors Exchange for buying, selling, or partnership inquiries. Email support@thecollectorsexchange.in. We respond within 24 to 48 hours.',
    schemaType: 'ContactPage',
    h1: 'Contact The Collectors Exchange',
    intro:
      'Reach our team for questions about buying, selling, authentication, shipping, or partnerships. Email support@thecollectorsexchange.in and expect a reply within 24 to 48 hours.',
    breadcrumb: [
      { name: 'Home', url: '/' },
      { name: 'Contact Us', url: '/contact' },
    ],
  },
  '/faq': {
    title: 'FAQ',
    description:
      'Answers about buying, selling, shipping, payments, and account security on The Collectors Exchange. Learn how authentication, returns, and payouts work.',
    schemaType: 'FAQPage',
    h1: 'Frequently Asked Questions',
    intro:
      'Find clear answers about purchasing on The Exchange, seller verification, shipping with Delhivery, Razorpay payments, returns, and account security.',
    breadcrumb: [
      { name: 'Home', url: '/' },
      { name: 'FAQ', url: '/faq' },
    ],
  },
  '/vision': {
    title: 'Our Vision',
    description:
      'The Collectors Exchange vision: a trusted global archive where heritage, authenticity, and expert verification define how collectors buy and sell.',
    schemaType: 'AboutPage',
    h1: 'Our Vision',
    intro:
      'We are building a trusted archive for collectors: a marketplace where authenticity is verified, heritage is preserved, and every transaction is secure.',
    breadcrumb: [
      { name: 'Home', url: '/' },
      { name: 'Our Vision', url: '/vision' },
    ],
  },
  '/returns': {
    title: 'Returns & Refunds',
    description:
      'Return policy for The Collectors Exchange. Items may be returned within 48 hours of delivery if condition does not match the listing description.',
    schemaType: 'WebPage',
    h1: 'Returns & Refunds',
    intro:
      'Items purchased on The Exchange may be returned within 48 hours of delivery if they do not match the described condition.',
    breadcrumb: [
      { name: 'Home', url: '/' },
      { name: 'Returns & Refunds', url: '/returns' },
    ],
  },
  '/privacy': {
    title: 'Privacy Policy',
    description:
      'Privacy Policy for The Collectors Exchange. How we collect, use, and protect your personal data when you buy, sell, or browse our marketplace.',
    schemaType: 'WebPage',
    h1: 'Privacy Policy',
    intro:
      'How The Collectors Exchange collects, uses, stores, and protects your personal information.',
    breadcrumb: [
      { name: 'Home', url: '/' },
      { name: 'Privacy Policy', url: '/privacy' },
    ],
  },
  '/terms': {
    title: 'Terms & Conditions',
    description:
      'Terms and Conditions for using The Collectors Exchange marketplace, including buyer inspection periods, seller obligations, and platform fees.',
    schemaType: 'WebPage',
    h1: 'Terms & Conditions',
    intro:
      'Terms governing purchases, sales, authentication, and use of The Collectors Exchange platform.',
    breadcrumb: [
      { name: 'Home', url: '/' },
      { name: 'Terms & Conditions', url: '/terms' },
    ],
  },
  '/founders-note': {
    title: "Founder's Note",
    description:
      "A personal note from the founder of The Collectors Exchange on building India's trusted marketplace for authenticated collectibles and vintage watches.",
    schemaType: 'WebPage',
    h1: "Founder's Note",
    intro:
      'A note from our founder on why The Collectors Exchange was built and what we stand for as a marketplace.',
    breadcrumb: [
      { name: 'Home', url: '/' },
      { name: "Founder's Note", url: '/founders-note' },
    ],
  },
  '/seller-agreement': {
    title: 'Seller Agreement',
    description:
      'Seller Agreement for listing on The Collectors Exchange. KYC requirements, listing limits, commission structure, and payout terms for vendors.',
    schemaType: 'WebPage',
    h1: 'Seller Agreement',
    intro:
      'Terms for sellers listing authenticated collectibles on The Exchange, including KYC, fees, and payout schedules.',
    breadcrumb: [
      { name: 'Home', url: '/' },
      { name: 'Seller Agreement', url: '/seller-agreement' },
    ],
  },
};
