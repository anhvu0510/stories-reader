// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import React from 'react';

import { SelectionSpeakerTooltip } from '../SelectionSpeakerTooltip';

describe('SelectionSpeakerTooltip Component', () => {
	let containerDiv: HTMLElement;

	beforeEach(() => {
		containerDiv = document.createElement('main');
		containerDiv.id = 'main-story-content';
		document.body.appendChild(containerDiv);
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			cb(0);
			return 0;
		});
	});

	afterEach(() => {
		cleanup();
		containerDiv.remove();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
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

	it('does NOT render speaker tooltip when isTTSActive is true, but jumps to selection on interaction end', async () => {
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

		// Tooltip must NOT render when in TTS active mode
		expect(screen.queryByTestId('selection-speaker-tooltip')).toBeNull();

		// Trigger mouseup (or touchend) after text selection in TTS active mode
		act(() => {
			window.dispatchEvent(new MouseEvent('mouseup'));
		});

		expect(onSpeak).toHaveBeenCalledWith(2, 5);
		expect(removeAllRanges).toHaveBeenCalled();
	});
});

