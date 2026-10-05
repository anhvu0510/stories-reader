import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { EdgeTTSNative } from './edgeTtsService';

export interface StartPlaybackOptions {
	chunks: string[];
	startIndex?: number;
	voice?: string;
	rate?: number;
	pitch?: string;
	gatewayUrl?: string;
	bookTitle?: string;
	chapterTitle?: string;
	bufferMode?: 'file' | 'memory';
}

export interface WordBoundaryEvent {
	chunkIndex: number;
	charIndex: number;
	charLength: number;
	text: string;
}

export interface PlaybackStateEvent {
	isPlaying: boolean;
	isPaused: boolean;
	isBuffering: boolean;
}

export type ChunkStartListener = (chunkIndex: number) => void;
export type WordBoundaryListener = (data: WordBoundaryEvent) => void;
export type PlaybackStateListener = (state: PlaybackStateEvent) => void;
export type PlaybackCompleteListener = () => void;
export type PlaybackErrorListener = (error: { message: string; chunkIndex?: number }) => void;

class EdgeTTSNativeStreamServiceClass {
	private chunkStartListeners: Set<ChunkStartListener> = new Set();
	private wordBoundaryListeners: Set<WordBoundaryListener> = new Set();
	private playbackStateListeners: Set<PlaybackStateListener> = new Set();
	private playbackCompleteListeners: Set<PlaybackCompleteListener> = new Set();
	private errorListeners: Set<PlaybackErrorListener> = new Set();

	private listenerHandles: PluginListenerHandle[] = [];
	private isListenersInitialized = false;

	public resetForTesting(): void {
		this.chunkStartListeners.clear();
		this.wordBoundaryListeners.clear();
		this.playbackStateListeners.clear();
		this.playbackCompleteListeners.clear();
		this.errorListeners.clear();
		this.listenerHandles = [];
		this.isListenersInitialized = false;
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
		try {
			if (typeof EdgeTTSNative.addListener === 'function') {
				const handle1 = await EdgeTTSNative.addListener('onChunkStart', (data: { chunkIndex: number }) => {
					this.chunkStartListeners.forEach((cb) => cb(data.chunkIndex));
				});
				const handle2 = await EdgeTTSNative.addListener('onWordBoundary', (data: WordBoundaryEvent) => {
					this.wordBoundaryListeners.forEach((cb) => cb(data));
				});
				const handle3 = await EdgeTTSNative.addListener('onPlaybackStateChange', (data: PlaybackStateEvent) => {
					this.playbackStateListeners.forEach((cb) => cb(data));
				});
				const handle4 = await EdgeTTSNative.addListener('onPlaybackComplete', () => {
					this.playbackCompleteListeners.forEach((cb) => cb());
				});
				const handle5 = await EdgeTTSNative.addListener('onError', (data: { message: string; chunkIndex?: number }) => {
					this.errorListeners.forEach((cb) => cb(data));
				});

				this.listenerHandles.push(handle1, handle2, handle3, handle4, handle5);
				this.isListenersInitialized = true;
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
}

export const EdgeTTSNativeStreamService = new EdgeTTSNativeStreamServiceClass();
