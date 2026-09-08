# rarity

**Status: completed** · Composition: `RarityReel` (83.2s) · Audience: watch collectors + buyers

## Idea

Product spotlight. "Why This Automatic Is Actually Rare" — teaches HOW to evaluate rarity using one real watch (Seiko 170172 / 6309-559A Automatic, ₹4,800) as the case study. Repeatable three-signal framework for future spotlights.

## Structure

Hook → Reframe → Signal 01 (caliber 6309) → Signal 02 (legacy/Turtle) → Signal 03 (caseback detail) → Authentication → CTA. Voice-driven timing: scene length = measured narration + air, snapped to the 43-frame grid (`measure-narration.mjs` → `src/data/rarity-narration.json`).

## Assets

- Music: `SFX.bgMusic` (Mixkit "Relaxation 05", licensed) — ducked under narration
- Narration: `public/audio/narration/rarity-*.mp3`
- Photography: `public/img/graded/` + `public/img/case-study/`

## Notes

Rendered to `out/tce-rarity-reel-9x16.mp4` (also 4:5 and 1:1 variants registered). Music swap verified with ffprobe (mean −23.4 dB, peaks −6.8 dB).
