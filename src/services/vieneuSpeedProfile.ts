export type VieneuSpeedMode = 'server' | 'frontend';

export interface VieneuSpeedProfile {
  synthesisSpeed: number;
  playbackRate: number;
}

/** Keeps the two VieNeu speed pipelines explicit and independently testable. */
export function getVieneuSpeedProfile(
  mode: VieneuSpeedMode = 'server',
  requestedRate: number = 1
): VieneuSpeedProfile {
  const rate = Math.max(0.25, Math.min(requestedRate, 4));
  return mode === 'frontend'
    ? { synthesisSpeed: 1, playbackRate: rate }
    : { synthesisSpeed: rate, playbackRate: 1 };
}
