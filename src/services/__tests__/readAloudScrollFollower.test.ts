// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ReadAloudScrollFollower } from '../readAloudScrollFollower';

describe('ReadAloudScrollFollower', () => {
  it('coalesces changing line targets into one interruptible animation', () => {
    let scrollY = 0;
    let nextFrame: FrameRequestCallback | null = null;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      nextFrame = callback;
      return requestFrame.mock.calls.length;
    });
    const scrollTo = vi.fn((top: number) => {
      scrollY = top;
    });
    const follower = new ReadAloudScrollFollower({
      getScrollY: () => scrollY,
      getViewportHeight: () => 800,
      scrollTo,
      requestFrame,
      cancelFrame: vi.fn(),
      prefersReducedMotion: () => false,
    });

    follower.follow(new DOMRect(0, 900, 300, 30));
    follower.follow(new DOMRect(0, 1200, 300, 30));

    expect(requestFrame).toHaveBeenCalledTimes(1);
    for (let frame = 0; frame < 100 && nextFrame; frame += 1) {
      const callback: FrameRequestCallback = nextFrame;
      nextFrame = null;
      callback(frame * 16);
    }

    expect(scrollY).toBeCloseTo(1200 + 15 - 800 * 0.46, 0);
    expect(scrollTo.mock.calls.length).toBeLessThan(60);
  });

  it('jumps immediately when reduced motion is requested', () => {
    const scrollTo = vi.fn();
    const requestFrame = vi.fn();
    const follower = new ReadAloudScrollFollower({
      getScrollY: () => 0,
      getViewportHeight: () => 800,
      scrollTo,
      requestFrame,
      cancelFrame: vi.fn(),
      prefersReducedMotion: () => true,
    });

    follower.follow(new DOMRect(0, 900, 300, 30));

    expect(scrollTo).toHaveBeenCalledOnce();
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
