// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useReadAloudHighlight } from '../readAloud/useReadAloudHighlight';

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

it.each(['media3', 'browser'] as const)('holds the %s word across a silent gap and replaces it directly at the next word', (engine) => {
	document.body.innerHTML = '<main id="main-story-content"><article><div data-paragraph-index="0">Một hai ba</div></article></main>';
	const highlights = new Map<string, unknown>();
	vi.stubGlobal('CSS', { highlights });
	vi.stubGlobal('Highlight', class {
		constructor(public range: Range) {}
	});
	const createRange = document.createRange.bind(document);
	vi.spyOn(document, 'createRange').mockImplementation(() => {
		const range = createRange();
		Object.defineProperty(range, 'getClientRects', { value: () => [new DOMRect(20, 40, 260, 30)] });
		return range;
	});
	const cursor = { charIndexRef: { current: 0 }, charLengthRef: { current: 0 }, sourceOffsetRef: { current: 0 }, currentParagraphIndexRef: { current: 0 } };
	const chunks = [{ text: 'Một hai ba', pIdx: 0, startOffset: 0, length: 10 }];
	const { result } = renderHook(() => useReadAloudHighlight(chunks, cursor));
	const update = (offset: number, length: number) => {
		if (engine === 'media3') return result.current.updateMedia3Highlight(0, 0, 0, offset, length);
		result.current.updateWordHighlight(0, offset, length);
	};
	act(() => update(0, 3));
	const word = highlights.get('stories-tts-word');
	const line = highlights.get('stories-tts-line');
	expect(word).toBeDefined();
	act(() => update(3, 0));
	expect(highlights.get('stories-tts-word')).toBe(word);
	expect(highlights.get('stories-tts-line')).toBe(line);
	expect(cursor.sourceOffsetRef.current).toBe(3);
	act(() => update(4, 3));
	expect(highlights.get('stories-tts-word')).not.toBe(word);
	expect(highlights.get('stories-tts-line')).toBe(line);
	act(() => result.current.wordHighlighterRef.current?.clear());
	expect(highlights.size).toBe(0);
});
