// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ParagraphView } from '@/features/reader/components/ParagraphView';

describe('ParagraphView', () => {
	it('preserves text nodes and live highlight ranges when playback state changes', () => {
		const { container, rerender } = render(<ParagraphView content="Một đoạn đang được đọc." index={0} isTTSActive />);
		const paragraph = container.querySelector('[data-paragraph-index="0"]')!;
		const text = paragraph.firstChild!;
		const range = document.createRange();
		range.setStart(text, 0);
		range.setEnd(text, 3);
		rerender(<ParagraphView content="Một đoạn đang được đọc." index={0} isTTSActive={false} />);
		expect(paragraph.firstChild).toBe(text);
		expect(range.toString()).toBe('Một');
	});
	afterEach(cleanup);

	it('does not turn the active TTS paragraph into a framed card', () => {
		const { container } = render(<ParagraphView content="Một đoạn đang được đọc." index={0} isTTSActive />);
		const paragraph = container.querySelector<HTMLElement>('[data-paragraph-index="0"]');

		expect(paragraph).not.toBeNull();
		expect(paragraph?.className).not.toMatch(/\bring-/u);
		expect(paragraph?.className).not.toContain('bg-primary/10');
		expect(paragraph?.className).not.toContain('rounded-2xl');
		expect(paragraph?.className).not.toContain('p-3');
		expect(paragraph?.className).not.toContain('shadow-md');
	});

	it('cleans invisible sentence delimiters and nested block tags for Edge Read Aloud', () => {
		const rawContent = '<p>Đoạn mở đầu.\u2063 Câu thứ hai.</p>';
		const { container } = render(<ParagraphView content={rawContent} index={1} />);
		const paragraph = container.querySelector('[data-paragraph-index="1"]');

		expect(paragraph).not.toBeNull();
		expect(paragraph?.tagName.toLowerCase()).toBe('div');
		expect(paragraph?.textContent).toBe('Đoạn mở đầu. Câu thứ hai.');
		expect(paragraph?.innerHTML).not.toContain('\u2063');
		expect(paragraph?.querySelectorAll('p').length).toBe(0);
	});

	it('returns null and renders no DOM element when content is empty or only whitespace/empty tags', () => {
		const { container } = render(<ParagraphView content="<p>  </p>" index={2} />);
		expect(container.firstChild).toBeNull();
	});
});
