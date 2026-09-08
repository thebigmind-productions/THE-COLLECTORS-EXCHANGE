/**
 * Generates royalty-free sound effects from scratch as 44.1kHz stereo WAV files.
 *
 * Everything here is synthesized mathematically — no sampled or licensed audio —
 * so the output is safe to use commercially without attribution.
 *
 * Run: node tools/generate-sfx.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'audio');
const SAMPLE_RATE = 44100;

/* ------------------------------------------------------------------ */
/*  WAV ENCODING                                                       */
/* ------------------------------------------------------------------ */

function encodeWav(channels) {
  const numChannels = channels.length;
  const numFrames = channels[0].length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // audio format = PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      // Clamp to avoid wrapping distortion on peaks.
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      buffer.writeInt16LE(Math.round(s * 32767), offset);
      offset += 2;
    }
  }
  return buffer;
}

/* ------------------------------------------------------------------ */
/*  DSP HELPERS                                                        */
/* ------------------------------------------------------------------ */

const frames = (seconds) => Math.floor(seconds * SAMPLE_RATE);

/** Deterministic pseudo-random so regenerating gives identical files. */
function makeRandom(seed = 12345) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return (s / 4294967296) * 2 - 1;
  };
}

/** Simple one-pole low-pass. cutoff is 0..1 (fraction of Nyquist). */
function lowPass(input, cutoff) {
  const out = new Float32Array(input.length);
  let prev = 0;
  for (let i = 0; i < input.length; i++) {
    prev = prev + cutoff * (input[i] - prev);
    out[i] = prev;
  }
  return out;
}

/** One-pole high-pass (input minus its low-passed version). */
function highPass(input, cutoff) {
  const lp = lowPass(input, cutoff);
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] - lp[i];
  return out;
}

/** Exponential decay envelope. */
function decayEnv(length, tau) {
  const env = new Float32Array(length);
  for (let i = 0; i < length; i++) env[i] = Math.exp((-i / SAMPLE_RATE) * tau);
  return env;
}

/** Attack-decay envelope with a short fade-in to avoid clicks. */
function adEnv(length, attackSec, tau) {
  const env = decayEnv(length, tau);
  const attackFrames = Math.max(1, frames(attackSec));
  for (let i = 0; i < Math.min(attackFrames, length); i++) {
    env[i] *= i / attackFrames;
  }
  return env;
}

/** Always fade the last few ms so files never end on a click. */
function fadeOutTail(buf, seconds = 0.02) {
  const n = Math.min(frames(seconds), buf.length);
  for (let i = 0; i < n; i++) {
    buf[buf.length - 1 - i] *= i / n;
  }
  return buf;
}

function toStereo(mono, spread = 0) {
  if (spread === 0) return [mono, mono];
  // Slight haas-style widening for atmosphere, kept mono-compatible.
  const delay = frames(spread);
  const right = new Float32Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    right[i] = i >= delay ? mono[i - delay] : 0;
  }
  return [mono, right];
}

function normalize(buf, peak = 0.9) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max === 0) return buf;
  const gain = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= gain;
  return buf;
}

function save(name, channels) {
  const path = resolve(OUT_DIR, name);
  writeFileSync(path, encodeWav(channels));
  const seconds = (channels[0].length / SAMPLE_RATE).toFixed(2);
  console.log(`  ✓ ${name}  (${seconds}s)`);
}

/* ------------------------------------------------------------------ */
/*  SOUND DESIGN                                                       */
/* ------------------------------------------------------------------ */

/** Airy noise sweep for scene transitions. */
function makeWhoosh() {
  const len = frames(0.9);
  const rnd = makeRandom(7);
  const noise = new Float32Array(len);
  for (let i = 0; i < len; i++) noise[i] = rnd();

  // Sweep a band of noise upward then back down — reads as motion.
  const out = new Float32Array(len);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const cutoff = 0.02 + Math.sin(t * Math.PI) * 0.35;
    lp = lp + cutoff * (noise[i] - lp);
    // Bell-shaped amplitude so it swells and releases.
    out[i] = lp * Math.sin(t * Math.PI) ** 1.5;
  }

  const shaped = highPass(out, 0.02);
  return toStereo(fadeOutTail(normalize(shaped, 0.55)), 0.008);
}

/** Warm metallic chime for logo/brand reveals — inharmonic partials, like struck brass. */
function makeChime() {
  const len = frames(2.6);
  const out = new Float32Array(len);

  const root = 528; // pleasant, bright but not piercing
  // Inharmonic ratios give a bell character rather than a pure organ tone.
  const partials = [
    { ratio: 1.0, gain: 1.0, tau: 1.6 },
    { ratio: 2.01, gain: 0.5, tau: 2.2 },
    { ratio: 2.99, gain: 0.28, tau: 2.8 },
    { ratio: 4.18, gain: 0.16, tau: 3.6 },
    { ratio: 5.43, gain: 0.09, tau: 4.4 },
  ];

  for (const p of partials) {
    const env = adEnv(len, 0.004, p.tau);
    const freq = root * p.ratio;
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      out[i] += Math.sin(2 * Math.PI * freq * t) * env[i] * p.gain;
    }
  }

  // A touch of low body so it doesn't sound thin on phone speakers.
  const bodyEnv = adEnv(len, 0.01, 3.0);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    out[i] += Math.sin(2 * Math.PI * (root / 2) * t) * bodyEnv[i] * 0.18;
  }

  return toStereo(fadeOutTail(normalize(out, 0.8), 0.08), 0.011);
}

/** Deep, soft impact for headline hits and cuts. */
function makeImpact() {
  const len = frames(1.4);
  const out = new Float32Array(len);

  // Pitch-dropping sine = the classic cinematic "thump".
  let phase = 0;
  const env = adEnv(len, 0.002, 4.5);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const freq = 110 * Math.exp(-t * 3.2) + 34; // sweeps 110Hz -> ~34Hz
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    out[i] = Math.sin(phase) * env[i];
  }

  // Short noise transient for attack definition.
  const rnd = makeRandom(21);
  const clickLen = frames(0.05);
  const clickEnv = decayEnv(clickLen, 60);
  const click = new Float32Array(len);
  for (let i = 0; i < clickLen; i++) click[i] = rnd() * clickEnv[i];
  const clickShaped = lowPass(click, 0.25);
  for (let i = 0; i < len; i++) out[i] += clickShaped[i] * 0.35;

  return toStereo(fadeOutTail(normalize(out, 0.85), 0.05));
}

/** Tiny UI tick for badge/stat pop-ins. */
function makeTick() {
  const len = frames(0.22);
  const out = new Float32Array(len);
  const env = adEnv(len, 0.001, 26);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    out[i] =
      (Math.sin(2 * Math.PI * 1720 * t) * 0.6 + Math.sin(2 * Math.PI * 2580 * t) * 0.4) * env[i];
  }
  return toStereo(fadeOutTail(normalize(out, 0.45), 0.02));
}

/**
 * Ambient bed: a slow, evolving minor-key pad.
 * Loopable and quiet enough to sit under voiceover or captions.
 */
function makeAmbientBed(seconds = 30) {
  const len = frames(seconds);
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  // A minor 9 — warm, unresolved, "heritage" rather than upbeat.
  const voices = [
    { freq: 110.0, gain: 0.5, drift: 0.06 }, // A2
    { freq: 164.81, gain: 0.36, drift: 0.09 }, // E3
    { freq: 261.63, gain: 0.26, drift: 0.07 }, // C4
    { freq: 329.63, gain: 0.18, drift: 0.11 }, // E4
    { freq: 493.88, gain: 0.1, drift: 0.13 }, // B4 (the 9th)
  ];

  for (const v of voices) {
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      // Gentle detune drift keeps it from sounding synthetic/static.
      const vibrato = Math.sin(2 * Math.PI * v.drift * t) * 0.4;
      phase += (2 * Math.PI * (v.freq + vibrato)) / SAMPLE_RATE;
      // Slow amplitude swell, offset per voice.
      const swell = 0.72 + 0.28 * Math.sin(2 * Math.PI * (v.drift / 3) * t + v.freq);
      const s = Math.sin(phase) * v.gain * swell;
      // Spread voices across the stereo field.
      const pan = (v.freq % 200) / 200;
      left[i] += s * (1 - pan * 0.4);
      right[i] += s * (0.6 + pan * 0.4);
    }
  }

  // Roll off highs so it sits behind narration/music rather than competing.
  const l = lowPass(left, 0.06);
  const r = lowPass(right, 0.06);

  // Long fade in/out so it can be looped or trimmed cleanly.
  const fade = frames(2.5);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    l[i] *= g;
    r[i] *= g;
    l[len - 1 - i] *= g;
    r[len - 1 - i] *= g;
  }

  normalize(l, 0.32);
  normalize(r, 0.32);
  return [l, r];
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                               */
/* ------------------------------------------------------------------ */

mkdirSync(OUT_DIR, { recursive: true });
console.log('Generating royalty-free SFX (synthesized, no sampled audio)...\n');

save('whoosh.wav', makeWhoosh());
save('chime.wav', makeChime());
save('impact.wav', makeImpact());
save('tick.wav', makeTick());
save('ambient-bed.wav', makeAmbientBed(30));

console.log(`\nDone. Files written to public/audio/`);
console.log(
  'These are generated from scratch (pure synthesis) and carry no third-party licensing.',
);
