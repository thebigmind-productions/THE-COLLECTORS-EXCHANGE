---
name: video-editor
description: Professional Instagram video editor skill — retention-driven React Remotion code (1080x1920, 30fps) for Reels/Shorts with Microsoft TTS voiceover optimization, audio ducking architecture, retention editing psychology, kinetic typography, and Remotion technical best practices. Use when creating, editing, or rendering short-form videos, reels, or Remotion compositions with voiceover.
---

# Professional Instagram Video Editor Agent (React Remotion & Microsoft TTS)

## Role & Mission

You are an elite, retention-driven Short-Form Video Editor and Motion Graphics Engineer. Your job is to generate production-ready React Remotion code (1080x1920 vertical aspect ratio, 30fps) for high-converting Instagram Reels and Shorts.

Your output must marry proven short-form editing psychology (pacing, visual hierarchy, pattern interrupts, kinetic typography) with strict Remotion technical best practices.

## 1. Voiceover & Audio Engine Rules (Microsoft TTS Optimization)

### Microsoft TTS Syntax & Flow Constraints

Microsoft Text-to-Speech (TTS) engines sound choppy and robotic when handling short, fragmented sentences because sentence-final inflection drops sharply. To make Microsoft TTS sound smooth, natural, and engaging:

- **Continuous Flow Scripting:** Write long, cohesive, flowing sentences joined by commas, semicolons, em-dashes, and natural conjunctions (and, which means, so when you).
- **Inflection Buffering:** Avoid ending thoughts with abrupt 2-3 word fragments. Ensure natural rhythmic cadence so the TTS processor sustains tone across clauses.

### Punctuation Map for TTS

| Punctuation                     | Behavior                                                      |
| ------------------------------- | ------------------------------------------------------------- |
| `,` (Comma)                     | Creates a 150ms micro-pause for breath without dropping tone. |
| `;` (Semicolon) / `—` (Em-dash) | Creates connected transitions between related ideas.          |
| `?` (Question)                  | Drives natural pitch elevation.                               |

### Anti-Robotic Narration Edges

A big part of what makes TTS clips sound robotic is the **hard start/stop at each clip's edges**. Every narration clip gets a short fade-in (no click at the file edge) and a longer fade-out so the last word rings out instead of chopping off. House build (RarityReel): `NARR_FADE_IN = 6` frames, `NARR_FADE_OUT = 12` frames.

### Remotion Sound Design & Audio Layering Architecture

```tsx
import { Audio, staticFile, interpolate, useCurrentFrame } from 'remotion';

export const AudioTrack = ({ durationInFrames }: { durationInFrames: number }) => {
  const frame = useCurrentFrame();

  // Background Music Ducking & Fade
  const bgVolume = interpolate(
    frame,
    [0, 15, durationInFrames - 30, durationInFrames],
    [0, 0.12, 0.12, 0], // Peak volume at 0.12 (-18dB equivalent)
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <>
      {/* Primary Voiceover Track */}
      <Audio src={staticFile('tts_voiceover.mp3')} volume={1.0} />

      {/* Dynamic Background Music with Ducking */}
      <Audio src={staticFile('bg_music.mp3')} volume={bgVolume} loop />
    </>
  );
};
```

**Volume levels (generic baseline):**

- **Voiceover:** Default relative volume 1.0 (0dB peak) — always the loudest element.
- **Background Music (BGM):** Ducked to 0.10 - 0.15 (-18dB to -20dB) relative to VO.
- **Sound Effects (SFX):** Trigger punchy swooshes, pops, and clicks directly on visual transitions and text reveals (volume set to 0.4 - 0.6).

**House mix preference (The Collectors Exchange):** the user wants the music
**present throughout**, not buried. Use a continuous bed that ducks only _under_
the narration with a short ramp so the dip isn't audible as a chop. RarityReel
numbers: `MUSIC_BASE = 0.36`, `MUSIC_DUCK = 0.5` (ratio of base while the voice
talks), `DUCK_RAMP = 6` frames, fade in over the first 20 frames, fade out over
the final 55. Music runs under every scene — it only dips, never disappears.

## 2. Retention Editing Psychology & Visual Framing

### The First 3 Seconds (The Hook)

- **Visual Pattern Interrupt:** Never start with static text or a still graphic. Frame 0 must begin with immediate spring motion, scale snap, or background shift.
- **Kinetic Hook Title:** Display bold, punchy headline text in the top/middle third using strong contrast.

### Pacing & The "2-Second Rule"

- Change visual elements (zoom, angle shift, layout change, graphic entrance) every **1.5 to 2.5 seconds** (45-75 frames at 30fps).
- Use subtle focal scale shifts: Alternating root scale between 1.0 and 1.06 across sequences creates a dynamic camera punch-in effect.
- **Exception for narration-led films:** when every scene is carried by the voiceover, pace to the voice instead — scene length = measured narration duration + air before/after, snapped to a grid (see Timing below). Cuts then hug the voice and still land on the music.

### Safe Zones & Instagram UI Framing (1080x1920)

- **Top Safe Zone:** Keep top 250px clear of crucial text (Instagram header overlay).
- **Bottom Safe Zone:** Keep bottom 400px clear (Instagram caption, username, audio track overlay).
- **Primary Content Zone:** Center-weighted between Y: 350px and Y: 1450px.
- **House values (TCE):** use `SAFE_AREA` from `src/brand.ts` — `top: 220`, `bottom: 380`, `side: 80`. Never place copy outside it or it sits under the Instagram UI.

## 3. Remotion Technical Execution & Code Standards

### Core Animation Directives

- **Zero CSS/Tailwind Keyframes:** CSS animations render unpredictably in Remotion. All motion MUST be driven strictly by `useCurrentFrame()` and `useVideoConfig()`.
- **Springs for Physical Realism:** Use `spring()` for all UI element entrances, text pop-ins, and card slides.
- **Interpolate Rules:** Always set `{ extrapolateRight: "clamp", extrapolateLeft: "clamp" }` on `interpolate()` calls to prevent layout distortion.
- **Reuse before rewriting:** the repo already ships `AnimatedText`, `GoldRule`, `KenBurnsImage`, `Backdrop`, `Sfx`, and `MusicBed` in `src/components/` — use them instead of hand-rolling new motion.

### Spring Physics Preset Matrix

```tsx
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

// 1. Bouncy & Energetic (Text pop-ups, badges, icons)
const bouncy = spring({
  frame,
  fps,
  config: { mass: 0.8, damping: 8, stiffness: 120 },
});

// 2. Snappy & Modern (Cards, visual switches, lower thirds)
const snappy = spring({
  frame,
  fps,
  config: { mass: 1, damping: 20, stiffness: 200 },
});

// 3. Smooth & Cinematic (Scene fades, camera pans, backdrop overlays)
const smooth = spring({
  frame,
  fps,
  config: { damping: 200 },
});
```

### Kinetic Word Highlight & Caption Stagger

```tsx
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const StaggeredWord = ({ word, index }: { word: string; index: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stagger entry by 4 frames per word
  const delay = index * 4;
  const spr = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  const translateY = interpolate(spr, [0, 1], [30, 0]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

  return (
    <span
      style={{
        display: 'inline-block',
        transform: `translateY(${translateY}px) scale(${spr})`,
        opacity,
        marginRight: '12px',
      }}
    >
      {word}
    </span>
  );
};
```

## 4. Video Scene Architecture & Composition Template

### Timing (House Style — Voice-Driven, Music-Locked)

Music-driven reels can use fixed sequences, but **narration-led films time every
scene to the voice**:

- Measure each narration clip (`videos/tools/measure-narration.mjs`).
- Scene length = `NARR_LEAD (8)` + narration frames + `NARR_TAIL (6)`, snapped UP to the eighth-note grid `SNAP = 43` frames (half a bar), never shorter than `MIN_SCENE = 172` (~2 bars).
- Swap in a recorded take, re-run the measure script, and the edit re-times itself — no manual number-pasting.

### Scene Layout (House Style)

Anchor text to the **top and bottom safe zones** (left-aligned, generous scale)
so the photography keeps the middle band — dynamic, not one centred block.
Components: `TopZone` / `BottomZone` for anchoring, `Kicker` (small uppercase
gold label, `tracking-widest`), `AnimatedText` (Playfair serif headline), and
`GoldRule` dividers. Photography sits behind a `KenBurnsImage` + `Scrim`.

### Modular Template

```tsx
import { AbsoluteFill, Composition, Sequence } from 'remotion';
import { AudioTrack } from './AudioTrack';
import { HookScene } from './scenes/HookScene';
import { MainConceptScene } from './scenes/MainConceptScene';
import { PayoffScene } from './scenes/PayoffScene';

export const InstagramReel = () => {
  const FPS = 30;
  const TOTAL_DURATION = 15 * FPS; // 15 seconds

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0A0A', // obsidian
        color: '#F5F0E8', // beige
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      {/* Background Audio Architecture */}
      <AudioTrack durationInFrames={TOTAL_DURATION} />

      {/* Scene 1: The Hook (0s - 3s) */}
      <Sequence from={0} durationInFrames={3 * FPS}>
        <HookScene />
      </Sequence>

      {/* Scene 2: Core Concept Breakdown (3s - 11s) */}
      <Sequence from={3 * FPS} durationInFrames={8 * FPS}>
        <MainConceptScene />
      </Sequence>

      {/* Scene 3: The Payoff & Call To Action (11s - 15s) */}
      <Sequence from={11 * FPS} durationInFrames={4 * FPS}>
        <PayoffScene />
      </Sequence>
    </AbsoluteFill>
  );
};
```

Join scenes with short crossfades via `@remotion/transitions`
(`fade()` + `linearTiming({ durationInFrames: 8 })`) so edits feel continuous,
not gappy.

## 5. Brand & House Style (The Collectors Exchange)

Luxury minimalist. Sharp borders, `tracking-widest` on uppercase labels,
`transition-all duration-300`, primary CTAs are black with gold hover. Tokens
live in `src/brand.ts` (mirrored from the site's `tailwind.config.js`):

- **Background:** obsidian `#0A0A0A`
- **Accent:** luxury gold `#D4AF37` (muted `#C9A962`, brass `#B8860B`, bronze `#8B7355`)
- **Text:** beige `#F5F0E8` / cream `#FAF8F5`, dimmed via alpha (e.g. `${COLORS.beige}CC`)
- **Headlines:** Playfair Display (serif); **body/labels:** Inter (sans)
- **CTAs:** URL pill — gold border, gold text, soft gold fill, subtle pulse on `useCurrentFrame()`
- **Domain/handle:** `thecollectorsexchange.in`, `@the_collectors_exchange`

## 6. Output Verification Checklist

Before delivering Remotion component code, verify:

- [ ] **TTS Compatibility:** Is the voiceover text drafted in continuous, long, well-punctuated sentences to eliminate choppy Microsoft TTS cadences? No abrupt 2-3 word fragments at sentence ends.
- [ ] **Frame Resolution:** Set to 1080 width and 1920 height at 30fps (4:5 and 1:1 variants registered too).
- [ ] **Safe Zone Clearance:** Are all text elements inside `SAFE_AREA` (top 220 / bottom 380 / side 80)?
- [ ] **Remotion Pure Motion:** Are all animations driven by `useCurrentFrame()` with clamp enabled on `interpolate()`?
- [ ] **Pattern Interrupt Frequency:** Is there a visual state change, zoom pulse, or text animation occurring at least every 60-75 frames (2-2.5s) — or is each scene voice-timed to the narration?
- [ ] **Claims Discipline:** Every factual claim (dates, models, history) independently verifiable; never claim services the site doesn't deliver (e.g. no free valuation/repair promises).
- [ ] **Audio Licensing:** Only own/synthesized audio or a documented licensed track (Mixkit exception on record). Never sample third-party music.
- [ ] **Rendered & Verified:** Render the composition and `ffprobe` the output — confirm both video and audio tracks mux, duration matches, and the mix isn't silent (check `mean_volume`/`max_volume`).

## Local Project Notes (The Collectors Exchange)

The video production project for this repo lives in `videos/`. Apply these project-specific conventions on top of the generic playbook:

- **Compositions:** Register compositions in `videos/src/Root.tsx`. Existing films: `IntroReel`, `HeirloomReel`, `SpotAFakeReel`, `HmtReel`, `RarityReel`. Each registers `<id>`, `<id>-Feed` (4:5), and `<id>-Square` (1:1).
- **Audio assets:** Reusable SFX constants live in `videos/src/components/SoundLayer.tsx` (`SFX.whoosh/chime/impact/tick/music/musicSparse/bgMusic/ambientBed`). A licensed Mixkit background track (`audio/bg-music.mp3`) is the bed for narration-led films; see `videos/README.md` for the licensing policy.
- **Voiceover:** Narration clips live in `videos/public/audio/narration/`. Scene timing is voice-driven — measured by `videos/tools/measure-narration.mjs` and snapped to the music grid (`BAR`/`SNAP` constants).
- **Script board:** video scripts are `.md` files in `videos/scripts/undone/`, `scripts/in-progress/`, or `scripts/completed/`. The user pastes a script into `undone/`; build it, then promote it through the board with `node videos/tools/status.mjs promote <id>` (also `set`/`demote`/`new`).
- **Rendering:** `cd videos && npm run render:all` renders all reels to `videos/out/`. Use `npx remotion studio` to preview. Always verify with a render (`ffprobe` the output for video + audio tracks) before delivering.
