#!/usr/bin/env node
/**
 * Measure the actual duration of each narration clip and write
 * src/data/rarity-narration.json — the single source of truth the
 * composition reads for voice-driven scene timing.
 *
 * Run this AFTER replacing any clip in public/audio/narration/ (e.g. with
 * a recorded take), then re-render. The edit re-times itself:
 *
 *     node tools/measure-narration.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = JSON.parse(
  readFileSync(join(root, 'scripts', 'narration-rarity-reel.json'), 'utf-8'),
);
const outDir = join(root, 'public', 'audio', 'narration');
const destJson = join(root, 'src', 'data', 'rarity-narration.json');

function findFfprobe() {
  const compositors = join(root, 'node_modules', '@remotion');
  if (existsSync(compositors)) {
    for (const dir of readdirSync(compositors)) {
      const hit = readdirSync(join(compositors, dir)).find(
        (f) => f.startsWith('ffprobe') && f.endsWith('.exe'),
      );
      if (hit) return join(compositors, dir, hit);
    }
  }
  return 'ffprobe';
}
const ffprobe = findFfprobe();

function probeSeconds(file) {
  const full = join(outDir, file);
  if (!existsSync(full)) {
    console.error(`MISSING: ${file}`);
    return 0;
  }
  const out = execFileSync(
    ffprobe,
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      full,
    ],
    { encoding: 'utf-8' },
  ).trim();
  return Math.round(parseFloat(out) * 1000) / 1000;
}

const scenes = script.scenes.map((s) => ({
  id: s.id,
  file: s.file,
  seconds: probeSeconds(s.file),
}));

const total = scenes.reduce((a, s) => a + s.seconds, 0);

mkdirSync(dirname(destJson), { recursive: true });
writeFileSync(destJson, JSON.stringify({ scenes }, null, 2) + '\n');

for (const s of scenes) {
  console.log(`  ${s.file.padEnd(22)} ${s.seconds.toFixed(2).padStart(6)}s`);
}
console.log(`\n  TOTAL SPEECH ${total.toFixed(2)}s  ->  ${destJson}`);
