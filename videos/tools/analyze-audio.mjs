/**
 * Renders a WAV file's waveform + per-bar RMS as a PNG so the arrangement
 * can be visually verified (layer entries, dynamics, fades) without listening.
 *
 * Usage: node tools/analyze-audio.mjs <file.wav> <out.png> [bpm]
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = dirname(fileURLToPath(import.meta.url));
const sharp = require(resolve(ROOT, '..', '..', 'node_modules', 'sharp'));

const [, , inArg, outArg, bpmArg] = process.argv;
const buf = readFileSync(resolve(inArg));

// --- Parse WAV header ---
const numChannels = buf.readUInt16LE(22);
const sampleRate = buf.readUInt32LE(24);
const bitsPerSample = buf.readUInt16LE(34);
if (bitsPerSample !== 16) throw new Error('Expected 16-bit PCM');

// Locate the data chunk (don't assume it starts at 44).
let pos = 12;
let dataOffset = 44;
let dataSize = buf.length - 44;
while (pos < buf.length - 8) {
  const id = buf.toString('ascii', pos, pos + 4);
  const size = buf.readUInt32LE(pos + 4);
  if (id === 'data') {
    dataOffset = pos + 8;
    dataSize = size;
    break;
  }
  pos += 8 + size;
}

const frameCount = Math.floor(dataSize / (numChannels * 2));
const durationSec = frameCount / sampleRate;

// Mono-sum for analysis.
const mono = new Float32Array(frameCount);
for (let i = 0; i < frameCount; i++) {
  let sum = 0;
  for (let c = 0; c < numChannels; c++) {
    sum += buf.readInt16LE(dataOffset + (i * numChannels + c) * 2) / 32768;
  }
  mono[i] = sum / numChannels;
}

// --- Draw ---
const W = 1600;
const H = 420;
const MID = H / 2;
const bucket = Math.floor(frameCount / W);

let peaks = '';
for (let x = 0; x < W; x++) {
  let min = 0;
  let max = 0;
  for (let i = 0; i < bucket; i++) {
    const v = mono[x * bucket + i] ?? 0;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const y1 = MID - max * (MID - 20);
  const y2 = MID - min * (MID - 20);
  peaks += `<line x1="${x}" y1="${y1.toFixed(1)}" x2="${x}" y2="${y2.toFixed(1)}" stroke="#D4AF37" stroke-width="1"/>`;
}

// RMS envelope overlay
let rmsPath = '';
const RMS_BUCKETS = 200;
const rmsStep = Math.floor(frameCount / RMS_BUCKETS);
for (let b = 0; b < RMS_BUCKETS; b++) {
  let sum = 0;
  for (let i = 0; i < rmsStep; i++) {
    const v = mono[b * rmsStep + i] ?? 0;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / rmsStep);
  const x = (b / RMS_BUCKETS) * W;
  const y = MID - rms * (MID - 20) * 2;
  rmsPath += `${b === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
}

// Bar gridlines
let grid = '';
if (bpmArg) {
  const bpm = parseFloat(bpmArg);
  const barSec = (60 / bpm) * 4;
  for (let bar = 0; bar * barSec < durationSec; bar++) {
    const x = ((bar * barSec) / durationSec) * W;
    grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#ffffff22" stroke-width="1"/>`;
    grid += `<text x="${x + 5}" y="18" font-family="monospace" font-size="14" fill="#888">bar ${bar + 1}</text>`;
  }
}

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0A0A0A"/>
  ${grid}
  <line x1="0" y1="${MID}" x2="${W}" y2="${MID}" stroke="#ffffff33" stroke-width="1"/>
  ${peaks}
  <path d="${rmsPath}" fill="none" stroke="#4ade80" stroke-width="2"/>
  <text x="10" y="${H - 12}" font-family="monospace" font-size="16" fill="#D4AF37">
    ${inArg.split(/[\\/]/).pop()} — ${durationSec.toFixed(1)}s, ${sampleRate}Hz, ${numChannels}ch  (green = RMS envelope)
  </text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(resolve(outArg));

// Per-second RMS printout
console.log(`Duration: ${durationSec.toFixed(2)}s  Channels: ${numChannels}  Rate: ${sampleRate}`);
let peak = 0;
for (const v of mono) peak = Math.max(peak, Math.abs(v));
console.log(`Peak amplitude: ${peak.toFixed(3)}`);
console.log('\nPer-second RMS (bar chart):');
for (let s = 0; s < Math.ceil(durationSec); s++) {
  let sum = 0;
  let n = 0;
  for (let i = s * sampleRate; i < Math.min((s + 1) * sampleRate, frameCount); i++) {
    sum += mono[i] * mono[i];
    n++;
  }
  const rms = Math.sqrt(sum / (n || 1));
  const bars = '█'.repeat(Math.round(rms * 120));
  console.log(`  ${String(s).padStart(2)}s ${rms.toFixed(3)} ${bars}`);
}
