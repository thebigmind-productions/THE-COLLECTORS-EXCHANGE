/**
 * Renders every registered composition to out/ in one pass.
 *
 * Usage: npm run render:all
 */

import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'out');
mkdirSync(OUT, { recursive: true });

// Reels (9:16) are the priority; pass --all-formats to also render 4:5 and 1:1.
const ALL_FORMATS = process.argv.includes('--all-formats');

const VIDEOS = [
  { id: 'IntroReel', slug: 'intro' },
  { id: 'HeirloomReel', slug: 'heirloom' },
  { id: 'SpotAFakeReel', slug: 'spot-a-fake' },
  { id: 'HmtReel', slug: 'hmt' },
  { id: 'RarityReel', slug: 'rarity' },
];

const TARGETS = VIDEOS.flatMap(({ id, slug }) => {
  const base = [{ id, file: `tce-${slug}-reel-9x16.mp4` }];
  if (!ALL_FORMATS) return base;
  return [
    ...base,
    { id: `${id}-Feed`, file: `tce-${slug}-feed-4x5.mp4` },
    { id: `${id}-Square`, file: `tce-${slug}-square-1x1.mp4` },
  ];
});

for (const { id, file } of TARGETS) {
  const outPath = resolve(OUT, file);
  console.log(`\n▶ Rendering ${id} -> out/${file}`);
  execSync(`npx remotion render ${id} "${outPath}" --codec=h264 --log=error`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

console.log('\n✓ All compositions rendered to out/');
