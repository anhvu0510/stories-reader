// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useReadAloud } from '@/hooks/useReadAloud';
import { DomWordHighlighter } from '@/services/domWordHighlighter';
import { EdgeTTSService } from '@/services/edgeTtsService';
import { splitParagraphIntoSentences } from '@/services/gaplessTtsPlayer';
import { NativeTTSService } from '@/services/nativeTtsService';
import { TTSService } from '@/services/ttsService';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

const OriginalAudioContext = window.AudioContext;
const fakeAudioContexts: FakeAudioContext[] = [];

class FakeAudioContext {
	public currentTime = 0;
	public destination = {};
	public readonly sources: Array<{
		playbackRate: { value: number };
		onended: (() => void) | null;
	}> = [];

	public constructor() {
		fakeAudioContexts.push(this);
	}

	public createBuffer(_channels: number, frameCount: number, sampleRate: number) {
		return {
			duration: frameCount / sampleRate,
			copyToChannel: vi.fn()
		};
	}

	public createBufferSource() {
		const source = {
			buffer: null,
			playbackRate: { value: 1 },
			onended: null as (() => void) | null,
			connect: vi.fn(),
			start: vi.fn(),
			stop: vi.fn()
		};
		this.sources.push(source);
		return source;
	}

	public async decodeAudioData() {
		return { duration: 1 };
	}

	public async suspend() {}
	public async resume() {}
	public async close() {}
}

describe('splitParagraphIntoSentences', () => {
	it('splits a paragraph while preserving paragraph and text offsets', () => {
		const text = 'Hai bóng người vô cùng cường đại. Thời đại này có mấy kẻ thấy chí bảo mà không hoảng sợ? Nữ nhân lên tiếng!';

		const sentences = splitParagraphIntoSentences(text, 4);

		expect(sentences).toHaveLength(3);
		expect(sentences[0]).toEqual({
			pIdx: 4,
			text: 'Hai bóng người vô cùng cường đại.',
			startOffset: 0,
			length: 'Hai bóng người vô cùng cường đại.'.length
		});
		expect(sentences[1].startOffset).toBe(text.indexOf('Thời đại'));
		expect(sentences[2].text).toBe('Nữ nhân lên tiếng!');
	});

	it('merges a tiny trailing fragment into the preceding sentence', () => {
		const sentences = splitParagraphIntoSentences('Một câu văn dài và đầy đủ ý nghĩa ở đây. Ồ!', 1);

		expect(sentences).toEqual([
			{
				pIdx: 1,
				text: 'Một câu văn dài và đầy đủ ý nghĩa ở đây. Ồ!',
				startOffset: 0,
				length: 'Một câu văn dài và đầy đủ ý nghĩa ở đây. Ồ!'.length
			}
		]);
	});

	it('never merges sentences across paragraph boundaries', () => {
		const sentences = [...splitParagraphIntoSentences('Chương một bắt đầu. Mọi thứ yên lặng.', 0), ...splitParagraphIntoSentences('Chương hai nối tiếp. Sấm sét đùng đùng!', 1)];

		expect(sentences.map((sentence) => sentence.pIdx)).toEqual([0, 0, 1, 1]);
	});
});

describe('useReadAloud VieNeu streaming speed', () => {
	beforeEach(() => {
		fakeAudioContexts.length = 0;
		useReaderConfigStore.setState({
			speechRate: 2,
			ttsEngine: 'vieneu',
			voiceUri: 'Minh Quân',
			vieneuServerUrl: 'https://tts.example.test'
		});
		Object.defineProperty(window, 'AudioContext', {
			configurable: true,
			value: FakeAudioContext
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Object.defineProperty(window, 'AudioContext', {
			configurable: true,
			value: OriginalAudioContext
		});
	});

	it('asks VieNeu to apply the selected rate without changing PCM pitch in Web Audio', async () => {
		const streamSpeech = vi.spyOn(TTSService, 'streamSpeech').mockImplementation(async () => ({
			body: new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new Uint8Array([0, 0, 0, 0]));
					controller.close();
				}
			}),
			sampleRate: 24000,
			channels: 1,
			sampleFormat: 's16le'
		}));
		const synthesizeSpeech = vi.spyOn(TTSService, 'synthesizeSpeech').mockResolvedValue(new Blob());

		const paragraphs = ['Câu đầu tiên. \u2063 Câu thứ hai tiếp tục nội dung.'];
		const { result, unmount } = renderHook(() => useReadAloud(paragraphs));

		act(() => result.current.startReading());

		await waitFor(() => expect(streamSpeech).toHaveBeenCalled());
		expect(streamSpeech).toHaveBeenNthCalledWith(
			1,
			'Câu đầu tiên.',
			'Minh Quân',
			2,
			'https://tts.example.test',
			expect.any(AbortSignal),
			undefined,
			expect.objectContaining({
				temperature: 0.8,
				top_k: 25,
				max_chars: 140
			})
		);

		await waitFor(() => expect(fakeAudioContexts[0].sources[0]?.playbackRate.value).toBe(1));
		expect(synthesizeSpeech).not.toHaveBeenCalled();

		unmount();
	});

	it('keeps the visual highlight mounted until the next spoken word begins', async () => {
		const clearHighlight = vi.spyOn(DomWordHighlighter.prototype, 'clear');
		const streamSpeech = vi.spyOn(TTSService, 'streamSpeech').mockResolvedValue({
			body: new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new Uint8Array([0, 0, 0, 0]));
					controller.close();
				}
			}),
			sampleRate: 24000,
			channels: 1,
			sampleFormat: 's16le'
		});
		vi.spyOn(TTSService, 'synthesizeSpeech').mockResolvedValue(new Blob());

		const paragraphs = ['Câu đầu tiên đủ dài để bắt đầu một lượt đọc.'];
		const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
		const clearsBeforePlayback = clearHighlight.mock.calls.length;

		act(() => result.current.startReading());
		await waitFor(() => expect(streamSpeech).toHaveBeenCalledTimes(1));
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		expect(clearHighlight).toHaveBeenCalledTimes(clearsBeforePlayback);

		unmount();
	});

	it('keeps each VieNeu request aligned to an API sentence boundary', async () => {
		const streamSpeech = vi.spyOn(TTSService, 'streamSpeech').mockImplementation(async () => ({
			body: new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new Uint8Array([0, 0, 0, 0]));
				}
			}),
			sampleRate: 24000,
			channels: 1,
			sampleFormat: 's16le'
		}));
		vi.spyOn(TTSService, 'synthesizeSpeech').mockResolvedValue(new Blob());
		const paragraph = ['Ngày hôm sau, Tần Thành lại tới, sau khi gửi thiệp cưới và bình tâm lại,', 'nhìn thấy mấy chục sợi tóc bạc bên thái dương Vương Huyên, hắn không khỏi lo lắng.'].join(
			' \u2063 '
		);
		const { result, unmount } = renderHook(() => useReadAloud([paragraph]));

		act(() => result.current.startReading());
		await waitFor(() => expect(streamSpeech.mock.calls.length).toBe(2));

		const requestedTexts = streamSpeech.mock.calls.map(([text]) => text);
		expect(requestedTexts.every((text) => text.length <= 480)).toBe(true);
		expect(requestedTexts.join(' ')).toBe(paragraph.replace(/\s*\u2063\s*/g, ' '));

		unmount();
	});
});

describe('useReadAloud Edge word boundaries', () => {
	const OriginalAudio = window.Audio;
	const originalCreateObjectUrl = URL.createObjectURL;
	const originalRevokeObjectUrl = URL.revokeObjectURL;
	const fakeAudios: FakeEdgeAudio[] = [];

	class FakeEdgeAudio {
		public currentTime = 0;
		public paused = true;
		public ended = false;
		public onplay: (() => void) | null = null;
		public onpause: (() => void) | null = null;
		public ontimeupdate: (() => void) | null = null;
		public onended: (() => void) | null = null;
		public onerror: ((error: unknown) => void) | null = null;
		public readonly play = vi.fn(async () => {
			this.paused = false;
			this.onplay?.();
		});
		public readonly pause = vi.fn(() => {
			this.paused = true;
			this.onpause?.();
		});

		public addEventListener = vi.fn((event: string, handler: EventListenerOrEventListenerObject) => {
			if (event === 'loadedmetadata' || event === 'canplay') {
				if (typeof handler === 'function') handler(new Event(event));
				else if (handler && 'handleEvent' in handler) handler.handleEvent(new Event(event));
			}
		});
		public removeEventListener = vi.fn();
		public constructor(public readonly src: string) {
			fakeAudios.push(this);
		}
	}

	beforeEach(() => {
		fakeAudios.length = 0;
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'visible'
		});
		document.body.innerHTML = ['<main id="main-story-content"><article>', '<div data-paragraph-index="0">"Xin chào", thế giới.</div>', '</article></main>'].join('');
		useReaderConfigStore.setState({
			speechRate: 1,
			ttsEngine: 'edge',
			edgeVoiceUri: 'vi-VN-HoaiMyNeural'
		});
		vi.stubGlobal('Audio', FakeEdgeAudio);
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: vi.fn(() => 'blob:edge-audio')
		});
		Object.defineProperty(URL, 'revokeObjectURL', {
			configurable: true,
			value: vi.fn()
		});
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
		vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
		Object.defineProperty(window, 'Audio', {
			configurable: true,
			value: OriginalAudio
		});
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: originalCreateObjectUrl
		});
		Object.defineProperty(URL, 'revokeObjectURL', {
			configurable: true,
			value: originalRevokeObjectUrl
		});
	});

	it('moves the highlight from Microsoft word-boundary timestamps instead of estimating duration', async () => {
		const synthesize = vi.spyOn(EdgeTTSService, 'synthesizeSpeechWithBoundaries').mockResolvedValue({
			audio: new Blob(['audio'], { type: 'audio/mpeg' }),
			wordBoundaries: [
				{
					text: 'Xin',
					charIndex: 1,
					charLength: 3,
					startSeconds: 0.125,
					endSeconds: 0.325
				},
				{
					text: 'chào',
					charIndex: 5,
					charLength: 4,
					startSeconds: 0.325,
					endSeconds: 0.5875
				}
			]
		});
		const highlight = vi.spyOn(DomWordHighlighter.prototype, 'highlight').mockReturnValue(null);
		const paragraphs = ['"Xin chào", thế giới.'];
		const { result, unmount } = renderHook(() => useReadAloud(paragraphs));

		act(() => result.current.startReading());
		await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(fakeAudios).toHaveLength(1));
		expect(highlight).not.toHaveBeenCalled();

		act(() => {
			fakeAudios[0].currentTime = 0.13;
			fakeAudios[0].ontimeupdate?.();
		});
		expect(highlight).toHaveBeenLastCalledWith(expect.any(HTMLElement), 1, 3);

		act(() => {
			fakeAudios[0].currentTime = 0.34;
			fakeAudios[0].ontimeupdate?.();
		});
		expect(highlight).toHaveBeenLastCalledWith(expect.any(HTMLElement), 5, 4);

		act(() => result.current.pauseReading());
		expect(fakeAudios[0].pause).toHaveBeenCalledTimes(1);
		act(() => result.current.startReading());
		expect(fakeAudios[0].play).toHaveBeenCalledTimes(2);

		unmount();
	});

	it('does not replay active Edge audio while its tab is hidden', async () => {
		vi.spyOn(EdgeTTSService, 'synthesizeSpeechWithBoundaries').mockResolvedValue({
			audio: new Blob(['audio'], { type: 'audio/mpeg' }),
			wordBoundaries: []
		});
		const paragraphs = ['Đoạn đang đọc phải giữ nguyên khi chuyển tab.'];
		const { result, unmount } = renderHook(() => useReadAloud(paragraphs));

		act(() => result.current.startReading());
		await waitFor(() => expect(fakeAudios).toHaveLength(1));
		expect(fakeAudios[0].play).toHaveBeenCalledTimes(1);

		act(() => {
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				value: 'hidden'
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});

		expect(fakeAudios[0].play).toHaveBeenCalledTimes(1);

		act(() => {
			fakeAudios[0].paused = true;
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				value: 'visible'
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});

		expect(fakeAudios[0].play).toHaveBeenCalledTimes(2);
		unmount();
	});

	it('queues the current segment before speculative Edge prefetches', async () => {
		const synthesize = vi.spyOn(EdgeTTSService, 'synthesizeSpeechWithBoundaries').mockResolvedValue({
			audio: new Blob(['audio'], { type: 'audio/mpeg' }),
			wordBoundaries: []
		});
		const paragraphs = ['Đoạn hiện tại cần được phát ngay.', 'Đoạn kế tiếp chỉ dùng để tải trước.', 'Đoạn thứ ba cũng chỉ dùng để tải trước.'];
		const { result, unmount } = renderHook(() => useReadAloud(paragraphs));

		act(() => result.current.startReading());
		await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(3));

		expect(synthesize.mock.calls.map(([text]) => text)).toEqual(paragraphs);
		const requestSignals = synthesize.mock.calls.map((call) => call[4]);
		expect(requestSignals.every((signal) => signal && !signal.aborted)).toBe(true);

		act(() => result.current.stopReading());
		expect(requestSignals.every((signal) => signal?.aborted)).toBe(true);

		unmount();
	});

	it('jumpToContent with Edge TTS reuses prefetched chunk and seeks to word boundary without extra network calls', async () => {
		const paragraphs = ['Mặt trời dần buông xuống phía sau ngọn đồi.'];
		useReaderConfigStore.setState({ ttsEngine: 'edge' });
		const edgeSpy = vi.spyOn(EdgeTTSService, 'synthesizeSpeechWithBoundaries').mockResolvedValue({
			audio: new Blob(['fake audio'], { type: 'audio/mp3' }),
			wordBoundaries: [
				{ text: 'Mặt', charIndex: 0, charLength: 3, startSeconds: 0, endSeconds: 0.3 },
				{ text: 'trời', charIndex: 4, charLength: 4, startSeconds: 0.35, endSeconds: 0.7 },
				{ text: 'dần', charIndex: 9, charLength: 3, startSeconds: 0.75, endSeconds: 1.0 },
				{ text: 'buông', charIndex: 13, charLength: 5, startSeconds: 1.25, endSeconds: 1.6 }
			]
		});

		const { result, unmount } = renderHook(() =>
			useReadAloud(paragraphs, { chapterId: 'c2', bookId: 'b1', chapterNumber: 1 })
		);

		// First, start reading: chunk 0 is synthesized and cached
		act(() => result.current.startReading());
		await waitFor(() => expect(edgeSpy).toHaveBeenCalledTimes(1));
		expect(fakeAudios).toHaveLength(1);

		// Now, jump to offset 13 ("buông")
		act(() => result.current.jumpToContent(0, 13));

		// ZERO extra synthesis calls: chunk was already prefetched/cached!
		expect(edgeSpy).toHaveBeenCalledTimes(1);

		// Audio seeks to word boundary startSeconds (1.25s)
		await waitFor(() => {
			const latestAudio = fakeAudios[fakeAudios.length - 1];
			expect(latestAudio.currentTime).toBeCloseTo(1.25, 2);
		});

		unmount();
	});

	it('jumpToContent with Edge TTS synthesizes full chunk and seeks when chunk was not yet cached', async () => {
		const paragraphs = ['Mặt trời dần buông xuống phía sau ngọn đồi.'];
		useReaderConfigStore.setState({ ttsEngine: 'edge' });
		const edgeSpy = vi.spyOn(EdgeTTSService, 'synthesizeSpeechWithBoundaries').mockResolvedValue({
			audio: new Blob(['fake audio'], { type: 'audio/mp3' }),
			wordBoundaries: [
				{ text: 'Mặt', charIndex: 0, charLength: 3, startSeconds: 0, endSeconds: 0.3 },
				{ text: 'buông', charIndex: 13, charLength: 5, startSeconds: 1.25, endSeconds: 1.6 }
			]
		});

		const { result, unmount } = renderHook(() =>
			useReadAloud(paragraphs, { chapterId: 'c3', bookId: 'b1', chapterNumber: 1 })
		);

		// Direct jump without prior reading: synthesizes FULL chunk so future reads are cached
		act(() => result.current.jumpToContent(0, 13));

		await waitFor(() => expect(edgeSpy).toHaveBeenCalledTimes(1));
		expect(edgeSpy).toHaveBeenCalledWith(
			'Mặt trời dần buông xuống phía sau ngọn đồi.',
			expect.any(String),
			expect.any(Number),
			undefined,
			expect.any(AbortSignal)
		);

		// Seeks to offset 13's word boundary
		await waitFor(() => {
			const latestAudio = fakeAudios[fakeAudios.length - 1];
			expect(latestAudio.currentTime).toBeCloseTo(1.25, 2);
		});

		unmount();
	});

	it('idle pre-warming pre-synthesizes initial chunks when reader is idle', async () => {
		vi.useFakeTimers();
		const paragraphs = ['Câu một.', 'Câu hai.', 'Câu ba.', 'Câu bốn.'];
		useReaderConfigStore.setState({ ttsEngine: 'edge' });
		const edgeSpy = vi.spyOn(EdgeTTSService, 'synthesizeSpeechWithBoundaries').mockResolvedValue({
			audio: new Blob(['fake audio'], { type: 'audio/mp3' }),
			wordBoundaries: []
		});

		const { unmount } = renderHook(() =>
			useReadAloud(paragraphs, { chapterId: 'c4', bookId: 'b1', chapterNumber: 1 })
		);

		// Fast forward past idle debounce (500ms)
		act(() => {
			vi.advanceTimersByTime(600);
		});

		// Initial chunks should be pre-warmed into cache
		expect(edgeSpy).toHaveBeenCalledWith('Câu một.', expect.any(String), expect.any(Number), undefined, expect.any(AbortSignal));
		expect(edgeSpy).toHaveBeenCalledWith('Câu hai.', expect.any(String), expect.any(Number), undefined, expect.any(AbortSignal));

		vi.useRealTimers();
		unmount();
	});

	it('expanded sliding window prefetch buffers upcoming chunks with max 2 concurrent requests', async () => {
		const paragraphs = [
			'Đoạn một.',
			'Đoạn hai.',
			'Đoạn ba.',
			'Đoạn bốn.',
			'Đoạn năm.',
			'Đoạn sáu.'
		];
		useReaderConfigStore.setState({ ttsEngine: 'edge' });
		let concurrentCount = 0;
		let maxConcurrentSeen = 0;

		const edgeSpy = vi.spyOn(EdgeTTSService, 'synthesizeSpeechWithBoundaries').mockImplementation(async () => {
			concurrentCount += 1;
			if (concurrentCount > maxConcurrentSeen) {
				maxConcurrentSeen = concurrentCount;
			}
			await new Promise((r) => setTimeout(r, 10));
			concurrentCount -= 1;
			return {
				audio: new Blob(['fake audio'], { type: 'audio/mp3' }),
				wordBoundaries: []
			};
		});

		const { result, unmount } = renderHook(() =>
			useReadAloud(paragraphs, { chapterId: 'c5', bookId: 'b1', chapterNumber: 1 })
		);

		act(() => result.current.startReading());

		await waitFor(() => {
			// At least 4 chunks requested in sliding window
			expect(edgeSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
		});

		// Concurrency limit throttled to <= 2 simultaneous requests
		expect(maxConcurrentSeen).toBeLessThanOrEqual(2);

		unmount();
	});

	it('delegates to EdgeTTSNativeStreamService when on Android native platform', async () => {
		useReaderConfigStore.setState({ ttsEngine: 'edge', edgeVoiceUri: 'vi-VN-HoaiMyNeural' });
		const { EdgeTTSNativeStreamService } = await import('@/services/edgeTtsNativeStream');
		vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
		const startPlaybackSpy = vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue(undefined);
		const pauseSpy = vi.spyOn(EdgeTTSNativeStreamService, 'pause').mockResolvedValue(undefined);
		const stopSpy = vi.spyOn(EdgeTTSNativeStreamService, 'stop').mockResolvedValue(undefined);

		const paragraphs = ['Đoạn một trên native.', 'Đoạn hai trên native.'];
		const { result, unmount } = renderHook(() =>
			useReadAloud(paragraphs, { chapterId: 'c-native', bookId: 'b-native', chapterNumber: 1 })
		);

		await act(async () => {
			result.current.startReading();
		});

		expect(startPlaybackSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				chunks: expect.arrayContaining(['Đoạn một trên native.', 'Đoạn hai trên native.']),
				startIndex: 0,
				voice: 'vi-VN-HoaiMyNeural'
			})
		);

		act(() => result.current.pauseReading());
		expect(pauseSpy).toHaveBeenCalled();

		act(() => result.current.stopReading());
		expect(stopSpy).toHaveBeenCalled();

		unmount();
	});
});

describe('useReadAloud browser speech ownership', () => {
	const createSpeechSynthesis = () => ({
		cancel: vi.fn(),
		pause: vi.fn(),
		resume: vi.fn(),
		speak: vi.fn(),
		getVoices: vi.fn(() => [])
	});

	it('does not cancel browser speech when this tab has never started reading', () => {
		const speechSynthesis = createSpeechSynthesis();
		vi.stubGlobal('speechSynthesis', speechSynthesis);
		useReaderConfigStore.setState({ ttsEngine: 'browser' });

		const { rerender, unmount } = renderHook(({ paragraphs }) => useReadAloud(paragraphs), {
			initialProps: { paragraphs: ['Tab này chưa từng bắt đầu đọc.'] }
		});

		rerender({ paragraphs: ['Trang khác vừa được tải lại.'] });
		unmount();

		// Edge can share a native SpeechSynthesis queue across same-site tabs.
		// An idle tab must never cancel a queue it does not own.
		expect(speechSynthesis.cancel).not.toHaveBeenCalled();
	});

	it('does not claim the operating-system media session while this tab is idle', () => {
		const mediaSession = { setActionHandler: vi.fn() };
		Object.defineProperty(navigator, 'mediaSession', {
			configurable: true,
			value: mediaSession
		});
		vi.stubGlobal(
			'MediaMetadata',
			class {
				public constructor(_metadata: MediaMetadataInit) {}
			}
		);
		useReaderConfigStore.setState({ ttsEngine: 'browser' });

		const { unmount } = renderHook(() => useReadAloud(['Tab này chỉ vừa mở một quyển truyện khác.']));

		expect(mediaSession.setActionHandler).not.toHaveBeenCalled();
		unmount();
	});

	it('still cancels the native queue when this tab started the utterance', () => {
		const speechSynthesis = createSpeechSynthesis();
		vi.stubGlobal('speechSynthesis', speechSynthesis);
		vi.stubGlobal(
			'SpeechSynthesisUtterance',
			class {
				public rate = 1;
				public voice: SpeechSynthesisVoice | null = null;
				public onstart: (() => void) | null = null;
				public onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
				public onend: (() => void) | null = null;
				public onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

				public constructor(public readonly text: string) {}
			}
		);
		useReaderConfigStore.setState({ ttsEngine: 'browser' });

		const { result, unmount } = renderHook(() => useReadAloud(['Tab này đang đọc nên được phép tự dừng.']));

		act(() => result.current.startReading());
		expect(speechSynthesis.speak).toHaveBeenCalledTimes(1);

		act(() => result.current.stopReading());
		expect(speechSynthesis.cancel).toHaveBeenCalledTimes(1);
		unmount();
	});

	it('saves resume position when stopped mid-chapter and restores upon restarting', async () => {
		const chapterId = 'test-chapter-123';
		const paragraphs = ['Câu một.', '\u2063 Câu hai.', '\u2063 Câu ba kết thúc.'];
		useReaderConfigStore.setState({ ttsEngine: 'browser' });
		const speakSpy = vi.spyOn(NativeTTSService, 'speak').mockImplementation(async () => {});
		vi.spyOn(NativeTTSService, 'isNative').mockReturnValue(true);

		const { result, unmount } = renderHook(() =>
			useReadAloud(paragraphs, { chapterId, bookId: 'b1', chapterNumber: 1 })
		);

		// Start reading sentence 1
		act(() => result.current.startReading());
		expect(speakSpy).toHaveBeenCalledWith(expect.objectContaining({ text: 'Câu một.' }));

		// Advance to sentence 2
		act(() => result.current.nextSection());
		expect(speakSpy).toHaveBeenCalledWith(expect.objectContaining({ text: 'Câu hai.' }));

		// User stops reading at sentence 2
		act(() => result.current.stopReading());

		// Verify saved in localStorage
		const saved = localStorage.getItem(`stories_tts_pos_${chapterId}`);
		expect(saved).not.toBeNull();
		const parsed = JSON.parse(saved!);
		expect(parsed.chunkIndex).toBe(1);

		// User restarts reading: should resume from sentence 2 (index 1) rather than index 0
		act(() => result.current.startReading());
		expect(speakSpy).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Câu hai.' }));

		// Advance to end of chapter
		act(() => result.current.nextSection());
		// Next again past last sentence ends chapter and clears cache
		act(() => result.current.nextSection());
		expect(localStorage.getItem(`stories_tts_pos_${chapterId}`)).toBeNull();

		unmount();
	});

	it('jumpToContent speaks starting from the exact selected text offset instead of the whole sentence', async () => {
		const paragraphs = ['Câu một rất dài và có nhiều từ được chọn.'];
		useReaderConfigStore.setState({ ttsEngine: 'browser' });
		const speakSpy = vi.spyOn(NativeTTSService, 'speak').mockImplementation(async () => {});
		vi.spyOn(NativeTTSService, 'isNative').mockReturnValue(true);

		const { result, unmount } = renderHook(() =>
			useReadAloud(paragraphs, { chapterId: 'c1', bookId: 'b1', chapterNumber: 1 })
		);

		// Offset 16 is "và có nhiều từ được chọn."
		act(() => result.current.jumpToContent(0, 16));

		expect(speakSpy).toHaveBeenCalledWith(
			expect.objectContaining({ text: 'và có nhiều từ được chọn.' })
		);

		unmount();
	});
});


