// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import React from 'react';
import { Capacitor } from '@capacitor/core';

import { SelectionSpeakerTooltip } from '../SelectionSpeakerTooltip';

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: vi.fn(() => 'android') } }));

describe('SelectionSpeakerTooltip Component', () => {
	let containerDiv: HTMLElement;

	beforeEach(() => {
		vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
		containerDiv = document.createElement('main');
		containerDiv.id = 'main-story-content';
		document.body.appendChild(containerDiv);
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			cb(0);
			return 0;
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
		containerDiv.remove();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		window.getSelection()?.removeAllRanges();
	});

	it.each([false, true])('preserves the web selection menu without a speaker with reading active = %s', (isTTSActive) => {
		vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
		const paragraph = document.createElement('p');
		paragraph.dataset.paragraphIndex = '0';
		paragraph.textContent = 'Văn bản được chọn trên web.';
		containerDiv.appendChild(paragraph);
		const range = document.createRange();
		range.selectNodeContents(paragraph);
		range.getBoundingClientRect = () => new DOMRect(50, 100, 150, 20);
		window.getSelection()?.addRange(range);
		const onSpeak = vi.fn();
		render(<SelectionSpeakerTooltip onSpeak={onSpeak} isTTSActive={isTTSActive} />);
		fireEvent(document, new Event('selectionchange'));
		const contextmenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
		fireEvent(paragraph, contextmenu);
		expect(contextmenu.defaultPrevented).toBe(false);
		expect(screen.queryByTestId('selection-speaker-tooltip')).toBeNull();
		expect(window.getSelection()?.toString()).toBe(paragraph.textContent);
		expect(onSpeak).not.toHaveBeenCalled();
	});

	it('does not render when there is no text selection', () => {
		const onSpeak = vi.fn();
		render(<SelectionSpeakerTooltip onSpeak={onSpeak} />);

		expect(screen.queryByTestId('selection-speaker-tooltip')).toBeNull();
	});

	it('renders floating tooltip when text inside container is selected', async () => {
		const p = document.createElement('div');
		p.setAttribute('data-paragraph-index', '3');
		p.textContent = 'Câu chuyện bắt đầu tại một ngôi làng nhỏ.';
		containerDiv.appendChild(p);

		const onSpeak = vi.fn();
		render(<SelectionSpeakerTooltip onSpeak={onSpeak} />);

		// Mock window.getSelection
		const range = {
			startContainer: p.firstChild!,
			startOffset: 4,
			endContainer: p.firstChild!,
			endOffset: 12,
			commonAncestorContainer: p,
			getBoundingClientRect: () => ({
				top: 100,
				bottom: 120,
				left: 50,
				right: 150,
				width: 100,
				height: 20
			})
		} as unknown as Range;

		vi.spyOn(window, 'getSelection').mockReturnValue({
			isCollapsed: false,
			rangeCount: 1,
			toString: () => 'chuyện bắt',
			getRangeAt: () => range,
			removeAllRanges: vi.fn()
		} as any);

		act(() => {
			document.dispatchEvent(new Event('selectionchange'));
		});

		// Tooltip should be visible
		const tooltip = await screen.findByTestId('selection-speaker-tooltip');
		expect(tooltip).toBeTruthy();
		// expect(tooltip.textContent).toContain('Đọc từ đây');

		// Click tooltip to trigger speak
		fireEvent.click(tooltip);
		expect(onSpeak).toHaveBeenCalledWith(3, expect.any(Number));
	});

	it('does not render when selection is outside target container', () => {
		const outsideP = document.createElement('p');
		outsideP.textContent = 'Văn bản ngoài container';
		document.body.appendChild(outsideP);

		const onSpeak = vi.fn();
		render(<SelectionSpeakerTooltip onSpeak={onSpeak} />);

		vi.spyOn(window, 'getSelection').mockReturnValue({
			isCollapsed: false,
			rangeCount: 1,
			toString: () => 'Văn bản',
			getRangeAt: () => ({
				startContainer: outsideP.firstChild!,
				startOffset: 0,
				endContainer: outsideP.firstChild!,
				endOffset: 7,
				getBoundingClientRect: () => ({ top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 })
			}),
			removeAllRanges: vi.fn()
		} as any);

		act(() => {
			document.dispatchEvent(new Event('selectionchange'));
		});

		expect(screen.queryByTestId('selection-speaker-tooltip')).toBeNull();
		outsideP.remove();
	});

	it('keeps selection while reading and only jumps when the speaker is pressed', async () => {
		vi.useFakeTimers();
		const p = document.createElement('div');
		p.setAttribute('data-paragraph-index', '2');
		p.textContent = 'Đoạn văn này đang được đọc to.';
		containerDiv.appendChild(p);

		const onSpeak = vi.fn();
		const removeAllRanges = vi.fn();
		render(<SelectionSpeakerTooltip onSpeak={onSpeak} isTTSActive={true} />);

		const range = {
			startContainer: p.firstChild!,
			startOffset: 5,
			endContainer: p.firstChild!,
			endOffset: 12,
			commonAncestorContainer: p,
			getBoundingClientRect: () => ({
				top: 100,
				bottom: 120,
				left: 50,
				right: 150,
				width: 100,
				height: 20
			})
		} as unknown as Range;

		vi.spyOn(window, 'getSelection').mockReturnValue({
			isCollapsed: false,
			rangeCount: 1,
			toString: () => 'văn này',
			getRangeAt: () => range,
			removeAllRanges
		} as any);

		act(() => {
			document.dispatchEvent(new Event('selectionchange'));
		});

		// Trigger mouseup (or touchend) after text selection in TTS active mode
		act(() => {
			window.dispatchEvent(new MouseEvent('mouseup'));
		});

		act(() => vi.advanceTimersByTime(200));
		expect(onSpeak).not.toHaveBeenCalled();
		expect(removeAllRanges).not.toHaveBeenCalled();
		fireEvent.click(screen.getByTestId('selection-speaker-tooltip'));
		expect(onSpeak).toHaveBeenCalledWith(2, 5);
		expect(onSpeak).toHaveBeenCalledTimes(1);
		expect(removeAllRanges).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it.each([false, true])('suppresses the reader context menu with reading active = %s', async (isTTSActive) => {
		const p = document.createElement('div');
		p.setAttribute('data-paragraph-index', '7');
		p.textContent = 'Mục được chọn khi người dùng nhấn giữ trên mobile.';
		containerDiv.appendChild(p);

		const onSpeak = vi.fn();
		const removeAllRanges = vi.fn();
		render(<SelectionSpeakerTooltip onSpeak={onSpeak} isTTSActive={isTTSActive} />);

		const range = {
			startContainer: p.firstChild!,
			startOffset: 4,
			endContainer: p.firstChild!,
			endOffset: 18,
			commonAncestorContainer: p,
			getBoundingClientRect: () => ({
				top: 200,
				bottom: 220,
				left: 50,
				right: 200,
				width: 150,
				height: 20
			})
		} as unknown as Range;

		vi.spyOn(window, 'getSelection').mockReturnValue({
			isCollapsed: false,
			rangeCount: 1,
			toString: () => 'được chọn khi',
			getRangeAt: () => range,
			removeAllRanges
		} as any);

		// Android long-press fires contextmenu / touchcancel when native ActionMode appears
		const contextmenu = new MouseEvent('contextmenu', { cancelable: true });
		act(() => { window.dispatchEvent(contextmenu); });

		expect(contextmenu.defaultPrevented).toBe(true);
		expect(onSpeak).not.toHaveBeenCalled();
		expect(removeAllRanges).not.toHaveBeenCalled();
	});

	it('keeps context menus outside reader content unchanged', () => {
		const outside = document.createElement('input');
		document.body.appendChild(outside);
		render(<SelectionSpeakerTooltip onSpeak={vi.fn()} />);
		vi.spyOn(window, 'getSelection').mockReturnValue({
			isCollapsed: false,
			rangeCount: 1,
			getRangeAt: () => ({ startContainer: outside })
		} as unknown as Selection);
		const event = new MouseEvent('contextmenu', { cancelable: true });
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
		outside.remove();
	});

	it('does not seek or clear selected text while the user is still holding', async () => {
		vi.useFakeTimers();
		try {
			const p = document.createElement('div');
			p.setAttribute('data-paragraph-index', '9');
			p.textContent = 'Người dùng cuộn xuống nhấn giữ đoạn này.';
			containerDiv.appendChild(p);

			const onSpeak = vi.fn();
			const removeAllRanges = vi.fn();
			render(<SelectionSpeakerTooltip onSpeak={onSpeak} isTTSActive={true} />);

			const range = {
				startContainer: p.firstChild!,
				startOffset: 11,
				endContainer: p.firstChild!,
				endOffset: 25,
				commonAncestorContainer: p,
				getBoundingClientRect: () => ({
					top: 300,
					bottom: 320,
					left: 50,
					right: 220,
					width: 170,
					height: 20
				})
			} as unknown as Range;

			vi.spyOn(window, 'getSelection').mockReturnValue({
				isCollapsed: false,
				rangeCount: 1,
				toString: () => 'cuộn xuống nhấn',
				getRangeAt: () => range,
				removeAllRanges
			} as any);

			act(() => {
				document.dispatchEvent(new Event('selectionchange'));
			});

			// Still holding down: advance timers past debounce threshold
			act(() => {
				vi.advanceTimersByTime(300);
			});

			expect(onSpeak).not.toHaveBeenCalled();
			expect(removeAllRanges).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});
});
