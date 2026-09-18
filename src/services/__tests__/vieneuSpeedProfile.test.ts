import { describe, expect, it } from 'vitest';
import { getVieneuSpeedProfile } from '../vieneuSpeedProfile';

describe('getVieneuSpeedProfile', () => {
  it('keeps server mode at neutral FE playback', () => {
    expect(getVieneuSpeedProfile('server', 1.8)).toEqual({
      synthesisSpeed: 1.8,
      playbackRate: 1,
    });
  });

  it('keeps VieNeu at 1x in frontend mode', () => {
    expect(getVieneuSpeedProfile('frontend', 1.8)).toEqual({
      synthesisSpeed: 1,
      playbackRate: 1.8,
    });
  });

  it('clamps unsafe rates for both modes', () => {
    expect(getVieneuSpeedProfile('frontend', 99)).toEqual({
      synthesisSpeed: 1,
      playbackRate: 4,
    });
  });
});
