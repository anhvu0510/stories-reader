// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReadAloudControlFrame } from '../ReadAloudControlFrame';

class TestPointerEvent extends MouseEvent {
	readonly pointerId: number;
	constructor(type: string, init: PointerEventInit = {}) {
		super(type, init);
		this.pointerId = init.pointerId ?? 1;
	}
}

function setupFrame() {
	const onStop = vi.fn();
	const result = render(<ReadAloudControlFrame active isVisible><button onClick={onStop}>Dừng</button></ReadAloudControlFrame>);
	const frame = screen.getByRole('group', { name: 'Điều khiển đọc thành tiếng' });
	const handle = screen.getByRole('button', { name: 'Kéo thanh điều khiển lên hoặc xuống' });
	const capture = vi.fn();
	const release = vi.fn();
	Object.assign(handle, { setPointerCapture: capture, hasPointerCapture: () => true, releasePointerCapture: release });
	const offset = () => Number(frame.style.transform.match(/translate3d\(0, ([-\d.]+)px, 0\)/)?.[1] ?? 0);
	vi.spyOn(frame, 'getBoundingClientRect').mockImplementation(() => {
		const top = window.innerHeight - 100 - 200 + offset();
		return { x: 16, y: top, top, bottom: top + 200, left: 16, right: 72, width: 56, height: 200, toJSON: () => ({}) };
	});
	return { ...result, frame, handle, capture, release, offset, onStop };
}

describe('ReadAloudControlFrame vertical movement', () => {
	beforeEach(() => {
		vi.stubGlobal('PointerEvent', TestPointerEvent);
	});
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('uses a compact transparent mobile shell while leaving playback controls unchanged', () => {
		const { frame, handle } = setupFrame();
		expect(frame.className).toContain('p-1.5');
		expect(frame.className).toContain('gap-1');
		expect(frame.className).toContain('bg-transparent');
		expect(handle.className).toContain('w-9 h-6');
	});

	it('moves the entire frame only vertically from the handle without invoking playback', () => {
		const { frame, handle, capture, release, offset, onStop } = setupFrame();
		fireEvent.pointerDown(handle, { pointerId: 2, clientY: 500, button: 0 });
		fireEvent.pointerMove(handle, { pointerId: 2, clientY: 420, clientX: 300 });
		expect(offset()).toBe(-80);
		expect(frame.style.transform).toBe('translate3d(0, -80px, 0)');
		expect(capture).toHaveBeenCalledWith(2);
		fireEvent.pointerUp(handle, { pointerId: 2 });
		expect(release).toHaveBeenCalledWith(2);
		fireEvent.pointerMove(handle, { pointerId: 2, clientY: 350 });
		expect(offset()).toBe(-80);
		expect(onStop).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Dừng' }));
		expect(onStop).toHaveBeenCalledTimes(1);
	});

	it('clamps dragging to the reader viewport above the bottom dock', () => {
		const { frame, handle } = setupFrame();
		fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
		fireEvent.pointerMove(handle, { pointerId: 1, clientY: -5000 });
		expect(frame.getBoundingClientRect().top).toBe(80);
		fireEvent.pointerMove(handle, { pointerId: 1, clientY: 5000 });
		expect(frame.getBoundingClientRect().bottom).toBe(window.innerHeight - 100);
	});

	it('does not drag from playback buttons or a different pointer', () => {
		const { handle, offset } = setupFrame();
		const button = screen.getByRole('button', { name: 'Dừng' });
		fireEvent.pointerDown(button, { pointerId: 1, clientY: 500 });
		fireEvent.pointerMove(button, { pointerId: 1, clientY: 300 });
		expect(offset()).toBe(0);
		fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
		fireEvent.pointerMove(handle, { pointerId: 7, clientY: 300 });
		expect(offset()).toBe(0);
	});

	it('ends dragging on pointer cancellation or lost capture', () => {
		const { handle, offset } = setupFrame();
		fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
		fireEvent.pointerCancel(handle, { pointerId: 1 });
		fireEvent.pointerMove(handle, { pointerId: 1, clientY: 300 });
		expect(offset()).toBe(0);
		fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
		fireEvent.lostPointerCapture(handle, { pointerId: 1 });
		fireEvent.pointerMove(handle, { pointerId: 1, clientY: 300 });
		expect(offset()).toBe(0);
	});

	it('cancels a live drag when the controls are hidden', () => {
		const { handle, offset, rerender } = setupFrame();
		fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
		fireEvent.pointerMove(handle, { pointerId: 1, clientY: 450 });
		expect(offset()).toBe(-50);
		rerender(<ReadAloudControlFrame active isVisible={false}>Controls</ReadAloudControlFrame>);
		fireEvent.pointerMove(handle, { pointerId: 1, clientY: 300 });
		expect(offset()).toBe(-50);
	});

	it('reclamps when controls change size and cleans up its observer', () => {
		let resized: (() => void) | undefined;
		const disconnect = vi.fn();
		vi.stubGlobal('ResizeObserver', class {
			constructor(callback: () => void) { resized = callback; }
			observe = vi.fn();
			disconnect = disconnect;
		});
		const { handle, frame, unmount } = setupFrame();
		fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
		fireEvent.pointerMove(handle, { pointerId: 1, clientY: -500 });
		expect(frame.getBoundingClientRect().top).toBe(80);
		vi.stubGlobal('innerHeight', 500);
		act(() => resized?.());
		expect(frame.getBoundingClientRect().top).toBe(80);
		unmount();
		expect(disconnect).toHaveBeenCalled();
	});

	it('supports keyboard movement and reclamps after a viewport resize', () => {
		const { frame, handle, offset } = setupFrame();
		fireEvent.keyDown(handle, { key: 'ArrowUp' });
		expect(offset()).toBe(-24);
		fireEvent.keyDown(handle, { key: 'ArrowDown' });
		expect(offset()).toBe(0);
		fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
		fireEvent.pointerMove(handle, { pointerId: 1, clientY: 250 });
		vi.stubGlobal('innerHeight', 400);
		act(() => window.dispatchEvent(new Event('resize')));
		expect(frame.getBoundingClientRect().top).toBe(80);
		fireEvent.pointerMove(handle, { pointerId: 1, clientY: 600 });
		expect(frame.getBoundingClientRect().top).toBe(80);
	});

	it('does not bubble handle gestures into reader gestures and cancels when hidden', () => {
		const onReaderPointerDown = vi.fn();
		const { rerender } = render(<div onPointerDown={onReaderPointerDown}><ReadAloudControlFrame active isVisible>Controls</ReadAloudControlFrame></div>);
		const handle = screen.getByRole('button', { name: 'Kéo thanh điều khiển lên hoặc xuống' });
		Object.assign(handle, { setPointerCapture: vi.fn() });
		fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
		expect(onReaderPointerDown).not.toHaveBeenCalled();
		rerender(<ReadAloudControlFrame active isVisible={false}>Controls</ReadAloudControlFrame>);
		expect(screen.getByRole('button', { name: 'Kéo thanh điều khiển lên hoặc xuống' }).hasAttribute('disabled')).toBe(true);
	});
});
