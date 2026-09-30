import { clearReadingProgress } from '../../hooks/useReadingProgress';

export function openChapter(bookId: string, chapterId: string, options?: { resetScroll?: boolean }) {
	if (!bookId || !chapterId) return;

	if (options?.resetScroll && typeof window !== 'undefined' && window.scrollTo) {
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
	}

	const targetHash = `#/book/${bookId}/chapter/${chapterId}`;
	if (typeof window !== 'undefined') {
		if (window.location.hash !== targetHash) {
			window.location.hash = targetHash;
		}
	}
}

/**
 * Cleanly advance to the next chapter:
 * 1. Clear previous chapter's completed progress
 * 2. Clear any stale progress for next chapter
 * 3. Immediately reset window scroll to 0
 * 4. Navigate to next chapter
 */
export function openNextChapter(bookId: string, currentChapterId?: string, nextChapterId?: string) {
	if (!bookId || !nextChapterId) return;

	if (currentChapterId) {
		clearReadingProgress(bookId, currentChapterId);
	}
	clearReadingProgress(bookId, nextChapterId);

	if (typeof window !== 'undefined' && window.scrollTo) {
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
	}

	openChapter(bookId, nextChapterId, { resetScroll: true });
}

/**
 * Cleanly navigate to the previous chapter with scroll reset
 */
export function openPrevChapter(bookId: string, currentChapterId?: string, prevChapterId?: string) {
	if (!bookId || !prevChapterId) return;

	if (typeof window !== 'undefined' && window.scrollTo) {
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
	}

	openChapter(bookId, prevChapterId, { resetScroll: true });
}
