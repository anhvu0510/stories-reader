import { useEffect, useRef, type RefObject } from 'react';

import { useTTSStore } from '@/features/reader/stores/useTTSStore';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

import { resetSpeechSession, type ActiveNativeStream } from './readAloudTransportHelpers';

import type { BackgroundAudioKeepAlive } from '@/services/backgroundAudioKeepAlive';
import type { DomWordHighlighter } from '@/services/domWordHighlighter';
import type { GaplessTtsPlayer, SentenceChunk } from '@/services/gaplessTtsPlayer';
import type { ReadAloudScrollFollower } from '@/services/readAloudScrollFollower';
import type { ReadAloudUtterance } from '@/services/readAloudUtterancePlan';

export interface MediaActions {
	startReading?: (targetIndex?: number, targetOffset?: number) => void;
	pauseReading?: () => void;
	nextSection?: () => void;
	prevSection?: () => void;
}

export interface ReadAloudLifecycleParams {
	isPlaying: boolean;
	isPaused: boolean;
	isLoading: boolean;
	activeParagraphIndex: number;
	charIndexRef: RefObject<number>;
	charLengthRef: RefObject<number>;
	paragraphs: string[];
	ttsEngine: string;
	vieneuModel: string;
	voiceUri: string;
	vieneuOptions: unknown;
	synth: SpeechSynthesis | null;
	isPlayingRef: RefObject<boolean>;
	isPausedRef: RefObject<boolean>;
	ownsBrowserSpeechQueueRef: RefObject<boolean>;
	backgroundAudioRef: RefObject<BackgroundAudioKeepAlive | null>;
	gaplessPlayerRef: RefObject<GaplessTtsPlayer | null>;
	edgePlayback: { recoverIfPaused: () => void };
	activeNativeStream: ActiveNativeStream;
	chunksLength: number;
	mediaActionsRef: RefObject<MediaActions>;
	wordHighlighterRef: RefObject<DomWordHighlighter | null>;
	scrollFollowerRef: RefObject<ReadAloudScrollFollower | null>;
	stopReading: (clearSaved?: boolean) => void;
}

function bindMediaSessionHandlers(mediaActionsRef: RefObject<MediaActions>): (() => void) | undefined {
	if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return undefined;

	const mediaSession = navigator.mediaSession;
	mediaSession.metadata = new MediaMetadata({ title: 'VietNeu Read Aloud' });
	const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
		['play', () => mediaActionsRef.current.startReading?.()],
		['pause', () => mediaActionsRef.current.pauseReading?.()],
		['nexttrack', () => mediaActionsRef.current.nextSection?.()],
		['previoustrack', () => mediaActionsRef.current.prevSection?.()],
	];
	handlers.forEach(([action, handler]) => {
		try {
			mediaSession.setActionHandler(action, handler);
		} catch {
			// Some browsers expose Media Session but do not support every action.
		}
	});
	return () => {
		handlers.forEach(([action]) => {
			try {
				mediaSession.setActionHandler(action, null);
			} catch {
				// Ignore unsupported action cleanup.
			}
		});
	};
}

export function useReadAloudLifecycleEffects(params: ReadAloudLifecycleParams): void {
	const stopReadingRef = useRef(params.stopReading);
	stopReadingRef.current = params.stopReading;

	useEffect(() => {
		useTTSStore.setState({
			isPlaying: params.isPlaying,
			isPaused: params.isPaused,
			isLoading: params.isLoading,
			currentParagraphIndex: params.activeParagraphIndex,
			currentCharIndex: params.charIndexRef.current,
			currentCharLength: params.charLengthRef.current,
		});
	}, [params.isPlaying, params.isPaused, params.isLoading, params.activeParagraphIndex, params.charIndexRef, params.charLengthRef]);

	useEffect(() => {
		stopReadingRef.current();
	}, [params.paragraphs]);

	useEffect(() => {
		if (params.ttsEngine === 'vieneu') {
			stopReadingRef.current();
		}
	}, [params.vieneuModel, params.voiceUri, params.ttsEngine, params.vieneuOptions]);

	useEffect(() => {
		const onVisibilityChange = () => {
			if (document.visibilityState !== 'visible') return;
			if (!params.isPlayingRef.current || params.isPausedRef.current) return;

			params.backgroundAudioRef.current?.resume();
			if (params.ttsEngine === 'vieneu') {
				void params.gaplessPlayerRef.current?.resume().catch(() => {});
			} else if (params.ttsEngine === 'edge') {
				params.edgePlayback.recoverIfPaused();
			} else if (params.ownsBrowserSpeechQueueRef.current) {
				params.synth?.resume();
			}
		};

		document.addEventListener('visibilitychange', onVisibilityChange);
		window.addEventListener('pageshow', onVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('pageshow', onVisibilityChange);
		};
	}, [
		params.ttsEngine,
		params.synth,
		params.edgePlayback,
		params.isPlayingRef,
		params.isPausedRef,
		params.backgroundAudioRef,
		params.gaplessPlayerRef,
		params.ownsBrowserSpeechQueueRef,
	]);

	useEffect(() => {
		if (params.activeNativeStream) return;
		if (!params.isPlaying && !params.isPaused && !params.isLoading) return;
		return bindMediaSessionHandlers(params.mediaActionsRef);
	}, [params.activeNativeStream, params.chunksLength, params.isLoading, params.isPaused, params.isPlaying, params.mediaActionsRef]);

	useEffect(() => {
		const highlighter = params.wordHighlighterRef.current;
		const follower = params.scrollFollowerRef.current;
		return () => {
			highlighter?.dispose();
			follower?.cancel();
			stopReadingRef.current();
		};
	}, [params.scrollFollowerRef, params.wordHighlighterRef]);
}

export interface ReadAloudSectionNavigationParams {
	direction: -1 | 1;
	ttsEngine: string;
	activeNativeStream: ActiveNativeStream;
	media3Utterances: ReadAloudUtterance[];
	chunks: SentenceChunk[];
	getMedia3UtteranceIndex: (targetIdx: number, sourceOffset?: number) => number;
	media3UtteranceIndexRef: RefObject<number>;
	pendingMedia3UtteranceRef: RefObject<number | null>;
	pendingNativeChunkRef: RefObject<number | null>;
	currentChunkIdxRef: RefObject<number>;
	playSessionIdRef: RefObject<number>;
	isPlayingRef: RefObject<boolean>;
	isPausedRef: RefObject<boolean>;
	ownsBrowserSpeechQueueRef: RefObject<boolean>;
	utteranceRef: RefObject<SpeechSynthesisUtterance | null>;
	synth: SpeechSynthesis | null;
	scrollFollowerRef: RefObject<ReadAloudScrollFollower | null>;
	setIsLoading: (val: boolean) => void;
	setIsPlaying: (val: boolean) => void;
	setIsPaused: (val: boolean) => void;
	clearResumePosition: () => void;
	stopReading: (clearSaved?: boolean) => void;
	stopAudioPlayer: (clearPrefetch?: boolean) => void;
	playChunk: (index: number, startOffset?: number) => void;
}

function tryNavigateMedia3Utterance(params: ReadAloudSectionNavigationParams): boolean {
	if (params.ttsEngine !== 'edge' || !params.activeNativeStream || useReaderConfigStore.getState().edgeBufferMode !== 'media3') {
		return false;
	}
	const nativeIndex = params.media3UtteranceIndexRef.current + params.direction;
	const utterance = params.media3Utterances[nativeIndex];
	if (nativeIndex >= params.media3Utterances.length) params.clearResumePosition();
	if (!utterance || utterance.sourceChunkIndex === undefined) {
		params.stopReading(params.direction === 1);
		return true;
	}
	params.playSessionIdRef.current += 1;
	params.stopAudioPlayer();
	params.media3UtteranceIndexRef.current = nativeIndex;
	params.pendingMedia3UtteranceRef.current = nativeIndex;
	params.pendingNativeChunkRef.current = utterance.sourceChunkIndex;
	params.currentChunkIdxRef.current = utterance.sourceChunkIndex;
	params.setIsLoading(true);
	params.setIsPlaying(false);
	params.setIsPaused(false);
	params.isPlayingRef.current = true;
	params.isPausedRef.current = false;
	void params.activeNativeStream.seekToChunk(nativeIndex);
	return true;
}

export function performReadAloudSectionNavigation(params: ReadAloudSectionNavigationParams): void {
	params.scrollFollowerRef.current?.resumeFollowing();
	if (tryNavigateMedia3Utterance(params)) return;

	const index = params.currentChunkIdxRef.current + params.direction;
	if (index < 0) {
		params.stopReading();
		return;
	}
	if (index >= params.chunks.length) {
		params.clearResumePosition();
		params.stopReading(true);
		return;
	}
	params.playSessionIdRef.current += 1;
	params.stopAudioPlayer();
	resetSpeechSession(params.ownsBrowserSpeechQueueRef, params.synth, params.utteranceRef);
	params.setIsLoading(true);
	params.setIsPlaying(false);
	params.setIsPaused(false);
	params.isPlayingRef.current = true;
	params.isPausedRef.current = false;
	params.currentChunkIdxRef.current = index;
	if (params.activeNativeStream) {
		params.pendingNativeChunkRef.current = index;
		const isMedia3 = params.ttsEngine === 'edge' && useReaderConfigStore.getState().edgeBufferMode === 'media3';
		const nativeIndex = isMedia3 ? params.getMedia3UtteranceIndex(index) : index;
		void params.activeNativeStream.seekToChunk(nativeIndex);
		return;
	}
	params.playChunk(index);
}
