/**
 * Supabase storage image transformation helpers.
 *
 * Product/blog images live in a public Supabase storage bucket and are, by
 * default, served at whatever resolution the seller uploaded (often ~750KB of
 * JPEG for a 400px grid tile). Supabase's image-transformation endpoint can
 * resize and re-encode on the fly, and content-negotiates WebP from the
 * browser's `Accept` header, so no `<picture>` element or explicit format
 * param is needed.
 *
 *   .../storage/v1/object/public/<bucket>/<file>              <- stored URL
 *   .../storage/v1/render/image/public/<bucket>/<file>?width=400&quality=75
 *
 * Everything here is a pure function — no React, no side effects. Any input
 * that is not a plain Supabase storage public URL (external URL, data:/blob:
 * URI, bundled local asset, already-transformed URL, null/undefined/empty) is
 * returned untouched so a bad `src` can never be produced.
 */

const OBJECT_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';

/** Default responsive width ladder. */
export const IMAGE_WIDTHS = [200, 400, 800, 1200];

/** Default encoder quality passed to Supabase (1-100). */
export const DEFAULT_QUALITY = 75;

/**
 * The Supabase project base URL, from the same env var `src/utils/supabase.js`
 * reads. Never hardcode the project ref.
 */
const getSupabaseBase = () => {
  try {
    const url = import.meta.env?.VITE_SUPABASE_URL;
    return typeof url === 'string' && url ? url.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
};

/**
 * True only for a stored (untransformed) Supabase storage public object URL
 * belonging to this project.
 */
export const isTransformableImage = (src) => {
  if (typeof src !== 'string' || src === '') return false;
  if (!src.includes(OBJECT_PATH)) return false;
  if (src.includes(RENDER_PATH)) return false;

  const base = getSupabaseBase();
  if (base) return src.startsWith(`${base}${OBJECT_PATH}`);
  // No env configured (SSR/prerender/tests): fall back to shape-matching any
  // supabase.co storage URL rather than rewriting something unrelated.
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(src);
};

/**
 * Build a Supabase render-image URL for `src` at `width` CSS pixels.
 * Returns `src` unchanged when it is not a transformable Supabase URL, or when
 * `width` is not a positive finite number.
 *
 * @param {string|null|undefined} src stored image URL
 * @param {number} width target width in pixels
 * @param {{quality?: number, resize?: 'cover'|'contain'|'fill', height?: number}} [options]
 * @returns {string|null|undefined} transform URL, or the input untouched
 */
export const imageUrl = (src, width, options = {}) => {
  if (!isTransformableImage(src)) return src;
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return src;

  const { quality = DEFAULT_QUALITY, resize, height } = options;
  const params = new URLSearchParams({
    width: String(Math.round(w)),
    quality: String(quality),
  });
  if (resize) params.set('resize', resize);
  // Without an explicit height, Supabase's transform only scales width and
  // leaves the source's full original height in place (e.g. a 400px-wide
  // request on a 4284px-tall photo comes back 400x4284, not 400x300) —
  // producing a sliver that gets cropped to near-nothing by object-cover.
  // A target height + resize=cover makes it crop server-side instead.
  const h = Number(height);
  if (Number.isFinite(h) && h > 0) params.set('height', String(Math.round(h)));

  return `${src.replace(OBJECT_PATH, RENDER_PATH)}?${params.toString()}`;
};

/**
 * Build a `srcSet` string across a width ladder.
 * Returns `undefined` for anything not transformable, so React omits the
 * attribute entirely rather than emitting a broken candidate list.
 *
 * @param {string|null|undefined} src stored image URL
 * @param {number[]} [widths] width ladder, defaults to IMAGE_WIDTHS
 * @param {{quality?: number, resize?: 'cover'|'contain'|'fill', square?: boolean, aspectRatio?: number}} [options]
 *   `square: true` requests each rung at height === width (see `imageUrl`),
 *   for callers displaying the image in a 1:1 slot. `aspectRatio` generalizes
 *   that to any height/width ratio (e.g. 1.25 for a 4:5 slot); `square` wins
 *   if both are given.
 * @returns {string|undefined}
 */
export const imageSrcSet = (src, widths = IMAGE_WIDTHS, options = {}) => {
  if (!isTransformableImage(src)) return undefined;
  const ladder = (Array.isArray(widths) ? widths : [])
    .map(Number)
    .filter((w) => Number.isFinite(w) && w > 0)
    .map(Math.round)
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .sort((a, b) => a - b);
  if (ladder.length === 0) return undefined;

  const { square, aspectRatio, ...rest } = options;
  const ratio = square ? 1 : aspectRatio;
  return ladder
    .map(
      (w) => `${imageUrl(src, w, ratio ? { ...rest, height: Math.round(w * ratio) } : rest)} ${w}w`,
    )
    .join(', ');
};

/**
 * Convenience bundle of the three responsive-image attributes.
 * `srcSet`/`sizes` come back `undefined` when `src` is not transformable.
 *
 * @param {string|null|undefined} src stored image URL
 * @param {{width: number, widths?: number[], sizes?: string, quality?: number,
 *          resize?: 'cover'|'contain'|'fill'}} config
 */
export const imageProps = (src, { width, widths, sizes, quality, resize } = {}) => {
  const options = { quality, resize };
  const srcSet = imageSrcSet(src, widths ?? IMAGE_WIDTHS, options);
  return {
    src: imageUrl(src, width, options),
    srcSet,
    sizes: srcSet ? sizes : undefined,
  };
};
