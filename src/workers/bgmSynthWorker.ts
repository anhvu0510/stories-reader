/**
 * Dedicated Background Music Worker
 * Runs in a separate background thread off the main UI thread.
 * Synthesizes background audio PCM buffers asynchronously to eliminate main-thread stutter or latency.
 */

export interface BgmSynthRequest {
  sampleRate: number;
  duration?: number;
}

export interface BgmSynthResponse {
  left: Float32Array;
  right: Float32Array;
}

self.onmessage = (event: MessageEvent<BgmSynthRequest>) => {
  const { sampleRate = 44100, duration = 4.0 } = event.data || {};
  const numSamples = Math.floor(sampleRate * duration);

  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
    const note1 = Math.sin(2 * Math.PI * 261.63 * t) * 0.12;
    const note2 = Math.sin(2 * Math.PI * 329.63 * t) * 0.10;
    const note3 = Math.sin(2 * Math.PI * 392.00 * t) * 0.08;
    const wave = (note1 + note2 + note3) * lfo;

    left[i] = wave;
    right[i] = wave;
  }

  // Transfer buffers with 0-copy transferable objects
  // @ts-ignore
  self.postMessage({ left, right }, [left.buffer, right.buffer]);
};
