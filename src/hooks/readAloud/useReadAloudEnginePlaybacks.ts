import { useRef, type RefObject } from 'react';

import { BackgroundAudioKeepAlive } from '@/services/backgroundAudioKeepAlive';
import { type DomWordHighlighter } from '@/services/domWordHighlighter';
import { type GaplessTtsPlayer, type SentenceChunk } from '@/services/gaplessTtsPlayer';

import { createBrowserSpeechPlayback } from './browserSpeechPlayback';
import { useBrowserEdgePlayback } from './useBrowserEdgePlayback';
import { type MediaActions } from './useReadAloudLifecycle';
import { type useReadAloudPlan } from './useReadAloudPlan';
import { useVieNeuReadingConfig } from './useVieNeuReadingConfig';
import { createVieNeuPlayback } from './vieNeuPlayback';

export interface ReadAloudChapterContext {
	bookId?: string;
	bookName?: string;
	chapterId?: string;
	chapterNumber?: number;
	chapterTitle?: string;
}

export function disposeAudioPlayerResources(
	edgePlayback: { stop: (clearPrefetch?: boolean) => void },
	gaplessPlayerRef: { current: GaplessTtsPlayer | null },
	clearPrefetch = false
): void {
	edgePlayback.stop(clearPrefetch);
	const player = gaplessPlayerRef.current;
	gaplessPlayerRef.current = null;
	if (player) {
		void player.dispose().catch((error: unknown) => {
			console.warn('Failed to dispose VieNeu audio player:', error);
		});
	}
}

export function useReadAloudRefs() {
	const gaplessPlayerRef = useRef<GaplessTtsPlayer | null>(null);
	const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
	const ownsBrowserSpeechQueueRef = useRef(false);
	const backgroundAudioRef = useRef<BackgroundAudioKeepAlive | null>(null);
	if (!backgroundAudioRef.current) {
		backgroundAudioRef.current = new BackgroundAudioKeepAlive();
	}
	const currentChunkIdxRef = useRef<number>(0);
	const sourceOffsetRef = useRef(0);
	const pendingNativeChunkRef = useRef<number | null>(null);
	const media3UtteranceIndexRef = useRef(0);
	const pendingMedia3UtteranceRef = useRef<number | null>(null);
	const isPlayingRef = useRef(false);
	const nativePlaybackActiveRef = useRef(false);
	const isPausedRef = useRef(false);
	const playSessionIdRef = useRef<number>(0);
	const charIndexRef = useRef(-1);
	const charLengthRef = useRef(0);
	const currentParagraphIndexRef = useRef(-1);
	const mediaActionsRef = useRef<MediaActions>({});

	return {
		gaplessPlayerRef,
		utteranceRef,
		ownsBrowserSpeechQueueRef,
		backgroundAudioRef,
		currentChunkIdxRef,
		sourceOffsetRef,
		pendingNativeChunkRef,
		media3UtteranceIndexRef,
		pendingMedia3UtteranceRef,
		isPlayingRef,
		nativePlaybackActiveRef,
		isPausedRef,
		playSessionIdRef,
		charIndexRef,
		charLengthRef,
		currentParagraphIndexRef,
		mediaActionsRef,
	};
}

export function useReadAloudEnginePlaybacks(params: {
	chunks: SentenceChunk[];
	synth: SpeechSynthesis | null;
	voiceUri: string;
	edgeVoiceUri: string;
	speechRate: number;
	speechRateRef: RefObject<number>;
	ttsEngine: string;
	activeDomain: { url: string } | null | undefined;
	chapterContext: ReadAloudChapterContext;
	paragraphContexts: ReadAloudChapterContext[];
	segmentMetadata: ReturnType<typeof useReadAloudPlan>['segmentMetadata'];
	refs: ReturnType<typeof useReadAloudRefs>;
	wordHighlighterRef: RefObject<DomWordHighlighter | null>;
	setCurrentChunkIndex: (val: number) => void;
	setIsLoading: (val: boolean) => void;
	setIsPlaying: (val: boolean) => void;
	clearResumePosition: () => void;
	updateWordHighlight: (index: number, offset: number, length: number) => void;
	stopReadingBridgeRef: RefObject<(clearSaved?: boolean) => void>;
}) {
	const { vieneuServerUrl, vieneuModel, vieneuOptions, getVieneuOptionsForSegment } = useVieNeuReadingConfig();
	const {
		chunks,
		synth,
		voiceUri,
		edgeVoiceUri,
		speechRate,
		speechRateRef,
		ttsEngine,
		activeDomain,
		chapterContext,
		paragraphContexts,
		segmentMetadata,
		refs,
		wordHighlighterRef,
		setCurrentChunkIndex,
		setIsLoading,
		setIsPlaying,
		clearResumePosition,
		updateWordHighlight,
		stopReadingBridgeRef,
	} = params;

	const edgePlayback = useBrowserEdgePlayback({
		chunks,
		edgeVoiceUri,
		activeDomain,
		speechRateRef,
		isPlayingRef: refs.isPlayingRef,
		playSessionIdRef: refs.playSessionIdRef,
		currentChunkIdxRef: refs.currentChunkIdxRef,
		setCurrentChunkIndex,
		setIsLoading,
		setIsPlaying,
		clearResumePosition,
		stopReading: (clearSaved) => stopReadingBridgeRef.current(clearSaved),
		updateWordHighlight: (index, offset, length) => updateWordHighlight(index, offset, length),
		playChunkViaBrowser: (index, offset, sessionId) => playChunkViaBrowser(index, offset, sessionId),
	});

	const stopAudioPlayer = (clearPrefetch = false) => disposeAudioPlayerResources(edgePlayback, refs.gaplessPlayerRef, clearPrefetch);

	const playChunk = (index: number, startOffset: number = 0) => {
		const sessionId = refs.playSessionIdRef.current;
		if (ttsEngine === 'browser') {
			playChunkViaBrowser(index, startOffset, sessionId);
		} else if (ttsEngine === 'edge') {
			edgePlayback.play(index, sessionId, startOffset);
		} else {
			playChunkViaVieNeu(index, sessionId, startOffset);
		}
	};

	const playChunkViaBrowser = createBrowserSpeechPlayback({
		chunks,
		synth,
		voiceUri,
		speechRateRef,
		isPlayingRef: refs.isPlayingRef,
		isPausedRef: refs.isPausedRef,
		playSessionIdRef: refs.playSessionIdRef,
		currentChunkIdxRef: refs.currentChunkIdxRef,
		charIndexRef: refs.charIndexRef,
		charLengthRef: refs.charLengthRef,
		utteranceRef: refs.utteranceRef,
		ownsBrowserSpeechQueueRef: refs.ownsBrowserSpeechQueueRef,
		wordHighlighterRef,
		setCurrentChunkIndex,
		setIsLoading,
		setIsPlaying,
		clearResumePosition,
		stopReading: (clear) => stopReadingBridgeRef.current(clear),
		updateWordHighlight: (index, offset, length) => updateWordHighlight(index, offset, length),
		playChunk: (index, offset) => playChunk(index, offset),
	});

	const playChunkViaVieNeu = createVieNeuPlayback({
		chunks,
		voiceUri,
		speechRate,
		chapterContext,
		paragraphContexts,
		segmentMetadata,
		isPlayingRef: refs.isPlayingRef,
		playSessionIdRef: refs.playSessionIdRef,
		currentChunkIdxRef: refs.currentChunkIdxRef,
		gaplessPlayerRef: refs.gaplessPlayerRef,
		setCurrentChunkIndex,
		setIsLoading,
		setIsPlaying,
		stopAudioPlayer,
		stopReading: () => stopReadingBridgeRef.current(),
		updateWordHighlight: (index, offset, length) => updateWordHighlight(index, offset, length),
		playChunkViaBrowser: (index, offset, sessionId) => playChunkViaBrowser(index, offset, sessionId),
		vieneuServerUrl,
		vieneuModel,
		vieneuOptions,
		getVieneuOptionsForSegment,
	});

	return { edgePlayback, stopAudioPlayer, playChunk, vieneuModel, vieneuOptions };
}
