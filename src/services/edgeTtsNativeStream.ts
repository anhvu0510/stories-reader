import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import type { EdgeBufferMode } from '@/shared/types';
import type { ReadAloudUtterance } from './readAloudUtterancePlan';
import { EdgeTTSNative } from './edgeTtsService';

export interface StartPlaybackOptions {
	chunks: string[];
	utterances?: ReadAloudUtterance[];
	sessionId?: string;
	startIndex?: number;
	voice?: string;
	rate?: number;
	pitch?: string;
	gatewayUrl?: string;
	bookTitle?: string;
	chapterTitle?: string;
	bufferMode?: EdgeBufferMode;
}

export interface WordBoundaryEvent {
	sessionId?: string;
	chunkIndex: number;
	charIndex: number;
	charLength: number;
	text: string;
	utteranceIndex?: number;
	paragraphIndex?: number;
	sourceStart?: number;
	sourceLength?: number;
}

export interface PlaybackStateEvent {
	sessionId?: string;
	isPlaying: boolean;
	isPaused: boolean;
	isBuffering: boolean;
}

export type PlaybackSessionState = 'IDLE' | 'CONNECTING' | 'BUFFERING' | 'PLAYING' | 'SEEKING' | 'PAUSED' | 'COMPLETED' | 'ERROR';

export interface PlaybackSnapshot {
	sessionId: string;
	state: PlaybackSessionState;
	utteranceIndex: number;
	positionMs: number;
	bufferedDurationMs: number;
	rebufferCount: number;
	firstAudioLatencyMs?: number;
	lastBufferingDurationMs?: number;
	errorCode?: string;
}

export type ChunkStartListener = (chunkIndex: number) => void;
export type WordBoundaryListener = (data: WordBoundaryEvent) => void;
export type PlaybackStateListener = (state: PlaybackStateEvent) => void;
export type PlaybackCompleteListener = () => void;
export type PlaybackErrorListener = (error: { message: string; chunkIndex?: number }) => void;
export type PlaybackSnapshotListener = (snapshot: PlaybackSnapshot) => void;

class EdgeTTSNativeStreamServiceClass {
	private chunkStartListeners: Set<ChunkStartListener> = new Set();
	private wordBoundaryListeners: Set<WordBoundaryListener> = new Set();
	private playbackStateListeners: Set<PlaybackStateListener> = new Set();
	private playbackCompleteListeners: Set<PlaybackCompleteListener> = new Set();
	private errorListeners: Set<PlaybackErrorListener> = new Set();
	private snapshotListeners: Set<PlaybackSnapshotListener> = new Set();

	private listenerHandles: PluginListenerHandle[] = [];
	private isListenersInitialized = false;
	private listenersInitialization: Promise<void> | null = null;
	private activeSessionId: string | null = null;
	private latestSnapshot: PlaybackSnapshot | null = null;

	public resetForTesting(): void {
		this.chunkStartListeners.clear();
		this.wordBoundaryListeners.clear();
		this.playbackStateListeners.clear();
		this.playbackCompleteListeners.clear();
		this.errorListeners.clear();
		this.snapshotListeners.clear();
		this.listenerHandles = [];
		this.isListenersInitialized = false;
		this.listenersInitialization = null;
		this.activeSessionId = null;
		this.latestSnapshot = null;
	}

	public isAvailable(): boolean {
		if (typeof window === 'undefined') return false;
		try {
			return Capacitor.getPlatform() === 'android';
		} catch {
			return false;
		}
	}

	public async initListeners(): Promise<void> {
		if (this.isListenersInitialized || !this.isAvailable()) return;
		if (this.listenersInitialization) return this.listenersInitialization;
		this.listenersInitialization = this.initializeListeners();
		try {
			await this.listenersInitialization;
		} finally {
			this.listenersInitialization = null;
		}
	}

	private async initializeListeners(): Promise<void> {
		try {
			if (typeof EdgeTTSNative.addListener === 'function') {
				const handle1 = await EdgeTTSNative.addListener('onChunkStart', (data: { sessionId?: string; chunkIndex: number }) => {
					if (!this.isActiveSession(data.sessionId)) return;
					this.chunkStartListeners.forEach((cb) => cb(data.chunkIndex));
				});
				const handle2 = await EdgeTTSNative.addListener('onWordBoundary', (data: WordBoundaryEvent) => {
					if (!this.isActiveSession(data.sessionId)) return;
					this.wordBoundaryListeners.forEach((cb) => cb(data));
				});
				const handle3 = await EdgeTTSNative.addListener('onPlaybackStateChange', (data: PlaybackStateEvent) => {
					if (!this.isActiveSession(data.sessionId)) return;
					this.playbackStateListeners.forEach((cb) => cb(data));
				});
				const handle4 = await EdgeTTSNative.addListener('onPlaybackComplete', (data: { sessionId?: string }) => {
					if (!this.isActiveSession(data?.sessionId)) return;
					this.playbackCompleteListeners.forEach((cb) => cb());
				});
				const handle5 = await EdgeTTSNative.addListener('onError', (data: { sessionId?: string; message: string; chunkIndex?: number }) => {
					if (!this.isActiveSession(data.sessionId)) return;
					this.errorListeners.forEach((cb) => cb(data));
				});
				const handle6 = await EdgeTTSNative.addListener('onPlaybackSnapshot', (data: PlaybackSnapshot) => {
					if (!this.isActiveSession(data.sessionId)) return;
					this.latestSnapshot = data;
					this.snapshotListeners.forEach((cb) => cb(data));
				});

				this.listenerHandles.push(handle1, handle2, handle3, handle4, handle5, handle6);
				this.isListenersInitialized = true;
				const plugin = EdgeTTSNative as unknown as { getPlaybackSnapshot?: () => Promise<PlaybackSnapshot | null> };
				const snapshot = await plugin.getPlaybackSnapshot?.();
				if (snapshot && snapshot.sessionId && this.isActiveSession(snapshot.sessionId)) {
					this.latestSnapshot = snapshot;
					this.snapshotListeners.forEach((cb) => cb(snapshot));
					this.playbackStateListeners.forEach((cb) => cb(this.snapshotToLegacyState(snapshot)));
				}
			}
		} catch (e) {
			console.warn('[EdgeTTSNativeStream] Failed to init native listeners:', e);
		}
	}

	public async startPlayback(options: StartPlaybackOptions): Promise<void> {
		if (!this.isAvailable()) {
			throw new Error('EdgeTTSNativeStream is only available on native Android');
		}
		await this.initListeners();
		this.activeSessionId = options.sessionId ?? null;
		this.latestSnapshot = null;
		const plugin = EdgeTTSNative as unknown as {
			playChapter?: (opts: StartPlaybackOptions) => Promise<void>;
			pausePlayback?: () => Promise<void>;
			resumePlayback?: () => Promise<void>;
			stopPlayback?: () => Promise<void>;
			seekToChunk?: (opts: { chunkIndex: number }) => Promise<void>;
			clearCache?: () => Promise<void>;
		};
		if (typeof plugin.playChapter === 'function') {
			await plugin.playChapter(options);
		}
	}

	public async pause(): Promise<void> {
		if (!this.isAvailable()) return;
		const plugin = EdgeTTSNative as unknown as { pausePlayback?: () => Promise<void> };
		if (typeof plugin.pausePlayback === 'function') {
			await plugin.pausePlayback();
		}
	}

	public async resume(): Promise<void> {
		if (!this.isAvailable()) return;
		const plugin = EdgeTTSNative as unknown as { resumePlayback?: () => Promise<void> };
		if (typeof plugin.resumePlayback === 'function') {
			await plugin.resumePlayback();
		}
	}

	public async stop(): Promise<void> {
		if (!this.isAvailable()) return;
		const plugin = EdgeTTSNative as unknown as { stopPlayback?: () => Promise<void> };
		if (typeof plugin.stopPlayback === 'function') {
			await plugin.stopPlayback();
		}
	}

	public async seekToChunk(chunkIndex: number): Promise<void> {
		if (!this.isAvailable()) return;
		const plugin = EdgeTTSNative as unknown as { seekToChunk?: (opts: { chunkIndex: number }) => Promise<void> };
		if (typeof plugin.seekToChunk === 'function') {
			await plugin.seekToChunk({ chunkIndex });
		}
	}

	public async clearCache(): Promise<void> {
		if (!this.isAvailable()) return;
		const plugin = EdgeTTSNative as unknown as { clearCache?: () => Promise<void> };
		if (typeof plugin.clearCache === 'function') {
			try {
				await plugin.clearCache();
			} catch (e) {
				console.warn('[EdgeTTSNativeStream] Failed to clear native cache:', e);
			}
		}
	}

	public onChunkStart(cb: ChunkStartListener): () => void {
		this.chunkStartListeners.add(cb);
		return () => {
			this.chunkStartListeners.delete(cb);
		};
	}

	public onWordBoundary(cb: WordBoundaryListener): () => void {
		this.wordBoundaryListeners.add(cb);
		return () => {
			this.wordBoundaryListeners.delete(cb);
		};
	}

	public onPlaybackStateChange(cb: PlaybackStateListener): () => void {
		this.playbackStateListeners.add(cb);
		void this.initListeners();
		return () => {
			this.playbackStateListeners.delete(cb);
		};
	}

	public onPlaybackComplete(cb: PlaybackCompleteListener): () => void {
		this.playbackCompleteListeners.add(cb);
		return () => {
			this.playbackCompleteListeners.delete(cb);
		};
	}

	public onError(cb: PlaybackErrorListener): () => void {
		this.errorListeners.add(cb);
		return () => {
			this.errorListeners.delete(cb);
		};
	}

	public onSnapshot(cb: PlaybackSnapshotListener): () => void {
		this.snapshotListeners.add(cb);
		void this.initListeners();
		if (this.latestSnapshot) cb(this.latestSnapshot);
		return () => {
			this.snapshotListeners.delete(cb);
		};
	}

	private isActiveSession(sessionId?: string): boolean {
		if (!sessionId) return true;
		if (!this.activeSessionId) return true;
		return sessionId === this.activeSessionId;
	}

	private snapshotToLegacyState(snapshot: PlaybackSnapshot): PlaybackStateEvent {
		return {
			sessionId: snapshot.sessionId,
			isPlaying: snapshot.state === 'PLAYING',
			isPaused: snapshot.state === 'PAUSED' || snapshot.state === 'ERROR',
			isBuffering: snapshot.state === 'CONNECTING' || snapshot.state === 'BUFFERING' || snapshot.state === 'SEEKING'
		};
	}
}

export const EdgeTTSNativeStreamService = new EdgeTTSNativeStreamServiceClass();
