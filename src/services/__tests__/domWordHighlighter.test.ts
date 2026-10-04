// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DomWordHighlighter } from '@/services/domWordHighlighter';

const originalHighlight = Reflect.get(globalThis, 'Highlight');
const originalCss = globalThis.CSS;

afterEach(() => {
	Object.defineProperty(globalThis, 'Highlight', {
		configurable: true,
		value: originalHighlight
	});
	Object.defineProperty(globalThis, 'CSS', {
		configurable: true,
		value: originalCss
	});
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('DomWordHighlighter', () => {
	it('moves the highlight without rebuilding unrelated formatted DOM', () => {
		const root = document.createElement('div');
		root.innerHTML = '<strong>Xin</strong> chào bạn';
		const strong = root.querySelector('strong');
		const highlighter = new DomWordHighlighter('active-word');

		highlighter.highlight(root, 4, 4);
		expect(root.querySelector('.active-word')?.textContent).toBe('chào');

		highlighter.highlight(root, 9, 3);

		expect(root.querySelector('strong')).toBe(strong);
		expect(root.querySelectorAll('.active-word')).toHaveLength(1);
		expect(root.querySelector('.active-word')?.textContent).toBe('bạn');
		expect(root.textContent).toBe('Xin chào bạn');
	});

	it('restores the original text when cleared', () => {
		const root = document.createElement('div');
		root.textContent = 'Xin chào';
		const highlighter = new DomWordHighlighter('active-word');

		highlighter.highlight(root, 4, 4);
		highlighter.clear();

		expect(root.querySelector('.active-word')).toBeNull();
		expect(root.textContent).toBe('Xin chào');
	});

	it('keeps one reusable highlight on the rendered line containing the active word', () => {
		const root = document.createElement('div');
		root.textContent = 'Dòng đầu tiên và dòng thứ hai';
		document.body.appendChild(root);

		const originalCreateRange = document.createRange.bind(document);
		const createRange = vi.spyOn(document, 'createRange').mockImplementation(() => {
			const range = originalCreateRange();
			Object.defineProperty(range, 'getClientRects', {
				value: () => [new DOMRect(24, 20, 210, 32), new DOMRect(24, 52, 178, 32)]
			});
			return range;
		});
		const getBoundingClientRect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
			return this.classList.contains('active-word') ? new DOMRect(96, 52, 42, 32) : new DOMRect();
		});
		const highlighter = new DomWordHighlighter('active-word');

		highlighter.highlight(root, 19, 4);

		const firstLineHighlight = document.querySelector<HTMLElement>('.stories-tts-line-wash');
		expect(firstLineHighlight).not.toBeNull();
		expect(firstLineHighlight?.style.transform).toBe('translate3d(24px, 52px, 0)');
		expect(firstLineHighlight?.style.width).toBe('178px');
		expect(firstLineHighlight?.style.height).toBe('32px');

		highlighter.highlight(root, 24, 3);

		expect(document.querySelectorAll('.stories-tts-line-wash')).toHaveLength(1);
		expect(document.querySelector('.stories-tts-line-wash')).toBe(firstLineHighlight);

		highlighter.clear();
		expect(document.querySelector('.stories-tts-line-wash')).toBeNull();

		getBoundingClientRect.mockRestore();
		createRange.mockRestore();
		root.remove();
	});

	it('uses the CSS Highlights API without mutating text DOM and caches paragraph line layout', () => {
		const root = document.createElement('div');
		root.textContent = 'Một hai ba bốn năm sáu bảy tám chín mười';
		document.body.appendChild(root);
		const originalHtml = root.innerHTML;
		const highlights = { set: vi.fn(), delete: vi.fn() };
		const FakeHighlight = vi.fn(function (this: { ranges: Range[] }, ...ranges: Range[]) {
			this.ranges = ranges;
		});
		Object.defineProperty(globalThis, 'Highlight', {
			configurable: true,
			value: FakeHighlight
		});
		Object.defineProperty(globalThis, 'CSS', {
			configurable: true,
			value: { ...originalCss, highlights }
		});

		let paragraphLayoutReads = 0;
		const originalCreateRange = document.createRange.bind(document);
		vi.spyOn(document, 'createRange').mockImplementation(() => {
			const range = originalCreateRange();
			Object.defineProperty(range, 'getClientRects', {
				value: () => {
					if (range.toString() === root.textContent) {
						paragraphLayoutReads += 1;
						return [new DOMRect(20, 40, 260, 30), new DOMRect(20, 70, 240, 30)];
					}
					return [new DOMRect(40, 40, 30, 30)];
				}
			});
			return range;
		});

		const highlighter = new DomWordHighlighter('active-word');
		for (let index = 0; index < 30; index += 1) {
			highlighter.highlight(root, index % 20, 3);
		}

		expect(root.innerHTML).toBe(originalHtml);
		expect(root.querySelector('.active-word')).toBeNull();
		expect(highlights.set).toHaveBeenCalled();
		expect(paragraphLayoutReads).toBe(1);

		highlighter.clear();
		expect(highlights.delete).toHaveBeenCalledWith('stories-tts-word');
		expect(highlights.delete).toHaveBeenCalledWith('stories-tts-line');
	});

	it('provides zero-flicker transitions by preserving line highlight across words on the same line and avoiding intermediate delete()', () => {
		const root = document.createElement('div');
		root.textContent = 'Một hai ba bốn';
		document.body.appendChild(root);

		const highlights = { set: vi.fn(), delete: vi.fn() };
		const FakeHighlight = vi.fn(function (this: { ranges: Range[] }, ...ranges: Range[]) {
			this.ranges = ranges;
		});
		Object.defineProperty(globalThis, 'Highlight', { configurable: true, value: FakeHighlight });
		Object.defineProperty(globalThis, 'CSS', { configurable: true, value: { ...originalCss, highlights } });

		const originalCreateRange = document.createRange.bind(document);
		vi.spyOn(document, 'createRange').mockImplementation(() => {
			const range = originalCreateRange();
			Object.defineProperty(range, 'getClientRects', {
				value: () => [new DOMRect(20, 40, 260, 30)]
			});
			return range;
		});

		const highlighter = new DomWordHighlighter('active-word');
		// Highlight word 1
		highlighter.highlight(root, 0, 3);
		// Highlight word 2 on same line
		highlighter.highlight(root, 4, 3);

		// delete() should NOT have been called between consecutive words to prevent strobe flicker
		expect(highlights.delete).not.toHaveBeenCalled();
		// Line highlight set once for the line, word highlight set twice
		const lineCalls = highlights.set.mock.calls.filter((call) => call[0] === 'stories-tts-line');
		expect(lineCalls.length).toBe(1);

		highlighter.clear();
		expect(highlights.delete).toHaveBeenCalledWith('stories-tts-word');
		expect(highlights.delete).toHaveBeenCalledWith('stories-tts-line');
		root.remove();
	});
});
