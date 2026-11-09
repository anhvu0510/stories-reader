import { NativeTTSService } from '@/services/nativeTtsService';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

import type { DomWordHighlighter } from '@/services/domWordHighlighter';
import type { SentenceChunk } from '@/services/gaplessTtsPlayer';
import type { RefObject } from 'react';

interface BrowserSpeechOptions {
	chunks: SentenceChunk[];
	synth: SpeechSynthesis | null;
	voiceUri: string;
	speechRateRef: RefObject<number>;
	isPlayingRef: RefObject<boolean>;
	isPausedRef: RefObject<boolean>;
	playSessionIdRef: RefObject<number>;
	currentChunkIdxRef: RefObject<number>;
	charIndexRef: RefObject<number>;
	charLengthRef: RefObject<number>;
	utteranceRef: RefObject<SpeechSynthesisUtterance | null>;
	ownsBrowserSpeechQueueRef: RefObject<boolean>;
	wordHighlighterRef: RefObject<DomWordHighlighter | null>;
	setCurrentChunkIndex: (index: number) => void;
	setIsLoading: (value: boolean) => void;
	setIsPlaying: (value: boolean) => void;
	clearResumePosition: () => void;
	stopReading: (clear?: boolean) => void;
	updateWordHighlight: (index: number, offset: number, length: number) => void;
	playChunk: (index: number, offset: number) => void;
}
export function createBrowserSpeechPlayback(options: BrowserSpeechOptions) {
	const playNativeChunk = (
		index: number,
		startOffset: number,
		sessionId: number,
		playChunkViaBrowser: (idx: number, offset: number, sId: number) => void
	) => {
		const {
			chunks,
			voiceUri,
			speechRateRef,
			isPlayingRef,
			isPausedRef,
			playSessionIdRef,
			currentChunkIdxRef,
			charIndexRef,
			charLengthRef,
			wordHighlighterRef,
			setCurrentChunkIndex,
			setIsLoading,
			setIsPlaying,
			clearResumePosition,
			stopReading,
			updateWordHighlight,
			playChunk,
		} = options;
		if (!isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
		if (index >= chunks.length) {
			clearResumePosition();
			stopReading(true);
			return;
		}

		currentChunkIdxRef.current = index;
		setCurrentChunkIndex(index);
		charIndexRef.current = startOffset;
		charLengthRef.current = 0;
		wordHighlighterRef.current?.clear();

		const textToSpeak = getChunkText(chunks[index], startOffset);
		if (!textToSpeak.trim()) {
			playChunkViaBrowser(index + 1, 0, sessionId);
			return;
		}

		const currentSpeechRate = useReaderConfigStore.getState().speechRate ?? speechRateRef.current ?? 1.8;
		NativeTTSService.speak({
			text: textToSpeak,
			voice: voiceUri,
			rate: currentSpeechRate,
			utteranceId: `${sessionId}-${index}`,
			onStart: () => {
				if (playSessionIdRef.current === sessionId && isPlayingRef.current) {
					setIsLoading(false);
					setIsPlaying(true);
				}
			},
			onRangeStart: (start, end) => {
				if (playSessionIdRef.current !== sessionId) return;
				updateWordHighlight(index, startOffset + start, wordLength(textToSpeak, start, end - start));
			},
			onDone: () => {
				if (playSessionIdRef.current !== sessionId) return;
				if (index >= chunks.length - 1) clearResumePosition();
				if (isPlayingRef.current && !isPausedRef.current) playChunk(index + 1, 0);
			},
			onError: (err) => {
				if (playSessionIdRef.current !== sessionId) return;
				console.warn('[NativeTTS] Playback error:', err);
				if (isPlayingRef.current && !isPausedRef.current) playChunk(index + 1, 0);
			},
		}).catch((err) => {
			if (playSessionIdRef.current !== sessionId) return;
			console.warn('[NativeTTS] Speak exception:', err);
			if (isPlayingRef.current && !isPausedRef.current) playChunk(index + 1, 0);
		});
	};

	const playChunkViaBrowser = (index: number, startOffset: number = 0, sessionId: number) => {
		if (NativeTTSService.isNative()) return playNativeChunk(index, startOffset, sessionId, playChunkViaBrowser);
		const {
			chunks,
			synth,
			voiceUri,
			speechRateRef,
			isPlayingRef,
			playSessionIdRef,
			currentChunkIdxRef,
			charIndexRef,
			charLengthRef,
			utteranceRef,
			ownsBrowserSpeechQueueRef,
			wordHighlighterRef,
			setCurrentChunkIndex,
			stopReading,
		} = options;
		if (shouldAbortBrowserPlayback(synth, isPlayingRef.current, playSessionIdRef.current, sessionId)) return;
		if (index >= chunks.length) {
			stopReading();
			return;
		}

		currentChunkIdxRef.current = index;
		setCurrentChunkIndex(index);
		charIndexRef.current = startOffset;
		charLengthRef.current = 0;
		wordHighlighterRef.current?.clear();

		const textToSpeak = getChunkText(chunks[index], startOffset);
		if (!textToSpeak.trim()) {
			playChunkViaBrowser(index + 1, 0, sessionId);
			return;
		}

		const utterance = createBrowserUtterance(synth!, textToSpeak, voiceUri, speechRateRef.current ?? 1.8);
		bindBrowserUtteranceCallbacks(utterance, options, index, startOffset, sessionId, textToSpeak);

		utteranceRef.current = utterance;
		ownsBrowserSpeechQueueRef.current = true;
		synth!.speak(utterance);
	};

	return playChunkViaBrowser;
}

function bindBrowserUtteranceCallbacks(
	utterance: SpeechSynthesisUtterance,
	options: BrowserSpeechOptions,
	index: number,
	startOffset: number,
	sessionId: number,
	textToSpeak: string
): void {
	const {
		playSessionIdRef,
		isPlayingRef,
		isPausedRef,
		utteranceRef,
		ownsBrowserSpeechQueueRef,
		setIsLoading,
		setIsPlaying,
		updateWordHighlight,
		playChunk,
	} = options;

	utterance.onstart = () => {
		if (playSessionIdRef.current === sessionId && isPlayingRef.current) {
			setIsLoading(false);
			setIsPlaying(true);
		}
	};

	utterance.onboundary = (event) => {
		if (playSessionIdRef.current !== sessionId || event.name !== 'word') return;
		updateWordHighlight(index, startOffset + event.charIndex, wordLength(textToSpeak, event.charIndex, event.charLength || 0));
	};

	utterance.onend = () => {
		if (playSessionIdRef.current !== sessionId) return;
		if (utteranceRef.current === utterance) {
			utteranceRef.current = null;
			ownsBrowserSpeechQueueRef.current = false;
		}
		if (isPlayingRef.current && !isPausedRef.current) {
			playChunk(index + 1, 0);
		}
	};

	utterance.onerror = (e) => {
		if (playSessionIdRef.current !== sessionId) return;
		if (utteranceRef.current === utterance) {
			utteranceRef.current = null;
			ownsBrowserSpeechQueueRef.current = false;
		}
		if (e.error === 'canceled') return;
		console.warn('Browser SpeechSynthesis error:', e.error);
		if (isPlayingRef.current && !isPausedRef.current) {
			playChunk(index + 1, 0);
		}
	};
}

function wordLength(text: string, offset: number, reportedLength: number): number {
	if (reportedLength > 0) return reportedLength;
	const remaining = text.slice(offset);
	const delimiter = remaining.search(/[\s.,!?:;'"(){}[\]“”‘’\-–—]/);
	return delimiter > 0 ? delimiter : Math.min(remaining.length, 6);
}

function shouldAbortBrowserPlayback(
	synth: SpeechSynthesis | null,
	isPlaying: boolean,
	currentSessionId: number,
	sessionId: number
): boolean {
	return !synth || !isPlaying || currentSessionId !== sessionId;
}

function getChunkText(chunk: SentenceChunk, startOffset: number): string {
	return startOffset > 0 ? chunk.text.substring(startOffset) : chunk.text;
}

function createBrowserUtterance(synth: SpeechSynthesis, text: string, voiceUri: string, defaultRate: number): SpeechSynthesisUtterance {
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.rate = useReaderConfigStore.getState().speechRate ?? defaultRate;
	const selectedVoice = synth.getVoices().find((v) => v.voiceURI === voiceUri || v.name === voiceUri);
	if (selectedVoice) {
		utterance.voice = selectedVoice;
	}
	return utterance;
}
