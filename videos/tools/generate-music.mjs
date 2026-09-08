/**
 * Composes the background music bed from scratch — no sampled or licensed audio.
 *
 * Musical design: a warm, unhurried Am7 - Fmaj7 - Cmaj7 - G6 progression.
 * Minor-leaning but unresolved, which reads as "heritage / considered" rather
 * than upbeat-commercial. Layers enter progressively so the track builds under
 * the video instead of sitting flat:
 *
 *   bars 1-2  pad + bass          (sparse, sets mood)
 *   bars 3-4  + plucked arpeggio  (movement enters)
 *   bars 5-6  + counter-melody    (fullest point, lands on the value props)
 *   bars 7-8  thins out + resolves (space for the CTA)
 *
 * Run: node tools/generate-music.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'audio');
const SR = 44100;

const BPM = 84;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = 8;
const TOTAL = BAR * BARS + 2.5; // + tail for the final chord to ring out

/**
 * `--sparse` produces a stripped-back cut: pad + bass + a quieter arpeggio,
 * no counter-melody, no pulse. Intended for reflective / storytelling videos
 * where a melody would compete with the copy on screen.
 */
const SPARSE = process.argv.includes('--sparse');
const OUT_NAME = SPARSE ? 'music-bed-sparse.wav' : 'music-bed.wav';

/* ------------------------------------------------------------------ */
/*  ENCODING                                                           */
/* ------------------------------------------------------------------ */

function encodeWav(channels) {
  const numChannels = channels.length;
  const numFrames = channels[0].length;
  const blockAlign = numChannels * 2;
  const dataSize = numFrames * blockAlign;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * blockAlign, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let o = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      buf.writeInt16LE(Math.round(s * 32767), o);
      o += 2;
    }
  }
  return buf;
}

/* ------------------------------------------------------------------ */
/*  MUSIC THEORY                                                       */
/* ------------------------------------------------------------------ */

const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A3" -> frequency in Hz (A4 = 440). */
function freq(name) {
  const m = /^([A-G])(#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note: ${name}`);
  const semis = NOTES[m[1]] + (m[2] ? 1 : 0);
  const octave = parseInt(m[3], 10);
  const midi = (octave + 1) * 12 + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** One chord per two bars. */
const PROGRESSION = [
  { bass: 'A1', notes: ['A3', 'C4', 'E4', 'G4'] }, // Am7
  { bass: 'F1', notes: ['F3', 'A3', 'C4', 'E4'] }, // Fmaj7
  { bass: 'C2', notes: ['C4', 'E4', 'G4', 'B4'] }, // Cmaj7
  { bass: 'G1', notes: ['G3', 'B3', 'D4', 'E4'] }, // G6
];

/* ------------------------------------------------------------------ */
/*  SYNTHESIS                                                          */
/* ------------------------------------------------------------------ */

const len = Math.floor(TOTAL * SR);
const L = new Float32Array(len);
const R = new Float32Array(len);

function addNote({ freqHz, startSec, durSec, gain, timbre = 'pluck', pan = 0.5, detune = 0 }) {
  const start = Math.floor(startSec * SR);
  const n = Math.floor(durSec * SR);
  if (start >= len) return;

  for (let i = 0; i < n; i++) {
    const idx = start + i;
    if (idx >= len) break;
    const t = i / SR;
    let env;
    let sample = 0;

    if (timbre === 'pluck') {
      // Fast attack, exponential decay — reads as a struck/plucked string.
      const attack = 0.005;
      env = t < attack ? t / attack : Math.exp(-(t - attack) * 3.2);
      const f = freqHz * (1 + detune);
      // Odd harmonics with decreasing weight for a warm, woody body.
      sample =
        Math.sin(2 * Math.PI * f * t) * 1.0 +
        Math.sin(2 * Math.PI * f * 2 * t) * 0.28 +
        Math.sin(2 * Math.PI * f * 3 * t) * 0.12 +
        Math.sin(2 * Math.PI * f * 4.2 * t) * 0.05;
    } else if (timbre === 'bass') {
      const attack = 0.02;
      env = t < attack ? t / attack : Math.exp(-(t - attack) * 0.9);
      const f = freqHz;
      sample = Math.sin(2 * Math.PI * f * t) * 1.0 + Math.sin(2 * Math.PI * f * 2 * t) * 0.18;
    } else {
      // 'pad' — slow swell, sustained, gently detuned for width.
      const attack = 0.6;
      const release = 0.8;
      const sustainEnd = durSec - release;
      if (t < attack) env = t / attack;
      else if (t > sustainEnd) env = Math.max(0, (durSec - t) / release);
      else env = 1;
      env *= 0.9;
      const f = freqHz * (1 + detune);
      sample =
        Math.sin(2 * Math.PI * f * t) * 0.6 +
        Math.sin(2 * Math.PI * f * 1.003 * t) * 0.4 + // chorus-y beating
        Math.sin(2 * Math.PI * f * 0.5 * t) * 0.22; // sub octave
    }

    const v = sample * env * gain;
    L[idx] += v * (1 - pan);
    R[idx] += v * pan;
  }
}

/* --- Layer 1: pad (all 8 bars) ------------------------------------ */
for (let bar = 0; bar < BARS; bar++) {
  const chord = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length];
  const startSec = bar * BAR;
  // Fade the pad back in the final two bars to open space for the CTA.
  const barGain = bar >= 6 ? 0.6 : 1;
  chord.notes.forEach((note, i) => {
    addNote({
      freqHz: freq(note) / 2, // an octave down: sits under everything
      startSec,
      durSec: BAR,
      gain: 0.075 * barGain,
      timbre: 'pad',
      pan: 0.5 + (i - 1.5) * 0.11,
      detune: (i - 1.5) * 0.0016,
    });
  });
}

/* --- Layer 2: bass (all 8 bars, root on beat 1 and 3) -------------- */
for (let bar = 0; bar < BARS; bar++) {
  const chord = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length];
  const f = freq(chord.bass);
  addNote({
    freqHz: f,
    startSec: bar * BAR,
    durSec: BEAT * 2.4,
    gain: 0.3,
    timbre: 'bass',
    pan: 0.5,
  });
  addNote({
    freqHz: f,
    startSec: bar * BAR + BEAT * 2,
    durSec: BEAT * 1.8,
    gain: 0.19,
    timbre: 'bass',
    pan: 0.5,
  });
}

/* --- Layer 3: plucked arpeggio (enters bar 3) ---------------------- */
for (let bar = 2; bar < BARS; bar++) {
  const chord = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length];
  // Eighth-note arpeggio, up then partially down — keeps it flowing.
  const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
  // Ramp in over the first bar it appears so the entry isn't abrupt.
  const layerGain = bar === 2 ? 0.55 : bar >= 7 ? 0.5 : 1;

  for (let step = 0; step < 8; step++) {
    // Sparse mode plays only on the beat, not every eighth: half the notes,
    // twice the space for the copy on screen.
    if (SPARSE && step % 2 !== 0) continue;
    const noteIdx = pattern[step];
    const t = bar * BAR + step * (BEAT / 2);
    addNote({
      freqHz: freq(chord.notes[noteIdx]),
      startSec: t,
      durSec: BEAT * 1.4,
      gain: (SPARSE ? 0.08 : 0.115) * layerGain,
      timbre: 'pluck',
      // Alternate placement slightly L/R for a sense of space.
      pan: step % 2 === 0 ? 0.42 : 0.58,
    });
  }
}

/* --- Layer 4: counter-melody (bars 5-6, the emotional peak) -------- */
const MELODY = [
  { note: 'E5', bar: 4, beat: 0, dur: 1.5 },
  { note: 'C5', bar: 4, beat: 1.5, dur: 1.0 },
  { note: 'D5', bar: 4, beat: 2.5, dur: 1.5 },
  { note: 'E5', bar: 5, beat: 0, dur: 1.0 },
  { note: 'G5', bar: 5, beat: 1, dur: 2.0 },
  { note: 'E5', bar: 5, beat: 3, dur: 1.0 },
  { note: 'C5', bar: 6, beat: 0, dur: 2.5 },
];
if (!SPARSE) {
  for (const m of MELODY) {
    addNote({
      freqHz: freq(m.note),
      startSec: m.bar * BAR + m.beat * BEAT,
      durSec: m.dur * BEAT,
      gain: 0.13,
      timbre: 'pluck',
      pan: 0.5,
    });
  }
}

/* --- Layer 5: soft pulse on beats 1 & 3 (momentum, not percussion) - */
for (let bar = 1; bar < BARS && !SPARSE; bar++) {
  for (const beatOffset of [0, 2]) {
    const start = Math.floor((bar * BAR + beatOffset * BEAT) * SR);
    const n = Math.floor(0.16 * SR);
    for (let i = 0; i < n; i++) {
      const idx = start + i;
      if (idx >= len) break;
      const t = i / SR;
      const env = Math.exp(-t * 26);
      // Low sine thump, felt more than heard on phone speakers.
      const v = Math.sin(2 * Math.PI * 62 * t) * env * 0.14;
      L[idx] += v;
      R[idx] += v;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  SPACE: simple multi-tap delay for a sense of room                  */
/* ------------------------------------------------------------------ */

function addReverb(ch, taps) {
  const out = Float32Array.from(ch);
  for (const { delaySec, gain } of taps) {
    const d = Math.floor(delaySec * SR);
    for (let i = d; i < ch.length; i++) {
      out[i] += ch[i - d] * gain;
    }
  }
  return out;
}

const REVERB_L = [
  { delaySec: 0.031, gain: 0.22 },
  { delaySec: 0.079, gain: 0.16 },
  { delaySec: 0.143, gain: 0.11 },
  { delaySec: 0.211, gain: 0.07 },
];
const REVERB_R = [
  { delaySec: 0.037, gain: 0.22 },
  { delaySec: 0.089, gain: 0.16 },
  { delaySec: 0.157, gain: 0.11 },
  { delaySec: 0.229, gain: 0.07 },
];

let outL = addReverb(L, REVERB_L);
let outR = addReverb(R, REVERB_R);

/* ------------------------------------------------------------------ */
/*  MASTER: gentle low-pass, fades, normalise                          */
/* ------------------------------------------------------------------ */

function lowPass(input, cutoff) {
  const out = new Float32Array(input.length);
  let prev = 0;
  for (let i = 0; i < input.length; i++) {
    prev = prev + cutoff * (input[i] - prev);
    out[i] = prev;
  }
  return out;
}

// Soften the top end so it never gets harsh on phone speakers.
outL = lowPass(outL, 0.42);
outR = lowPass(outR, 0.42);

// Fade in, and a long fade out so it resolves rather than cutting off.
const fadeIn = Math.floor(0.8 * SR);
const fadeOut = Math.floor(2.2 * SR);
for (let i = 0; i < fadeIn; i++) {
  const g = i / fadeIn;
  outL[i] *= g;
  outR[i] *= g;
}
for (let i = 0; i < fadeOut; i++) {
  const g = i / fadeOut;
  outL[len - 1 - i] *= g;
  outR[len - 1 - i] *= g;
}

// Normalise with headroom — the video mixes this under SFX and any voiceover.
let peak = 0;
for (let i = 0; i < len; i++) {
  peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
}
const gain = 0.82 / (peak || 1);
for (let i = 0; i < len; i++) {
  outL[i] *= gain;
  outR[i] *= gain;
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, OUT_NAME), encodeWav([outL, outR]));

console.log(`Composed ${OUT_NAME}`);
console.log(`  ${BPM} BPM, ${BARS} bars, ${TOTAL.toFixed(1)}s`);
console.log(`  Progression: Am7 - Fmaj7 - Cmaj7 - G6`);
console.log(
  SPARSE
    ? `  Layers: pad, bass, half-time arpeggio (no melody, no pulse)`
    : `  Layers: pad, bass, arpeggio (bar 3+), melody (bar 5-6), pulse`,
);
console.log(`  Fully synthesized — no third-party licensing.`);
