import { Capacitor, registerPlugin } from '@capacitor/core';
import { useAppStore } from '@/stores/useAppStore';
import { useToastStore } from '@/stores/useToastStore';
import { getEncryptedDefaultGatewayUrl } from './secretServerService';

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
	synthesize(options: {
		text: string;
		voice?: string;
		rate?: string;
		pitch?: string;
	}): Promise<{
		audioBase64: string;
		mimeType?: string;
		wordBoundaries: EdgeWordBoundary[];
	}>;
}

export const EdgeTTSNative = registerPlugin<EdgeTTSNativePluginInterface>('EdgeTTSNative', {
	web: () => ({
		synthesize: async () => {
			throw new Error('EdgeTTSNative is only available on native Android');
		}
	})
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

async function reportClientError(baseUrl: string | undefined, error: unknown, context: Record<string, unknown>) {
	const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getGatewayBaseUrl();
	const targetUrl = `${rootUrl}/api/logs/client-error`;
	const errorMsg = error instanceof Error ? error.message : String(error);
	console.info(`[EdgeTTS] Gửi báo cáo lỗi client/native lên server gateway (${targetUrl}): ${errorMsg}`, context);
	try {
		const res = await fetch(targetUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				platform: 'android',
				source: 'EdgeTTSNative',
				level: 'error',
				error: errorMsg,
				details: context
			})
		});
		if (!res.ok) {
			console.warn(`[EdgeTTS] Server gateway phản hồi lỗi khi nhận log: HTTP ${res.status}`);
		} else {
			console.info('[EdgeTTS] Đã gửi báo cáo lỗi thành công lên server gateway');
		}
	} catch (logErr) {
		console.warn('[EdgeTTS] Không thể kết nối tới server gateway để gửi log lỗi:', logErr);
	}
}

export const DEFAULT_GATEWAY_URL = '';

export function getGatewayBaseUrl(): string {
	try {
		const activeDomain = useAppStore.getState().activeDomain;
		if (activeDomain && activeDomain.url) {
			return activeDomain.url.replace(/\/+$/, '');
		}
	} catch {}
	return getEncryptedDefaultGatewayUrl();
}

export const DEFAULT_EDGE_VOICES: EdgeVoice[] = [
	{
		id: 'vi-VN-HoaiMyNeural',
		name: 'Hoài Mỹ (Nữ - Tiếng Việt)',
		language: 'vi-VN',
		gender: 'female',
		desc: 'Giọng nữ tiếng Việt tự nhiên'
	},
	{
		id: 'vi-VN-NamMinhNeural',
		name: 'Nam Minh (Nam - Tiếng Việt)',
		language: 'vi-VN',
		gender: 'male',
		desc: 'Giọng nam tiếng Việt truyền cảm'
	}
];

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
		let charIndex = foldedSource.indexOf(cleanWord, searchFrom);

		if (charIndex < 0) {
			const stripped = cleanWord.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
			if (stripped) {
				charIndex = foldedSource.indexOf(stripped, searchFrom);
			}
		}

		if (charIndex >= 0) {
			const matchedLength = rawWord.length;
			const matchedText = sourceText.slice(charIndex, charIndex + matchedLength);
			mapped.push({
				text: matchedText || rawWord,
				charIndex,
				charLength: matchedLength,
				startSeconds: boundary.startSeconds,
				endSeconds: boundary.endSeconds
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
		console.info(`[EdgeTTS:Voices] Đang lấy danh sách giọng từ server gateway: ${targetUrl}`);
		try {
			const startTime = performance.now();
			const response = await fetch(targetUrl, {
				method: 'GET',
				headers: { Accept: 'application/json' }
			});
			const elapsed = Math.round(performance.now() - startTime);
			if (!response.ok) {
				throw new Error(`HTTP error ${response.status}`);
			}
			const data = await response.json();
			if (Array.isArray(data?.voices) && data.voices.length > 0) {
				console.info(`[EdgeTTS:Voices] Đã lấy thành công ${data.voices.length} giọng từ server gateway (${elapsed}ms)`);
				return data.voices;
			}
		} catch (err) {
			console.warn('[EdgeTTSService] Failed to fetch Edge TTS voices, fallback to default list:', err);
		}
		return DEFAULT_EDGE_VOICES;
	}

	public static async synthesizeSpeech(text: string, voice: string = 'vi-VN-HoaiMyNeural', speed: number = 1.0, baseUrl?: string, signal?: AbortSignal): Promise<Blob> {
		if (!text || !text.trim()) {
			throw new Error('Text to synthesize cannot be empty');
		}

		const ratePercentage = speed !== 1.0 ? `${speed >= 1.0 ? '+' : ''}${Math.round((speed - 1.0) * 100)}%` : '+0%';

		// Android Native flow: in-memory bypass via OkHttp WebSocket
		if (Capacitor.isNativePlatform()) {
			console.info(`[EdgeTTS:Native] Bắt đầu tổng hợp native: voice=${voice}, speed=${speed} (${ratePercentage}), textLen=${text.length}`);
			const startTime = performance.now();
			try {
				const res = await EdgeTTSNative.synthesize({
					text: text.trim(),
					voice,
					rate: ratePercentage,
					pitch: '+0Hz'
				});
				const elapsed = Math.round(performance.now() - startTime);
				const blob = base64ToBlob(res.audioBase64, res.mimeType || 'audio/mpeg');
				console.info(`[EdgeTTS:Native] Tổng hợp native thành công sau ${elapsed}ms: size=${blob.size} bytes`);
				return blob;
			} catch (err) {
				const elapsed = Math.round(performance.now() - startTime);
				const errMsg = err instanceof Error ? err.message : String(err);
				console.error(`[EdgeTTS:Native] Tổng hợp native thất bại sau ${elapsed}ms: ${errMsg}`, err);
				useToastStore.getState().showToast(`Lỗi Edge TTS: ${errMsg}`, 'error');
				void reportClientError(baseUrl, err, { text: text.slice(0, 80), voice, speed, elapsedMs: elapsed });
				throw err;
			}
		}

		// Web Browser fallback via Gateway API
		const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getGatewayBaseUrl();
		const targetUrl = `${rootUrl}/tts/edge/synthesize`;
		console.info(`[EdgeTTS:Server] Đang gửi yêu cầu tổng hợp âm thanh lên server gateway (${targetUrl}): voice=${voice}, speed=${speed} (${ratePercentage}), textLen=${text.length}`);
		const startTime = performance.now();

		const response = await fetch(targetUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'audio/mpeg'
			},
			body: JSON.stringify({
				text: text.trim(),
				voice,
				rate: ratePercentage
			}),
			signal
		});

		const elapsed = Math.round(performance.now() - startTime);
		if (!response.ok) {
			const errText = await response.text().catch(() => '');
			console.error(`[EdgeTTS:Server] Server gateway trả về lỗi sau ${elapsed}ms: HTTP ${response.status} - ${errText}`);
			throw new Error(`Edge TTS synthesis failed (${response.status}): ${errText}`);
		}

		const blob = await response.blob();
		console.info(`[EdgeTTS:Server] Server gateway hoàn tất tổng hợp sau ${elapsed}ms: size=${blob.size} bytes`);
		return blob;
	}

	public static async synthesizeSpeechWithBoundaries(
		text: string,
		voice: string = 'vi-VN-HoaiMyNeural',
		speed: number = 1.0,
		baseUrl?: string,
		signal?: AbortSignal
	): Promise<EdgeSpeechWithBoundaries> {
		if (!text || !text.trim()) {
			throw new Error('Text to synthesize cannot be empty');
		}

		const ratePercentage = speed !== 1.0 ? `${speed >= 1.0 ? '+' : ''}${Math.round((speed - 1.0) * 100)}%` : '+0%';

		// Android Native flow: in-memory bypass with word boundaries
		if (Capacitor.isNativePlatform()) {
			console.info(`[EdgeTTS:Native] Bắt đầu tổng hợp native kèm word boundaries: voice=${voice}, speed=${speed} (${ratePercentage}), textLen=${text.length}`);
			const startTime = performance.now();
			try {
				const res = await EdgeTTSNative.synthesize({
					text: text.trim(),
					voice,
					rate: ratePercentage,
					pitch: '+0Hz'
				});
				const elapsed = Math.round(performance.now() - startTime);
				const blob = base64ToBlob(res.audioBase64, res.mimeType || 'audio/mpeg');
				const rawBoundaries = res.wordBoundaries || [];
				const mappedBoundaries = mapEdgeWordBoundaries(text, rawBoundaries);
				const finalBoundaries = mappedBoundaries.length > 0 ? mappedBoundaries : rawBoundaries;
				console.info(`[EdgeTTS:Native] Tổng hợp native thành công sau ${elapsed}ms: size=${blob.size} bytes, boundaries=${finalBoundaries.length}`);

				return {
					audio: blob,
					wordBoundaries: finalBoundaries
				};
			} catch (err) {
				const elapsed = Math.round(performance.now() - startTime);
				const errMsg = err instanceof Error ? err.message : String(err);
				console.error(`[EdgeTTS:Native] Tổng hợp native thất bại sau ${elapsed}ms: ${errMsg}`, err);
				useToastStore.getState().showToast(`Lỗi Edge TTS: ${errMsg}`, 'error');
				void reportClientError(baseUrl, err, { text: text.slice(0, 80), voice, speed, elapsedMs: elapsed });
				throw err;
			}
		}

		// Web Browser fallback via Gateway API
		const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getGatewayBaseUrl();
		const targetUrl = `${rootUrl}/tts/edge/synthesize`;
		console.info(`[EdgeTTS:Server] Đang gửi yêu cầu tổng hợp kèm word boundaries lên server gateway (${targetUrl}): voice=${voice}, speed=${speed} (${ratePercentage}), textLen=${text.length}`);
		const startTime = performance.now();
		const response = await fetch(targetUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'audio/mpeg'
			},
			body: JSON.stringify({
				text: text.trim(),
				voice,
				rate: ratePercentage,
				include_word_boundaries: true
			}),
			signal
		});

		const elapsed = Math.round(performance.now() - startTime);
		if (!response.ok) {
			const errText = await response.text().catch(() => '');
			console.error(`[EdgeTTS:Server] Server gateway trả về lỗi sau ${elapsed}ms: HTTP ${response.status} - ${errText}`);
			throw new Error(`Edge TTS synthesis failed (${response.status}): ${errText}`);
		}

		const encodedBoundaries = response.headers.get('X-Word-Boundaries');
		if (!encodedBoundaries) {
			console.error(`[EdgeTTS:Server] Server gateway phản hồi nhưng thiếu header X-Word-Boundaries sau ${elapsed}ms`);
			throw new Error('Edge TTS response did not include word boundaries');
		}

		const padded = encodedBoundaries
			.replace(/-/g, '+')
			.replace(/_/g, '/')
			.padEnd(Math.ceil(encodedBoundaries.length / 4) * 4, '=');
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
		const rawBoundaries = JSON.parse(new TextDecoder().decode(bytes)) as Array<{
			text: string;
			char_index: number;
			char_length: number;
			start_seconds: number;
			end_seconds: number;
		}>;
		const wordBoundaries = rawBoundaries.map((boundary) => ({
			text: boundary.text,
			charIndex: boundary.char_index,
			charLength: boundary.char_length,
			startSeconds: boundary.start_seconds,
			endSeconds: boundary.end_seconds
		}));

		const blob = await response.blob();
		console.info(`[EdgeTTS:Server] Server gateway hoàn tất tổng hợp sau ${elapsed}ms: size=${blob.size} bytes, boundaries=${wordBoundaries.length}`);

		return {
			audio: blob,
			wordBoundaries
		};
	}
}
