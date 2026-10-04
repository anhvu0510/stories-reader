import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface NativeVoice {
	name: string;
	lang: string;
	language?: string;
	displayName: string;
	quality?: number;
	latency?: number;
	requiresNetwork?: boolean;
}

export interface NativeTTSEngine {
	name: string;
	label: string;
	isDefault: boolean;
}

export interface NativeTTSPluginInterface {
	isAvailable(): Promise<{ available: boolean }>;
	getEngines(): Promise<{ engines: NativeTTSEngine[]; defaultEngine?: string }>;
	setEngine(options: { engine: string }): Promise<{ success: boolean; engine: string }>;
	getVoices(): Promise<{ voices: NativeVoice[] }>;
	speak(options: { text: string; voice?: string; rate?: number; pitch?: number; utteranceId?: string }): Promise<{ utteranceId: string }>;
	stop(): Promise<void>;
	playChapter?(options: {
		chunks: string[];
		startIndex?: number;
		voice?: string;
		rate?: number;
		pitch?: number;
		initialBufferAhead?: number;
		maxBufferAhead?: number;
		gatewayUrl?: string;
	}): Promise<void>;
	pausePlayback?(): Promise<void>;
	resumePlayback?(): Promise<void>;
	stopPlayback?(): Promise<void>;
	seekToChunk?(options: { chunkIndex: number }): Promise<void>;
	clearCache?(): Promise<void>;
	addListener(eventName: 'onStart', listenerFunc: (info: { utteranceId: string }) => void): Promise<PluginListenerHandle>;
	addListener(eventName: 'onDone', listenerFunc: (info: { utteranceId: string }) => void): Promise<PluginListenerHandle>;
	addListener(eventName: 'onError', listenerFunc: (info: { utteranceId?: string; error?: string; message?: string; chunkIndex?: number }) => void): Promise<PluginListenerHandle>;
	addListener(eventName: 'onRangeStart', listenerFunc: (info: { utteranceId: string; start: number; end: number }) => void): Promise<PluginListenerHandle>;
	addListener(eventName: 'onChunkStart', listenerFunc: (data: { chunkIndex: number }) => void): Promise<PluginListenerHandle>;
	addListener(eventName: 'onWordBoundary', listenerFunc: (data: any) => void): Promise<PluginListenerHandle>;
	addListener(eventName: 'onPlaybackStateChange', listenerFunc: (data: any) => void): Promise<PluginListenerHandle>;
	addListener(eventName: 'onPlaybackComplete', listenerFunc: () => void): Promise<PluginListenerHandle>;
}

export const NativeTTS = registerPlugin<NativeTTSPluginInterface>('NativeTTS');

class NativeTTSServiceClass {
	private activeListeners: PluginListenerHandle[] = [];

	isNative(): boolean {
		return Capacitor.isNativePlatform();
	}

	async getEngines(): Promise<{ engines: NativeTTSEngine[]; defaultEngine?: string }> {
		if (!this.isNative()) {
			return { engines: [], defaultEngine: undefined };
		}
		try {
			return await NativeTTS.getEngines();
		} catch (err) {
			console.warn('[NativeTTS] getEngines error:', err);
			return { engines: [], defaultEngine: undefined };
		}
	}

	async setEngine(engine: string): Promise<boolean> {
		if (!this.isNative()) return false;
		try {
			const res = await NativeTTS.setEngine({ engine });
			return res.success;
		} catch (err) {
			console.warn('[NativeTTS] setEngine error:', err);
			return false;
		}
	}

	async getVoices(): Promise<NativeVoice[]> {
		if (this.isNative()) {
			try {
				const res = await NativeTTS.getVoices();
				return res.voices || [];
			} catch (err) {
				console.warn('[NativeTTS] getVoices native error:', err);
				return [];
			}
		}

		// Web Browser SpeechSynthesis fallback
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			const browserVoices = window.speechSynthesis.getVoices();
			return browserVoices.map((v) => ({
				name: v.name,
				lang: v.lang,
				language: v.lang.split('-')[0],
				displayName: `${v.name} (${v.lang})`,
				requiresNetwork: !v.localService
			}));
		}

		return [];
	}

	getVietnameseVoices(voices: NativeVoice[]): NativeVoice[] {
		return voices.filter((v) => {
			const l = (v.lang || '').toLowerCase();
			const code = (v.language || '').toLowerCase();
			return l.startsWith('vi') || code === 'vi' || l.includes('vie') || v.name.toLowerCase().includes('vietnam');
		});
	}

	async speak(options: {
		text: string;
		voice?: string;
		rate?: number;
		pitch?: number;
		utteranceId?: string;
		onStart?: () => void;
		onDone?: () => void;
		onError?: (err: any) => void;
		onRangeStart?: (start: number, end: number) => void;
	}): Promise<void> {
		const { text, voice, rate = 1.0, pitch = 1.0, utteranceId = String(Date.now()), onStart, onDone, onError, onRangeStart } = options;

		await this.stop();

		if (this.isNative()) {
			// Register event listeners
			const hStart = await NativeTTS.addListener('onStart', (info) => {
				if (info.utteranceId === utteranceId && onStart) onStart();
			});
			const hDone = await NativeTTS.addListener('onDone', (info) => {
				if (info.utteranceId === utteranceId) {
					this.cleanupListeners();
					if (onDone) onDone();
				}
			});
			const hError = await NativeTTS.addListener('onError', (info) => {
				if (info.utteranceId === utteranceId) {
					this.cleanupListeners();
					if (onError) onError(info.error || 'TTS error');
				}
			});
			const hRange = await NativeTTS.addListener('onRangeStart', (info) => {
				if (info.utteranceId === utteranceId && onRangeStart) {
					onRangeStart(info.start, info.end);
				}
			});

			this.activeListeners.push(hStart, hDone, hError, hRange);

			try {
				await NativeTTS.speak({
					text,
					voice,
					rate,
					pitch,
					utteranceId
				});
			} catch (err) {
				this.cleanupListeners();
				if (onError) onError(err);
				throw err;
			}
			return;
		}

		// Web Browser fallback
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			const synth = window.speechSynthesis;
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = rate;
			utterance.pitch = pitch;

			if (voice) {
				const vList = synth.getVoices();
				const matched = vList.find((v) => v.name === voice || v.voiceURI === voice);
				if (matched) utterance.voice = matched;
			}

			utterance.onstart = () => onStart?.();
			utterance.onend = () => onDone?.();
			utterance.onerror = (e) => {
				if (e.error === 'canceled') return;
				onError?.(e);
			};
			utterance.onboundary = (e) => {
				if (e.name === 'word') {
					onRangeStart?.(e.charIndex, e.charIndex + (e.charLength || 0));
				}
			};

			synth.speak(utterance);
		}
	}

	async stop(): Promise<void> {
		this.cleanupListeners();
		if (this.isNative()) {
			try {
				await NativeTTS.stop();
			} catch (err) {
				console.warn('[NativeTTS] stop error:', err);
			}
			return;
		}

		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			window.speechSynthesis.cancel();
		}
	}

	private cleanupListeners(): void {
		for (const handle of this.activeListeners) {
			try {
				void handle.remove();
			} catch (ignored) {}
		}
		this.activeListeners = [];
	}
}

export const NativeTTSService = new NativeTTSServiceClass();
