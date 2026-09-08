/**
 * Trims the uniform background border off the logo artwork so it fills the
 * medallion in the video instead of floating in a sea of padding.
 *
 * Usage: node tools/prep-logo.mjs
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = dirname(fileURLToPath(import.meta.url));
const sharp = require(resolve(ROOT, '..', '..', 'node_modules', 'sharp'));

const SRC = resolve(ROOT, '..', 'public', 'img', 'logo.png');
const OUT = resolve(ROOT, '..', 'public', 'img', 'logo-trimmed.png');

const before = await sharp(SRC).metadata();

// `trim` removes the surrounding block of near-uniform colour. The threshold
// is deliberately generous because the logo ground is a soft cream, not pure white.
const info = await sharp(SRC).trim({ threshold: 22 }).png().toFile(OUT);

console.log(`logo.png        ${before.width}x${before.height}`);
console.log(`logo-trimmed    ${info.width}x${info.height}`);
console.log(
  `Trimmed ${before.width - info.width}px horizontally, ${
    before.height - info.height
  }px vertically.`,
);
