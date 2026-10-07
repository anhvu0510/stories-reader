import type { RefObject } from 'react';
import type { SentenceChunk } from '@/services/gaplessTtsPlayer';
import { NativeTTSService } from '@/services/nativeTtsService';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import type { DomWordHighlighter } from '@/services/domWordHighlighter';

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
	const {
		chunks,
		synth,
		voiceUri,
		speechRateRef,
		isPlayingRef,
		isPausedRef,
		playSessionIdRef,
		currentChunkIdxRef,
		charIndexRef,
		charLengthRef,
		utteranceRef,
		ownsBrowserSpeechQueueRef,
		wordHighlighterRef,
		setCurrentChunkIndex,
		setIsLoading,
		setIsPlaying,
		clearResumePosition,
		stopReading,
		updateWordHighlight,
		playChunk
	} = options;
	const playNativeChunk = (index: number, startOffset: number, sessionId: number) => {
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

		const chunk = chunks[index];
		const textToSpeak = startOffset > 0 ? chunk.text.substring(startOffset) : chunk.text;

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
				if (index >= chunks.length - 1) {
					clearResumePosition();
				}
				if (isPlayingRef.current && !isPausedRef.current) {
					playChunk(index + 1, 0);
				}
			},
			onError: (err) => {
				if (playSessionIdRef.current !== sessionId) return;
				console.warn('[NativeTTS] Playback error:', err);
				if (isPlayingRef.current && !isPausedRef.current) {
					playChunk(index + 1, 0);
				}
			}
		}).catch((err) => {
			if (playSessionIdRef.current !== sessionId) return;
			console.warn('[NativeTTS] Speak exception:', err);
			if (isPlayingRef.current && !isPausedRef.current) {
				playChunk(index + 1, 0);
			}
		});
	};

	const playChunkViaBrowser = (index: number, startOffset: number = 0, sessionId: number) => {
		if (NativeTTSService.isNative()) return playNativeChunk(index, startOffset, sessionId);

		if (!synth || !isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
		if (index >= chunks.length) {
			stopReading();
			return;
		}

		currentChunkIdxRef.current = index;
		setCurrentChunkIndex(index);
		charIndexRef.current = startOffset;
		charLengthRef.current = 0;
		wordHighlighterRef.current?.clear();

		const chunk = chunks[index];
		const textToSpeak = startOffset > 0 ? chunk.text.substring(startOffset) : chunk.text;

		if (!textToSpeak.trim()) {
			playChunkViaBrowser(index + 1, 0, sessionId);
			return;
		}

		const utterance = new SpeechSynthesisUtterance(textToSpeak);
		utterance.rate = useReaderConfigStore.getState().speechRate ?? speechRateRef.current ?? 1.8;

		const voices = synth.getVoices();
		const selectedVoice = voices.find((v) => v.voiceURI === voiceUri || v.name === voiceUri);
		if (selectedVoice) {
			utterance.voice = selectedVoice;
		}

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

		utteranceRef.current = utterance;
		ownsBrowserSpeechQueueRef.current = true;
		synth.speak(utterance);
	};

	return playChunkViaBrowser;
}

function wordLength(text: string, offset: number, reportedLength: number): number {
	if (reportedLength > 0) return reportedLength;
	const remaining = text.slice(offset);
	const delimiter = remaining.search(/[\s.,!?:;'"(){}[\]“”‘’\-–—]/);
	return delimiter > 0 ? delimiter : Math.min(remaining.length, 6);
}
