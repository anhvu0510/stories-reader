// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReadAloudScrollFollower } from '@/services/readAloudScrollFollower';

describe('ReadAloudScrollFollower', () => {
	afterEach(() => vi.useRealTimers());
	it('locates the active line explicitly from far away without seeking or restarting narration', () => {
		const scrollTo = vi.fn();
		const follower = new ReadAloudScrollFollower({
			getScrollY: () => 2000, getViewportHeight: () => 800, scrollTo,
			requestFrame: vi.fn(), cancelFrame: vi.fn(), prefersReducedMotion: () => true, autoReclaim: false
		});
		follower.notifyUserInteraction();
		follower.follow(new DOMRect(0, 500, 300, 30));
		follower.locateCurrentLine();
		expect(scrollTo).toHaveBeenCalledWith(195);
	});
	it('does not steal Android scrolling after a touch or control drag, until explicitly located', () => {
		vi.useFakeTimers();
		const scrollTo = vi.fn();
		const follower = new ReadAloudScrollFollower({
			getScrollY: () => 0, getViewportHeight: () => 800, scrollTo,
			requestFrame: vi.fn(), cancelFrame: vi.fn(), prefersReducedMotion: () => true,
			autoReclaim: false
		});
		follower.follow(new DOMRect(0, 500, 300, 30));
		follower.beginUserInteraction();
		follower.endUserInteraction();
		vi.advanceTimersByTime(1000);
		follower.follow(new DOMRect(0, 650, 300, 30));
		vi.advanceTimersByTime(1000);
		expect(scrollTo).not.toHaveBeenCalled();
		follower.resumeFollowing();
		follower.follow(new DOMRect(0, 650, 300, 30));
		expect(scrollTo).toHaveBeenCalledWith(345);
	});
	it('keeps manual selection stable until the user dismisses it', () => {
		vi.useFakeTimers();
		let selected = false;
		const scrollTo = vi.fn();
		const follower = new ReadAloudScrollFollower({
			getScrollY: () => 0, getViewportHeight: () => 800, hasTextSelection: () => selected,
			scrollTo, requestFrame: vi.fn(), cancelFrame: vi.fn(), prefersReducedMotion: () => true
		});
		follower.follow(new DOMRect(0, 500, 300, 30));
		scrollTo.mockClear();
		selected = true;
		follower.notifySelectionChange();
		vi.advanceTimersByTime(1000);
		expect(scrollTo).not.toHaveBeenCalled();
		selected = false;
		follower.notifySelectionChange();
		vi.advanceTimersByTime(300);
		expect(scrollTo).toHaveBeenCalledWith(195);
	});
	it('clamps centering to the page boundary so the animation can finish', () => {
		const scrollTo = vi.fn();
		const follower = new ReadAloudScrollFollower({
			getScrollY: () => 0, getViewportHeight: () => 800, getMaxScrollY: () => 100,
			scrollTo, requestFrame: vi.fn(), cancelFrame: vi.fn(), prefersReducedMotion: () => true
		});
		follower.follow(new DOMRect(0, 700, 300, 30));
		expect(scrollTo).toHaveBeenCalledWith(100);
	});
	it('keeps several spoken lines stationary until the reading line reaches three quarters of the screen', () => {
		const scrollTo = vi.fn();
		const follower = new ReadAloudScrollFollower({
			getScrollY: () => 0, getViewportHeight: () => 800, scrollTo,
			requestFrame: vi.fn(), cancelFrame: vi.fn(), prefersReducedMotion: () => true
		});
		follower.follow(new DOMRect(0, 500, 300, 30));
		follower.follow(new DOMRect(0, 540, 300, 30));
		follower.follow(new DOMRect(0, 570, 300, 30));
		expect(scrollTo).not.toHaveBeenCalled();
		follower.follow(new DOMRect(0, 600, 300, 30));
		expect(scrollTo).toHaveBeenCalledWith(295);
	});

	it('reclaims following only after scrolling settles with the active line visible', () => {
		vi.useFakeTimers();
		let scrollY = 0;
		const scrollTo = vi.fn();
		const follower = new ReadAloudScrollFollower({
			getScrollY: () => scrollY, getViewportHeight: () => 800, scrollTo,
			requestFrame: vi.fn(), cancelFrame: vi.fn(), prefersReducedMotion: () => true
		});
		follower.follow(new DOMRect(0, 900, 300, 30));
		scrollTo.mockClear();
		follower.notifyUserInteraction();
		vi.advanceTimersByTime(1000);
		expect(scrollTo).not.toHaveBeenCalled();
		scrollY = 600;
		follower.notifyViewportScroll();
		vi.advanceTimersByTime(200);
		follower.notifyViewportScroll();
		vi.advanceTimersByTime(100);
		expect(scrollTo).not.toHaveBeenCalled();
		vi.advanceTimersByTime(200);
		expect(scrollTo).toHaveBeenCalledWith(595);
	});

	it('cancels pending reacquisition when reading is paused or stopped', () => {
		vi.useFakeTimers();
		const scrollTo = vi.fn();
		const follower = new ReadAloudScrollFollower({
			getScrollY: () => 0, getViewportHeight: () => 800, scrollTo,
			requestFrame: vi.fn(), cancelFrame: vi.fn(), prefersReducedMotion: () => true
		});
		follower.follow(new DOMRect(0, 500, 300, 30));
		scrollTo.mockClear();
		follower.notifyUserInteraction();
		follower.cancel();
		vi.advanceTimersByTime(1000);
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('does not reclaim while the user is still holding the screen', () => {
		vi.useFakeTimers();
		const scrollTo = vi.fn();
		const follower = new ReadAloudScrollFollower({
			getScrollY: () => 0, getViewportHeight: () => 800, scrollTo,
			requestFrame: vi.fn(), cancelFrame: vi.fn(), prefersReducedMotion: () => true
		});
		follower.follow(new DOMRect(0, 500, 300, 30));
		scrollTo.mockClear();
		follower.beginUserInteraction();
		follower.follow(new DOMRect(0, 520, 300, 30));
		vi.advanceTimersByTime(2000);
		expect(scrollTo).not.toHaveBeenCalled();
		follower.endUserInteraction();
		vi.advanceTimersByTime(300);
		expect(scrollTo).toHaveBeenCalledWith(215);
	});
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
			prefersReducedMotion: () => false
		});

		follower.follow(new DOMRect(0, 900, 300, 30));
		follower.follow(new DOMRect(0, 1200, 300, 30));

		expect(requestFrame).toHaveBeenCalledTimes(1);
		for (let frame = 0; frame < 100 && nextFrame; frame += 1) {
			const callback: FrameRequestCallback = nextFrame;
			nextFrame = null;
			callback(frame * 16);
		}

		expect(scrollY).toBeCloseTo(1200 + 15 - 800 * 0.4, 0);
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
			prefersReducedMotion: () => true
		});

		follower.follow(new DOMRect(0, 900, 300, 30));

		expect(scrollTo).toHaveBeenCalledOnce();
		expect(requestFrame).not.toHaveBeenCalled();
	});

	it('does NOT scroll when highlight line has scrolled off-screen (above viewport)', () => {
		const scrollTo = vi.fn();
		const requestFrame = vi.fn();
		const follower = new ReadAloudScrollFollower({
			// Người dùng đã cuộn xuống trang 1500
			getScrollY: () => 1500,
			getViewportHeight: () => 800,
			scrollTo,
			requestFrame,
			cancelFrame: vi.fn(),
			prefersReducedMotion: () => false
		});

		// Dòng highlight đang đọc ở vị trí 300 (đã trôi lên trên khỏi đỉnh màn hình)
		follower.follow(new DOMRect(0, 300, 300, 30));

		// Tuyệt đối không được kích hoạt scroll để người dùng tự do đọc tiếp ở vị trí hiện tại
		expect(scrollTo).not.toHaveBeenCalled();
		expect(requestFrame).not.toHaveBeenCalled();
	});

	it('suspends auto-scroll when user interaction is notified', () => {
		const scrollTo = vi.fn();
		const requestFrame = vi.fn();
		const follower = new ReadAloudScrollFollower({
			getScrollY: () => 0,
			getViewportHeight: () => 800,
			scrollTo,
			requestFrame,
			cancelFrame: vi.fn(),
			prefersReducedMotion: () => false
		});

		// Người dùng vuốt màn hình
		follower.notifyUserInteraction();

		// Thử gọi follow trong lúc người dùng vừa tương tác
		follower.follow(new DOMRect(0, 750, 300, 30));

		expect(scrollTo).not.toHaveBeenCalled();
		expect(requestFrame).not.toHaveBeenCalled();
	});
	it('does not reclaim scrolling after the user has moved away for more than 1.2 seconds', () => {
		const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
		const requestFrame = vi.fn();
		const follower = new ReadAloudScrollFollower({
			getScrollY: () => 0,
			getViewportHeight: () => 800,
			scrollTo: vi.fn(),
			requestFrame,
			cancelFrame: vi.fn(),
			prefersReducedMotion: () => false
		});
		follower.notifyUserInteraction();
		now.mockReturnValue(4000);
		follower.follow(new DOMRect(0, 900, 300, 30));
		expect(requestFrame).not.toHaveBeenCalled();
		follower.resumeFollowing();
		follower.follow(new DOMRect(0, 900, 300, 30));
		expect(requestFrame).toHaveBeenCalledOnce();
		now.mockRestore();
	});
});
