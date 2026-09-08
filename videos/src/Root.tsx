import React from 'react';
import { Composition } from 'remotion';
import { IntroReel, INTRO_DURATION } from './compositions/IntroReel';
import { HeirloomReel, HEIRLOOM_DURATION } from './compositions/HeirloomReel';
import {
  SpotAFakeReel,
  SPOT_A_FAKE_DURATION,
} from './compositions/SpotAFakeReel';
import { HmtReel, HMT_DURATION } from './compositions/HmtReel';
import { RarityReel, RARITY_DURATION } from './compositions/RarityReel';
import { FORMATS, FPS } from './brand';

/**
 * Registered compositions appear in the Remotion Studio sidebar and can be
 * rendered by ID:  npx remotion render <id> out/file.mp4
 *
 * Content strategy across the four films:
 *   IntroReel    — brand awareness. Who TCE is and why it's trustworthy.
 *   HeirloomReel — emotional / sell-side. Wins supply and DMs.
 *   SpotAFakeReel— educational / buy-side. Earns saves, builds authority.
 *   HmtReel      — category desire. Builds want for the Timepieces category
 *                  that the live inventory can actually fulfil.
 *
 * Each is registered in 9:16 (Reels, primary) plus 4:5 feed and 1:1 square
 * variants, since the layouts are centre-composed and crop safely.
 */

const VIDEOS = [
  { id: 'IntroReel', component: IntroReel, duration: INTRO_DURATION },
  { id: 'HeirloomReel', component: HeirloomReel, duration: HEIRLOOM_DURATION },
  {
    id: 'SpotAFakeReel',
    component: SpotAFakeReel,
    duration: SPOT_A_FAKE_DURATION,
  },
  { id: 'HmtReel', component: HmtReel, duration: HMT_DURATION },
  { id: 'RarityReel', component: RarityReel, duration: RARITY_DURATION },
] as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {VIDEOS.map(({ id, component, duration }) => (
        <React.Fragment key={id}>
          {/* Primary: Reels / Stories */}
          <Composition
            id={id}
            component={component}
            durationInFrames={duration}
            fps={FPS}
            width={FORMATS.reel.width}
            height={FORMATS.reel.height}
          />
          {/* 4:5 — most vertical real estate in the main feed */}
          <Composition
            id={`${id}-Feed`}
            component={component}
            durationInFrames={duration}
            fps={FPS}
            width={FORMATS.portraitFeed.width}
            height={FORMATS.portraitFeed.height}
          />
          {/* 1:1 — cross-posting */}
          <Composition
            id={`${id}-Square`}
            component={component}
            durationInFrames={duration}
            fps={FPS}
            width={FORMATS.square.width}
            height={FORMATS.square.height}
          />
        </React.Fragment>
      ))}
    </>
  );
};
