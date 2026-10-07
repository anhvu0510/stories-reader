import type { RefObject } from 'react';
import { GaplessTtsPlayer, WebAudioPlaybackEngine, type SentenceChunk } from '@/services/gaplessTtsPlayer';
import { TTSService, type VieNeuRequestContext } from '@/services/ttsService';
import type { ReadAloudChapterContext } from '../useReadAloud';
import type { useVieNeuReadingConfig } from './useVieNeuReadingConfig';
import type { useReadAloudPlan } from './useReadAloudPlan';

interface VieNeuPlaybackOptions extends ReturnType<typeof useVieNeuReadingConfig> {
	chunks: ReturnType<typeof useReadAloudPlan>['chunks'];
	voiceUri: string;
	speechRate: number;
	chapterContext: ReadAloudChapterContext;
	paragraphContexts: ReadAloudChapterContext[];
	segmentMetadata: ReturnType<typeof useReadAloudPlan>['segmentMetadata'];
	isPlayingRef: RefObject<boolean>;
	playSessionIdRef: RefObject<number>;
	currentChunkIdxRef: RefObject<number>;
	gaplessPlayerRef: RefObject<GaplessTtsPlayer | null>;
	setCurrentChunkIndex: (index: number) => void;
	setIsLoading: (value: boolean) => void;
	setIsPlaying: (value: boolean) => void;
	stopReading: () => void;
	stopAudioPlayer: () => void;
	updateWordHighlight: (index: number, offset: number, length: number) => void;
	playChunkViaBrowser: (index: number, offset: number, session: number) => void;
}
export function createVieNeuPlayback(options: VieNeuPlaybackOptions) {
	const {
		chunks,
		voiceUri,
		speechRate,
		chapterContext,
		paragraphContexts,
		segmentMetadata,
		isPlayingRef,
		playSessionIdRef,
		currentChunkIdxRef,
		gaplessPlayerRef,
		setCurrentChunkIndex,
		setIsLoading,
		setIsPlaying,
		stopReading,
		stopAudioPlayer,
		updateWordHighlight,
		playChunkViaBrowser,
		vieneuServerUrl,
		vieneuModel,
		getVieneuOptionsForSegment
	} = options;
	const playChunkViaVieNeu = (index: number, sessionId: number, startOffset: number = 0) => {
		if (!isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
		if (index >= chunks.length) {
			stopReading();
			return;
		}

		const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextConstructor) {
			console.warn('Web Audio API is unavailable, falling back to browser voice.');
			playChunkViaBrowser(index, startOffset, sessionId);
			return;
		}

		stopAudioPlayer();
		const audioContext = new AudioContextConstructor();
		const activeVoice = voiceUri || undefined;
		// WebAudio's native playbackRate changes pitch (especially at 1.6x–2x),
		// so let VieNeu apply the rate and keep the PCM player at neutral speed.
		// A true FE-only speed change needs an AudioWorklet time-stretcher.
		const vieneuSynthesisSpeed = speechRate;
		const requestContextForSegment = (segment: SentenceChunk): VieNeuRequestContext => {
			const absoluteIndex = (segment as SentenceChunk & { sentenceStartIndex?: number }).sentenceStartIndex ?? index;
			const metadata = segmentMetadata[absoluteIndex];
			const context = metadata?.context || chapterContext;
			return {
				book_id: context.bookId,
				chapter_id: context.chapterId,
				chapter_number: context.chapterNumber,
				segment_index: metadata?.segmentIndex ?? absoluteIndex,
				segment_count: metadata?.segmentCount ?? chunks.length,
				is_final_segment: (metadata?.segmentIndex ?? absoluteIndex) === (metadata?.segmentCount ?? chunks.length) - 1
			};
		};
		const hasChapterContext = Boolean(chapterContext.bookId && chapterContext.chapterId) || paragraphContexts.some((context) => context.bookId && context.chapterId);
		let activeIndex = index;
		const player = new GaplessTtsPlayer({
			engine: new WebAudioPlaybackEngine(audioContext, 1.0),
			speechRate,
			synthesize: (segment, signal) => {
				const args = [segment.text, activeVoice, vieneuSynthesisSpeed, vieneuServerUrl, signal, vieneuModel, getVieneuOptionsForSegment(segment.text)] as const;
				return hasChapterContext ? TTSService.synthesizeSpeech(...args, requestContextForSegment(segment)) : TTSService.synthesizeSpeech(...args);
			},
			stream: (segment, signal) => {
				const args = [segment.text, activeVoice, vieneuSynthesisSpeed, vieneuServerUrl, signal, vieneuModel, getVieneuOptionsForSegment(segment.text)] as const;
				return hasChapterContext ? TTSService.streamSpeech(...args, requestContextForSegment(segment)) : TTSService.streamSpeech(...args);
			},
			// Warm the complete next source paragraph while the current one plays.
			// This avoids waiting on sentence 2+ without issuing requests for the
			// entire chapter at startup. The second paragraph provides a safety
			// buffer when this private VPS has a transiently slower inference turn.
			prefetchByParagraph: true,
			prefetchParagraphsAhead: 2
		});
		gaplessPlayerRef.current = player;

		const targetChunks = chunks.slice(index);
		if (startOffset > 0 && targetChunks.length > 0) {
			const first = targetChunks[0];
			const partialText = first.text.substring(startOffset);
			targetChunks[0] = {
				...first,
				text: partialText,
				startOffset: first.startOffset + startOffset,
				length: partialText.length
			};
		}

		player.start(targetChunks, {
			onSegmentStart: (relativeIndex) => {
				if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
				setIsLoading(false);
				setIsPlaying(true);
				activeIndex = index + relativeIndex;
			},
			onWordBoundary: (relativeIndex, _segment, cue) => {
				if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;
				setIsLoading(false);
				setIsPlaying(true);
				activeIndex = index + relativeIndex;
				if (currentChunkIdxRef.current !== activeIndex) {
					currentChunkIdxRef.current = activeIndex;
					setCurrentChunkIndex(activeIndex);
				}
				const baseOffset = relativeIndex === 0 ? startOffset : 0;
				updateWordHighlight(activeIndex, cue.charIndex + baseOffset, cue.charLength);
			},
			onFinished: () => {
				if (playSessionIdRef.current !== sessionId) return;
				gaplessPlayerRef.current = null;
				void player.dispose();
				stopReading();
			},
			onError: (error: unknown) => {
				if (playSessionIdRef.current !== sessionId) return;
				console.warn('VieNeu TTS playback failed, falling back to browser voice:', error);
				gaplessPlayerRef.current = null;
				void player.dispose();
				playChunkViaBrowser(activeIndex, 0, sessionId);
			}
		});
	};

	return playChunkViaVieNeu;
}
