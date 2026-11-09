import { useTTSStore } from '@/features/reader/stores/useTTSStore';

import {
	cancelBrowserSpeech,
	canQuickResume,
	getBoundedStartPosition,
	handleStopResumePosition,
	pauseEngineTransport,
	resetSpeechSession,
	resumeEngineTransport,
	saveCurrentReadingPosition,
	scrollToChunkParagraph,
	stopNativeServices,
	tryStartNativePlayback,
	type ActiveNativeStream,
} from './readAloudTransportHelpers';
import { performReadAloudSectionNavigation, type MediaActions } from './useReadAloudLifecycle';

import type { ReadAloudChapterContext } from '../useReadAloud';
import type { ReadAloudResumePosition } from './useReadAloudResume';
import type { BackgroundAudioKeepAlive } from '@/services/backgroundAudioKeepAlive';
import type { DomWordHighlighter } from '@/services/domWordHighlighter';
import type { GaplessTtsPlayer, SentenceChunk } from '@/services/gaplessTtsPlayer';
import type { ReadAloudScrollFollower } from '@/services/readAloudScrollFollower';
import type { ReadAloudUtterance } from '@/services/readAloudUtterancePlan';
import type { RefObject } from 'react';

export interface ReadAloudControllerDeps {
	chunks: SentenceChunk[];
	media3Utterances: ReadAloudUtterance[];
	getMedia3UtteranceIndex: (targetIdx: number, sourceOffset?: number) => number;
	ttsEngine: string;
	voiceUri: string;
	edgeVoiceUri: string;
	speechRateRef: RefObject<number>;
	chapterContext: ReadAloudChapterContext;
	activeDomainUrl?: string;
	synth: SpeechSynthesis | null;
	activeNativeStream: ActiveNativeStream;
	isPlaying: boolean;
	isPaused: boolean;
	isLoading: boolean;
	setIsPlaying: (val: boolean) => void;
	setIsPaused: (val: boolean) => void;
	setIsLoading: (val: boolean) => void;
	setCurrentChunkIndex: (val: number) => void;
	isPlayingRef: RefObject<boolean>;
	isPausedRef: RefObject<boolean>;
	nativePlaybackActiveRef: RefObject<boolean>;
	playSessionIdRef: RefObject<number>;
	currentChunkIdxRef: RefObject<number>;
	charIndexRef: RefObject<number>;
	charLengthRef: RefObject<number>;
	sourceOffsetRef: RefObject<number>;
	currentParagraphIndexRef: RefObject<number>;
	pendingNativeChunkRef: RefObject<number | null>;
	media3UtteranceIndexRef: RefObject<number>;
	pendingMedia3UtteranceRef: RefObject<number | null>;
	utteranceRef: RefObject<SpeechSynthesisUtterance | null>;
	ownsBrowserSpeechQueueRef: RefObject<boolean>;
	backgroundAudioRef: RefObject<BackgroundAudioKeepAlive | null>;
	gaplessPlayerRef: RefObject<GaplessTtsPlayer | null>;
	wordHighlighterRef: RefObject<DomWordHighlighter | null>;
	scrollFollowerRef: RefObject<ReadAloudScrollFollower | null>;
	mediaActionsRef: RefObject<MediaActions>;
	edgePlayback: {
		play: (index: number, sessionId: number, startOffset?: number) => void;
		stop: (clearCache?: boolean) => void;
		hasAudio: () => boolean;
		pause: () => void;
		resume: () => Promise<void>;
	};
	getResumePosition: () => ReadAloudResumePosition | null;
	saveResumePosition: (chunk: number, char: number, pIdx?: number, srcOff?: number) => void;
	clearResumePosition: () => void;
	requestWakeLock: () => Promise<void>;
	releaseWakeLock: () => void;
	stopAudioPlayer: (clearPrefetch?: boolean) => void;
	playChunk: (index: number, startOffset?: number) => void;
}

function executeStopReading(deps: ReadAloudControllerDeps, clearSaved = false): void {
	deps.nativePlaybackActiveRef.current = false;
	const wasActive = deps.isPlayingRef.current || deps.isPausedRef.current || deps.isLoading;
	const ownsBrowserSpeechQueue = deps.ownsBrowserSpeechQueueRef.current;

	handleStopResumePosition(
		clearSaved,
		wasActive,
		deps.currentChunkIdxRef.current,
		deps.chunks.length,
		deps.charIndexRef.current,
		deps.currentParagraphIndexRef.current,
		deps.sourceOffsetRef.current,
		deps.saveResumePosition,
		deps.clearResumePosition
	);

	deps.releaseWakeLock();
	deps.setIsPlaying(false);
	deps.setIsPaused(false);
	deps.setIsLoading(false);
	deps.isPlayingRef.current = false;
	deps.isPausedRef.current = false;
	deps.playSessionIdRef.current += 1;

	deps.stopAudioPlayer(true);
	deps.backgroundAudioRef.current?.stop();
	deps.wordHighlighterRef.current?.clear();
	deps.scrollFollowerRef.current?.cancel();
	stopNativeServices(wasActive);
	cancelBrowserSpeech(deps.synth, ownsBrowserSpeechQueue);
	deps.ownsBrowserSpeechQueueRef.current = false;
	deps.utteranceRef.current = null;

	deps.currentChunkIdxRef.current = 0;
	deps.setCurrentChunkIndex(-1);
	deps.charIndexRef.current = -1;
	deps.charLengthRef.current = 0;
	useTTSStore.setState({ currentCharIndex: -1, currentCharLength: 0, isLoading: false });
}

function executeStartReading(deps: ReadAloudControllerDeps, targetIndex?: number, targetOffset?: number): void {
	if (targetIndex === undefined && deps.isPlayingRef.current && !deps.isPausedRef.current) return;
	deps.scrollFollowerRef.current?.resumeFollowing();
	void deps.requestWakeLock();

	if (canQuickResume(deps.isPaused, targetIndex)) {
		deps.setIsPaused(false);
		deps.setIsPlaying(true);
		deps.setIsLoading(false);
		deps.isPlayingRef.current = true;
		deps.isPausedRef.current = false;
		deps.backgroundAudioRef.current?.start();
		resumeEngineTransport({
			ttsEngine: deps.ttsEngine,
			activeNativeStream: deps.activeNativeStream,
			gaplessPlayer: deps.gaplessPlayerRef.current,
			synth: deps.synth,
			edgePlayback: deps.edgePlayback,
			currentChunkIdx: deps.currentChunkIdxRef.current,
			charIndex: deps.charIndexRef.current,
			playChunk: deps.playChunk,
		});
		return;
	}

	deps.playSessionIdRef.current += 1;
	deps.stopAudioPlayer();
	resetSpeechSession(deps.ownsBrowserSpeechQueueRef, deps.synth, deps.utteranceRef);

	deps.setIsLoading(true);
	deps.setIsPlaying(false);
	deps.setIsPaused(false);
	deps.isPlayingRef.current = true;
	deps.isPausedRef.current = false;
	deps.backgroundAudioRef.current?.start();

	const savedPos = targetIndex === undefined ? deps.getResumePosition() : null;
	const { index: targetIdx, offset: targetOff } = getBoundedStartPosition(
		deps.chunks,
		deps.currentChunkIdxRef.current,
		savedPos,
		targetIndex,
		targetOffset,
		deps.clearResumePosition
	);
	deps.currentChunkIdxRef.current = targetIdx;
	scrollToChunkParagraph(deps.chunks[targetIdx]);

	const startedNative = tryStartNativePlayback({
		activeNativeStream: deps.activeNativeStream,
		ttsEngine: deps.ttsEngine,
		chunks: deps.chunks,
		targetIdx,
		targetOff,
		speechRateFallback: deps.speechRateRef.current,
		media3Utterances: deps.media3Utterances,
		getMedia3UtteranceIndex: deps.getMedia3UtteranceIndex,
		edgeVoiceUri: deps.edgeVoiceUri,
		voiceUri: deps.voiceUri,
		chapterContext: deps.chapterContext,
		activeDomainUrl: deps.activeDomainUrl,
		nativePlaybackActiveRef: deps.nativePlaybackActiveRef,
		isPlayingRef: deps.isPlayingRef,
		isPausedRef: deps.isPausedRef,
		pendingNativeChunkRef: deps.pendingNativeChunkRef,
		media3UtteranceIndexRef: deps.media3UtteranceIndexRef,
		pendingMedia3UtteranceRef: deps.pendingMedia3UtteranceRef,
		setIsPlaying: deps.setIsPlaying,
		setIsLoading: deps.setIsLoading,
	});
	if (startedNative) return;

	deps.playChunk(targetIdx, targetOff);
}

function executePauseReading(deps: ReadAloudControllerDeps): void {
	deps.scrollFollowerRef.current?.pauseFollowing();
	deps.releaseWakeLock();
	saveCurrentReadingPosition(
		deps.currentChunkIdxRef.current,
		deps.chunks.length,
		deps.charIndexRef.current,
		deps.currentParagraphIndexRef.current,
		deps.sourceOffsetRef.current,
		deps.saveResumePosition
	);
	deps.setIsPlaying(false);
	deps.setIsPaused(true);
	deps.setIsLoading(false);
	deps.isPlayingRef.current = false;
	deps.isPausedRef.current = true;
	deps.backgroundAudioRef.current?.stop();

	pauseEngineTransport(
		deps.ttsEngine,
		deps.activeNativeStream,
		deps.gaplessPlayerRef.current,
		deps.ownsBrowserSpeechQueueRef.current,
		deps.synth,
		deps.edgePlayback
	);
}

export function createReadAloudControllerActions(deps: ReadAloudControllerDeps) {
	const stopReading = (clearSaved = false) => executeStopReading(deps, clearSaved);
	const startReading = (targetIndex?: number, targetOffset?: number) => executeStartReading(deps, targetIndex, targetOffset);
	const pauseReading = () => executePauseReading(deps);

	const navigateReading = (direction: -1 | 1) =>
		performReadAloudSectionNavigation({
			direction,
			ttsEngine: deps.ttsEngine,
			activeNativeStream: deps.activeNativeStream,
			media3Utterances: deps.media3Utterances,
			chunks: deps.chunks,
			getMedia3UtteranceIndex: deps.getMedia3UtteranceIndex,
			media3UtteranceIndexRef: deps.media3UtteranceIndexRef,
			pendingMedia3UtteranceRef: deps.pendingMedia3UtteranceRef,
			pendingNativeChunkRef: deps.pendingNativeChunkRef,
			currentChunkIdxRef: deps.currentChunkIdxRef,
			playSessionIdRef: deps.playSessionIdRef,
			isPlayingRef: deps.isPlayingRef,
			isPausedRef: deps.isPausedRef,
			ownsBrowserSpeechQueueRef: deps.ownsBrowserSpeechQueueRef,
			utteranceRef: deps.utteranceRef,
			synth: deps.synth,
			scrollFollowerRef: deps.scrollFollowerRef,
			setIsLoading: deps.setIsLoading,
			setIsPlaying: deps.setIsPlaying,
			setIsPaused: deps.setIsPaused,
			clearResumePosition: deps.clearResumePosition,
			stopReading,
			stopAudioPlayer: deps.stopAudioPlayer,
			playChunk: deps.playChunk,
		});

	const nextSection = () => navigateReading(1);
	const prevSection = () => navigateReading(-1);
	deps.mediaActionsRef.current = { startReading, pauseReading, nextSection, prevSection };

	const jumpToContent = (pIdx: number, textOffset: number = 0) => {
		let targetIndex = deps.chunks.findIndex((c) => c.pIdx === pIdx && textOffset >= c.startOffset && textOffset < c.startOffset + c.length);
		if (targetIndex === -1) targetIndex = deps.chunks.findIndex((c) => c.pIdx === pIdx);
		if (targetIndex === -1) return;
		startReading(targetIndex, Math.max(0, textOffset - deps.chunks[targetIndex].startOffset));
	};

	const locateReadingLine = () => {
		window.getSelection()?.removeAllRanges();
		deps.scrollFollowerRef.current?.locateCurrentLine();
	};

	return {
		startReading,
		pauseReading,
		stopReading,
		nextSection,
		prevSection,
		jumpToContent,
		locateReadingLine,
	};
}
