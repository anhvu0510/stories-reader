import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { EdgeTTSNativeStreamService, type NativeChunkStartEvent } from '@/services/edgeTtsNativeStream';
import { NativeTTSStreamService } from '@/services/nativeTtsStream';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import type { useReadAloudHighlight } from './useReadAloudHighlight';
import type { useReadAloudResume } from './useReadAloudResume';

interface NativeReadingOptions {
	stream: typeof EdgeTTSNativeStreamService | typeof NativeTTSStreamService | null;
	edge: boolean;
	cursor: {
		playing: RefObject<boolean>;
		paused: RefObject<boolean>;
		active: RefObject<boolean>;
		pendingChunk: RefObject<number | null>;
		pendingUtterance: RefObject<number | null>;
		chunk: RefObject<number>;
		utterance: RefObject<number>;
		charIndex: RefObject<number>;
		charLength: RefObject<number>;
		sourceOffset: RefObject<number>;
		paragraph: RefObject<number>;
	};
	visual: ReturnType<typeof useReadAloudHighlight>;
	resume: Pick<ReturnType<typeof useReadAloudResume>, 'saveResumePosition' | 'clearResumePosition'>;
	state: { playing: (value: boolean) => void; paused: (value: boolean) => void; loading: (value: boolean) => void; chunk: (value: number) => void };
	stop: (clearSaved?: boolean) => void;
}

/** Native subscription lifetime is independent of React render frequency. */
export function useNativeReadingEvents(options: NativeReadingOptions) {
	const current = useRef(options);
	useLayoutEffect(() => {
		current.current = options;
	}, [options]);
	const activeNativeStream = options.stream;
	useEffect(() => {
		if (!activeNativeStream) return;

		const unsubChunk = activeNativeStream.onChunkStart((idx: number, event?: NativeChunkStartEvent) => {
			if (!current.current.cursor.playing.current) return;
			if (current.current.cursor.pendingUtterance.current !== null && event?.utteranceIndex !== current.current.cursor.pendingUtterance.current) return;
			if (current.current.cursor.pendingChunk.current !== null && idx !== current.current.cursor.pendingChunk.current) return;
			current.current.cursor.pendingChunk.current = null;
			const sourceOffset = event?.sourceStart === undefined ? -1 : event.sourceStart + (event.startCharIndex ?? 0);
			current.current.cursor.charIndex.current = sourceOffset;
			current.current.cursor.charLength.current = 0;
			current.current.cursor.chunk.current = idx;
			current.current.state.chunk(idx);
			current.current.state.loading(false);
			if (event?.sourceStart !== undefined && event.paragraphIndex !== undefined) {
				current.current.cursor.sourceOffset.current = sourceOffset;
				current.current.cursor.paragraph.current = event.paragraphIndex;
				current.current.resume.saveResumePosition(idx, 0, event.paragraphIndex, sourceOffset);
			} else current.current.resume.saveResumePosition(idx, 0);
		});

		const unsubWord = activeNativeStream.onWordBoundary((event) => {
			if (!current.current.cursor.playing.current) return;
			if (current.current.cursor.pendingUtterance.current !== null && event.utteranceIndex !== current.current.cursor.pendingUtterance.current) return;
			const { chunkIndex, charIndex, charLength, paragraphIndex, sourceStart, sourceLength } = event;
			if (current.current.cursor.pendingChunk.current !== null && chunkIndex !== current.current.cursor.pendingChunk.current) return;
			if (chunkIndex !== current.current.cursor.chunk.current) return;
			if (paragraphIndex !== undefined && sourceStart !== undefined && sourceLength !== undefined) {
				current.current.visual.updateMedia3Highlight(chunkIndex, paragraphIndex, sourceStart, charIndex, charLength);
				return;
			}
			current.current.visual.updateWordHighlight(chunkIndex, charIndex, charLength);
		});

		const unsubState = activeNativeStream.onPlaybackStateChange(({ isPlaying: p, isPaused: pa, isBuffering: b }) => {
			if (!current.current.cursor.active.current) return;
			if (pa) current.current.visual.scrollFollowerRef.current?.pauseFollowing();
			if (b) current.current.cursor.charLength.current = 0;
			current.current.state.playing(p);
			current.current.cursor.playing.current = p || b;
			current.current.state.paused(pa);
			current.current.cursor.paused.current = pa;
			current.current.state.loading(b);
		});

		const unsubDone = activeNativeStream.onPlaybackComplete(() => {
			if (!current.current.cursor.playing.current) return;
			if (current.current.cursor.pendingChunk.current !== null) return;
			current.current.resume.clearResumePosition();
			current.current.stop(true);
		});
		const unsubSnapshot = current.current.edge
			? EdgeTTSNativeStreamService.onSnapshot((snapshot) => {
					if (useReaderConfigStore.getState().edgeBufferMode !== 'media3') return;
					if (!current.current.cursor.playing.current && !current.current.cursor.paused.current) return;
					if (current.current.cursor.pendingUtterance.current !== null && snapshot.utteranceIndex !== current.current.cursor.pendingUtterance.current) return;
					current.current.cursor.utterance.current = snapshot.utteranceIndex;
					current.current.cursor.pendingUtterance.current = null;
				})
			: undefined;

		return () => {
			unsubChunk();
			unsubWord();
			unsubState();
			unsubDone();
			unsubSnapshot?.();
		};
	}, [activeNativeStream]);
}
