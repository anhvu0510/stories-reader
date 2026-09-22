// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getAssetUrl } from '../assetUrl';

describe('getAssetUrl Utility', () => {
  it('QC-1: Trả về nguyên mẫu với URL tuyệt đối HTTP/HTTPS hoặc Data URL', () => {
    expect(getAssetUrl('https://example.com/audio.mp3')).toBe('https://example.com/audio.mp3');
    expect(getAssetUrl('http://cdn.org/wave.wav')).toBe('http://cdn.org/wave.wav');
    expect(getAssetUrl('data:audio/wav;base64,AAA')).toBe('data:audio/wav;base64,AAA');
  });

  it('QC-2: Chuẩn hóa đường dẫn tương đối đúng theo window.location.origin và import.meta.env.BASE_URL', () => {
    const origin = window.location.origin;
    const url = getAssetUrl('/audio/ambient-bgm.mp3');
    expect(url).toBe(`${origin}/audio/ambient-bgm.mp3`);
  });

  it('QC-3: Trả về chuỗi rỗng khi path là falsy', () => {
    expect(getAssetUrl('')).toBe('');
  });
});
