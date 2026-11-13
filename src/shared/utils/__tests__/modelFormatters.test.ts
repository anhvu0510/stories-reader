import { describe, it, expect } from 'vitest';

import { formatModelDisplayName } from '../modelFormatters';

describe('formatModelDisplayName utility', () => {
	it('should format DeepSeek models into concise shortnames for UI cards', () => {
		expect(formatModelDisplayName('deepseek-ai/deepseek-v4.1-flash')).toBe('DS 4.1 FLASH');
		expect(formatModelDisplayName('deepseek-ai/deepseek-v4.1-flash-1017')).toBe('DS 4.1 FLASH (1017)');
		expect(formatModelDisplayName('deepseek-chat')).toBe('DS CHAT');
		expect(formatModelDisplayName('deepseek-reasoner')).toBe('DS REASONER');
	});

	it('should maintain backward compatibility for Gemini models', () => {
		expect(formatModelDisplayName('gemini-2.5-flash')).toBe('2.5 FLASH');
		expect(formatModelDisplayName('gemini-1.5-flash')).toBe('1.5 FLASH');
		expect(formatModelDisplayName('gemini-2.0-flash-lite')).toBe('2.0 FLASH LITE');
	});

	it('should safely handle empty or unknown model strings', () => {
		expect(formatModelDisplayName('')).toBe('');
		expect(formatModelDisplayName(undefined as unknown as string)).toBe('');
		expect(formatModelDisplayName('custom-model-x')).toBe('CUSTOM MODEL X');
	});
});
