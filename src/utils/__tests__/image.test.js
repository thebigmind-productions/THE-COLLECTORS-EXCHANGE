import { describe, it, expect, afterEach, vi } from 'vitest';
import { IMAGE_WIDTHS, isTransformableImage, imageUrl, imageSrcSet, imageProps } from '../image';

// The suite's own project ref — must match whatever VITE_SUPABASE_URL is in the
// test env. src/test/setup.js / .env supply it; we stub explicitly so the
// assertions do not depend on which one wins.
const BASE = 'https://rvamybeqoyznlgzglqqx.supabase.co';
const OBJECT = `${BASE}/storage/v1/object/public/product-images/1770988065588-jv9xsw7h3n.JPG`;
const RENDER = `${BASE}/storage/v1/render/image/public/product-images/1770988065588-jv9xsw7h3n.JPG`;

vi.stubEnv('VITE_SUPABASE_URL', BASE);

afterEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', BASE);
});

describe('isTransformableImage', () => {
  it('accepts a stored Supabase storage public URL', () => {
    expect(isTransformableImage(OBJECT)).toBe(true);
  });

  it('rejects an already-transformed render URL', () => {
    expect(isTransformableImage(`${RENDER}?width=400&quality=75`)).toBe(false);
  });

  it('rejects non-string / empty input', () => {
    expect(isTransformableImage(null)).toBe(false);
    expect(isTransformableImage(undefined)).toBe(false);
    expect(isTransformableImage('')).toBe(false);
    expect(isTransformableImage(42)).toBe(false);
  });

  it('rejects URLs from other origins and non-http schemes', () => {
    expect(isTransformableImage('https://images.unsplash.com/photo-1.jpg')).toBe(false);
    expect(isTransformableImage('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(false);
    expect(isTransformableImage('blob:http://localhost/abc-123')).toBe(false);
    expect(isTransformableImage('/assets/crest-mark-a1b2c3.svg')).toBe(false);
  });

  it('rejects a different Supabase project when the env base is known', () => {
    expect(
      isTransformableImage(
        'https://someotherref.supabase.co/storage/v1/object/public/product-images/x.jpg',
      ),
    ).toBe(false);
  });

  it('falls back to shape matching when no env base is configured', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    expect(
      isTransformableImage(
        'https://someotherref.supabase.co/storage/v1/object/public/product-images/x.jpg',
      ),
    ).toBe(true);
    expect(isTransformableImage('https://cdn.example.com/x.jpg')).toBe(false);
  });
});

describe('imageUrl', () => {
  it('swaps object/public for render/image/public and appends width + quality', () => {
    expect(imageUrl(OBJECT, 400)).toBe(`${RENDER}?width=400&quality=75`);
  });

  it('honours a custom quality and resize mode', () => {
    expect(imageUrl(OBJECT, 800, { quality: 60, resize: 'contain' })).toBe(
      `${RENDER}?width=800&quality=60&resize=contain`,
    );
  });

  it('rounds fractional widths', () => {
    expect(imageUrl(OBJECT, 399.6)).toBe(`${RENDER}?width=400&quality=75`);
  });

  it('passes through unchanged when src is not transformable', () => {
    const external = 'https://images.unsplash.com/photo-1.jpg?auto=format&w=1600';
    const dataUri =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3C/svg%3E";
    const local = '/assets/crest-mark-a1b2c3.svg';
    const already = `${RENDER}?width=400&quality=75`;

    expect(imageUrl(external, 400)).toBe(external);
    expect(imageUrl(dataUri, 400)).toBe(dataUri);
    expect(imageUrl(local, 400)).toBe(local);
    expect(imageUrl(already, 800)).toBe(already);
    expect(imageUrl(null, 400)).toBeNull();
    expect(imageUrl(undefined, 400)).toBeUndefined();
    expect(imageUrl('', 400)).toBe('');
  });

  it('passes through unchanged for an invalid width', () => {
    expect(imageUrl(OBJECT, 0)).toBe(OBJECT);
    expect(imageUrl(OBJECT, -100)).toBe(OBJECT);
    expect(imageUrl(OBJECT, undefined)).toBe(OBJECT);
    expect(imageUrl(OBJECT, 'wide')).toBe(OBJECT);
  });

  it('appends an explicit height so a fixed-aspect slot gets a server-side crop', () => {
    // Without `height`, Supabase's transform only scales width and leaves the
    // source's full original height untouched (e.g. a tall phone photo comes
    // back hundreds of times taller than wide) — object-cover then renders a
    // razor-thin sliver of the photo blown up to fill the box.
    expect(imageUrl(OBJECT, 400, { resize: 'cover', height: 400 })).toBe(
      `${RENDER}?width=400&quality=75&resize=cover&height=400`,
    );
  });
});

describe('imageSrcSet', () => {
  it('builds a descriptor list over the default ladder', () => {
    const set = imageSrcSet(OBJECT);
    expect(set).toBe(IMAGE_WIDTHS.map((w) => `${RENDER}?width=${w}&quality=75 ${w}w`).join(', '));
  });

  it('accepts a custom ladder and de-dupes + sorts it', () => {
    expect(imageSrcSet(OBJECT, [800, 200, 200, 400])).toBe(
      [200, 400, 800].map((w) => `${RENDER}?width=${w}&quality=75 ${w}w`).join(', '),
    );
  });

  it('returns undefined for anything not transformable, so React omits the attribute', () => {
    expect(imageSrcSet('https://images.unsplash.com/photo-1.jpg')).toBeUndefined();
    expect(imageSrcSet(`${RENDER}?width=400&quality=75`)).toBeUndefined();
    expect(imageSrcSet(null)).toBeUndefined();
    expect(imageSrcSet(undefined)).toBeUndefined();
    expect(imageSrcSet('')).toBeUndefined();
  });

  it('returns undefined for an empty or all-invalid ladder', () => {
    expect(imageSrcSet(OBJECT, [])).toBeUndefined();
    expect(imageSrcSet(OBJECT, [0, -1, NaN])).toBeUndefined();
  });

  it('sets height === width per rung when square is requested', () => {
    expect(imageSrcSet(OBJECT, [200, 400], { resize: 'cover', square: true })).toBe(
      [200, 400]
        .map((w) => `${RENDER}?width=${w}&quality=75&resize=cover&height=${w} ${w}w`)
        .join(', '),
    );
  });
});

describe('imageProps', () => {
  it('returns src, srcSet and sizes for a transformable image', () => {
    const props = imageProps(OBJECT, {
      width: 400,
      widths: [200, 400, 800],
      sizes: '(min-width: 768px) 25vw, 50vw',
    });
    expect(props.src).toBe(`${RENDER}?width=400&quality=75`);
    expect(props.srcSet).toContain('200w');
    expect(props.sizes).toBe('(min-width: 768px) 25vw, 50vw');
  });

  it('drops srcSet and sizes for a pass-through src', () => {
    const external = 'https://images.unsplash.com/photo-1.jpg';
    expect(imageProps(external, { width: 400, sizes: '100vw' })).toEqual({
      src: external,
      srcSet: undefined,
      sizes: undefined,
    });
  });
});
