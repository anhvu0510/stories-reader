/**
 * Service to generate audio buffers using a dedicated background Web Worker thread.
 * Guarantees zero main-thread block or UI lag.
 */

const INLINE_WORKER_CODE = `
self.onmessage = function(e) {
  var data = e.data || {};
  var sampleRate = data.sampleRate || 44100;
  var duration = data.duration || 4.0;
  var numSamples = Math.floor(sampleRate * duration);

  var left = new Float32Array(numSamples);
  var right = new Float32Array(numSamples);

  for (var i = 0; i < numSamples; i++) {
    var t = i / sampleRate;
    var lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
    var note1 = Math.sin(2 * Math.PI * 261.63 * t) * 0.12;
    var note2 = Math.sin(2 * Math.PI * 329.63 * t) * 0.10;
    var note3 = Math.sin(2 * Math.PI * 392.00 * t) * 0.08;
    var wave = (note1 + note2 + note3) * lfo;

    left[i] = wave;
    right[i] = wave;
  }

  self.postMessage({ left: left, right: right }, [left.buffer, right.buffer]);
};
`;

export async function generateBgmBufferInWorker(
  ctx: AudioContext,
  duration = 4.0
): Promise<AudioBuffer | null> {
  if (typeof ctx.createBuffer !== 'function') return null;
  const sampleRate = ctx.sampleRate || 44100;

  return new Promise((resolve) => {
    let worker: Worker | null = null;
    let resolved = false;

    const cleanup = () => {
      if (worker) {
        try {
          worker.terminate();
        } catch {}
        worker = null;
      }
    };

    const fallbackMainThread = () => {
      if (resolved) return;
      resolved = true;
      cleanup();

      try {
        const numSamples = Math.floor(sampleRate * duration);
        const buffer = ctx.createBuffer(2, numSamples, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

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
        resolve(buffer);
      } catch {
        resolve(null);
      }
    };

    try {
      if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
        const blob = new Blob([INLINE_WORKER_CODE], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        worker = new Worker(blobUrl);

        worker.onmessage = (event: MessageEvent<{ left: Float32Array; right: Float32Array }>) => {
          if (resolved) return;
          resolved = true;
          URL.revokeObjectURL(blobUrl);

          try {
            const { left, right } = event.data;
            const numSamples = left.length;
            const buffer = ctx.createBuffer(2, numSamples, sampleRate);
            buffer.copyToChannel(left, 0);
            buffer.copyToChannel(right, 1);
            cleanup();
            resolve(buffer);
          } catch {
            fallbackMainThread();
          }
        };

        worker.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          fallbackMainThread();
        };

        worker.postMessage({ sampleRate, duration });

        // Safety timeout if worker hangs
        setTimeout(() => {
          if (!resolved) {
            URL.revokeObjectURL(blobUrl);
            fallbackMainThread();
          }
        }, 1000);
      } else {
        fallbackMainThread();
      }
    } catch {
      fallbackMainThread();
    }
  });
}
