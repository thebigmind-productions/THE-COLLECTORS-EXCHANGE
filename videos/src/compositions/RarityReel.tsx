import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { COLORS, SAFE_AREA } from '../brand';
import { AnimatedText, GoldRule } from '../components/AnimatedText';
import { KenBurnsImage } from '../components/KenBurnsImage';
import { Scrim } from '../components/Layout';
import { Sfx, SFX } from '../components/SoundLayer';
import rarityNarration from '../data/rarity-narration.json';

loadPlayfair();
loadInter();

/**
 * "Why This Automatic Is Actually Rare" — the product-spotlight film.
 *
 * Case study: Seiko 170172 / 6309-559A Automatic (₹4,800)
 *
 * STRATEGY
 * Positions TCE as the authority by teaching viewers HOW to evaluate rarity,
 * using one real watch as the case study. The three "signals" framework is
 * repeatable for future product spotlights (chronographs, dive watches,
 * discontinued brands).
 *
 * SHAPE
 * Hook (curiosity gap) → Reframe (assumption challenge) → Signal 01 (caliber)
 * → Signal 02 (legacy) → Signal 03 (detail collectors check) → Authentication
 * → CTA (this one's live, price, domain). Every scene is narrated by the
 * voice clips in public/audio/narration/.
 *
 * LAYOUT
 * Text is anchored to the top and bottom safe zones (left-aligned, generous
 * scale) so the photography keeps the middle band — the edit feels dynamic
 * instead of one centred block sitting on top of the image.
 *
 * RHYTHM
 * Scene length = measured narration length + air, snapped UP to the 43-frame
 * eighth-note grid so cuts hug the voice and still sit on the music. A subtle
 * music bed runs continuously and ducks under the narration.
 *
 * CLAIMS DISCIPLINE
 * All historical facts about the Seiko 6309 are independently verifiable:
 * - Production 1976–1988 (Mizeni, WatchProSite, TheSeikoGuy)
 * - 17 jewels, 21,600 bph (Mizeni movement database)
 * - Powered the "Turtle" divers (6309-7040/7049/7290) (Gear Patrol, Crystaltimes)
 * - 2015 SRP777 revival used 4R36, not 6309 (Crystaltimes, PolyWatch)
 * - Caseback engraving "6309-559A" visible on this specific piece
 *
 * Deliberately NOT claimed: production numbers, whether this specific dial is
 * "original" (we show the caseback proof, not make dial-condition claims),
 * any valuation, repair, or restoration service.
 */

const BAR = 86; // 84 BPM @ 30fps — one beat
const TRANSITION = 8; // short crossfade so scenes feel continuous, not gappy

/* ------------------------------------------------------------------ */
/*  LAYOUT HELPERS                                                     */
/* ------------------------------------------------------------------ */

/** Text anchored to the top safe zone, left-aligned — dynamic, not centred. */
const TopZone: React.FC<{ children: React.ReactNode; gap?: number }> = ({
  children,
  gap = 18,
}) => (
  <div
    style={{
      position: 'absolute',
      top: SAFE_AREA.top,
      left: SAFE_AREA.side,
      right: SAFE_AREA.side,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap,
    }}
  >
    {children}
  </div>
);

/** Text anchored to the bottom safe zone, left-aligned. */
const BottomZone: React.FC<{ children: React.ReactNode; gap?: number }> = ({
  children,
  gap = 16,
}) => (
  <div
    style={{
      position: 'absolute',
      bottom: SAFE_AREA.bottom,
      left: SAFE_AREA.side,
      right: SAFE_AREA.side,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap,
    }}
  >
    {children}
  </div>
);

const Kicker: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => (
  <AnimatedText
    delay={delay}
    fontSize={26}
    font="sans"
    weight={700}
    color={COLORS.luxuryGold}
    letterSpacing="0.3em"
    textTransform="uppercase"
    align="left"
  >
    {children}
  </AnimatedText>
);

/* ------------------------------------------------------------------ */
/*  SCENES                                                             */
/* ------------------------------------------------------------------ */

/**
 * Beat 1 — Hook. A specific, verifiable claim that creates a curiosity gap.
 * "A part not made since 1988" is more compelling than "this is rare" because
 * it names a date and implies scarcity without stating it.
 */
const HookScene: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.obsidian }}>
    <KenBurnsImage
      src={staticFile('img/graded/movement-macro.jpg')}
      direction="in"
      intensity={0.16}
      opacity={0.7}
    />
    <Scrim strength={0.72} />
    <TopZone gap={22}>
      <Kicker>A Seiko from the 1980s</Kicker>
      <AnimatedText delay={10} fontSize={92} weight={600} lineHeight={1.08} align="left" maxWidth={900}>
        This watch has a part
        <br />
        Seiko stopped making
        <br />
        in 1988.
      </AnimatedText>
    </TopZone>
    <BottomZone>
      <AnimatedText
        delay={28}
        fontSize={28}
        font="sans"
        weight={500}
        color={`${COLORS.beige}99`}
        letterSpacing="0.14em"
        align="left"
      >
        Seiko 6309 · 1976–1988
      </AnimatedText>
    </BottomZone>
  </AbsoluteFill>
);

/**
 * Beat 2 — Reframe the assumption. "Automatic" doesn't mean rare.
 * What matters is what's inside. Sets up the three-signal framework.
 */
const ReframeScene: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.obsidian }}>
    <KenBurnsImage
      src={staticFile('img/case-study/seiko-1.jpg')}
      direction="out"
      intensity={0.1}
      opacity={0.58}
    />
    <Scrim strength={0.74} />
    <TopZone gap={22}>
      <AnimatedText delay={0} fontSize={86} weight={600} lineHeight={1.1} align="left" maxWidth={900}>
        Everyone thinks
        <br />
        “automatic” means rare.
      </AnimatedText>
    </TopZone>
    <BottomZone gap={14}>
      <AnimatedText delay={14} fontSize={100} weight={600} color={COLORS.luxuryGold} align="left">
        It doesn't.
      </AnimatedText>
      <AnimatedText
        delay={26}
        fontSize={36}
        font="sans"
        weight={300}
        color={`${COLORS.beige}CC`}
        lineHeight={1.4}
        maxWidth={780}
        align="left"
        style={{ textShadow: '0 2px 18px rgba(0,0,0,0.85)' }}
      >
        Rarity is what's inside it.
      </AnimatedText>
    </BottomZone>
  </AbsoluteFill>
);

/**
 * Signal 01 — The Caliber. The 6309 is a documented, verifiable movement
 * with a clear production window. "No replacement was ever made" is true:
 * Seiko never produced another 6309.
 */
const CaliberScene: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.obsidian }}>
    <KenBurnsImage
      src={staticFile('img/graded/movement-macro-alt.jpg')}
      direction="in"
      intensity={0.14}
      opacity={0.62}
    />
    <Scrim strength={0.78} />
    <TopZone gap={20}>
      <Kicker>Signal 01 — The Caliber</Kicker>
      <AnimatedText delay={7} fontSize={80} weight={600} lineHeight={1.1} color={COLORS.luxuryGold} align="left">
        Seiko 6309.
      </AnimatedText>
    </TopZone>
    <BottomZone gap={14}>
      <AnimatedText
        delay={18}
        fontSize={36}
        font="sans"
        weight={300}
        color={`${COLORS.beige}CC`}
        lineHeight={1.42}
        maxWidth={780}
        align="left"
        style={{ textShadow: '0 2px 18px rgba(0,0,0,0.85)' }}
      >
        17 jewels · 21,600 beats per hour.
        <br />
        Seiko stopped producing it in 1988.
      </AnimatedText>
      <AnimatedText delay={38} fontSize={48} weight={600} color={COLORS.luxuryGold} align="left">
        No replacement was ever made.
      </AnimatedText>
    </BottomZone>
  </AbsoluteFill>
);

/**
 * Signal 02 — The Legacy. The 6309 powered the Turtle divers, one of the
 * most collected Seiko families. The 2015 revival used a different movement —
 * the 6309 was gone. This is the beat that converts a history fact into desire.
 */
const LegacyScene: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.obsidian }}>
    <KenBurnsImage
      src={staticFile('img/case-study/seiko-5.jpg')}
      direction="out"
      intensity={0.12}
      opacity={0.58}
    />
    <Scrim strength={0.76} />
    <TopZone gap={20}>
      <Kicker>Signal 02 — The Legacy</Kicker>
      <AnimatedText delay={7} fontSize={84} weight={600} lineHeight={1.1} align="left" maxWidth={880}>
        The collectors'
        <br />
        movement.
      </AnimatedText>
    </TopZone>
    <BottomZone gap={14}>
      <AnimatedText
        delay={20}
        fontSize={36}
        font="sans"
        weight={300}
        color={`${COLORS.beige}CC`}
        lineHeight={1.42}
        maxWidth={800}
        align="left"
        style={{ textShadow: '0 2px 18px rgba(0,0,0,0.85)' }}
      >
        It powered Seiko's legendary “Turtle” divers.
        <br />
        In 2015 the revival used a new movement —
      </AnimatedText>
      <AnimatedText delay={40} fontSize={54} weight={600} color={COLORS.luxuryGold} align="left">
        the 6309 was gone.
      </AnimatedText>
    </BottomZone>
  </AbsoluteFill>
);

/**
 * Signal 03 — The Detail. The caseback engraving is the proof. "6309-559A"
 * is visible on this specific watch — this is what collectors check, and
 * it's what TCE verifies before listing.
 */
const DetailScene: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.obsidian }}>
    <KenBurnsImage
      src={staticFile('img/case-study/seiko-4.jpg')}
      direction="in"
      intensity={0.12}
      opacity={0.64}
    />
    <Scrim strength={0.78} />
    <TopZone gap={20}>
      <Kicker>Signal 03 — The Detail</Kicker>
      <AnimatedText delay={7} fontSize={80} weight={600} lineHeight={1.1} align="left" maxWidth={880}>
        The detail
        <br />
        collectors check.
      </AnimatedText>
    </TopZone>
    <BottomZone gap={14}>
      <AnimatedText
        delay={20}
        fontSize={36}
        font="sans"
        weight={300}
        color={`${COLORS.beige}CC`}
        lineHeight={1.42}
        maxWidth={800}
        align="left"
        style={{ textShadow: '0 2px 18px rgba(0,0,0,0.85)' }}
      >
        Turn it over. The caseback reads
        <br />
        6309-559A — that's the movement code.
      </AnimatedText>
      <AnimatedText delay={40} fontSize={46} weight={600} color={COLORS.luxuryGold} align="left">
        An original engraving is proof.
      </AnimatedText>
    </BottomZone>
  </AbsoluteFill>
);

/**
 * Authentication beat. The trust differentiator — this is what TCE does
 * that a random seller doesn't. Loupe, movement inspection, serial
 * cross-check. Every claim here matches the live verification policy.
 */
const AuthScene: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.obsidian }}>
    <KenBurnsImage
      src={staticFile('img/graded/watchmaker.jpg')}
      direction="in"
      intensity={0.13}
      opacity={0.56}
    />
    <Scrim strength={0.74} />
    <TopZone gap={22}>
      <Kicker>The Collectors Exchange</Kicker>
      <AnimatedText delay={8} fontSize={82} weight={600} lineHeight={1.1} align="left" maxWidth={900}>
        Every piece goes through
        <br />
        this before it's listed.
      </AnimatedText>
    </TopZone>
    <BottomZone gap={14}>
      <GoldRule delay={20} width={160} />
      <AnimatedText
        delay={26}
        fontSize={36}
        font="sans"
        weight={300}
        color={`${COLORS.beige}CC`}
        lineHeight={1.42}
        maxWidth={800}
        align="left"
        style={{ textShadow: '0 2px 18px rgba(0,0,0,0.85)' }}
      >
        Movement inspection.
        <br />
        Caseback verification.
        <br />
        Serial cross-check.
      </AnimatedText>
      <AnimatedText delay={46} fontSize={44} weight={600} color={COLORS.luxuryGold} align="left">
        Authenticated. Then listed.
      </AnimatedText>
    </BottomZone>
  </AbsoluteFill>
);

/**
 * CTA. The payoff — this specific watch, this price, this URL.
 * Headline up top; the price + URL pill sit in the lower third so the watch
 * photo stays visible. Same radial-gold-glow pattern as the other reels.
 */
const RarityCta: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 8) * 0.016;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.obsidian }}>
      <KenBurnsImage
        src={staticFile('img/case-study/seiko-1.jpg')}
        direction="out"
        intensity={0.14}
        opacity={0.52}
      />
      <Scrim strength={0.85} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 55% 38% at 50% 58%, ${COLORS.luxuryGold}22 0%, transparent 70%)`,
        }}
      />
      <TopZone gap={20}>
        <AnimatedText delay={0} fontSize={88} weight={600} lineHeight={1.1} align="left" maxWidth={900}>
          This one's live
          <br />
          on the Exchange.
        </AnimatedText>
      </TopZone>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: SAFE_AREA.bottom + 40,
          gap: 18,
        }}
      >
        <AnimatedText
          delay={10}
          fontSize={30}
          font="sans"
          weight={500}
          color={`${COLORS.beige}BB`}
          letterSpacing="0.12em"
        >
          Seiko 6309 Automatic
        </AnimatedText>
        <AnimatedText delay={16} fontSize={88} weight={600} color={COLORS.luxuryGold}>
          ₹4,800
        </AnimatedText>
        <GoldRule delay={22} width={220} />
        <div style={{ transform: `scale(${pulse})` }}>
          <AnimatedText
            delay={28}
            fontSize={40}
            font="sans"
            weight={600}
            color={COLORS.luxuryGold}
            style={{
              padding: '24px 52px',
              border: `2px solid ${COLORS.luxuryGold}`,
              borderRadius: 999,
              background: `${COLORS.luxuryGold}14`,
            }}
          >
            thecollectorsexchange.in
          </AnimatedText>
        </div>
        <AnimatedText
          delay={36}
          fontSize={27}
          font="sans"
          weight={400}
          color={`${COLORS.beige}88`}
          letterSpacing="0.12em"
        >
          @the_collectors_exchange
        </AnimatedText>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  COMPOSITION — voice-driven timing                                  */
/* ------------------------------------------------------------------ */

/**
 * Scene length = narration clip duration (measured by tools/measure-narration.mjs)
 * plus air before and after the voice, snapped UP to the 43-frame eighth-note
 * grid so cuts hug the voice and land on the music. Longer narration => longer
 * scene. Swap in a recorded take, re-run the measure script, and the edit
 * re-times itself — no manual number-pasting.
 */
const FPS = 30;
const SNAP = 43; // eighth-note grid — half a bar, keeps the edit tight
const NARR_LEAD = 8; // frames of air after the cut, before the voice enters
const NARR_TAIL = 6; // frames of air after the voice ends, before the next cut
const MIN_SCENE = 172; // ~2 bars minimum, so the edit never rattles

const NARR_FRAMES = rarityNarration.scenes.map((s) => Math.round(s.seconds * FPS));

const SCENES = [
  { component: HookScene, narr: 0 },
  { component: ReframeScene, narr: 1 },
  { component: CaliberScene, narr: 2 },
  { component: LegacyScene, narr: 3 },
  { component: DetailScene, narr: 4 },
  { component: AuthScene, narr: 5 },
  { component: RarityCta, narr: 6 },
] as const;

const SCENE_LEN = NARR_FRAMES.map(
  (nf) => Math.max(MIN_SCENE, Math.ceil((NARR_LEAD + nf + NARR_TAIL) / SNAP) * SNAP),
);

/** Frame where the cut INTO each scene lands (on the eighth-note grid). */
const STARTS: number[] = [];
{
  let cursor = 0;
  for (const len of SCENE_LEN) {
    STARTS.push(cursor);
    cursor += len;
  }
}

export const RARITY_DURATION = STARTS[STARTS.length - 1] + SCENE_LEN[SCENE_LEN.length - 1];

/** TransitionSeries sequence lengths (crossfade folded into the following scene). */
const DURATIONS = SCENE_LEN.map((len, i) =>
  len + (i < SCENE_LEN.length - 1 ? TRANSITION : 0),
);

/** Where each narration clip plays. */
const NARRATION = SCENES.map((s, i) => ({
  file: rarityNarration.scenes[s.narr].file,
  start: STARTS[i] + NARR_LEAD,
  end: STARTS[i] + NARR_LEAD + NARR_FRAMES[s.narr],
}));

/**
 * The three signal scenes get a mechanical ticking accent.
 * SIGNALS_START = frame where CaliberScene begins.
 * SIGNALS_END   = frame where AuthScene begins.
 */
const SIGNALS_START = STARTS[2];
const SIGNALS_END = STARTS[5];

/**
 * Music envelope: a continuous licensed bed (SFX.bgMusic — Mixkit "Relaxation 05")
 * that ducks under the narration (with a short ramp so the dip isn't audible
 * as a chop) and fades at both ends. The ticking adds texture over the signals,
 * not silence.
 */
const MUSIC_BASE = 0.36;
const MUSIC_DUCK = 0.5; // ratio of base level while the voice is talking
const DUCK_RAMP = 6; // frames to fade the duck in/out

const musicVolume = (f: number): number => {
  let duck = 1;
  for (const n of NARRATION) {
    if (f >= n.start && f < n.end) duck = Math.min(duck, MUSIC_DUCK);
    if (f >= n.start - DUCK_RAMP && f < n.start) {
      const t = (f - (n.start - DUCK_RAMP)) / DUCK_RAMP;
      duck = Math.min(duck, MUSIC_DUCK + (1 - MUSIC_DUCK) * t);
    }
    if (f >= n.end && f < n.end + DUCK_RAMP) {
      const t = (f - n.end) / DUCK_RAMP;
      duck = Math.min(duck, MUSIC_DUCK + (1 - MUSIC_DUCK) * t);
    }
  }
  let level = MUSIC_BASE * duck;
  if (f < 20) level *= f / 20;
  if (f > RARITY_DURATION - 55)
    level *= Math.max(0, 1 - (f - (RARITY_DURATION - 55)) / 55);
  return level;
};

/**
 * Generate tick frames for the signals section.
 * One tick every 43 frames (0.5s at 30fps) = a steady mechanical rhythm.
 */
const TICK_FRAMES: number[] = [];
for (let f = SIGNALS_START; f < SIGNALS_END; f += 43) {
  TICK_FRAMES.push(f);
}

/**
 * Narration clips get a short fade-in (no click at the file edge) and a longer
 * fade-out so the last word rings out instead of chopping off — a big part of
 * what makes TTS clips sound robotic is the hard start/stop at each clip end.
 */
const NARR_FADE_IN = 6;
const NARR_FADE_OUT = 12;

const narrEnvelope = (f: number, duration: number): number => {
  if (f < NARR_FADE_IN) return f / NARR_FADE_IN;
  if (f > duration - NARR_FADE_OUT)
    return Math.max(0, (duration - f) / NARR_FADE_OUT);
  return 1;
};

export const RarityReel: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.obsidian }}>
      <TransitionSeries>
        {SCENES.map(({ component: Comp }, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={DURATIONS[i]}>
              <Comp />
            </TransitionSeries.Sequence>
            {i < SCENES.length - 1 && (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: TRANSITION })}
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>

      {/* Narration — one clip per scene, timed to the voice, with graceful edges. */}
      {NARRATION.map((n, i) => (
        <Sequence key={`narr${i}`} from={n.start}>
          <Audio
            src={staticFile(`audio/narration/${n.file}`)}
            volume={(f) => narrEnvelope(f, n.end - n.start)}
          />
        </Sequence>
      ))}

      {/* Music: continuous licensed bed, ducked under the voice. */}
      <Audio src={staticFile(SFX.bgMusic)} volume={musicVolume} />

      {/* Mechanical ticking accent across the three signal scenes. */}
      {TICK_FRAMES.map((f, i) => (
        <Sfx key={`tick${i}`} src={SFX.tick} at={f} volume={0.18} />
      ))}

      {/* Transition accents — whoosh riding the cut, impact on the hook. */}
      <Sfx src={SFX.impact} at={0} volume={0.35} />
      {STARTS.slice(1).map((s, i) => (
        <Sfx key={`w${i}`} src={SFX.whoosh} at={s - 6} volume={0.18} />
      ))}
      <Sfx src={SFX.chime} at={STARTS[6] + 24} volume={0.26} />
    </AbsoluteFill>
  );
};
