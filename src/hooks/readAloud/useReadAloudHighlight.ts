import { useEffect, useRef, type RefObject } from 'react';
import { useTTSStore } from '@/features/reader/stores/useTTSStore';
import { DomWordHighlighter } from '@/services/domWordHighlighter';
import { ReadAloudScrollFollower } from '@/services/readAloudScrollFollower';
import { hasNativeReaderGestures } from '@/services/nativeReaderGestures';
import { bindNativeReadingInteraction } from '@/services/nativeReadingInteraction';
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
		if (!highlighter || !chunks[chunkIndex]) return;

		const readerContent = document.querySelector('#main-story-content');
		if (!readerContent) {
			return;
		}

		const chunk = chunks[chunkIndex];
		const pNode = readerContent.querySelector<HTMLElement>(`article > div[data-paragraph-index="${chunk.pIdx}"]`);
		if (!pNode) {
			return;
		}
		if (nextCharIndex < 0 || nextCharLength <= 0) {
			// Keep the visual anchor until the next spoken word replaces it.
			charIndexRef.current = Math.max(0, nextCharIndex);
			sourceOffsetRef.current = chunk.startOffset + Math.max(0, nextCharIndex);
			charLengthRef.current = 0;
			return;
		}

		if (charIndexRef.current === nextCharIndex && charLengthRef.current === nextCharLength && useTTSStore.getState().currentParagraphIndex === chunk.pIdx) {
			return;
		}

		const wordText = chunk.text.substring(nextCharIndex, nextCharIndex + nextCharLength);
		const match = wordText.match(/[^\s.,!?:;'"(){}[\]“”‘’\-–—]+/);
		if (!match || match.index === undefined) {
			return;
		}

		charIndexRef.current = nextCharIndex;
		sourceOffsetRef.current = chunk.startOffset + nextCharIndex;
		charLengthRef.current = nextCharLength;
		useTTSStore.setState({
			currentParagraphIndex: chunk.pIdx,
			currentCharIndex: nextCharIndex,
			currentCharLength: nextCharLength
		});
		currentParagraphIndexRef.current = chunk.pIdx;

		const offset = nextCharIndex + match.index;
		const geometry = highlighter.highlight(pNode, chunk.startOffset + offset, match[0].length);
		if (geometry?.lineChanged) {
			scrollFollowerRef.current?.follow(geometry.line);
		}
	};

	const updateMedia3Highlight = (chunkIndex: number, paragraphIndex: number, sourceStart: number, wordCharIndex: number, wordCharLength: number) => {
		const highlighter = wordHighlighterRef.current;
		if (!highlighter || wordCharIndex < 0) return;
		if (wordCharLength <= 0) {
			// Keep the visual anchor until the next spoken word replaces it.
			charIndexRef.current = sourceStart + wordCharIndex;
			sourceOffsetRef.current = sourceStart + wordCharIndex;
			charLengthRef.current = 0;
			return;
		}
		const readerContent = document.querySelector('#main-story-content');
		const paragraphNode = readerContent?.querySelector<HTMLElement>(`article > div[data-paragraph-index="${paragraphIndex}"]`);
		if (!paragraphNode) return;
		const absoluteWordIndex = sourceStart + wordCharIndex;
		if (currentParagraphIndexRef.current === paragraphIndex && charIndexRef.current === absoluteWordIndex && charLengthRef.current === wordCharLength) return;

		currentParagraphIndexRef.current = paragraphIndex;
		charIndexRef.current = sourceStart + wordCharIndex;
		sourceOffsetRef.current = sourceStart + wordCharIndex;
		charLengthRef.current = wordCharLength;
		useTTSStore.setState({
			currentParagraphIndex: paragraphIndex,
			currentCharIndex: sourceStart + wordCharIndex,
			currentCharLength: wordCharLength
		});
		const geometry = highlighter.highlight(paragraphNode, absoluteWordIndex, wordCharLength);
		if (geometry?.lineChanged) scrollFollowerRef.current?.follow(geometry.line);
	};

	useEffect(() => {
		const onInteraction = () => {
			scrollFollowerRef.current?.notifyUserInteraction();
		};
		if (hasNativeReaderGestures() && scrollFollowerRef.current) {
			const unsubscribe = bindNativeReadingInteraction(scrollFollowerRef.current, () => {});
			return () => {
				unsubscribe();
				scrollFollowerRef.current?.cancel();
			};
		}
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
	}, []);

	return { wordHighlighterRef, scrollFollowerRef, updateWordHighlight, updateMedia3Highlight };
}
