/**
 * Applies a consistent "TCE heritage" colour grade to source photography so
 * that stock imagery from different photographers reads as one brand world.
 *
 * The look: deepened shadows, warm gold-tinted highlights, slightly reduced
 * saturation (so the gold accent dominates), and a soft vignette.
 *
 * Usage: node tools/grade-images.mjs
 */

import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = dirname(fileURLToPath(import.meta.url));
const sharp = require(resolve(ROOT, '..', '..', 'node_modules', 'sharp'));

const CAND = resolve(ROOT, '..', 'public', 'img', 'candidates');
const OUT = resolve(ROOT, '..', 'public', 'img', 'graded');
mkdirSync(OUT, { recursive: true });

/** Output canvas — vertical, matching the 9:16 reel. */
const W = 1080;
const H = 1920;

/**
 * Each entry: source file, output name, and how tightly to crop.
 * `position` steers the crop toward the subject.
 */
const JOBS = [
  {
    src: 'round2/movement-macro-a.jpg',
    out: 'movement-macro.jpg',
    position: 'centre',
  },
  {
    src: 'round2/watchmaker-loupe.jpg',
    out: 'watchmaker.jpg',
    position: 'centre',
  },
  {
    src: 'round2/vintage-watch-b.jpg',
    out: 'pocketwatch-hero.jpg',
    position: 'centre',
  },
  {
    src: 'pocket-watches.jpg',
    out: 'collection.jpg',
    position: 'centre',
  },
  {
    src: 'round2/pocketwatch-b.jpg',
    out: 'collection-alt.jpg',
    position: 'centre',
  },
  {
    src: 'round2/antique-jewelry.jpg',
    out: 'jewelry.jpg',
    position: 'centre',
  },
  {
    src: 'round2/movement-macro-b.jpg',
    out: 'movement-macro-alt.jpg',
    position: 'centre',
  },
];

/**
 * Radial vignette plus a *restrained* warm wash.
 * Kept subtle on purpose: a heavy tint flattens everything into sepia and
 * reads as a cheap filter rather than a considered grade.
 */
function vignetteSvg(w, h) {
  return Buffer.from(`
    <svg width="${w}" height="${h}">
      <defs>
        <radialGradient id="v" cx="50%" cy="46%" r="75%">
          <stop offset="40%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.68"/>
        </radialGradient>
        <linearGradient id="warm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0A0A0A" stop-opacity="0.34"/>
          <stop offset="45%" stop-color="#B8860B" stop-opacity="0.06"/>
          <stop offset="100%" stop-color="#0A0A0A" stop-opacity="0.52"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#warm)"/>
      <rect width="100%" height="100%" fill="url(#v)"/>
    </svg>
  `);
}

console.log('Grading imagery to the TCE heritage look...\n');

for (const job of JOBS) {
  const inPath = resolve(CAND, job.src);
  const outPath = resolve(OUT, job.out);

  const base = await sharp(inPath)
    .resize(W, H, { fit: 'cover', position: job.position })
    // Deepen the image and nudge saturation down just enough that the gold
    // reads as the accent — not so far that the photo goes muddy.
    .modulate({ brightness: 0.86, saturation: 0.92 })
    // Contrast: crush the blacks a little, keep highlight detail.
    .linear(1.14, -20)
    .toBuffer();

  await sharp(base)
    .composite([{ input: vignetteSvg(W, H), blend: 'over' }])
    .jpeg({ quality: 90 })
    .toFile(outPath);

  console.log(`  ✓ ${job.out}`);
}

console.log(`\nGraded ${JOBS.length} images -> public/img/graded/`);
