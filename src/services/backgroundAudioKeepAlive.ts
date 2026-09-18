const SILENT_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';

/** Keeps a user-started reading session eligible for background audio on mobile browsers. */
export class BackgroundAudioKeepAlive {
  private audio: HTMLAudioElement | null = null;

  public start(): void {
    if (typeof document === 'undefined' || this.audio) return;

    const audio = document.createElement('audio');
    audio.src = SILENT_WAV_DATA_URL;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.001;
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('aria-hidden', 'true');
    audio.style.position = 'fixed';
    audio.style.width = '1px';
    audio.style.height = '1px';
    audio.style.opacity = '0.01';
    audio.style.pointerEvents = 'none';
    document.body?.appendChild(audio);
    this.audio = audio;
    void Promise.resolve(audio.play()).catch(() => {
      // A browser may reject background playback until the user gesture; the
      // real TTS audio still proceeds and will retry on the next lifecycle event.
    });
  }

  public resume(): void {
    if (!this.audio || !this.audio.paused) return;
    void Promise.resolve(this.audio.play()).catch(() => {});
  }

  public stop(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.audio.remove();
    this.audio = null;
  }
}
