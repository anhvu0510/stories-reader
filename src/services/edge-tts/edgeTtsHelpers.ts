import { useAppStore } from '@/stores/useAppStore';

import { getEncryptedDefaultGatewayUrl } from '../secretServerService';

import type { EdgeVoice, EdgeWordBoundary } from '../edgeTtsService';

export const DEFAULT_GATEWAY_URL = '';

export const DEFAULT_EDGE_VOICES: EdgeVoice[] = [
	{
		id: 'vi-VN-HoaiMyNeural',
		name: 'Hoài Mỹ (Nữ - Tiếng Việt)',
		language: 'vi-VN',
		gender: 'female',
		desc: 'Giọng nữ tiếng Việt tự nhiên',
	},
	{
		id: 'vi-VN-NamMinhNeural',
		name: 'Nam Minh (Nam - Tiếng Việt)',
		language: 'vi-VN',
		gender: 'male',
		desc: 'Giọng nam tiếng Việt truyền cảm',
	},
];

export function base64ToBlob(base64: string, mimeType = 'audio/mpeg'): Blob {
	const byteCharacters = atob(base64);
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	const byteArray = new Uint8Array(byteNumbers);
	return new Blob([byteArray], { type: mimeType });
}

export function getGatewayBaseUrl(): string {
	try {
		const activeDomain = useAppStore.getState().activeDomain;
		if (activeDomain && activeDomain.url) {
			return activeDomain.url.replace(/\/+$/, '');
		}
	} catch {
		// intentionally empty — useAppStore may throw during SSR, fall through to default URL
	}
	return getEncryptedDefaultGatewayUrl();
}

function buildClientLogPayload(logData: {
	level?: 'info' | 'warn' | 'error';
	source?: string;
	message?: string;
	error?: string;
	details?: Record<string, unknown>;
}) {
	const error = logData.error || '';
	return {
		platform: 'android',
		source: logData.source || 'EdgeTTSNative',
		level: logData.level || 'info',
		message: logData.message || error,
		error,
		details: logData.details || {},
	};
}

function resolveLogBaseUrl(baseUrl?: string): string {
	if (baseUrl) return baseUrl.replace(/\/+$/, '');
	return getGatewayBaseUrl();
}

export async function reportClientLog(
	baseUrl: string | undefined,
	logData: {
		level?: 'info' | 'warn' | 'error';
		source?: string;
		message?: string;
		error?: string;
		details?: Record<string, unknown>;
	}
) {
	const rootUrl = resolveLogBaseUrl(baseUrl);
	if (!rootUrl) return;
	const targetUrl = `${rootUrl}/api/logs/client-error`;
	try {
		const res = await fetch(targetUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(buildClientLogPayload(logData)),
		});
		if (!res.ok) {
			console.warn(`[EdgeTTS] Server gateway phản hồi lỗi HTTP ${res.status} khi nhận client log`);
		}
	} catch (sendErr) {
		console.warn('[EdgeTTS] Không thể kết nối tới server gateway để gửi client log:', sendErr);
	}
}

export async function reportClientError(baseUrl: string | undefined, error: unknown, context: Record<string, unknown>) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	return reportClientLog(baseUrl, {
		level: 'error',
		source: 'EdgeTTSNative',
		error: errorMsg,
		message: `[EdgeTTS] Lỗi: ${errorMsg}`,
		details: context,
	});
}

function findWordIndex(foldedSource: string, cleanWord: string, searchFrom: number): number {
	const directIndex = foldedSource.indexOf(cleanWord, searchFrom);
	if (directIndex >= 0) return directIndex;

	const stripped = cleanWord.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
	if (stripped) {
		return foldedSource.indexOf(stripped, searchFrom);
	}
	return -1;
}

export function formatRatePercentage(speed: number): string {
	if (speed === 1.0) return '+0%';
	const prefix = speed >= 1.0 ? '+' : '';
	return `${prefix}${Math.round((speed - 1.0) * 100)}%`;
}

export function parseWordBoundariesHeader(headerValue: string | null): EdgeWordBoundary[] {
	if (!headerValue) {
		throw new Error('Edge TTS response did not include word boundaries');
	}

	const padded = headerValue
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.padEnd(Math.ceil(headerValue.length / 4) * 4, '=');
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	const rawBoundaries = JSON.parse(new TextDecoder().decode(bytes)) as Array<{
		text: string;
		char_index: number;
		char_length: number;
		start_seconds: number;
		end_seconds: number;
	}>;
	return rawBoundaries.map((boundary) => ({
		text: boundary.text,
		charIndex: boundary.char_index,
		charLength: boundary.char_length,
		startSeconds: boundary.start_seconds,
		endSeconds: boundary.end_seconds,
	}));
}

export function mapEdgeWordBoundaries(
	sourceText: string,
	rawBoundaries: Array<{
		text: string;
		charIndex?: number;
		charLength?: number;
		startSeconds: number;
		endSeconds: number;
	}>
): EdgeWordBoundary[] {
	if (!sourceText || !rawBoundaries || rawBoundaries.length === 0) {
		return [];
	}

	const foldedSource = sourceText.toLowerCase();
	let searchFrom = 0;
	const mapped: EdgeWordBoundary[] = [];

	for (const boundary of rawBoundaries) {
		const rawWord = boundary.text?.trim() || '';
		if (!rawWord) continue;

		const cleanWord = rawWord.toLowerCase();
		const charIndex = findWordIndex(foldedSource, cleanWord, searchFrom);

		if (charIndex >= 0) {
			const matchedLength = rawWord.length;
			const matchedText = sourceText.slice(charIndex, charIndex + matchedLength);
			mapped.push({
				text: matchedText || rawWord,
				charIndex,
				charLength: matchedLength,
				startSeconds: boundary.startSeconds,
				endSeconds: boundary.endSeconds,
			});
			searchFrom = charIndex + matchedLength;
		}
	}

	return mapped;
}
