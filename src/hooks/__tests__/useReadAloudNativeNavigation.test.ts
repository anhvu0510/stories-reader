// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useReadAloud } from '@/hooks/useReadAloud';
import { NativeTTSStreamService } from '@/services/nativeTtsStream';
import { EdgeTTSNativeStreamService } from '@/services/edgeTtsNativeStream';
import { DomWordHighlighter } from '@/services/domWordHighlighter';
import { ReadAloudScrollFollower } from '@/services/readAloudScrollFollower';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

beforeEach(() => {
	localStorage.clear();
	document.body.innerHTML = '<main id="main-story-content"><article><div data-paragraph-index="0">Câu đầu.</div><div data-paragraph-index="1">Câu sau.</div></article></main>';
	vi.spyOn(DomWordHighlighter.prototype, 'highlight').mockReturnValue(null);
	vi.spyOn(NativeTTSStreamService, 'stop').mockResolvedValue();
	vi.spyOn(EdgeTTSNativeStreamService, 'stop').mockResolvedValue();
	vi.spyOn(EdgeTTSNativeStreamService, 'initListeners').mockResolvedValue();
});
afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = '';
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
