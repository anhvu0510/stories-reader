// @vitest-environment jsdom
const { mockNativeTTS } = vi.hoisted(() => ({
	mockNativeTTS: {
		playChapter: vi.fn(),
		pausePlayback: vi.fn(),
		resumePlayback: vi.fn(),
		stopPlayback: vi.fn(),
		seekToChunk: vi.fn(),
		clearCache: vi.fn(),
		addListener: vi.fn()
	}
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Capacitor } from '@capacitor/core';

vi.mock('@capacitor/core', async () => {
	const actual = await vi.importActual<any>('@capacitor/core');
	return {
		...actual,
		registerPlugin: (name: string, options?: any) => {
			if (name === 'NativeTTS') {
				return mockNativeTTS;
			}
			return actual.registerPlugin(name, options);
		}
	};
});

import { NativeTTSStreamService } from '@/services/nativeTtsStream';

describe('NativeTTSStreamService (Tracer Bullet - Behavior 1)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		NativeTTSStreamService.resetForTesting();
		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
		mockNativeTTS.playChapter.mockResolvedValue(undefined);
		mockNativeTTS.pausePlayback.mockResolvedValue(undefined);
		mockNativeTTS.resumePlayback.mockResolvedValue(undefined);
		mockNativeTTS.stopPlayback.mockResolvedValue(undefined);
		mockNativeTTS.seekToChunk.mockResolvedValue(undefined);
		mockNativeTTS.addListener.mockResolvedValue({ remove: vi.fn() });
	});

	it('identifies availability based on Android platform', () => {
		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
		expect(NativeTTSStreamService.isAvailable()).toBe(true);

		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
		expect(NativeTTSStreamService.isAvailable()).toBe(false);
	});

	it('starts chapter playback and delegates directly to native plugin', async () => {
		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
		const chunks = ['Đoạn số một.', 'Đoạn số hai.', 'Đoạn số ba.'];

		await NativeTTSStreamService.startPlayback({
			chunks,
			startIndex: 0,
			voice: 'vi-vn-x-gda-network',
			rate: 1.5,
			pitch: 1.0,
			gatewayUrl: 'https://gateway.example.com'
		});

		expect(mockNativeTTS.playChapter).toHaveBeenCalledWith({
			chunks,
			startIndex: 0,
			voice: 'vi-vn-x-gda-network',
			rate: 1.5,
			pitch: 1.0,
			gatewayUrl: 'https://gateway.example.com'
		});
	});

	it('routes playback controls (pause, resume, stop, seekToChunk, clearCache) to native plugin', async () => {
		mockNativeTTS.clearCache = vi.fn().mockResolvedValue(undefined);

		await NativeTTSStreamService.pause();
		expect(mockNativeTTS.pausePlayback).toHaveBeenCalled();

		await NativeTTSStreamService.resume();
		expect(mockNativeTTS.resumePlayback).toHaveBeenCalled();

		await NativeTTSStreamService.seekToChunk(2);
		expect(mockNativeTTS.seekToChunk).toHaveBeenCalledWith({ chunkIndex: 2 });

		await NativeTTSStreamService.stop();
		expect(mockNativeTTS.stopPlayback).toHaveBeenCalled();

		await NativeTTSStreamService.clearCache();
		expect(mockNativeTTS.clearCache).toHaveBeenCalled();
	});

	it('registers native event listeners and notifies subscribers', async () => {
		let chunkStartListener: ((data: any) => void) | undefined;
		let wordBoundaryListener: ((data: any) => void) | undefined;
		let playbackStateListener: ((data: any) => void) | undefined;
		let playbackCompleteListener: (() => void) | undefined;
		let errorListener: ((data: any) => void) | undefined;

		mockNativeTTS.addListener.mockImplementation((eventName: string, handler: any) => {
			if (eventName === 'onChunkStart') {
				chunkStartListener = handler;
			} else if (eventName === 'onWordBoundary') {
				wordBoundaryListener = handler;
			} else if (eventName === 'onPlaybackStateChange') {
				playbackStateListener = handler;
			} else if (eventName === 'onPlaybackComplete') {
				playbackCompleteListener = handler;
			} else if (eventName === 'onError') {
				errorListener = handler;
			}
			return Promise.resolve({ remove: vi.fn() });
		});

		const onChunkStartSpy = vi.fn();
		const onWordBoundarySpy = vi.fn();
		const onPlaybackStateSpy = vi.fn();
		const onPlaybackCompleteSpy = vi.fn();
		const onErrorSpy = vi.fn();

		const unsubChunk = NativeTTSStreamService.onChunkStart(onChunkStartSpy);
		const unsubWord = NativeTTSStreamService.onWordBoundary(onWordBoundarySpy);
		const unsubState = NativeTTSStreamService.onPlaybackStateChange(onPlaybackStateSpy);
		const unsubComplete = NativeTTSStreamService.onPlaybackComplete(onPlaybackCompleteSpy);
		const unsubError = NativeTTSStreamService.onError(onErrorSpy);

		mockNativeTTS.addListener.mockClear();
		await NativeTTSStreamService.initListeners();

		expect(mockNativeTTS.addListener).toHaveBeenCalledTimes(5);

		// Trigger each callback
		chunkStartListener?.({ chunkIndex: 1 });
		expect(onChunkStartSpy).toHaveBeenCalledWith(1);

		wordBoundaryListener?.({ chunkIndex: 0, charIndex: 4, charLength: 3, text: 'một' });
		expect(onWordBoundarySpy).toHaveBeenCalledWith({
			chunkIndex: 0,
			charIndex: 4,
			charLength: 3,
			text: 'một'
		});

		playbackStateListener?.({ isPlaying: true, isPaused: false, isBuffering: false });
		expect(onPlaybackStateSpy).toHaveBeenCalledWith({
			isPlaying: true,
			isPaused: false,
			isBuffering: false
		});

		playbackCompleteListener?.();
		expect(onPlaybackCompleteSpy).toHaveBeenCalled();

		errorListener?.({ message: 'TTS error', chunkIndex: 0 });
		expect(onErrorSpy).toHaveBeenCalledWith({ message: 'TTS error', chunkIndex: 0 });

		// Cleanup
		unsubChunk();
		unsubWord();
		unsubState();
		unsubComplete();
		unsubError();
	});
});
