import { useState, useRef, useMemo } from 'react';

import { useAppStore } from '@/stores/useAppStore';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

import { resolveActiveNativeStream } from './readAloud/readAloudTransportHelpers';
import { useNativeReadingEvents } from './readAloud/useNativeReadingEvents';
import { createReadAloudControllerActions } from './readAloud/useReadAloudActions';
import { useReadAloudEnginePlaybacks, useReadAloudRefs, type ReadAloudChapterContext } from './readAloud/useReadAloudEnginePlaybacks';
import { useReadAloudHighlight } from './readAloud/useReadAloudHighlight';
import { useReadAloudLifecycleEffects } from './readAloud/useReadAloudLifecycle';
import { useReadAloudPlan } from './readAloud/useReadAloudPlan';
import { useReadAloudResume } from './readAloud/useReadAloudResume';
import { useReadingWakeLock } from './readAloud/useReadingWakeLock';

export { splitParagraphIntoSentences } from '@/services/gaplessTtsPlayer';
export { useReadAloud as useNativeReadAloud };
export type { ReadAloudChapterContext };

function useReadAloudCoreState() {
	const activeDomain = useAppStore((state) => state.activeDomain);
	const voiceUri = useReaderConfigStore((state) => state.voiceUri);
	const edgeVoiceUri = useReaderConfigStore((state) => state.edgeVoiceUri || 'vi-VN-HoaiMyNeural');
	const speechRate = useReaderConfigStore((state) => state.speechRate);
	const speechRateRef = useRef(speechRate);
	speechRateRef.current = speechRate;
	const ttsEngine = useReaderConfigStore((state) => state.ttsEngine || 'vieneu');

	const [isPlaying, setIsPlaying] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
	const synth = typeof window === 'undefined' ? null : window.speechSynthesis;
	const refs = useReadAloudRefs();
	const stopReadingBridgeRef = useRef<(clearSaved?: boolean) => void>(() => {});

	return {
		activeDomain,
		voiceUri,
		edgeVoiceUri,
		speechRate,
		speechRateRef,
		ttsEngine,
		isPlaying,
		setIsPlaying,
		isPaused,
		setIsPaused,
		isLoading,
		setIsLoading,
		currentChunkIndex,
		setCurrentChunkIndex,
		synth,
		refs,
		stopReadingBridgeRef,
	};
}

interface ReadAloudRuntimeParams {
	activeNativeStream: ReturnType<typeof resolveActiveNativeStream>;
	ttsEngine: string;
	refs: ReturnType<typeof useReadAloudRefs>;
	wordHighlighterRef: ReturnType<typeof useReadAloudHighlight>['wordHighlighterRef'];
	scrollFollowerRef: ReturnType<typeof useReadAloudHighlight>['scrollFollowerRef'];
	updateWordHighlight: ReturnType<typeof useReadAloudHighlight>['updateWordHighlight'];
	updateMedia3Highlight: ReturnType<typeof useReadAloudHighlight>['updateMedia3Highlight'];
	saveResumePosition: ReturnType<typeof useReadAloudResume>['saveResumePosition'];
	clearResumePosition: ReturnType<typeof useReadAloudResume>['clearResumePosition'];
	setIsPlaying: (val: boolean) => void;
	setIsPaused: (val: boolean) => void;
	setIsLoading: (val: boolean) => void;
	setCurrentChunkIndex: (val: number) => void;
	actions: ReturnType<typeof createReadAloudControllerActions>;
	isPlaying: boolean;
	isPaused: boolean;
	isLoading: boolean;
	activeParagraphIndex: number;
	paragraphs: string[];
	vieneuModel: string;
	voiceUri: string;
	vieneuOptions: unknown;
	synth: SpeechSynthesis | null;
	edgePlayback: ReturnType<typeof useReadAloudEnginePlaybacks>['edgePlayback'];
	chunksLength: number;
}

function useReadAloudEventSubscriptions(params: ReadAloudRuntimeParams) {
	useNativeReadingEvents({
		stream: params.activeNativeStream,
		edge: params.ttsEngine === 'edge',
		cursor: {
			playing: params.refs.isPlayingRef,
			paused: params.refs.isPausedRef,
			active: params.refs.nativePlaybackActiveRef,
			pendingChunk: params.refs.pendingNativeChunkRef,
			pendingUtterance: params.refs.pendingMedia3UtteranceRef,
			chunk: params.refs.currentChunkIdxRef,
			utterance: params.refs.media3UtteranceIndexRef,
			charIndex: params.refs.charIndexRef,
			charLength: params.refs.charLengthRef,
			sourceOffset: params.refs.sourceOffsetRef,
			paragraph: params.refs.currentParagraphIndexRef,
		},
		visual: {
			wordHighlighterRef: params.wordHighlighterRef,
			scrollFollowerRef: params.scrollFollowerRef,
			updateWordHighlight: params.updateWordHighlight,
			updateMedia3Highlight: params.updateMedia3Highlight,
		},
		resume: { saveResumePosition: params.saveResumePosition, clearResumePosition: params.clearResumePosition },
		state: {
			playing: params.setIsPlaying,
			paused: params.setIsPaused,
			loading: params.setIsLoading,
			chunk: params.setCurrentChunkIndex,
		},
		stop: (clearSaved) => params.actions.stopReading(clearSaved),
	});

	useReadAloudLifecycleEffects({
		...params.refs,
		isPlaying: params.isPlaying,
		isPaused: params.isPaused,
		isLoading: params.isLoading,
		activeParagraphIndex: params.activeParagraphIndex,
		paragraphs: params.paragraphs,
		ttsEngine: params.ttsEngine,
		vieneuModel: params.vieneuModel,
		voiceUri: params.voiceUri,
		vieneuOptions: params.vieneuOptions,
		synth: params.synth,
		edgePlayback: params.edgePlayback,
		activeNativeStream: params.activeNativeStream,
		chunksLength: params.chunksLength,
		wordHighlighterRef: params.wordHighlighterRef,
		scrollFollowerRef: params.scrollFollowerRef,
		stopReading: params.actions.stopReading,
	});
}

export function useReadAloud(
	paragraphs: string[],
	chapterContext: ReadAloudChapterContext = {},
	paragraphContexts: ReadAloudChapterContext[] = []
) {
	const core = useReadAloudCoreState();
	const { getResumePosition, saveResumePosition, clearResumePosition } = useReadAloudResume(chapterContext.chapterId);
	const { requestWakeLock, releaseWakeLock } = useReadingWakeLock();
	const { chunks, media3Utterances, getMedia3UtteranceIndex, segmentMetadata } = useReadAloudPlan(
		paragraphs,
		chapterContext,
		paragraphContexts
	);

	const { wordHighlighterRef, scrollFollowerRef, updateWordHighlight, updateMedia3Highlight } = useReadAloudHighlight(chunks, {
		charIndexRef: core.refs.charIndexRef,
		charLengthRef: core.refs.charLengthRef,
		sourceOffsetRef: core.refs.sourceOffsetRef,
		currentParagraphIndexRef: core.refs.currentParagraphIndexRef,
	});

	const { edgePlayback, stopAudioPlayer, playChunk, vieneuModel, vieneuOptions } = useReadAloudEnginePlaybacks({
		chunks,
		synth: core.synth,
		voiceUri: core.voiceUri,
		edgeVoiceUri: core.edgeVoiceUri,
		speechRate: core.speechRate,
		speechRateRef: core.speechRateRef,
		ttsEngine: core.ttsEngine,
		activeDomain: core.activeDomain,
		chapterContext,
		paragraphContexts,
		segmentMetadata,
		refs: core.refs,
		wordHighlighterRef,
		setCurrentChunkIndex: core.setCurrentChunkIndex,
		setIsLoading: core.setIsLoading,
		setIsPlaying: core.setIsPlaying,
		clearResumePosition,
		updateWordHighlight,
		stopReadingBridgeRef: core.stopReadingBridgeRef,
	});

	const activeParagraphIndex = core.currentChunkIndex >= 0 && chunks[core.currentChunkIndex] ? chunks[core.currentChunkIndex].pIdx : -1;
	const activeNativeStream = useMemo(() => resolveActiveNativeStream(core.ttsEngine), [core.ttsEngine]);

	const actions = createReadAloudControllerActions({
		...core.refs,
		chunks,
		media3Utterances,
		getMedia3UtteranceIndex,
		ttsEngine: core.ttsEngine,
		voiceUri: core.voiceUri,
		edgeVoiceUri: core.edgeVoiceUri,
		speechRateRef: core.speechRateRef,
		chapterContext,
		activeDomainUrl: core.activeDomain?.url,
		synth: core.synth,
		activeNativeStream,
		isPlaying: core.isPlaying,
		isPaused: core.isPaused,
		isLoading: core.isLoading,
		setIsPlaying: core.setIsPlaying,
		setIsPaused: core.setIsPaused,
		setIsLoading: core.setIsLoading,
		setCurrentChunkIndex: core.setCurrentChunkIndex,
		wordHighlighterRef,
		scrollFollowerRef,
		edgePlayback,
		getResumePosition,
		saveResumePosition,
		clearResumePosition,
		requestWakeLock,
		releaseWakeLock,
		stopAudioPlayer,
		playChunk,
	});
	core.stopReadingBridgeRef.current = actions.stopReading;

	useReadAloudEventSubscriptions({
		activeNativeStream,
		ttsEngine: core.ttsEngine,
		refs: core.refs,
		wordHighlighterRef,
		scrollFollowerRef,
		updateWordHighlight,
		updateMedia3Highlight,
		saveResumePosition,
		clearResumePosition,
		setIsPlaying: core.setIsPlaying,
		setIsPaused: core.setIsPaused,
		setIsLoading: core.setIsLoading,
		setCurrentChunkIndex: core.setCurrentChunkIndex,
		actions,
		isPlaying: core.isPlaying,
		isPaused: core.isPaused,
		isLoading: core.isLoading,
		activeParagraphIndex,
		paragraphs,
		vieneuModel,
		voiceUri: core.voiceUri,
		vieneuOptions,
		synth: core.synth,
		edgePlayback,
		chunksLength: chunks.length,
	});

	return {
		isPlaying: core.isPlaying,
		isPaused: core.isPaused,
		isLoading: core.isLoading,
		isTTSActive: core.isPlaying || core.isPaused || core.isLoading,
		currentChunkIndex: core.currentChunkIndex,
		activeParagraphIndex,
		...actions,
		clearResumePosition,
	};
}
