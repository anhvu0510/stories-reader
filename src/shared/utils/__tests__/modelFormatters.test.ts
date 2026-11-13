import { describe, it, expect } from 'vitest';

import { formatCompactNumber, formatModelDisplayName, formatPlatformDisplayName, getPlatformBadgeClass } from '../modelFormatters';

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

describe('formatPlatformDisplayName utility', () => {
	it('should format known platforms into human-readable labels', () => {
		expect(formatPlatformDisplayName('AI_STUDIO')).toBe('AI Studio');
		expect(formatPlatformDisplayName('VERTEX_API')).toBe('Vertex AI');
		expect(formatPlatformDisplayName('DEPLOYAI')).toBe('DeployAI');
		expect(formatPlatformDisplayName('OPENAI_COMPAT')).toBe('OpenAI');
		expect(formatPlatformDisplayName('ANTHROPIC')).toBe('Anthropic');
		expect(formatPlatformDisplayName('GROQ')).toBe('Groq');
		expect(formatPlatformDisplayName('')).toBe('AI Studio');
	});

	it('should automatically scale and format unknown future platforms into Title Case', () => {
		expect(formatPlatformDisplayName('AZURE_OPENAI')).toBe('Azure Openai');
		expect(formatPlatformDisplayName('mistral-cloud')).toBe('Mistral Cloud');
	});

	it('should return proper badge classes for platforms', () => {
		expect(getPlatformBadgeClass('AI_STUDIO')).toContain('sky');
		expect(getPlatformBadgeClass('VERTEX_API')).toContain('indigo');
		expect(getPlatformBadgeClass('DEPLOYAI')).toContain('amber');
		expect(getPlatformBadgeClass('OPENAI_COMPAT')).toContain('emerald');
	});

	it('should assign a valid deterministic badge class for any new provider', () => {
		const classA = getPlatformBadgeClass('AZURE_OPENAI');
		const classB = getPlatformBadgeClass('AZURE_OPENAI');
		expect(classA).toBe(classB);
		expect(classA).toContain('border-');
	});
});

describe('formatCompactNumber utility', () => {
	it('should format large numbers into compact k and M units', () => {
		expect(formatCompactNumber(500)).toBe('500');
		expect(formatCompactNumber(9999)).toBe('10k');
		expect(formatCompactNumber(1500)).toBe('1.5k');
		expect(formatCompactNumber(1000000)).toBe('1M');
	});
});
