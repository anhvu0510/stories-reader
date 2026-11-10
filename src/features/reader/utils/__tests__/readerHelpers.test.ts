import { describe, expect, it } from 'vitest';

import { checkNavDockVisible } from '../readerHelpers';

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
