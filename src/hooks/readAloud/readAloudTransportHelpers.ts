import { EdgeTTSNativeStreamService } from '@/services/edgeTtsNativeStream';
import { getGatewayBaseUrl } from '@/services/edgeTtsService';
import { type GaplessTtsPlayer, type SentenceChunk } from '@/services/gaplessTtsPlayer';
import { NativeTTSService } from '@/services/nativeTtsService';
import { NativeTTSStreamService } from '@/services/nativeTtsStream';
import { type ReadAloudUtterance } from '@/services/readAloudUtterancePlan';
import { type EdgeBufferMode } from '@/shared/types';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

import { resolveReadAloudStart } from './readAloudStartPosition';

import type { ReadAloudChapterContext } from '../useReadAloud';
import type { ReadAloudResumePosition } from './useReadAloudResume';
import type { RefObject } from 'react';

export type ActiveNativeStream = typeof EdgeTTSNativeStreamService | typeof NativeTTSStreamService | null;

export function resolveActiveNativeStream(ttsEngine: string): ActiveNativeStream {
	if (ttsEngine === 'edge' && EdgeTTSNativeStreamService.isAvailable()) {
		return EdgeTTSNativeStreamService;
	}
	if (ttsEngine === 'browser' && NativeTTSStreamService.isAvailable()) {
		return NativeTTSStreamService;
	}
	return null;
}

export function handleStopResumePosition(
	clearSaved: boolean,
	wasActive: boolean,
	currentChunkIdx: number,
	totalChunks: number,
	charIndex: number,
	paragraphIndex: number,
	sourceOffset: number,
	saveResume: (chunk: number, char: number, pIdx?: number, srcOff?: number) => void,
	clearResume: () => void
): void {
	if (clearSaved) {
		clearResume();
		return;
	}
	if (!wasActive || currentChunkIdx >= totalChunks) return;

	const safeChar = Math.max(0, charIndex);
	const safePIdx = paragraphIndex >= 0 ? paragraphIndex : undefined;
	const safeSrcOff = charIndex >= 0 ? sourceOffset : undefined;
	saveResume(currentChunkIdx, safeChar, safePIdx, safeSrcOff);
}

export function stopNativeServices(wasActive: boolean): void {
	if (!wasActive) return;
	if (NativeTTSService.isNative()) void NativeTTSService.stop();
	if (NativeTTSStreamService.isAvailable()) void NativeTTSStreamService.stop();
	if (EdgeTTSNativeStreamService.isAvailable()) void EdgeTTSNativeStreamService.stop();
}

export function cancelBrowserSpeech(synth: SpeechSynthesis | null, ownsQueue: boolean): void {
	if (ownsQueue && synth) {
		synth.cancel();
	}
}

export function calculateNativePlaybackIndices(
	chunks: SentenceChunk[],
	targetIdx: number,
	targetOff: number,
	isMedia3Mode: boolean,
	media3Utterances: ReadAloudUtterance[],
	getMedia3UtteranceIndex: (targetIdx: number, sourceOffset?: number) => number
): { sourceOffset: number; nativeStartIndex: number; startCharIndex: number } {
	const chunkStart = chunks[targetIdx]?.startOffset ?? 0;
	const sourceOffset = chunkStart + targetOff;
	const nativeStartIndex = isMedia3Mode ? getMedia3UtteranceIndex(targetIdx, sourceOffset) : targetIdx;
	const utteranceSourceStart = media3Utterances[nativeStartIndex]?.sourceStart ?? 0;
	const startCharIndex = Math.max(0, sourceOffset - utteranceSourceStart);
	return { sourceOffset, nativeStartIndex, startCharIndex };
}

export function resolveTargetVoice(ttsEngine: string, edgeVoiceUri: string, voiceUri: string): string {
	if (ttsEngine === 'edge') {
		return edgeVoiceUri || 'vi-VN-HoaiMyNeural';
	}
	return voiceUri;
}

export function resolveChapterMetadata(chapterContext: ReadAloudChapterContext): {
	bookTitle: string;
	chapterTitle: string;
} {
	const bookTitle = chapterContext.bookName || (chapterContext.bookId ? `Truyện #${chapterContext.bookId}` : 'Stories Reader');
	if (chapterContext.chapterTitle) {
		return { bookTitle, chapterTitle: chapterContext.chapterTitle };
	}
	if (chapterContext.chapterNumber) {
		return { bookTitle, chapterTitle: `Chương ${chapterContext.chapterNumber}` };
	}
	if (chapterContext.chapterId) {
		return { bookTitle, chapterTitle: `Chương ${chapterContext.chapterId}` };
	}
	return { bookTitle, chapterTitle: 'Chương đang đọc' };
}

export function executeNativeStreamPlayback(
	ttsEngine: string,
	common: {
		chunks: string[];
		startIndex: number;
		voice: string;
		rate: number;
		gatewayUrl: string;
		bookTitle: string;
		chapterTitle: string;
	},
	edgeBufferMode: EdgeBufferMode,
	isMedia3Mode: boolean,
	media3Utterances: ReadAloudUtterance[],
	startCharIndex: number,
	targetOff: number
): void {
	if (ttsEngine === 'edge') {
		void EdgeTTSNativeStreamService.startPlayback({
			...common,
			pitch: '+0Hz',
			bufferMode: edgeBufferMode,
			...(isMedia3Mode ? { utterances: media3Utterances, startCharIndex, sessionId: `edge-media3-${crypto.randomUUID()}` } : {}),
		});
		return;
	}
	void NativeTTSStreamService.startPlayback({ ...common, pitch: 1.0, startCharIndex: targetOff });
}

export function canQuickResume(isPaused: boolean, targetIndex?: number): boolean {
	return isPaused && targetIndex === undefined;
}

export function resetSpeechSession(
	ownsQueueRef: { current: boolean },
	synth: SpeechSynthesis | null,
	utteranceRef: { current: SpeechSynthesisUtterance | null }
): void {
	if (ownsQueueRef.current && synth) {
		synth.cancel();
	}
	ownsQueueRef.current = false;
	utteranceRef.current = null;
}

export function getBoundedStartPosition(
	chunks: SentenceChunk[],
	currentIdx: number,
	savedPosition: ReadAloudResumePosition | null,
	targetIndex?: number,
	targetOffset?: number,
	onOutOfRange?: () => void
): { index: number; offset: number } {
	const position = resolveReadAloudStart(chunks, currentIdx, savedPosition, targetIndex, targetOffset);
	if (position.index >= chunks.length) {
		onOutOfRange?.();
		return { index: 0, offset: 0 };
	}
	return position;
}

export function scrollToChunkParagraph(chunk: SentenceChunk | undefined): void {
	if (!chunk) return;
	const readerContent = document.querySelector('#main-story-content');
	const pNode = readerContent?.querySelector<HTMLElement>(`article > div[data-paragraph-index="${chunk.pIdx}"]`);
	if (typeof pNode?.scrollIntoView === 'function') {
		pNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
}

export function saveCurrentReadingPosition(
	currentChunkIdx: number,
	totalChunks: number,
	charIndex: number,
	paragraphIndex: number,
	sourceOffset: number,
	saveResume: (chunk: number, char: number, pIdx?: number, srcOff?: number) => void
): void {
	if (currentChunkIdx >= totalChunks) return;
	const safeChar = Math.max(0, charIndex);
	const safePIdx = paragraphIndex >= 0 ? paragraphIndex : undefined;
	const safeSrcOff = charIndex >= 0 ? sourceOffset : undefined;
	saveResume(currentChunkIdx, safeChar, safePIdx, safeSrcOff);
}

export function pauseEngineTransport(
	ttsEngine: string,
	activeNativeStream: ActiveNativeStream,
	gaplessPlayer: GaplessTtsPlayer | null,
	ownsBrowserQueue: boolean,
	synth: SpeechSynthesis | null,
	edgePlayback: { pause: () => void }
): void {
	if (gaplessPlayer) {
		void gaplessPlayer.pause();
	}
	if (activeNativeStream) {
		void activeNativeStream.pause();
		return;
	}
	if (ttsEngine === 'browser' && NativeTTSService.isNative()) {
		void NativeTTSService.stop();
		return;
	}
	if (ttsEngine === 'browser' && ownsBrowserQueue) {
		synth?.pause();
		return;
	}
	if (ttsEngine === 'edge') {
		edgePlayback.pause();
	}
}

export function resumeEngineTransport(params: {
	ttsEngine: string;
	activeNativeStream: ActiveNativeStream;
	gaplessPlayer: GaplessTtsPlayer | null;
	synth: SpeechSynthesis | null;
	edgePlayback: { hasAudio: () => boolean; resume: () => Promise<void> };
	currentChunkIdx: number;
	charIndex: number;
	playChunk: (idx: number, offset?: number) => void;
}): void {
	const { ttsEngine, activeNativeStream, gaplessPlayer, synth, edgePlayback, currentChunkIdx, charIndex, playChunk } = params;
	if (activeNativeStream) {
		void activeNativeStream.resume();
		return;
	}
	if (ttsEngine === 'vieneu' && gaplessPlayer) {
		void gaplessPlayer.resume().catch(() => playChunk(currentChunkIdx));
		return;
	}
	if (ttsEngine === 'browser' && NativeTTSService.isNative()) {
		playChunk(currentChunkIdx, Math.max(0, charIndex));
		return;
	}
	if (ttsEngine === 'browser') {
		synth?.resume();
		return;
	}
	if (ttsEngine === 'edge' && edgePlayback.hasAudio()) {
		void edgePlayback.resume().catch(() => playChunk(currentChunkIdx));
		return;
	}
	playChunk(currentChunkIdx);
}

export function tryStartNativePlayback(params: {
	activeNativeStream: ActiveNativeStream;
	ttsEngine: string;
	chunks: SentenceChunk[];
	targetIdx: number;
	targetOff: number;
	speechRateFallback: number;
	media3Utterances: ReadAloudUtterance[];
	getMedia3UtteranceIndex: (targetIdx: number, sourceOffset?: number) => number;
	edgeVoiceUri: string;
	voiceUri: string;
	chapterContext: ReadAloudChapterContext;
	activeDomainUrl?: string;
	nativePlaybackActiveRef: RefObject<boolean>;
	isPlayingRef: RefObject<boolean>;
	isPausedRef: RefObject<boolean>;
	pendingNativeChunkRef: RefObject<number | null>;
	media3UtteranceIndexRef: RefObject<number>;
	pendingMedia3UtteranceRef: RefObject<number | null>;
	setIsPlaying: (val: boolean) => void;
	setIsLoading: (val: boolean) => void;
}): boolean {
	const {
		activeNativeStream,
		ttsEngine,
		chunks,
		targetIdx,
		targetOff,
		speechRateFallback,
		media3Utterances,
		getMedia3UtteranceIndex,
		edgeVoiceUri,
		voiceUri,
		chapterContext,
		activeDomainUrl,
		nativePlaybackActiveRef,
		isPlayingRef,
		isPausedRef,
		pendingNativeChunkRef,
		media3UtteranceIndexRef,
		pendingMedia3UtteranceRef,
		setIsPlaying,
		setIsLoading,
	} = params;

	if (!activeNativeStream) return false;
	nativePlaybackActiveRef.current = true;
	setIsPlaying(true);
	setIsLoading(true);
	isPlayingRef.current = true;
	isPausedRef.current = false;
	pendingNativeChunkRef.current = null;

	const textChunks = chunks.map((c) => c.text);
	const currentSpeechRate = useReaderConfigStore.getState().speechRate ?? speechRateFallback ?? 1.8;
	const edgeBufferMode = useReaderConfigStore.getState().edgeBufferMode || 'file';
	const isMedia3Mode = ttsEngine === 'edge' && edgeBufferMode === 'media3';

	const { nativeStartIndex, startCharIndex } = calculateNativePlaybackIndices(
		chunks,
		targetIdx,
		targetOff,
		isMedia3Mode,
		media3Utterances,
		getMedia3UtteranceIndex
	);

	media3UtteranceIndexRef.current = nativeStartIndex;
	pendingMedia3UtteranceRef.current = null;
	const targetVoice = resolveTargetVoice(ttsEngine, edgeVoiceUri, voiceUri);
	const { bookTitle, chapterTitle } = resolveChapterMetadata(chapterContext);

	const common = {
		chunks: textChunks,
		startIndex: nativeStartIndex,
		voice: targetVoice,
		rate: currentSpeechRate,
		gatewayUrl: activeDomainUrl || getGatewayBaseUrl(),
		bookTitle,
		chapterTitle,
	};

	executeNativeStreamPlayback(ttsEngine, common, edgeBufferMode, isMedia3Mode, media3Utterances, startCharIndex, targetOff);
	return true;
}
