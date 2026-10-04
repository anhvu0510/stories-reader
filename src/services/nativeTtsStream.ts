import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { NativeTTS } from './nativeTtsService';

export interface StartNativePlaybackOptions {
	chunks: string[];
	startIndex?: number;
	voice?: string;
	rate?: number;
	pitch?: number;
	gatewayUrl?: string;
}

export interface NativeWordBoundaryEvent {
	chunkIndex: number;
	charIndex: number;
	charLength: number;
	text: string;
}

export interface NativePlaybackStateEvent {
	isPlaying: boolean;
	isPaused: boolean;
	isBuffering: boolean;
}

export type NativeChunkStartListener = (chunkIndex: number) => void;
export type NativeWordBoundaryListener = (data: NativeWordBoundaryEvent) => void;
export type NativePlaybackStateListener = (state: NativePlaybackStateEvent) => void;
export type NativePlaybackCompleteListener = () => void;
export type NativePlaybackErrorListener = (error: { message: string; chunkIndex?: number }) => void;

class NativeTTSStreamServiceClass {
	private chunkStartListeners: Set<NativeChunkStartListener> = new Set();
	private wordBoundaryListeners: Set<NativeWordBoundaryListener> = new Set();
	private playbackStateListeners: Set<NativePlaybackStateListener> = new Set();
	private playbackCompleteListeners: Set<NativePlaybackCompleteListener> = new Set();
	private errorListeners: Set<NativePlaybackErrorListener> = new Set();

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
			if (typeof NativeTTS.addListener === 'function') {
				const handle1 = await NativeTTS.addListener('onChunkStart', (data: { chunkIndex: number }) => {
					this.chunkStartListeners.forEach((cb) => cb(data.chunkIndex));
				});
				const handle2 = await NativeTTS.addListener('onWordBoundary', (data: NativeWordBoundaryEvent) => {
					this.wordBoundaryListeners.forEach((cb) => cb(data));
				});
				const handle3 = await NativeTTS.addListener('onPlaybackStateChange', (data: NativePlaybackStateEvent) => {
					this.playbackStateListeners.forEach((cb) => cb(data));
				});
				const handle4 = await NativeTTS.addListener('onPlaybackComplete', () => {
					this.playbackCompleteListeners.forEach((cb) => cb());
				});
				const handle5 = await NativeTTS.addListener('onError', (data: { message: string; chunkIndex?: number }) => {
					this.errorListeners.forEach((cb) => cb(data));
				});

				this.listenerHandles.push(handle1, handle2, handle3, handle4, handle5);
				this.isListenersInitialized = true;
			}
		} catch (e) {
			console.warn('[NativeTTSStream] Failed to init native listeners:', e);
		}
	}

	public async startPlayback(options: StartNativePlaybackOptions): Promise<void> {
		if (!this.isAvailable()) {
			throw new Error('NativeTTSStream is only available on native Android');
		}
		await this.initListeners();
		if (typeof (NativeTTS as any).playChapter === 'function') {
			await (NativeTTS as any).playChapter(options);
		}
	}

	public async pause(): Promise<void> {
		if (!this.isAvailable()) return;
		if (typeof (NativeTTS as any).pausePlayback === 'function') {
			await (NativeTTS as any).pausePlayback();
		}
	}

	public async resume(): Promise<void> {
		if (!this.isAvailable()) return;
		if (typeof (NativeTTS as any).resumePlayback === 'function') {
			await (NativeTTS as any).resumePlayback();
		}
	}

	public async stop(): Promise<void> {
		if (!this.isAvailable()) return;
		if (typeof (NativeTTS as any).stopPlayback === 'function') {
			await (NativeTTS as any).stopPlayback();
		}
	}

	public async seekToChunk(chunkIndex: number): Promise<void> {
		if (!this.isAvailable()) return;
		if (typeof (NativeTTS as any).seekToChunk === 'function') {
			await (NativeTTS as any).seekToChunk({ chunkIndex });
		}
	}

	public async clearCache(): Promise<void> {
		if (!this.isAvailable()) return;
		if (typeof (NativeTTS as any).clearCache === 'function') {
			try {
				await (NativeTTS as any).clearCache();
			} catch (e) {
				console.warn('[NativeTTSStream] Failed to clear native cache:', e);
			}
		}
	}

	public onChunkStart(cb: NativeChunkStartListener): () => void {
		this.chunkStartListeners.add(cb);
		return () => {
			this.chunkStartListeners.delete(cb);
		};
	}

	public onWordBoundary(cb: NativeWordBoundaryListener): () => void {
		this.wordBoundaryListeners.add(cb);
		return () => {
			this.wordBoundaryListeners.delete(cb);
		};
	}

	public onPlaybackStateChange(cb: NativePlaybackStateListener): () => void {
		this.playbackStateListeners.add(cb);
		return () => {
			this.playbackStateListeners.delete(cb);
		};
	}

	public onPlaybackComplete(cb: NativePlaybackCompleteListener): () => void {
		this.playbackCompleteListeners.add(cb);
		return () => {
			this.playbackCompleteListeners.delete(cb);
		};
	}

	public onError(cb: NativePlaybackErrorListener): () => void {
		this.errorListeners.add(cb);
		return () => {
			this.errorListeners.delete(cb);
		};
	}
}

export const NativeTTSStreamService = new NativeTTSStreamServiceClass();
