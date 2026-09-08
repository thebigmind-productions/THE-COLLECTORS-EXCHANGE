import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';

export const SFX = {
  whoosh: 'audio/whoosh.wav',
  chime: 'audio/chime.wav',
  impact: 'audio/impact.wav',
  tick: 'audio/tick.wav',
  /** Composed 8-bar arrangement at 84 BPM (see tools/generate-music.mjs). */
  music: 'audio/music-bed.wav',
  /** Same progression, stripped back — for copy-led / reflective films. */
  musicSparse: 'audio/music-bed-sparse.wav',
  /** Licensed real track — "Relaxation 05" by Lily J, Mixkit (free license, commercial use OK, no attribution required). https://mixkit.co/free-stock-music/mood/soothing/ */
  bgMusic: 'audio/bg-music.mp3',
  /** Older static drone, kept as a fallback for talking-head style videos. */
  ambientBed: 'audio/ambient-bed.wav',
} as const;

/**
 * Fires a one-shot sound effect at a given frame.
 * Wrapped in a Sequence so the audio starts exactly on the cut it accents.
 */
export const Sfx: React.FC<{
  src: string;
  at: number;
  volume?: number;
}> = ({ src, at, volume = 1 }) => (
  <Sequence from={at}>
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

/**
 * Background music with a fade-out tail.
 * Kept under the SFX and any voiceover — Instagram is frequently watched
 * muted, so audio should reward sound-on viewers without being load-bearing.
 */
export const MusicBed: React.FC<{
  volume?: number;
  fadeOutStart?: number;
  totalFrames?: number;
  src?: string;
}> = ({ volume = 0.5, fadeOutStart, totalFrames, src = SFX.music }) => (
  <Audio
    src={staticFile(src)}
    volume={(f) => {
      if (fadeOutStart === undefined || totalFrames === undefined) return volume;
      if (f < fadeOutStart) return volume;
      const t = (f - fadeOutStart) / Math.max(1, totalFrames - fadeOutStart);
      return volume * Math.max(0, 1 - t);
    }}
  />
);

/** Back-compat alias for the older static drone. */
export const AmbientBed: React.FC<{
  volume?: number;
  fadeOutStart?: number;
  totalFrames?: number;
}> = (props) => <MusicBed {...props} src={SFX.ambientBed} />;
