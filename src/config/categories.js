/**
 * Shared category data — imported by BOTH the React app
 * (`src/pages/Category.jsx`) and the Node build script
 * (`scripts/prerender-blogs.mjs`, which generates the static SEO shells in
 * `dist/`). Keep this module plain ESM: no React, no JSX, no imports — the
 * build script loads it directly with Node, so anything Node can't parse
 * breaks the build.
 *
 * It exists because this data used to be forked between `CATEGORIES` in
 * Category.jsx and `CATEGORY_LANDINGS` in the prerender script, and the two
 * copies drifted: copy edited on the React side stayed live in the
 * prerendered HTML that crawlers actually read. Do not re-fork it.
 *
 * Fields:
 *   description        long narrative shown on the React category page
 *   metaDescription    <meta name="description"> for that category
 *   metaKeywords       <meta name="keywords"> for that category
 *   prerenderMetaDescription
 *                      PRE-EXISTING DRIFT, preserved byte-for-byte so this
 *                      extraction stayed a pure refactor. This is the older,
 *                      un-updated string the prerender script was still
 *                      shipping. Deleting it makes the static HTML fall back
 *                      to `metaDescription`. Removed on `timepieces` (whose
 *                      prerendered meta description used to name brands that
 *                      were scrubbed); the remaining entries above it are the
 *                      other categories' intentionally-kept strings.
 *   icon               NOT here — it's a lucide React component, so
 *                      Category.jsx maps it on by id.
 */
export const CATEGORIES = [
  {
    id: 'timepieces',
    slug: 'timepieces',
    name: 'Timepieces',
    tagline: 'The Mechanical Heartbeat',
    description:
      'Your phone tells the time. A mechanical watch tells a story. In a world of flickering screens and disposable tech, we choose the "Mechanical Truth." We don\'t sell battery-powered fashion; we rescue 17-jewel heartbeats that never need a plug or an algorithm to live.',
    metaDescription:
      'Shop authenticated vintage watches and timepieces at The Collectors Exchange. Rolex, Omega, HMT, Seiko & more, expert-verified, mid-range to rare, secure transactions across India.',
    metaKeywords:
      'vintage watches for men, vintage watches india, rolex vintage watches, omega vintage watches, hmt vintage watches, mechanical watches, pre-owned watches india',
  },
  {
    id: 'accessories',
    slug: 'accessories',
    name: 'Accessories',
    tagline: 'The Perfect Finish',
    description:
      'An outfit is a statement. The right accessory makes it iconic. In a world of fast fashion and disposable trends, we choose the "Enduring Truth." We rescue the definitive finishing pieces: the cufflinks, the bags, the belts, and the heirlooms that transform the ordinary into the extraordinary.',
    metaDescription:
      'Shop authenticated vintage accessories at The Collectors Exchange: cufflinks, bags, belts, and heirloom pieces. Every piece expert-verified, secure transactions across India.',
    metaKeywords:
      'vintage accessories india, vintage cufflinks, vintage leather bags, heirloom accessories, pre-owned accessories india',
  },
  {
    id: 'collectibles',
    slug: 'collectibles',
    name: 'Collectibles',
    tagline: 'The Curated Pulse',
    description:
      'A trend lasts a season. A collectible lasts a lifetime. In a world of digital clutter and "fast-consumption," we choose the "Physical Truth." We don\'t deal in landfill-ready trinkets; we rescue the rare, the nostalgic, and the culturally significant.',
    metaDescription:
      'Shop rare, curated collectibles at The Collectors Exchange: nostalgic and culturally significant pieces, expert-verified. Secure transactions across India.',
    metaKeywords:
      'rare collectibles india, curated collectibles, vintage collectibles, pre-owned collectibles india',
    prerenderMetaDescription:
      'Shop rare, curated collectibles at The Collectors Exchange, including nostalgic and culturally significant pieces.',
  },
  {
    id: 'antiques',
    slug: 'antiques',
    name: 'Antiques',
    tagline: 'The Ancestral Anchor',
    description:
      'A replica fills a space. An antique commands it. In a world of flat-pack furniture and mass-produced "vintage-look" decor, we choose the "Ancestral Truth." We rescue the weathered survivors of our history, solid objects that carry the craftsman\'s soul and the weight of the generations before us.',
    metaDescription:
      'Shop authenticated antiques at The Collectors Exchange: heritage furniture, decor, and historical pieces, expert-verified. Secure transactions across India.',
    metaKeywords: 'antiques india, vintage antiques, heritage antiques, pre-owned antiques india',
    prerenderMetaDescription:
      'Shop authenticated antiques at The Collectors Exchange, including heritage furniture, decor, and historical pieces.',
  },
  {
    id: 'toys',
    slug: 'toys-and-pop-culture',
    name: 'Toys & Pop Culture',
    tagline: 'The Nostalgic Truth',
    description:
      'A plaything is for a moment. A pop icon is for the ages. In a world of disposable plastic and "over-hyped" trends, we choose the "Cultural Truth." We rescue the definitive pieces: the action figures, the limited figurines, and the media artifacts that shaped our childhoods.',
    metaDescription:
      'Shop vintage toys and pop culture collectibles at The Collectors Exchange: action figures, limited figurines, and media artifacts, expert-verified.',
    metaKeywords:
      'vintage toys india, pop culture collectibles, vintage action figures, collectible figurines india',
    prerenderMetaDescription:
      'Shop vintage toys and pop culture collectibles at The Collectors Exchange, including action figures, limited figurines, and media artifacts.',
  },
  {
    id: 'jewelry',
    slug: 'jewelry',
    name: 'Jewelry',
    tagline: 'The TCE Original',
    description:
      'A brand sells you a status. A TCE Original gives you a legacy. In a world of hollow "luxury" and gold-plated illusions, we choose the "Absolute Truth." After years of studying the ancestors and master artisans, we have moved from protecting history to creating it.',
    metaDescription:
      'Shop authenticated vintage jewelry at The Collectors Exchange: expert-verified craftsmanship, secure transactions across India.',
    metaKeywords: 'vintage jewelry india, pre-owned jewelry, antique jewelry india',
    prerenderMetaDescription:
      'Shop authenticated vintage jewelry and TCE Original pieces at The Collectors Exchange.',
  },
];
