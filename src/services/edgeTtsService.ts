import { Capacitor, registerPlugin } from '@capacitor/core';

import { useAppStore } from '@/stores/useAppStore';
import { useToastStore } from '@/stores/useToastStore';

import { getEncryptedDefaultGatewayUrl } from './secretServerService';

import type { PlaybackSnapshot } from './edgeTtsNativeStream';
import type { ReadAloudUtterance } from './readAloudUtterancePlan';

export interface EdgeVoice {
	id: string;
	name: string;
	language: string;
	gender: 'male' | 'female';
	desc?: string;
}

export interface EdgeWordBoundary {
	text: string;
	charIndex: number;
	charLength: number;
	startSeconds: number;
	endSeconds: number;
}

export interface EdgeSpeechWithBoundaries {
	audio: Blob;
	wordBoundaries: EdgeWordBoundary[];
}

export interface EdgeTTSNativePluginInterface {
	synthesize(options: { text: string; voice?: string; rate?: string; pitch?: string; gatewayUrl?: string }): Promise<{
		audioBase64: string;
		mimeType?: string;
		wordBoundaries: EdgeWordBoundary[];
	}>;
	playChapter?(options: {
		chunks: string[];
		utterances?: ReadAloudUtterance[];
		sessionId?: string;
		startIndex?: number;
		startCharIndex?: number;
		voice?: string;
		rate?: number;
		pitch?: string;
		gatewayUrl?: string;
		bookTitle?: string;
		chapterTitle?: string;
	}): Promise<void>;
	pausePlayback?(): Promise<void>;
	resumePlayback?(): Promise<void>;
	stopPlayback?(): Promise<void>;
	seekToChunk?(options: { chunkIndex: number }): Promise<void>;
	getPlaybackSnapshot?(): Promise<PlaybackSnapshot | null>;
	addListener?(eventName: string, listenerFunc: (data: unknown) => void): Promise<{ remove: () => Promise<void> }>;
}

export const EdgeTTSNative = registerPlugin<EdgeTTSNativePluginInterface>('EdgeTTSNative', {
	web: () => ({
		synthesize: async () => {
			throw new Error('EdgeTTSNative is only available on native Android');
		},
		playChapter: async () => {
			throw new Error('EdgeTTSNative stream is only available on native Android');
		},
		pausePlayback: async () => {},
		resumePlayback: async () => {},
		stopPlayback: async () => {},
		seekToChunk: async () => {},
		addListener: async () => ({ remove: async () => {} }),
	}),
});

function base64ToBlob(base64: string, mimeType = 'audio/mpeg'): Blob {
	const byteCharacters = atob(base64);
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	const byteArray = new Uint8Array(byteNumbers);
	return new Blob([byteArray], { type: mimeType });
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

export const DEFAULT_GATEWAY_URL = '';

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

function parseWordBoundariesHeader(headerValue: string | null): EdgeWordBoundary[] {
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

export class EdgeTTSService {
	public static async fetchVoices(baseUrl?: string): Promise<EdgeVoice[]> {
		const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getGatewayBaseUrl();
		const targetUrl = `${rootUrl}/tts/edge/voices`;
		try {
			const response = await fetch(targetUrl, {
				method: 'GET',
				headers: { Accept: 'application/json' },
			});
			if (!response.ok) {
				throw new Error(`HTTP error ${response.status}`);
			}
			const data = await response.json();
			if (Array.isArray(data?.voices) && data.voices.length > 0) {
				const viVoices = data.voices.filter((v: EdgeVoice) => v.language === 'vi-VN' || v.id?.startsWith('vi-VN'));
				if (viVoices.length > 0) {
					return viVoices;
				}
			}
		} catch (err) {
			console.warn('[EdgeTTSService] Failed to fetch Edge TTS voices, fallback to default list:', err);
		}
		return DEFAULT_EDGE_VOICES;
	}

	private static async synthesizeSpeechNative(text: string, voice: string, ratePercentage: string, rootUrl: string): Promise<Blob> {
		const startTime = performance.now();
		try {
			const res = await EdgeTTSNative.synthesize({
				text: text.trim(),
				voice,
				rate: ratePercentage,
				pitch: '+0Hz',
				gatewayUrl: rootUrl,
			});
			const elapsed = Math.round(performance.now() - startTime);
			const blob = base64ToBlob(res.audioBase64, res.mimeType || 'audio/mpeg');

			void reportClientLog(rootUrl, {
				level: 'info',
				source: 'EdgeTTSNative',
				message: `[EdgeTTS] Tổng hợp native thành công (${elapsed}ms, ${blob.size} bytes)`,
				details: { voice, speed: ratePercentage, elapsedMs: elapsed, audioBytes: blob.size, textPreview: text.slice(0, 60) },
			});

			return blob;
		} catch (err) {
			const elapsed = Math.round(performance.now() - startTime);
			const errMsg = err instanceof Error ? err.message : String(err);
			console.error(`[EdgeTTS:Native] Tổng hợp native thất bại sau ${elapsed}ms: ${errMsg}`, err);
			useToastStore.getState().showToast(`Lỗi Edge TTS: ${errMsg}`, 'error');
			void reportClientLog(rootUrl, {
				level: 'error',
				source: 'EdgeTTSNative',
				message: `[EdgeTTS] Tổng hợp native thất bại (${elapsed}ms): ${errMsg}`,
				error: errMsg,
				details: { voice, speed: ratePercentage, elapsedMs: elapsed, textPreview: text.slice(0, 80) },
			});
			throw err;
		}
	}

	private static async synthesizeSpeechWeb(
		text: string,
		voice: string,
		ratePercentage: string,
		rootUrl: string,
		signal?: AbortSignal
	): Promise<Blob> {
		const targetUrl = `${rootUrl}/tts/edge/synthesize`;
		const startTime = performance.now();

		const response = await fetch(targetUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'audio/mpeg',
			},
			body: JSON.stringify({
				text: text.trim(),
				voice,
				rate: ratePercentage,
			}),
			signal,
		});

		const elapsed = Math.round(performance.now() - startTime);
		if (!response.ok) {
			const errText = await response.text().catch(() => '');
			console.error(`[EdgeTTS:Server] Server gateway trả về lỗi sau ${elapsed}ms: HTTP ${response.status} - ${errText}`);
			void reportClientLog(rootUrl, {
				level: 'error',
				source: 'EdgeTTS_Web',
				message: `[EdgeTTS:Web] Server gateway trả về lỗi sau ${elapsed}ms: HTTP ${response.status}`,
				error: errText,
				details: { voice, speed: ratePercentage, elapsedMs: elapsed },
			});
			throw new Error(`Edge TTS synthesis failed (${response.status}): ${errText}`);
		}

		const blob = await response.blob();
		void reportClientLog(rootUrl, {
			level: 'info',
			source: 'EdgeTTS_Web',
			message: `[EdgeTTS:Web] Hoàn tất tổng hợp âm thanh qua server (${elapsed}ms, ${blob.size} bytes): "${text}"`,
			details: { voice, speed: ratePercentage, elapsedMs: elapsed, audioBytes: blob.size, fullText: text },
		});
		return blob;
	}

	public static async synthesizeSpeech(
		text: string,
		voice: string = 'vi-VN-HoaiMyNeural',
		speed: number = 1.8,
		baseUrl?: string,
		signal?: AbortSignal
	): Promise<Blob> {
		if (!text || !text.trim()) {
			throw new Error('Text to synthesize cannot be empty');
		}

		const ratePercentage = formatRatePercentage(speed);
		const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getGatewayBaseUrl();

		if (Capacitor.isNativePlatform()) {
			return this.synthesizeSpeechNative(text, voice, ratePercentage, rootUrl);
		}

		return this.synthesizeSpeechWeb(text, voice, ratePercentage, rootUrl, signal);
	}

	private static async synthesizeBoundariesNative(
		text: string,
		voice: string,
		ratePercentage: string,
		rootUrl: string
	): Promise<EdgeSpeechWithBoundaries> {
		const startTime = performance.now();
		try {
			const res = await EdgeTTSNative.synthesize({
				text: text.trim(),
				voice,
				rate: ratePercentage,
				pitch: '+0Hz',
				gatewayUrl: rootUrl,
			});
			const elapsed = Math.round(performance.now() - startTime);
			const blob = base64ToBlob(res.audioBase64, res.mimeType || 'audio/mpeg');
			const rawBoundaries = res.wordBoundaries || [];
			const mappedBoundaries = mapEdgeWordBoundaries(text, rawBoundaries);
			const finalBoundaries = mappedBoundaries.length > 0 ? mappedBoundaries : rawBoundaries;

			void reportClientLog(rootUrl, {
				level: 'info',
				source: 'EdgeTTSNative',
				message: `[EdgeTTS] Tổng hợp native thành công (${elapsed}ms, ${blob.size} bytes, ${finalBoundaries.length} boundaries): "${text}"`,
				details: {
					voice,
					speed: ratePercentage,
					elapsedMs: elapsed,
					audioBytes: blob.size,
					boundariesCount: finalBoundaries.length,
					fullText: text,
				},
			});

			return {
				audio: blob,
				wordBoundaries: finalBoundaries,
			};
		} catch (err) {
			const elapsed = Math.round(performance.now() - startTime);
			const errMsg = err instanceof Error ? err.message : String(err);
			console.error(`[EdgeTTS:Native] Tổng hợp native thất bại sau ${elapsed}ms: ${errMsg}`, err);
			useToastStore.getState().showToast(`Lỗi Edge TTS: ${errMsg}`, 'error');
			void reportClientLog(rootUrl, {
				level: 'error',
				source: 'EdgeTTSNative',
				message: `[EdgeTTS] Tổng hợp native thất bại (${elapsed}ms): ${errMsg} - Nội dung: "${text}"`,
				error: errMsg,
				details: { voice, speed: ratePercentage, elapsedMs: elapsed, fullText: text },
			});
			throw err;
		}
	}

	private static async synthesizeBoundariesWeb(
		text: string,
		voice: string,
		ratePercentage: string,
		rootUrl: string,
		signal?: AbortSignal
	): Promise<EdgeSpeechWithBoundaries> {
		const targetUrl = `${rootUrl}/tts/edge/synthesize`;
		const startTime = performance.now();
		const response = await fetch(targetUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'audio/mpeg',
			},
			body: JSON.stringify({
				text: text.trim(),
				voice,
				rate: ratePercentage,
				include_word_boundaries: true,
			}),
			signal,
		});

		const elapsed = Math.round(performance.now() - startTime);
		if (!response.ok) {
			const errText = await response.text().catch(() => '');
			console.error(`[EdgeTTS:Server] Server gateway trả về lỗi sau ${elapsed}ms: HTTP ${response.status} - ${errText}`);
			void reportClientLog(rootUrl, {
				level: 'error',
				source: 'EdgeTTS_Web',
				message: `[EdgeTTS:Web] Server gateway trả về lỗi sau ${elapsed}ms: HTTP ${response.status} - Nội dung: "${text}"`,
				error: errText,
				details: { voice, speed: ratePercentage, elapsedMs: elapsed, fullText: text },
			});
			throw new Error(`Edge TTS synthesis failed (${response.status}): ${errText}`);
		}

		const wordBoundaries = parseWordBoundariesHeader(response.headers.get('X-Word-Boundaries'));
		const blob = await response.blob();
		return { audio: blob, wordBoundaries };
	}

	public static async synthesizeSpeechWithBoundaries(
		text: string,
		voice: string = 'vi-VN-HoaiMyNeural',
		speed: number = 1.8,
		baseUrl?: string,
		signal?: AbortSignal
	): Promise<EdgeSpeechWithBoundaries> {
		if (!text || !text.trim()) {
			throw new Error('Text to synthesize cannot be empty');
		}

		const ratePercentage = formatRatePercentage(speed);
		const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getGatewayBaseUrl();

		if (Capacitor.isNativePlatform()) {
			return this.synthesizeBoundariesNative(text, voice, ratePercentage, rootUrl);
		}

		return this.synthesizeBoundariesWeb(text, voice, ratePercentage, rootUrl, signal);
	}
}
