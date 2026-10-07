// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useReadAloud } from '@/hooks/useReadAloud';
import { NativeTTSStreamService } from '@/services/nativeTtsStream';
import { EdgeTTSNativeStreamService } from '@/services/edgeTtsNativeStream';
import { DomWordHighlighter } from '@/services/domWordHighlighter';
import { ReadAloudScrollFollower } from '@/services/readAloudScrollFollower';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { INVISIBLE_SENTENCE_DELIMITER } from '@/services/gaplessTtsPlayer';

beforeEach(() => {
	localStorage.clear();
	document.body.innerHTML = '<main id="main-story-content"><article><div data-paragraph-index="0">Câu đầu.</div><div data-paragraph-index="1">Câu sau.</div></article></main>';
	vi.spyOn(DomWordHighlighter.prototype, 'highlight').mockReturnValue(null);
	vi.spyOn(NativeTTSStreamService, 'stop').mockResolvedValue();
	vi.spyOn(EdgeTTSNativeStreamService, 'stop').mockResolvedValue();
	vi.spyOn(EdgeTTSNativeStreamService, 'initListeners').mockResolvedValue();
});

it('reuses the original Edge utterance after Stop and Play instead of synthesizing a new suffix', () => {
	useReaderConfigStore.setState({ ttsEngine: 'edge', edgeBufferMode: 'media3' });
	vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
	const start = vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue();
	const paragraphs = ['Câu đầu đang đọc tiếp.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs, { chapterId: 'warm-edge-resume' }));
	act(() => result.current.startReading());
	const original = start.mock.calls[0][0].utterances!;
	act(() => EdgeTTSNativeStreamService['wordBoundaryListeners'].forEach(cb => cb({ chunkIndex: 0, utteranceIndex: 0, paragraphIndex: 0, sourceStart: 0, sourceLength: paragraphs[0].length, charIndex: 8, charLength: 4, text: 'đang' })));
	act(() => result.current.stopReading());
	act(() => result.current.startReading());
	expect(start.mock.calls.at(-1)?.[0].utterances).toEqual(original);
	expect(start.mock.calls.at(-1)?.[0]).toMatchObject({ startIndex: 0, startCharIndex: 8 });
	unmount();
});

it('resumes at the next Media3 utterance when stopped before its first word arrives', () => {
	useReaderConfigStore.setState({ ttsEngine: 'edge', edgeBufferMode: 'media3' });
	vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
	const start = vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue();
	const sentence = `Đây là câu thử ${'nội dung '.repeat(12)}.`;
	const paragraphs = [`${sentence} ${sentence} ${sentence}`];
	const context = { chapterId: 'between-utterances' };
	const first = renderHook(() => useReadAloud(paragraphs, context));
	act(() => first.result.current.startReading());
	const utterance = start.mock.calls[0][0].utterances![1];
	act(() =>
		EdgeTTSNativeStreamService['chunkStartListeners'].forEach((cb) =>
			cb(0, {
				chunkIndex: 0,
				utteranceIndex: 1,
				paragraphIndex: 0,
				sourceStart: utterance.sourceStart,
				sourceLength: utterance.sourceLength
			})
		)
	);
	act(() => first.result.current.stopReading());
	expect(JSON.parse(localStorage.getItem('stories_tts_pos_between-utterances')!)).toMatchObject({ version: 2, sourceOffset: utterance.sourceStart });
	first.unmount();
	const second = renderHook(() => useReadAloud(paragraphs, context));
	act(() => second.result.current.startReading());
	expect(start.mock.calls.at(-1)?.[0]).toMatchObject({ startIndex: 1 });
	second.unmount();
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.body.innerHTML = '';
});

it.each(['edge', 'browser'] as const)('does not revive stopped %s playback from a late native state event', (ttsEngine) => {
	useReaderConfigStore.setState({ ttsEngine, edgeBufferMode: 'media3' });
	const stream = ttsEngine === 'edge' ? EdgeTTSNativeStreamService : NativeTTSStreamService;
	vi.spyOn(stream, 'isAvailable').mockReturnValue(true);
	vi.spyOn(stream, 'startPlayback').mockResolvedValue();
	const paragraphs = ['Câu đầu.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
	act(() => result.current.startReading());
	act(() => result.current.stopReading());
	act(() => stream['playbackStateListeners'].forEach((cb) => cb({ isPlaying: false, isPaused: false, isBuffering: true })));
	expect(result.current.isTTSActive).toBe(false);
	act(() => stream['playbackStateListeners'].forEach((cb) => cb({ isPlaying: true, isPaused: false, isBuffering: false })));
	expect(result.current.isPlaying).toBe(false);
	unmount();
});

it('saves the final device chunk when paused before it has finished', () => {
	useReaderConfigStore.setState({ ttsEngine: 'browser' });
	vi.spyOn(NativeTTSStreamService, 'isAvailable').mockReturnValue(true);
	vi.spyOn(NativeTTSStreamService, 'startPlayback').mockResolvedValue();
	vi.spyOn(NativeTTSStreamService, 'pause').mockResolvedValue();
	const paragraphs = ['Câu cuối đang đọc.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs, { chapterId: 'final-device' }));
	act(() => result.current.startReading());
	act(() => NativeTTSStreamService['wordBoundaryListeners'].forEach((cb) => cb({ chunkIndex: 0, charIndex: 4, charLength: 4, text: 'cuối' })));
	act(() => result.current.pauseReading());
	expect(JSON.parse(localStorage.getItem('stories_tts_pos_final-device')!)).toMatchObject({ charOffset: 4, sourceOffset: 4 });
	unmount();
});

it('restores the next database chunk when the saved source offset is exactly at a completed boundary', () => {
	useReaderConfigStore.setState({ ttsEngine: 'browser' });
	vi.spyOn(NativeTTSStreamService, 'isAvailable').mockReturnValue(true);
	const start = vi.spyOn(NativeTTSStreamService, 'startPlayback').mockResolvedValue();
	const first = 'Câu đã đọc.';
	const paragraphs = [`${first} ${INVISIBLE_SENTENCE_DELIMITER} Câu chưa đọc.`];
	localStorage.setItem('stories_tts_pos_boundary-device', JSON.stringify({ version: 2, chunkIndex: 0, charOffset: first.length, paragraphIndex: 0, sourceOffset: first.length }));
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs, { chapterId: 'boundary-device' }));
	act(() => result.current.startReading());
	expect(start.mock.calls[0][0]).toMatchObject({ startIndex: 1, startCharIndex: 0 });
	unmount();
});

it('restores device narration within a later chunk of the same paragraph', () => {
	useReaderConfigStore.setState({ ttsEngine: 'browser' });
	vi.spyOn(NativeTTSStreamService, 'isAvailable').mockReturnValue(true);
	vi.spyOn(NativeTTSStreamService, 'pause').mockResolvedValue();
	const start = vi.spyOn(NativeTTSStreamService, 'startPlayback').mockResolvedValue();
	const paragraph = ['Câu đầu đã đọc.', 'Câu sau đang được đọc.', 'Câu tiếp theo.'].join(` ${INVISIBLE_SENTENCE_DELIMITER} `);
	const paragraphs = [paragraph, 'Câu cuối.'];
	const context = { chapterId: 'restore-device' };
	const first = renderHook(() => useReadAloud(paragraphs, context));
	act(() => first.result.current.startReading());
	const text = start.mock.calls[0][0].chunks[1];
	expect(paragraph.indexOf(text)).toBeGreaterThan(0);
	const offset = text.indexOf(' ') + 1;
	act(() => NativeTTSStreamService['chunkStartListeners'].forEach((cb) => cb(1)));
	act(() => NativeTTSStreamService['wordBoundaryListeners'].forEach((cb) => cb({ chunkIndex: 1, charIndex: offset, charLength: 3, text: text.slice(offset, offset + 3) })));
	act(() => first.result.current.pauseReading());
	const saved = JSON.parse(localStorage.getItem('stories_tts_pos_restore-device')!);
	expect(saved.sourceOffset).toBe(paragraph.indexOf(text) + offset);
	first.unmount();
	const second = renderHook(() => useReadAloud(paragraphs, context));
	act(() => second.result.current.startReading());
	expect(start.mock.calls.at(-1)?.[0]).toMatchObject({ startIndex: 1, startCharIndex: offset });
	second.unmount();
});

it('lets the native player own transport controls without a competing WebView Media Session', () => {
	const original = Object.getOwnPropertyDescriptor(navigator, 'mediaSession');
	const setActionHandler = vi.fn();
	Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: { setActionHandler } });
	vi.stubGlobal('MediaMetadata', vi.fn());
	useReaderConfigStore.setState({ ttsEngine: 'edge', edgeBufferMode: 'media3' });
	vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
	vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue();
	const paragraphs = ['Câu đầu.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
	try {
		act(() => result.current.startReading());
		expect(setActionHandler).not.toHaveBeenCalled();
	} finally {
		unmount();
		if (original) Object.defineProperty(navigator, 'mediaSession', original);
		if (!original) Reflect.deleteProperty(navigator, 'mediaSession');
	}
});

it.each(['edge', 'browser'] as const)('does not restart %s narration for a repeated Play command while already playing or buffering', (ttsEngine) => {
	useReaderConfigStore.setState({ ttsEngine, edgeBufferMode: 'media3' });
	const stream = ttsEngine === 'edge' ? EdgeTTSNativeStreamService : NativeTTSStreamService;
	vi.spyOn(stream, 'isAvailable').mockReturnValue(true);
	const start = vi.spyOn(stream, 'startPlayback').mockResolvedValue();
	const paragraphs = ['Câu đầu.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
	act(() => result.current.startReading());
	act(() => result.current.startReading());
	expect(start).toHaveBeenCalledTimes(1);
	unmount();
});

it.each(['edge', 'browser'] as const)('keeps the %s word and line steady during buffering', (ttsEngine) => {
	useReaderConfigStore.setState({ ttsEngine, edgeBufferMode: 'media3' });
	const stream = ttsEngine === 'edge' ? EdgeTTSNativeStreamService : NativeTTSStreamService;
	vi.spyOn(stream, 'isAvailable').mockReturnValue(true);
	vi.spyOn(stream, 'startPlayback').mockResolvedValue();
	const clear = vi.spyOn(DomWordHighlighter.prototype, 'clear');
	const clearWord = vi.spyOn(DomWordHighlighter.prototype, 'clearActiveWord');
	const paragraphs = ['Câu đầu.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
	act(() => result.current.startReading());
	clear.mockClear();
	clearWord.mockClear();
	act(() => stream['playbackStateListeners'].forEach((cb) => cb({ isPlaying: false, isPaused: false, isBuffering: true })));
	expect(result.current.isLoading).toBe(true);
	act(() => stream['chunkStartListeners'].forEach((cb) => cb(0)));
	expect(clearWord).not.toHaveBeenCalled();
	expect(clear).not.toHaveBeenCalled();
	expect(result.current.isLoading).toBe(false);
	unmount();
});

it('new reader mounts never reuse a Media3 session id from a previous player', () => {
	useReaderConfigStore.setState({ ttsEngine: 'edge', edgeBufferMode: 'media3' });
	vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
	const start = vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue();
	const paragraphs = ['Câu đầu.'];
	const first = renderHook(() => useReadAloud(paragraphs));
	act(() => first.result.current.startReading());
	first.unmount();
	const second = renderHook(() => useReadAloud(paragraphs));
	act(() => second.result.current.startReading());
	expect(start.mock.calls[0][0].sessionId).not.toBe(start.mock.calls[1][0].sessionId);
	second.unmount();
});

it('device failure pause updates the UI to paused instead of leaving playback active', () => {
	useReaderConfigStore.setState({ ttsEngine: 'browser' });
	vi.spyOn(NativeTTSStreamService, 'isAvailable').mockReturnValue(true);
	vi.spyOn(NativeTTSStreamService, 'startPlayback').mockResolvedValue();
	const paragraphs = ['Câu đầu.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
	act(() => result.current.startReading());
	act(() =>
		NativeTTSStreamService['playbackStateListeners'].forEach((cb) =>
			cb({
				isPlaying: false,
				isPaused: true,
				isBuffering: false
			})
		)
	);
	expect(result.current.isPlaying).toBe(false);
	expect(result.current.isPaused).toBe(true);
	unmount();
});

it('device highlight follows only a change of rendered line, like Media3', () => {
	useReaderConfigStore.setState({ ttsEngine: 'browser' });
	vi.spyOn(NativeTTSStreamService, 'isAvailable').mockReturnValue(true);
	vi.spyOn(NativeTTSStreamService, 'startPlayback').mockResolvedValue();
	const rect = new DOMRect(0, 50, 200, 25);
	vi.mocked(DomWordHighlighter.prototype.highlight).mockReturnValueOnce({ word: rect, line: rect, lineChanged: true }).mockReturnValue({ word: rect, line: rect, lineChanged: false });
	const follow = vi.spyOn(ReadAloudScrollFollower.prototype, 'follow');
	const paragraphs = ['Câu đầu.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
	act(() => result.current.startReading());
	act(() =>
		NativeTTSStreamService['wordBoundaryListeners'].forEach((cb) =>
			cb({
				chunkIndex: 0,
				charIndex: 0,
				charLength: 3,
				text: 'Câu'
			})
		)
	);
	act(() =>
		NativeTTSStreamService['wordBoundaryListeners'].forEach((cb) =>
			cb({
				chunkIndex: 0,
				charIndex: 4,
				charLength: 3,
				text: 'đầu'
			})
		)
	);
	expect(follow).toHaveBeenCalledTimes(1);
	unmount();
});

it('device Next uses device sentence indexes even when Edge Media3 is selected in settings', () => {
	useReaderConfigStore.setState({ ttsEngine: 'browser', edgeBufferMode: 'media3' });
	vi.spyOn(NativeTTSStreamService, 'isAvailable').mockReturnValue(true);
	vi.spyOn(NativeTTSStreamService, 'startPlayback').mockResolvedValue();
	const seek = vi.spyOn(NativeTTSStreamService, 'seekToChunk').mockResolvedValue();
	const paragraphs = ['Một câu rất dài để chia thành nhiều utterance cho Media3. '.repeat(12), 'Câu sau.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
	act(() => result.current.startReading());
	act(() => result.current.nextSection());
	expect(seek).toHaveBeenLastCalledWith(1);
	unmount();
});

it('late word callbacks after Next cannot move the navigation cursor back to the old sentence', () => {
	useReaderConfigStore.setState({ ttsEngine: 'edge', edgeBufferMode: 'media3' });
	vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
	vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue();
	const seek = vi.spyOn(EdgeTTSNativeStreamService, 'seekToChunk').mockResolvedValue();
	const paragraphs = ['Câu đầu.', 'Câu sau.', 'Câu cuối.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
	act(() => result.current.startReading());
	act(() => result.current.nextSection());
	act(() =>
		EdgeTTSNativeStreamService['wordBoundaryListeners'].forEach((cb) =>
			cb({
				chunkIndex: 0,
				utteranceIndex: 0,
				paragraphIndex: 0,
				sourceStart: 0,
				sourceLength: 8,
				charIndex: 0,
				charLength: 3,
				text: 'Câu'
			})
		)
	);
	act(() => result.current.nextSection());
	expect(seek.mock.calls.map(([index]) => index)).toEqual([1, 2]);
	unmount();
});

it('Media3 Next and Previous move one utterance inside a merged text chunk', () => {
	useReaderConfigStore.setState({ ttsEngine: 'edge', edgeBufferMode: 'media3' });
	vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
	vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue();
	const seek = vi.spyOn(EdgeTTSNativeStreamService, 'seekToChunk').mockResolvedValue();
	const sentence = `Đây là câu thử ${'nội dung '.repeat(12)}.`;
	const paragraphs = [`${sentence} ${sentence} ${sentence}`, 'Câu cuối.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
	act(() => result.current.startReading());
	act(() => result.current.nextSection());
	act(() => result.current.nextSection());
	act(() => result.current.prevSection());
	expect(seek.mock.calls.map(([index]) => index)).toEqual([1, 2, 1]);
	unmount();
});

it('Media3 Next uses the player utterance cursor and ignores stale snapshots during seek', () => {
	useReaderConfigStore.setState({ ttsEngine: 'edge', edgeBufferMode: 'media3' });
	vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
	vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue();
	const seek = vi.spyOn(EdgeTTSNativeStreamService, 'seekToChunk').mockResolvedValue();
	const sentence = `Đây là câu thử ${'nội dung '.repeat(12)}.`;
	const paragraphs = [`${sentence} ${sentence} ${sentence}`, 'Câu cuối.'];
	const { result, unmount } = renderHook(() => useReadAloud(paragraphs));
	act(() => result.current.startReading());
	const snapshot = (utteranceIndex: number) => {
		EdgeTTSNativeStreamService['snapshotListeners'].forEach((cb) =>
			cb({
				sessionId: 'test',
				state: 'PLAYING',
				utteranceIndex,
				positionMs: 100,
				bufferedDurationMs: 1000,
				rebufferCount: 0
			})
		);
	};
	act(() => snapshot(1));
	act(() => result.current.nextSection());
	act(() => snapshot(1));
	act(() => result.current.nextSection());
	expect(seek.mock.calls.map(([index]) => index)).toEqual([2, 3]);
	unmount();
});
