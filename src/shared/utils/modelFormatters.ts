/**
 * Chuẩn hóa tên hiển thị ngắn gọn cho các model AI trên UI (tránh bị tràn hoặc cắt ngang).
 * - deepseek-ai/deepseek-v4.1-flash -> DS 4.1 FLASH
 * - deepseek-ai/deepseek-v4.1-flash-1017 -> DS 4.1 FLASH (1017)
 * - gemini-2.5-flash -> 2.5 FLASH
 */
export function formatModelDisplayName(model: string): string {
	if (!model) {
		return '';
	}

	const withSnapshotParen = model.replace(/-(\d{4})$/, ' ($1)');

	return withSnapshotParen
		.replace(/^deepseek-ai\/deepseek-v?/, 'DS ')
		.replace(/^deepseek-ai\//, 'DS ')
		.replace(/^deepseek-v?/, 'DS ')
		.replace(/^gemini-/, '')
		.replace(/-/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toUpperCase();
}

const KNOWN_PLATFORM_LABELS: Record<string, string> = {
	AI_STUDIO: 'AI Studio',
	VERTEX_API: 'Vertex AI',
	DEPLOYAI: 'DeployAI',
	OPENAI_COMPAT: 'OpenAI',
	ANTHROPIC: 'Anthropic',
	GROQ: 'Groq',
	DEEPSEEK: 'DeepSeek',
	MISTRAL: 'Mistral',
	COHERE: 'Cohere',
	OPENROUTER: 'OpenRouter',
};

export function formatPlatformDisplayName(platform?: string): string {
	if (!platform) return 'AI Studio';
	const key = platform.toUpperCase().trim();
	if (KNOWN_PLATFORM_LABELS[key]) {
		return KNOWN_PLATFORM_LABELS[key];
	}
	return key
		.replace(/[_-]+/g, ' ')
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

const BADGE_COLOR_PALETTE = [
	'text-sky-400 bg-sky-500/15 border-sky-500/30',
	'text-indigo-400 bg-indigo-500/15 border-indigo-500/30',
	'text-amber-400 bg-amber-500/15 border-amber-500/30',
	'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
	'text-purple-400 bg-purple-500/15 border-purple-500/30',
	'text-rose-400 bg-rose-500/15 border-rose-500/30',
	'text-teal-400 bg-teal-500/15 border-teal-500/30',
	'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
];

export function getPlatformBadgeClass(platform?: string): string {
	if (!platform) return BADGE_COLOR_PALETTE[0];
	const key = platform.toUpperCase().trim();
	if (key === 'AI_STUDIO') return 'text-sky-400 bg-sky-500/15 border-sky-500/30';
	if (key === 'VERTEX_API') return 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30';
	if (key === 'DEPLOYAI') return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
	if (key === 'OPENAI_COMPAT') return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';

	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		hash = (hash << 5) - hash + key.charCodeAt(i);
		hash |= 0;
	}
	const index = Math.abs(hash) % BADGE_COLOR_PALETTE.length;
	return BADGE_COLOR_PALETTE[index];
}

export function formatCompactNumber(num: number): string {
	if (num >= 1_000_000) {
		return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
	}
	if (num >= 1_000) {
		return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
	}
	return num.toLocaleString('vi-VN');
}
