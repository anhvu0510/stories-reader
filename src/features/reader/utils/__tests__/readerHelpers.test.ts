import { describe, expect, it } from 'vitest';

import { checkNavDockVisible, sanitizeParagraphHtml } from '../readerHelpers';

describe('checkNavDockVisible helper', () => {
	it('normal mode: hides vertical dock when showZenControls is false even if TTS is active', () => {
		expect(checkNavDockVisible(false, true, true, false, false)).toBe(false);
		expect(checkNavDockVisible(false, false, false, true, false)).toBe(false);
	});

	it('normal mode: follows showZenControls when TTS is inactive', () => {
		expect(checkNavDockVisible(true, true, false, false, false)).toBe(true);
		expect(checkNavDockVisible(false, true, false, false, false)).toBe(false);
		expect(checkNavDockVisible(true, false, false, false, false)).toBe(false);
	});

	it('normal mode: shows vertical dock when showZenControls is true and TTS/Edge is active', () => {
		expect(checkNavDockVisible(true, true, true, false, false)).toBe(true);
		expect(checkNavDockVisible(true, false, true, false, false)).toBe(true);
		expect(checkNavDockVisible(true, false, false, true, false)).toBe(true);
	});

	it('fullscreen mode: vertical dock hides when showZenControls is false even if TTS is active', () => {
		expect(checkNavDockVisible(false, true, true, false, true)).toBe(false);
		expect(checkNavDockVisible(false, true, false, true, true)).toBe(false);
		expect(checkNavDockVisible(false, false, false, false, true)).toBe(false);
	});

	it('fullscreen mode: vertical dock shows when showZenControls is true and TTS/control enabled', () => {
		expect(checkNavDockVisible(true, true, true, false, true)).toBe(true);
		expect(checkNavDockVisible(true, true, false, true, true)).toBe(true);
		expect(checkNavDockVisible(true, true, false, false, true)).toBe(true);
		expect(checkNavDockVisible(true, false, false, false, true)).toBe(false);
	});
});

describe('sanitizeParagraphHtml helper', () => {
	it('removes unicode invisible sentence delimiter \u2063 cleanly', () => {
		const raw = 'Câu một.\u2063 Câu hai.\u2063 Câu ba.';
		expect(sanitizeParagraphHtml(raw)).toBe('Câu một. Câu hai. Câu ba.');
	});

	it('strips nested or wrapping <p> and <div> block tags preventing DOM fragmentation', () => {
		const raw = '<p>Đoạn văn bắt đầu.</p><div>Đoạn tiếp theo.</div>';
		expect(sanitizeParagraphHtml(raw)).toBe('Đoạn văn bắt đầu. Đoạn tiếp theo.');
	});

	it('preserves valid inline formatting tags and cleans excessive whitespace', () => {
		const raw = '  <p>Chữ <strong>đậm</strong> và <em>nghiêng</em>.</p>  ';
		expect(sanitizeParagraphHtml(raw)).toBe('Chữ <strong>đậm</strong> và <em>nghiêng</em>.');
	});

	it('returns empty string when input is empty, null or undefined', () => {
		expect(sanitizeParagraphHtml('')).toBe('');
		expect(sanitizeParagraphHtml('   ')).toBe('');
		expect(sanitizeParagraphHtml(undefined)).toBe('');
		expect(sanitizeParagraphHtml(null as unknown as string)).toBe('');
	});
});
