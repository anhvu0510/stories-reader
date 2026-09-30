// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { ParagraphView } from '@/features/reader/components/ParagraphView';

describe('ParagraphView', () => {
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
});
