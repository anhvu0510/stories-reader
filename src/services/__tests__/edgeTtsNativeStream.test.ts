// @vitest-environment jsdom
const { mockEdgeTTSNative } = vi.hoisted(() => ({
	mockEdgeTTSNative: {
		playChapter: vi.fn(),
		pausePlayback: vi.fn(),
		resumePlayback: vi.fn(),
		stopPlayback: vi.fn(),
		seekToChunk: vi.fn(),
		clearCache: vi.fn(),
		getPlaybackSnapshot: vi.fn(),
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
			if (name === 'EdgeTTSNative') {
				return mockEdgeTTSNative;
			}
			return actual.registerPlugin(name, options);
		}
	};
});

import { EdgeTTSNativeStreamService } from '@/services/edgeTtsNativeStream';

describe('EdgeTTSNativeStreamService (Tracer Bullet - Behavior 1)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		EdgeTTSNativeStreamService.resetForTesting();
		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
		mockEdgeTTSNative.playChapter.mockResolvedValue(undefined);
		mockEdgeTTSNative.pausePlayback.mockResolvedValue(undefined);
		mockEdgeTTSNative.resumePlayback.mockResolvedValue(undefined);
		mockEdgeTTSNative.stopPlayback.mockResolvedValue(undefined);
		mockEdgeTTSNative.seekToChunk.mockResolvedValue(undefined);
		mockEdgeTTSNative.getPlaybackSnapshot.mockResolvedValue(null);
		mockEdgeTTSNative.addListener.mockResolvedValue({ remove: vi.fn() });
	});

	it('identifies availability based on Android platform', () => {
		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
		expect(EdgeTTSNativeStreamService.isAvailable()).toBe(true);

		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
		expect(EdgeTTSNativeStreamService.isAvailable()).toBe(false);
	});

	it('starts chapter playback and delegates directly to native plugin', async () => {
		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
		const chunks = ['Câu số một.', 'Câu số hai.', 'Câu số ba.'];

		await EdgeTTSNativeStreamService.startPlayback({
			chunks,
			startIndex: 0,
			voice: 'vi-VN-HoaiMyNeural',
			rate: 1.5,
			pitch: '+0Hz',
			gatewayUrl: 'https://gateway.example.com'
		});

		expect(mockEdgeTTSNative.playChapter).toHaveBeenCalledWith({
			chunks,
			startIndex: 0,
			voice: 'vi-VN-HoaiMyNeural',
			rate: 1.5,
			pitch: '+0Hz',
			gatewayUrl: 'https://gateway.example.com'
		});
	});

	it('routes playback controls (pause, resume, stop, seekToChunk) to native plugin', async () => {
		await EdgeTTSNativeStreamService.pause();
		expect(mockEdgeTTSNative.pausePlayback).toHaveBeenCalled();

		await EdgeTTSNativeStreamService.resume();
		expect(mockEdgeTTSNative.resumePlayback).toHaveBeenCalled();

		await EdgeTTSNativeStreamService.seekToChunk(2);
		expect(mockEdgeTTSNative.seekToChunk).toHaveBeenCalledWith({ chunkIndex: 2 });

		await EdgeTTSNativeStreamService.stop();
		expect(mockEdgeTTSNative.stopPlayback).toHaveBeenCalled();

		await EdgeTTSNativeStreamService.clearCache();
		expect(mockEdgeTTSNative.clearCache).toHaveBeenCalled();
	});

	it('registers native event listeners and notifies subscribers', async () => {
		let chunkStartListener: ((data: any) => void) | undefined;
		let wordBoundaryListener: ((data: any) => void) | undefined;

		mockEdgeTTSNative.addListener.mockImplementation((eventName: string, handler: any) => {
			if (eventName === 'onChunkStart') {
				chunkStartListener = handler;
			} else if (eventName === 'onWordBoundary') {
				wordBoundaryListener = handler;
			}
			return Promise.resolve({ remove: vi.fn() });
		});

		const onChunkStartSpy = vi.fn();
		const onWordBoundarySpy = vi.fn();

		await EdgeTTSNativeStreamService.initListeners();
		EdgeTTSNativeStreamService.onChunkStart(onChunkStartSpy);
		EdgeTTSNativeStreamService.onWordBoundary(onWordBoundarySpy);

		expect(chunkStartListener).toBeDefined();
		expect(wordBoundaryListener).toBeDefined();

		// Trigger native simulated event
		chunkStartListener?.({ chunkIndex: 1 });
		expect(onChunkStartSpy).toHaveBeenCalledWith(1);

		wordBoundaryListener?.({ chunkIndex: 1, charIndex: 4, charLength: 2, text: 'số' });
		expect(onWordBoundarySpy).toHaveBeenCalledWith({ chunkIndex: 1, charIndex: 4, charLength: 2, text: 'số' });
	});

	it('ignores events from stale sessions and replays the latest snapshot', async () => {
		const handlers = new Map<string, (data: unknown) => void>();
		mockEdgeTTSNative.addListener.mockImplementation((eventName: string, handler: (data: unknown) => void) => {
			handlers.set(eventName, handler);
			return Promise.resolve({ remove: vi.fn() });
		});

		await EdgeTTSNativeStreamService.startPlayback({ chunks: ['Một'], sessionId: 'session-new' });
		const onChunkStart = vi.fn();
		const onSnapshot = vi.fn();
		EdgeTTSNativeStreamService.onChunkStart(onChunkStart);

		handlers.get('onChunkStart')?.({ sessionId: 'session-old', chunkIndex: 0 });
		handlers.get('onChunkStart')?.({ sessionId: 'session-new', chunkIndex: 0 });
		handlers.get('onPlaybackSnapshot')?.({
			sessionId: 'session-new',
			state: 'PLAYING',
			utteranceIndex: 0,
			positionMs: 120,
			bufferedDurationMs: 4800,
			rebufferCount: 0
		});
		EdgeTTSNativeStreamService.onSnapshot(onSnapshot);

		expect(onChunkStart).toHaveBeenCalledTimes(1);
		expect(onSnapshot).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'session-new', state: 'PLAYING' }));
	});

	it('pulls the replayable native snapshot when listeners reconnect', async () => {
		mockEdgeTTSNative.getPlaybackSnapshot.mockResolvedValue({
			sessionId: 'surviving-session',
			state: 'PAUSED',
			utteranceIndex: 4,
			positionMs: 900,
			bufferedDurationMs: 5000,
			rebufferCount: 1
		});
		const onSnapshot = vi.fn();

		await EdgeTTSNativeStreamService.initListeners();
		EdgeTTSNativeStreamService.onSnapshot(onSnapshot);

		expect(mockEdgeTTSNative.getPlaybackSnapshot).toHaveBeenCalledTimes(1);
		expect(onSnapshot).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'surviving-session', state: 'PAUSED' }));
	});
});
