// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePullToRefresh } from '../usePullToRefresh';
import { useSwipeGesture } from '../useSwipeGesture';
import { ReadAloudControlFrame } from '@/features/reader/components/ReadAloudControlFrame';
import { BottomSheet } from '@/components/BottomSheet';
import { VerticalBatchChapterNav } from '@/features/reader/components/VerticalBatchChapterNav';
import { ReadAloudScrollFollower } from '@/services/readAloudScrollFollower';
import { bindNativeReadingInteraction } from '@/services/nativeReadingInteraction';
import { NATIVE_GESTURE_EVENT, type NativeReaderGesture } from '@/services/nativeReaderGestures';

const native = vi.hoisted(() => ({
	configureControl: vi.fn().mockResolvedValue(undefined),
	configureRefresh: vi.fn().mockResolvedValue(undefined),
	finishRefresh: vi.fn().mockResolvedValue(undefined),
	configureSwipe: vi.fn().mockResolvedValue(undefined),
	configureSheet: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('@capacitor/core', () => ({
	Capacitor: { getPlatform: vi.fn(() => 'android'), isPluginAvailable: vi.fn(() => true) },
	registerPlugin: () => native
}));
vi.mock('@/hooks/useHaptic', () => ({ triggerHaptic: vi.fn() }));

function emit(detail: NativeReaderGesture) {
	act(() => window.dispatchEvent(new CustomEvent(NATIVE_GESTURE_EVENT, { detail })));
}

describe('Android gestures through real React consumers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
		vi.mocked(Capacitor.isPluginAvailable).mockReturnValue(true);
		Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => document.body) });
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('ignores DOM touch recognition on Android and refreshes once through native release', async () => {
		let complete = () => {};
		const pending = new Promise<void>((resolve) => { complete = resolve; });
		const onRefresh = vi.fn(() => pending);
		const { result } = renderHook(() => usePullToRefresh({ onRefresh }));
		const owner: string = native.configureRefresh.mock.calls[0][0].owner;
		fireEvent.touchStart(window, { touches: [{ clientX: 100, clientY: 100 }] });
		fireEvent.touchMove(window, { touches: [{ clientX: 100, clientY: 300 }] });
		fireEvent.touchEnd(window);
		expect(onRefresh).not.toHaveBeenCalled();
		emit({ kind: 'refresh', requestId: `${owner}:1` });
		emit({ kind: 'refresh', requestId: `${owner}:2` });
		expect(onRefresh).toHaveBeenCalledTimes(1);
		expect(result.current.isRefreshing).toBe(true);
		await act(async () => { complete(); await pending; });
		expect(result.current.isRefreshing).toBe(false);
		expect(native.finishRefresh).toHaveBeenCalledWith({ owner, requestId: `${owner}:1` });
	});

	it('checks the real DOM scroll owner, controls and selection before allowing native refresh', () => {
		const { unmount } = renderHook(() => usePullToRefresh({ onRefresh: vi.fn() }));
		const owner: string = native.configureRefresh.mock.calls[0][0].owner;
		const check = () => window.__storiesNativeGestureHitTest?.(100, 100, owner, '', '').refresh;
		expect(check()).toBe(true);
		const button = document.createElement('button');
		document.body.append(button);
		vi.mocked(document.elementFromPoint).mockReturnValue(button);
		expect(check()).toBe(false);
		const scroller = document.createElement('main');
		document.body.append(scroller);
		scroller.scrollTop = 30;
		vi.mocked(document.elementFromPoint).mockReturnValue(scroller);
		expect(check()).toBe(false);
		scroller.scrollTop = 0;
		expect(check()).toBe(true);
		const text = document.createTextNode('selected text');
		scroller.append(text);
		const range = document.createRange();
		range.selectNodeContents(text);
		window.getSelection()?.addRange(range);
		expect(check()).toBe(false);
		window.getSelection()?.removeAllRanges();
		button.remove(); scroller.remove();
		unmount();
		expect(window.__storiesNativeGestureHitTest).toBeUndefined();
	});

	it('moves the control in both directions without follower reacquisition or invoking playback', () => {
		vi.useFakeTimers();
		const scrollTo = vi.fn();
		const stop = vi.fn();
		const follower = new ReadAloudScrollFollower({
			getScrollY: () => 0, getViewportHeight: () => 800, scrollTo,
			requestFrame: vi.fn(), cancelFrame: vi.fn(), prefersReducedMotion: () => true, autoReclaim: false
		});
		function Reader() {
			useEffect(() => bindNativeReadingInteraction(follower), []);
			return <ReadAloudControlFrame active isVisible><button onClick={stop}>Dừng</button></ReadAloudControlFrame>;
		}
		render(<Reader />);
		const frame = screen.getByRole('group', { name: 'Điều khiển đọc thành tiếng' });
		follower.follow(new DOMRect(0, 500, 300, 30));
		emit({ kind: 'interaction-start' });
		emit({ kind: 'control-move', offset: -120 });
		expect(frame.style.transform).toBe('translate3d(0, -120px, 0)');
		follower.follow(new DOMRect(0, 650, 300, 30));
		emit({ kind: 'control-move', offset: -40 });
		emit({ kind: 'interaction-end' });
		vi.advanceTimersByTime(2000);
		expect(frame.style.transform).toBe('translate3d(0, -40px, 0)');
		expect(scrollTo).not.toHaveBeenCalled();
		expect(stop).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Dừng' }));
		expect(stop).toHaveBeenCalledOnce();
	});

	it('routes native chapter drag and cancel without also running DOM swipe callbacks', () => {
		const left = vi.fn(); const right = vi.fn(); const move = vi.fn(); const end = vi.fn();
		const { unmount } = renderHook(() => useSwipeGesture({ onSwipeLeft: left, onSwipeRight: right, onDragMove: move, onDragEnd: end }));
		fireEvent.touchStart(window, { touches: [{ clientX: 250, clientY: 100 }] });
		fireEvent.touchMove(window, { touches: [{ clientX: 80, clientY: 100 }] });
		fireEvent.touchEnd(window, { changedTouches: [{ clientX: 80, clientY: 100 }] });
		expect(left).not.toHaveBeenCalled();
		emit({ kind: 'swipe-move', offset: -150 });
		emit({ kind: 'swipe-end', settled: 'cancel' });
		expect(move).toHaveBeenCalledWith(-150);
		expect(end).toHaveBeenCalledWith('cancel');
		expect(left).not.toHaveBeenCalled();
		emit({ kind: 'swipe-move', offset: -150 });
		emit({ kind: 'swipe-end', settled: 'left' });
		expect(left).toHaveBeenCalledOnce();
		expect(right).not.toHaveBeenCalled();
		unmount();
		emit({ kind: 'swipe-end', settled: 'right' });
		expect(right).not.toHaveBeenCalled();
	});

	it('native sheet drag cancels without closing; confirmed release closes once', () => {
		vi.useFakeTimers();
		const close = vi.fn();
		render(<BottomSheet isOpen onClose={close}><p>Sheet content</p></BottomSheet>);
		const owner: string = native.configureSheet.mock.calls[0][0].owner;
		const card = screen.getByTestId('bottom-sheet-container');
		emit({ kind: 'sheet-move', offset: 120, owner });
		expect(card.style.transform).toBe('translate3d(0, 120px, 0)');
		emit({ kind: 'sheet-end', dismiss: false, owner });
		act(() => vi.advanceTimersByTime(300));
		expect(close).not.toHaveBeenCalled();
		emit({ kind: 'sheet-move', offset: 120, owner });
		emit({ kind: 'sheet-end', dismiss: true, owner });
		act(() => vi.advanceTimersByTime(200));
		expect(close).toHaveBeenCalledOnce();
	});

	it('does not lose native sheet dismissal when the reader rerenders with an inline close callback', () => {
		vi.useFakeTimers();
		const close = vi.fn();
		const { rerender } = render(<BottomSheet isOpen onClose={() => close('before')}>Content</BottomSheet>);
		const owner: string = native.configureSheet.mock.calls[0][0].owner;
		emit({ kind: 'sheet-move', offset: 120, owner });
		emit({ kind: 'sheet-end', dismiss: true, owner });
		rerender(<BottomSheet isOpen onClose={() => close('after')}>Updated reader</BottomSheet>);
		act(() => vi.advanceTimersByTime(200));
		expect(close).toHaveBeenCalledExactlyOnceWith('after');
	});

	it('leaves browser behavior native-free, even when the plugin is advertised', () => {
		vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
		const refresh = vi.fn(); const left = vi.fn();
		renderHook(() => usePullToRefresh({ onRefresh: refresh }));
		renderHook(() => useSwipeGesture({ onSwipeLeft: left, threshold: 100 }));
		render(<ReadAloudControlFrame active isVisible>Controls</ReadAloudControlFrame>);
		expect(native.configureControl).not.toHaveBeenCalled();
		expect(native.configureRefresh).not.toHaveBeenCalled();
		expect(native.configureSwipe).not.toHaveBeenCalled();
		emit({ kind: 'swipe-end', settled: 'left' });
		expect(left).not.toHaveBeenCalled();
		fireEvent.touchStart(window, { touches: [{ clientX: 250, clientY: 100 }] });
		fireEvent.touchMove(window, { touches: [{ clientX: 80, clientY: 100 }] });
		fireEvent.touchEnd(window, { changedTouches: [{ clientX: 80, clientY: 100 }] });
		expect(left).toHaveBeenCalledOnce();
		expect(refresh).not.toHaveBeenCalled();
	});

	it('offers explicit locate on Android without replaying audio', () => {
		const locate = vi.fn(); const play = vi.fn();
		render(<VerticalBatchChapterNav isTTSActive isTTSPlaying onLocateReadingLine={locate} onTTSPlay={play} />);
		fireEvent.click(screen.getByRole('button', { name: 'Nhảy tới dòng đang đọc' }));
		expect(locate).toHaveBeenCalledOnce();
		expect(play).not.toHaveBeenCalled();
	});

	it('releases a native refresh after unmount without refreshing the next screen', async () => {
		let complete = () => {};
		const pending = new Promise<void>((resolve) => { complete = resolve; });
		const onRefresh = vi.fn(() => pending);
		const { unmount } = renderHook(() => usePullToRefresh({ onRefresh }));
		const owner: string = native.configureRefresh.mock.calls[0][0].owner;
		emit({ kind: 'refresh', requestId: `${owner}:1` });
		unmount();
		emit({ kind: 'refresh', requestId: `${owner}:2` });
		await act(async () => { complete(); await pending; });
		expect(onRefresh).toHaveBeenCalledOnce();
		expect(native.finishRefresh).toHaveBeenCalledWith({ owner, requestId: `${owner}:1` });
	});
});
