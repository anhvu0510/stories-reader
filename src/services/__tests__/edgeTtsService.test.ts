const { mockEdgeTTSNative } = vi.hoisted(() => ({
	mockEdgeTTSNative: {
		synthesize: vi.fn()
	}
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { EdgeTTSService, DEFAULT_EDGE_VOICES } from '@/services/edgeTtsService';

describe('EdgeTTSService', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('should return default voices if fetch fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

		const voices = await EdgeTTSService.fetchVoices();
		expect(voices).toEqual(DEFAULT_EDGE_VOICES);
	});

	it('should fetch voices from gateway API when available', async () => {
		const mockVoices = [{ id: 'vi-VN-HoaiMyNeural', name: 'Hoài Mỹ', language: 'vi-VN', gender: 'female' }];
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ voices: mockVoices })
			})
		);

		const voices = await EdgeTTSService.fetchVoices('https://api.test');
		expect(voices).toEqual(mockVoices);
	});

	it('should synthesize speech and return blob', async () => {
		const mockBlob = new Blob(['mock audio'], { type: 'audio/mpeg' });
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				blob: async () => mockBlob
			})
		);

		const result = await EdgeTTSService.synthesizeSpeech('Xin chào', 'vi-VN-HoaiMyNeural', 1.2);
		expect(result).toBeInstanceOf(Blob);
	});

	it('returns Microsoft word boundaries together with the audio blob', async () => {
		const boundaries = [
			{
				text: 'Xin',
				charIndex: 0,
				charLength: 3,
				startSeconds: 0.125,
				endSeconds: 0.325
			},
			{
				text: 'chào',
				charIndex: 4,
				charLength: 4,
				startSeconds: 0.325,
				endSeconds: 0.5875
			}
		];
		const encodedBoundaries = Buffer.from(
			JSON.stringify([
				{
					text: 'Xin',
					char_index: 0,
					char_length: 3,
					start_seconds: 0.125,
					end_seconds: 0.325
				},
				{
					text: 'chào',
					char_index: 4,
					char_length: 4,
					start_seconds: 0.325,
					end_seconds: 0.5875
				}
			]),
			'utf8'
		).toString('base64url');
		const mockBlob = new Blob(['mock audio'], { type: 'audio/mpeg' });
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			blob: async () => mockBlob,
			headers: new Headers({ 'X-Word-Boundaries': encodedBoundaries })
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await EdgeTTSService.synthesizeSpeechWithBoundaries('Xin chào', 'vi-VN-HoaiMyNeural', 1.2, 'https://api.test');

		expect(result.audio).toBe(mockBlob);
		expect(result.wordBoundaries).toEqual(boundaries);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
			include_word_boundaries: true,
			rate: '+20%'
		});
	});

	it('uses EdgeTTSNative plugin on Android native platform and maps word boundaries accurately', async () => {
		const { Capacitor } = await import('@capacitor/core');
		const { EdgeTTSNative } = await import('@/services/edgeTtsService');

		vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
		const nativeSpy = vi.spyOn(EdgeTTSNative, 'synthesize').mockResolvedValue({
			audioBase64: Buffer.from('mock native audio').toString('base64'),
			mimeType: 'audio/mpeg',
			wordBoundaries: [
				{ text: 'Xin', charIndex: 0, charLength: 3, startSeconds: 0.1, endSeconds: 0.3 },
				{ text: 'chào', charIndex: 0, charLength: 4, startSeconds: 0.33, endSeconds: 0.58 }
			]
		});

		const result = await EdgeTTSService.synthesizeSpeechWithBoundaries('Xin chào các bạn', 'vi-VN-HoaiMyNeural', 1.0);

		expect(nativeSpy).toHaveBeenCalledWith({
			text: 'Xin chào các bạn',
			voice: 'vi-VN-HoaiMyNeural',
			rate: '+0%',
			pitch: '+0Hz'
		});
		expect(result.audio).toBeInstanceOf(Blob);
		expect(result.wordBoundaries).toHaveLength(2);
		expect(result.wordBoundaries[0]).toEqual({
			text: 'Xin',
			charIndex: 0,
			charLength: 3,
			startSeconds: 0.1,
			endSeconds: 0.3
		});
		expect(result.wordBoundaries[1]).toEqual({
			text: 'chào',
			charIndex: 4,
			charLength: 4,
			startSeconds: 0.33,
			endSeconds: 0.58
		});
	});

	it('maps word boundaries accurately with quotes, punctuation and repeated words', async () => {
		const { mapEdgeWordBoundaries } = await import('@/services/edgeTtsService');
		const sourceText = 'Xin chào các bạn! Bạn nói: "quác quác quác".';
		const rawBoundaries = [
			{ text: 'Xin', startSeconds: 0.1, endSeconds: 0.3 },
			{ text: 'chào', startSeconds: 0.33, endSeconds: 0.58 },
			{ text: 'các', startSeconds: 0.59, endSeconds: 0.78 },
			{ text: 'bạn', startSeconds: 0.79, endSeconds: 1.15 },
			{ text: 'Bạn', startSeconds: 1.35, endSeconds: 1.55 },
			{ text: 'nói', startSeconds: 1.6, endSeconds: 1.8 },
			{ text: 'quác', startSeconds: 1.9, endSeconds: 2.1 },
			{ text: 'quác', startSeconds: 2.15, endSeconds: 2.35 },
			{ text: 'quác', startSeconds: 2.4, endSeconds: 2.6 }
		];

		const mapped = mapEdgeWordBoundaries(sourceText, rawBoundaries);

		expect(mapped).toHaveLength(9);
		expect(mapped[0].charIndex).toBe(0); // 'Xin'
		expect(mapped[1].charIndex).toBe(4); // 'chào'
		expect(mapped[2].charIndex).toBe(9); // 'các'
		expect(mapped[3].charIndex).toBe(13); // 'bạn'
		expect(mapped[4].charIndex).toBe(18); // 'Bạn'
		expect(mapped[5].charIndex).toBe(22); // 'nói'
		expect(mapped[6].charIndex).toBe(28); // first 'quác' inside quotes
		expect(mapped[7].charIndex).toBe(33); // second 'quác'
		expect(mapped[8].charIndex).toBe(38); // third 'quác'
	});

	it('alerts user and logs error to gateway when EdgeTTSNative fails on Android', async () => {
		const { Capacitor } = await import('@capacitor/core');
		const { EdgeTTSNative } = await import('@/services/edgeTtsService');
		const { useToastStore } = await import('@/stores/useToastStore');

		vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
		vi.spyOn(EdgeTTSNative, 'synthesize').mockRejectedValue(new Error('WebSocket 403 Forbidden'));
		const toastSpy = vi.spyOn(useToastStore.getState(), 'showToast');

		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			EdgeTTSService.synthesizeSpeechWithBoundaries('Xin chào', 'vi-VN-HoaiMyNeural', 1.0, 'https://api.test')
		).rejects.toThrow('WebSocket 403 Forbidden');

		expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Lỗi Edge TTS: WebSocket 403 Forbidden'), 'error');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.test/api/logs/client-error',
			expect.objectContaining({
				method: 'POST',
				body: expect.stringContaining('"platform":"android"')
			})
		);
	});
});
