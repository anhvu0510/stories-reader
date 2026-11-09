import { useEffect, useRef, type RefObject } from 'react';

import { useTTSStore } from '@/features/reader/stores/useTTSStore';
import { DomWordHighlighter } from '@/services/domWordHighlighter';
import { hasNativeReaderGestures } from '@/services/nativeReaderGestures';
import { bindNativeReadingInteraction } from '@/services/nativeReadingInteraction';
import { ReadAloudScrollFollower } from '@/services/readAloudScrollFollower';

import type { SentenceChunk } from '@/services/gaplessTtsPlayer';

const WORD_HIGHLIGHT_CLASS = 'stories-tts-word-highlight';
interface HighlightCursor {
	charIndexRef: RefObject<number>;
	charLengthRef: RefObject<number>;
	sourceOffsetRef: RefObject<number>;
	currentParagraphIndexRef: RefObject<number>;
}
export function useReadAloudHighlight(chunks: SentenceChunk[], cursor: HighlightCursor) {
	const { charIndexRef, charLengthRef, sourceOffsetRef, currentParagraphIndexRef } = cursor;
	const wordHighlighterRef = useRef<DomWordHighlighter | null>(null);
	if (!wordHighlighterRef.current) {
		wordHighlighterRef.current = new DomWordHighlighter(WORD_HIGHLIGHT_CLASS);
	}
	const scrollFollowerRef = useRef<ReadAloudScrollFollower | null>(null);
	if (!scrollFollowerRef.current) {
		scrollFollowerRef.current = new ReadAloudScrollFollower();
	}
	const updateWordHighlight = (chunkIndex: number, nextCharIndex: number, nextCharLength: number) => {
		const highlighter = wordHighlighterRef.current;
		if (!highlighter) return;
		const chunk = chunks[chunkIndex];
		if (!chunk) return;

		const pNode = getParagraphNode(chunk.pIdx);
		if (!pNode) return;

		if (nextCharIndex < 0 || nextCharLength <= 0) {
			// Keep the visual anchor until the next spoken word replaces it.
			charIndexRef.current = Math.max(0, nextCharIndex);
			sourceOffsetRef.current = chunk.startOffset + Math.max(0, nextCharIndex);
			charLengthRef.current = 0;
			return;
		}

		if (
			isSameHighlightPosition(
				useTTSStore.getState().currentParagraphIndex,
				charIndexRef.current,
				charLengthRef.current,
				chunk.pIdx,
				nextCharIndex,
				nextCharLength
			)
		) {
			return;
		}

		const match = extractWordMatch(chunk.text, nextCharIndex, nextCharLength);
		if (!match) return;

		charIndexRef.current = nextCharIndex;
		sourceOffsetRef.current = chunk.startOffset + nextCharIndex;
		charLengthRef.current = nextCharLength;
		useTTSStore.setState({
			currentParagraphIndex: chunk.pIdx,
			currentCharIndex: nextCharIndex,
			currentCharLength: nextCharLength,
		});
		currentParagraphIndexRef.current = chunk.pIdx;

		const geometry = highlighter.highlight(pNode, chunk.startOffset + match.offset, match.length);
		followLineIfChanged(geometry, scrollFollowerRef.current);
	};

	const updateMedia3Highlight = (
		chunkIndex: number,
		paragraphIndex: number,
		sourceStart: number,
		wordCharIndex: number,
		wordCharLength: number
	) => {
		const highlighter = wordHighlighterRef.current;
		if (!highlighter || wordCharIndex < 0) return;
		if (wordCharLength <= 0) {
			// Keep the visual anchor until the next spoken word replaces it.
			charIndexRef.current = sourceStart + wordCharIndex;
			sourceOffsetRef.current = sourceStart + wordCharIndex;
			charLengthRef.current = 0;
			return;
		}
		const paragraphNode = getParagraphNode(paragraphIndex);
		if (!paragraphNode) return;
		const absoluteWordIndex = sourceStart + wordCharIndex;
		if (
			isSameHighlightPosition(
				currentParagraphIndexRef.current,
				charIndexRef.current,
				charLengthRef.current,
				paragraphIndex,
				absoluteWordIndex,
				wordCharLength
			)
		) {
			return;
		}

		currentParagraphIndexRef.current = paragraphIndex;
		charIndexRef.current = absoluteWordIndex;
		sourceOffsetRef.current = absoluteWordIndex;
		charLengthRef.current = wordCharLength;
		useTTSStore.setState({
			currentParagraphIndex: paragraphIndex,
			currentCharIndex: absoluteWordIndex,
			currentCharLength: wordCharLength,
		});
		const geometry = highlighter.highlight(paragraphNode, absoluteWordIndex, wordCharLength);
		followLineIfChanged(geometry, scrollFollowerRef.current);
	};

	useEffect(() => {
		if (hasNativeReaderGestures() && scrollFollowerRef.current) {
			const unsubscribe = bindNativeReadingInteraction(scrollFollowerRef.current, () => {});
			return () => {
				unsubscribe();
				scrollFollowerRef.current?.cancel();
			};
		}
		return bindWebReadingInteraction(scrollFollowerRef);
	}, []);

	return { wordHighlighterRef, scrollFollowerRef, updateWordHighlight, updateMedia3Highlight };
}

function bindWebReadingInteraction(scrollFollowerRef: RefObject<ReadAloudScrollFollower | null>): () => void {
	const onInteraction = () => scrollFollowerRef.current?.notifyUserInteraction();
	const onHold = () => scrollFollowerRef.current?.beginUserInteraction();
	const onRelease = () => scrollFollowerRef.current?.endUserInteraction();
	const onPointerHold = (event: PointerEvent) => {
		if (event.pointerType === 'touch') return;
		onHold();
	};
	const onPointerRelease = (event: PointerEvent) => {
		if (event.pointerType === 'touch') return;
		onRelease();
	};
	const onScroll = () => scrollFollowerRef.current?.notifyViewportScroll();
	const onSelection = () => scrollFollowerRef.current?.notifySelectionChange();
	document.addEventListener('selectionchange', onSelection);
	window.addEventListener('wheel', onInteraction, { passive: true });
	window.addEventListener('touchmove', onInteraction, { passive: true });
	window.addEventListener('touchstart', onHold, { passive: true });
	window.addEventListener('pointerdown', onPointerHold, { passive: true });
	window.addEventListener('pointerup', onPointerRelease, { passive: true });
	window.addEventListener('pointercancel', onPointerRelease, { passive: true });
	window.addEventListener('touchend', onRelease, { passive: true });
	window.addEventListener('touchcancel', onRelease, { passive: true });
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('keydown', onInteraction, { passive: true });
	return () => {
		document.removeEventListener('selectionchange', onSelection);
		window.removeEventListener('wheel', onInteraction);
		window.removeEventListener('touchmove', onInteraction);
		window.removeEventListener('touchstart', onHold);
		window.removeEventListener('pointerdown', onPointerHold);
		window.removeEventListener('pointerup', onPointerRelease);
		window.removeEventListener('pointercancel', onPointerRelease);
		window.removeEventListener('touchend', onRelease);
		window.removeEventListener('touchcancel', onRelease);
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('keydown', onInteraction);
		scrollFollowerRef.current?.cancel();
	};
}

function followLineIfChanged(geometry: ReturnType<DomWordHighlighter['highlight']>, scrollFollower: ReadAloudScrollFollower | null): void {
	if (geometry?.lineChanged && scrollFollower) {
		scrollFollower.follow(geometry.line);
	}
}

function getParagraphNode(paragraphIndex: number): HTMLElement | null {
	const readerContent = document.querySelector('#main-story-content');
	return readerContent?.querySelector<HTMLElement>(`article > div[data-paragraph-index="${paragraphIndex}"]`) ?? null;
}

function isSameHighlightPosition(
	currentPIdx: number,
	currentCharIndex: number,
	currentCharLength: number,
	targetPIdx: number,
	targetCharIndex: number,
	targetCharLength: number
): boolean {
	return currentPIdx === targetPIdx && currentCharIndex === targetCharIndex && currentCharLength === targetCharLength;
}

function extractWordMatch(text: string, charIndex: number, charLength: number): { offset: number; length: number } | null {
	const wordText = text.substring(charIndex, charIndex + charLength);
	const match = wordText.match(/[^\s.,!?:;'"(){}[\]“”‘’\-–—]+/);
	if (!match || match.index === undefined) return null;
	return { offset: charIndex + match.index, length: match[0].length };
}
