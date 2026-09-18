interface ScrollFollowerEnvironment {
  getScrollY: () => number;
  getViewportHeight: () => number;
  scrollTo: (top: number) => void;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
  prefersReducedMotion: () => boolean;
}

const createBrowserEnvironment = (): ScrollFollowerEnvironment => ({
  getScrollY: () => window.scrollY,
  getViewportHeight: () => window.innerHeight,
  scrollTo: (top) => window.scrollTo({ top, behavior: 'auto' }),
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
  prefersReducedMotion: () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
});

export class ReadAloudScrollFollower {
  private targetY: number | null = null;
  private animationFrame: number | null = null;

  constructor(private readonly environment: ScrollFollowerEnvironment = createBrowserEnvironment()) {}

  public follow(line: DOMRect): void {
    const scrollY = this.environment.getScrollY();
    const viewportHeight = this.environment.getViewportHeight();
    const viewportTop = line.top - scrollY;
    const viewportBottom = line.bottom - scrollY;
    const safeTop = viewportHeight * 0.3;
    const safeBottom = viewportHeight * 0.7;
    if (viewportTop >= safeTop && viewportBottom <= safeBottom) return;

    this.targetY = Math.max(0, line.top + line.height / 2 - viewportHeight * 0.46);
    if (this.environment.prefersReducedMotion()) {
      this.environment.scrollTo(this.targetY);
      this.targetY = null;
      return;
    }

    if (this.animationFrame === null) {
      this.animationFrame = this.environment.requestFrame(this.tick);
    }
  }

  public cancel(): void {
    if (this.animationFrame !== null) {
      this.environment.cancelFrame(this.animationFrame);
    }
    this.animationFrame = null;
    this.targetY = null;
  }

  private readonly tick: FrameRequestCallback = () => {
    if (this.targetY === null) {
      this.animationFrame = null;
      return;
    }

    const currentY = this.environment.getScrollY();
    const distance = this.targetY - currentY;
    if (Math.abs(distance) < 0.75) {
      this.environment.scrollTo(this.targetY);
      this.animationFrame = null;
      this.targetY = null;
      return;
    }

    this.environment.scrollTo(currentY + distance * 0.16);
    this.animationFrame = this.environment.requestFrame(this.tick);
  };
}
