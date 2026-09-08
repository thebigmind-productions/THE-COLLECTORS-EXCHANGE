/**
 * Builds a labelled contact sheet from the candidate images so they can be
 * reviewed side by side in a single pass instead of one file at a time.
 *
 * Usage: node tools/contact-sheet.mjs <inputDir> <outputFile>
 */

import { readdirSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// sharp lives in the main project's node_modules
const sharp = require(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'node_modules', 'sharp'),
);

const [, , inDirArg, outArg] = process.argv;
const inDir = resolve(inDirArg);
const outFile = resolve(outArg);

const CELL_W = 420;
const CELL_H = 560;
const COLS = 4;
const LABEL_H = 44;

const files = readdirSync(inDir).filter((f) =>
  ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(f).toLowerCase()),
);

if (files.length === 0) {
  console.error('No images found in', inDir);
  process.exit(1);
}

const rows = Math.ceil(files.length / COLS);
const sheetW = COLS * CELL_W;
const sheetH = rows * (CELL_H + LABEL_H);

const composites = [];

for (let i = 0; i < files.length; i++) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = col * CELL_W;
  const y = row * (CELL_H + LABEL_H);

  const buf = await sharp(resolve(inDir, files[i]))
    .resize(CELL_W - 8, CELL_H - 8, { fit: 'cover' })
    .toBuffer();

  composites.push({ input: buf, left: x + 4, top: y + 4 });

  const label = basename(files[i], extname(files[i]));
  const svg = Buffer.from(
    `<svg width="${CELL_W}" height="${LABEL_H}">
       <rect width="100%" height="100%" fill="#111"/>
       <text x="10" y="29" font-family="sans-serif" font-size="22" fill="#D4AF37">${i + 1}. ${label}</text>
     </svg>`,
  );
  composites.push({ input: svg, left: x, top: y + CELL_H });
}

await sharp({
  create: {
    width: sheetW,
    height: sheetH,
    channels: 3,
    background: { r: 10, g: 10, b: 10 },
  },
})
  .composite(composites)
  .jpeg({ quality: 88 })
  .toFile(outFile);

console.log(`Contact sheet: ${outFile} (${files.length} images, ${sheetW}x${sheetH})`);
files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
