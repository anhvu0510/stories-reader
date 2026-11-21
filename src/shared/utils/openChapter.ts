import { clearReadingProgress } from '@/hooks/useReadingProgress';
import { useAppStore } from '@/stores/useAppStore';

export interface OpenChapterOptions {
	resetScroll?: boolean;
	forceReload?: boolean;
}

export function reloadCurrentPage() {
	if (typeof window === 'undefined' || typeof window.location?.reload !== 'function') return;

	try {
		window.location.reload();
	} catch {
		// Bỏ qua lỗi reload trong môi trường test
	}
}

function updateTargetHashForReload(targetHash: string) {
	if (window.location.hash === targetHash) return;
	// Dùng pushState để đổi URL mà không kích hoạt hashchange/SPA re-render trước khi reload
	if (typeof window.history?.pushState === 'function') {
		window.history.pushState(null, '', targetHash);
		return;
	}
	window.location.hash = targetHash;
}

export function openChapter(bookId: string, chapterId: string, options?: OpenChapterOptions) {
	if (!bookId || !chapterId) return;

	if (typeof window === 'undefined') return;

	const targetHash = `#/book/${bookId}/chapter/${chapterId}`;
	const shouldForceReload = options?.forceReload !== false;

	if (shouldForceReload) {
		updateTargetHashForReload(targetHash);
		useAppStore.getState().incrementApiLoading();
		reloadCurrentPage();
		return;
	}

	if (options?.resetScroll && window.scrollTo) {
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
	}

	if (window.location.hash !== targetHash) {
		window.location.hash = targetHash;
	}
}

/**
 * Cleanly advance to the next chapter:
 * 1. Clear previous chapter's completed progress
 * 2. Clear any stale progress for next chapter
 * 3. Navigate to next chapter URL without firing hashchange and force reload to clear old cache
 */
export function openNextChapter(bookId: string, currentChapterId?: string, nextChapterId?: string) {
	if (!bookId || !nextChapterId) return;

	if (currentChapterId) {
		clearReadingProgress(bookId, currentChapterId);
	}
	clearReadingProgress(bookId, nextChapterId);

	openChapter(bookId, nextChapterId, { resetScroll: true, forceReload: true });
}

/**
 * Cleanly navigate to the previous chapter with force reload
 */
export function openPrevChapter(bookId: string, currentChapterId?: string, prevChapterId?: string) {
	if (!bookId || !prevChapterId) return;

	openChapter(bookId, prevChapterId, { resetScroll: true, forceReload: true });
}
