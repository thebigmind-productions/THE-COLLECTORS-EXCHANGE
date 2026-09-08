# TCE Videos — Remotion Studio

Instagram-first video production for The Collectors Exchange, built with
[Remotion](https://remotion.dev) (React → MP4).

## Quick start

```bash
cd videos
npm install
npm run studio      # opens the visual editor with live preview + scrubbing
```

Render:

```bash
npm run render:intro   # 9:16 Reel only
npm run render:all     # all three Instagram formats
```

Output lands in `out/`.

## The four films & why each exists

Each one targets a different audience and a different job. Posting all four
covers the funnel rather than saying the same thing louder.

| Composition     | Length | Job                                                                | Audience                |
| --------------- | ------ | ------------------------------------------------------------------ | ----------------------- |
| `IntroReel`     | 17.3s  | **Awareness.** Who TCE is, why it's trustworthy.                   | Cold traffic            |
| `HeirloomReel`  | 19.5s  | **Supply + emotion.** Earns DMs from people holding a watch.       | Heirloom holders        |
| `SpotAFakeReel` | 19.5s  | **Authority.** Earns saves/shares, defuses counterfeit fear.       | First-time buyers       |
| `HmtReel`       | 20.0s  | **Category desire.** Builds want for the stock TCE actually holds. | Indian watch collectors |

**`HeirloomReel` ("The Drawer")** opens with _"There's a watch in your father's
drawer."_ That line works because HMT supplied watches to millions of Indian
government employees as retirement gifts for decades — a dormant mechanical
watch in a family drawer is close to a shared national memory. The film sells
nothing directly; it creates recognition, then offers a low-friction next step.
It also feeds the marketplace's real bottleneck, which is **supply**, not demand.

**`SpotAFakeReel` ("3 ways to spot a fake")** is the authority play. On
Instagram, teach-something content earns _saves_ and _sends_, which weigh more
for reach than likes. The close reframes the lesson as the product: learn to do
this yourself, or buy where it's already been done.

> All three tips in that film are factually accurate and independently
> checkable. On an authority video a wrong claim costs more than it earns —
> if you edit the copy, keep it verifiable.

**`HmtReel` ("India's forgotten heirloom")** builds appetite for the category
the marketplace can actually fulfil. The live inventory is currently 17
products, every one of them in Timepieces, and most Indian vintage watch stock
is HMT — so this film sells the _category_, not stock it may not hold. Its
engine is scarcity: HMT's last factory closed on 1 May 2016, so supply is
finite by definition, which is a more durable reason to want one than a
discount. Every historical claim in it is independently checkable (Bangalore
1961, the Citizen collaboration, the retirement-gift tradition, the Janata /
Pilot / Sona models, the hand-wound calibre 0231 with Parashock).

### Claims discipline

Only say what the site actually delivers. Verified against the live FAQ and
policies: authentication before listing, KYC-checked sellers, 48-hour returns,
seller identity kept private, free domestic shipping.

**Deliberately not claimed:** free valuation, repair, or restoration services.
Promising those on a video whose entire point is trust would be self-defeating.

### Formats

Each composition is registered three ways — `<id>`, `<id>-Feed` (4:5), and
`<id>-Square` (1:1). Layouts are centre-composed so they crop safely.
`npm run render:all` does 9:16 only; add `--all-formats` for all three.

Instagram allows Reels up to 90s, but under ~20s holds retention best and loops
cleanly.

## How the edit is structured

Scene cuts are **locked to the music**. The bed is 84 BPM, so:

- 1 beat = 21.43 frames @ 30fps
- 1 bar = **86 frames**

`BAR` in `src/compositions/IntroReel.tsx` is the timing unit — every scene
length is expressed in bars, so cuts land on downbeats. This is most of why
the edit feels deliberate rather than arbitrary. If you change the BPM in
`tools/generate-music.mjs`, update `BAR` to match.

Scene order: Hook → Brand → Value props → Categories → CTA, joined by 14-frame
crossfades via `@remotion/transitions`.

## Audio

**Policy:** sound effects and the default music beds are synthesized from
scratch — no sampled, licensed, or third-party audio. The one exception is the
narrative-film background track `bg-music.mp3` ("Relaxation 05" by Lily J),
licensed from Mixkit under their free license (commercial use permitted, no
attribution required — keep the source URL on record). It has zero risk of
copyright claims or Instagram muting, but **only use files you can prove are
licensed.**

```bash
node tools/generate-sfx.mjs             # whoosh, chime, impact, tick, drone
node tools/generate-music.mjs           # full mix
node tools/generate-music.mjs --sparse  # stripped-back mix
```

The synthesized music is an Am7 – Fmaj7 – Cmaj7 – G6 progression with layers
entering progressively (pad+bass → arpeggio → melody → resolve) so it builds
under the video rather than sitting flat.

Two mixes, same progression so the brand sounds consistent:

- **full** (`music-bed.wav`) — with counter-melody and pulse. Used by the intro
  and the educational film, which should feel energetic.
- **sparse** (`music-bed-sparse.wav`) — half-time arpeggio, no melody, no pulse.
  Used by `HeirloomReel` and `HmtReel`, both of which are carried by their copy;
  a melody there would compete with the words.

Narration-led films (`RarityReel`) use the licensed Mixkit track
(`bg-music.mp3`, `SFX.bgMusic`) instead — a real ambient bed, ducked under the
voiceover. Source: https://mixkit.co/free-stock-music/mood/soothing/

To check an audio file's arrangement without listening:

```bash
node tools/analyze-audio.mjs public/audio/music-bed.wav out/wave.png 84
```

That prints per-second RMS and renders a waveform with bar gridlines.

## Imagery

Source photography lives in `public/img/candidates/`; the versions actually
used are the colour-graded ones in `public/img/graded/`.

```bash
node tools/grade-images.mjs      # applies the house look
node tools/contact-sheet.mjs public/img/graded out/sheet.jpg   # review grid
```

The grade (deepened shadows, slight desaturation, warm vignette) is what makes
stock photography from different photographers read as one brand world. Keep it
restrained — a heavy tint flattens everything into sepia and looks like a cheap
filter.

### Licensing note

Downloaded imagery is from **Unsplash**, whose licence permits commercial use
without attribution. When adding new photography:

- **Avoid legible third-party brand marks.** Several otherwise-beautiful
  candidates were rejected because Rolex / Omega / Fossil / Daniel Wellington
  logos were readable — showing those implies inventory or endorsement TCE may
  not have.
- Prefer unbranded, antique, warm-toned, dark-ground subjects.

## Brand tokens

`src/brand.ts` mirrors `tailwind.config.js` from the main site (colours, fonts,
formats). If the site palette changes, update it there.

`SAFE_AREA` keeps text clear of Instagram's UI overlays (header, caption,
action rail). Don't place copy outside it or it'll sit under the interface.

## Adding a new video

1. `node tools/status.mjs new <id>` — creates a script file in `scripts/undone/`.
2. Paste the video script into the file (idea, structure, TTS script, assets,
   checklist).
3. Build scenes in `src/components/Scenes.tsx` (or a new file).
4. Compose them in a new file under `src/compositions/`.
5. Register it in `src/Root.tsx` with a `<Composition>`.
6. It appears in the studio sidebar and is renderable by ID.

Track progress from the script board — every video is a `<id>.md` script in
exactly one of `scripts/undone/`, `scripts/in-progress/`, or
`scripts/completed/`:

```bash
node tools/status.mjs                     # show the board
node tools/status.mjs promote <id>        # undone -> in-progress -> completed
node tools/status.mjs demote <id>         # step back one status
node tools/status.mjs set <id> <status>   # jump to a specific status
```

Reusable pieces already available: `AnimatedText`, `GoldRule`, `KenBurnsImage`,
`Backdrop`, `Sfx`, `MusicBed`.
