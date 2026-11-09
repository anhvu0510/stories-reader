import { Capacitor, registerPlugin } from '@capacitor/core';

import { useToastStore } from '@/stores/useToastStore';

import {
	base64ToBlob,
	DEFAULT_EDGE_VOICES,
	DEFAULT_GATEWAY_URL,
	formatRatePercentage,
	getGatewayBaseUrl,
	mapEdgeWordBoundaries,
	parseWordBoundariesHeader,
	reportClientError,
	reportClientLog,
} from './edge-tts/edgeTtsHelpers';

import type { PlaybackSnapshot } from './edgeTtsNativeStream';
import type { ReadAloudUtterance } from './readAloudUtterancePlan';

export {
	DEFAULT_EDGE_VOICES,
	DEFAULT_GATEWAY_URL,
	formatRatePercentage,
	getGatewayBaseUrl,
	mapEdgeWordBoundaries,
	reportClientError,
	reportClientLog,
};

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
