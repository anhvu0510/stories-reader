import { useEffect, useRef, useCallback } from 'react';

export interface ReadingState {
	chapterId: string;
	scrollY: number;
	activeChapterId?: string;
	paragraphIndex?: number;
	isCompleted?: boolean;
	updatedAt: number;
}

const STORAGE_PREFIX = 'reading_progress_';
const MAX_PROGRESS_ITEMS = 20;

const safeRemoveStorage = (key?: string | null): void => {
	if (!key || typeof window === 'undefined') return;
	try {
		localStorage.removeItem(key);
	} catch (err) {
		console.warn('[ReadingProgress] Remove storage error ignored:', err);
	}
};

const getProgressUpdatedAt = (key: string): number => {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return 0;
		const parsed: ReadingState = JSON.parse(raw);
		return parsed.updatedAt || 0;
	} catch {
		return 0;
	}
};

const detectActiveParagraphAndChapter = (): { paragraphIndex?: number; activeChapterId?: string } => {
	if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') return {};
	const topOffset = 100;
	const x = window.innerWidth / 2;
	const el = document.elementFromPoint(x, topOffset);
	const paraEl = el?.closest('[data-paragraph-index]') as HTMLElement | null;
	if (!paraEl) return {};

	const pIdx = paraEl.getAttribute('data-paragraph-index');
	const paragraphIndex = pIdx === null ? undefined : parseInt(pIdx, 10);
	const sectionEl = paraEl.closest('[data-chapter-id]') as HTMLElement | null;
	const activeChapterId = sectionEl?.getAttribute('data-chapter-id') || undefined;

	return { paragraphIndex, activeChapterId };
};

const getRelativeSectionScrollY = (activeChapterId: string, currentY: number): number => {
	if (typeof document === 'undefined') return 0;
	const sectionEl = document.getElementById(`chapter-section-${activeChapterId}`);
	if (!sectionEl) return 0;
	return Math.max(0, currentY - sectionEl.offsetTop);
};

export const clearReadingProgress = (bookId?: string, chapterId?: string) => {
	if (!bookId || !chapterId) return;
	safeRemoveStorage(`${STORAGE_PREFIX}${bookId}_${chapterId}`);
};

/**
 * Perform LRU garbage collection to prevent localStorage quota issues
 */
const cleanupOldProgress = () => {
	try {
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && key.startsWith(STORAGE_PREFIX)) {
				keys.push(key);
			}
		}

		if (keys.length <= MAX_PROGRESS_ITEMS) return;

		const items = keys.map((k) => ({ key: k, updatedAt: getProgressUpdatedAt(k) }));
		items.sort((a, b) => a.updatedAt - b.updatedAt);

		const deleteCount = items.length - MAX_PROGRESS_ITEMS;
		for (let i = 0; i < deleteCount; i++) {
			safeRemoveStorage(items[i].key);
		}
	} catch {
		// Ignore storage errors safely
	}
};

// Module-level tracking across component unmount/remount in router
let lastActiveChapterKey = '';

export const resetReadingProgressModuleState = () => {
	lastActiveChapterKey = '';
};

/**
 * Custom hook to cleanly persist and auto-restore reading scroll position
 * per book and chapter, preventing unwanted reloads and lost scroll states.
 */
export function useReadingProgress(bookId: string | undefined, chapterId: string | undefined, isContentReady: boolean) {
	const isRestoredRef = useRef(false);
	const prevChapterIdRef = useRef<string | undefined>(chapterId);

	const getStorageKey = useCallback((bId?: string, cId?: string) => {
		if (!bId || !cId) return null;
		return `${STORAGE_PREFIX}${bId}_${cId}`;
	}, []);

	// 1. Reset scroll and clear previous chapter progress on Chapter Change
	useEffect(() => {
		if (!bookId || !chapterId) return;

		const currentKey = `${bookId}_${chapterId}`;
		if (checkIsDifferentChapter(prevChapterIdRef.current, chapterId, lastActiveChapterKey, currentKey)) {
			const prevCId = getPreviousChapterId(prevChapterIdRef.current, chapterId, lastActiveChapterKey, bookId);
			if (prevCId && prevCId !== chapterId) {
				safeRemoveStorage(getStorageKey(bookId, prevCId));
			}

			/*
			 * Khi chuyển sang chapter mới trong phiên đọc:
			 * Xóa sạch tiến độ cũ của chapter đích để tránh nhảy xuống cuối trang, bắt đầu từ đỉnh 0px
			 */
			clearReadingProgress(bookId, chapterId);
			isRestoredRef.current = true;
			scrollToTopInstant();
		}

		lastActiveChapterKey = currentKey;
		prevChapterIdRef.current = chapterId;
	}, [bookId, chapterId, getStorageKey]);

	// 2. Continuously track scroll & flush to localStorage when tab becomes hidden
	useEffect(() => {
		if (!bookId || !chapterId || !isContentReady) return;

		const key = getStorageKey(bookId, chapterId);
		if (!key) return;

		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const saveCurrentProgress = () => {
			try {
				// Do not overwrite progress until restoration has completed
				if (!isRestoredRef.current) return;

				const { paragraphIndex, activeChapterId } = detectActiveParagraphAndChapter();

				const currentY = window.scrollY || 0;
				const totalHeight = typeof document === 'undefined' ? 0 : document.documentElement.scrollHeight - window.innerHeight;
				const isCompleted = totalHeight > 0 && currentY >= totalHeight - 60;

				const state: ReadingState = {
					chapterId,
					scrollY: currentY,
					activeChapterId,
					paragraphIndex,
					isCompleted,
					updatedAt: Date.now(),
				};

				localStorage.setItem(key, JSON.stringify(state));

				/*
				 * In multi-chapter batch mode: calculate relative scrollY against the active chapter's section
				 * to prevent giant global scroll offsets from dumping the user at the bottom when reading standalone
				 */
				if (activeChapterId && activeChapterId !== chapterId) {
					const activeKey = getStorageKey(bookId, activeChapterId);
					if (activeKey) {
						const relativeY = getRelativeSectionScrollY(activeChapterId, currentY);
						const activeState: ReadingState = {
							chapterId: activeChapterId,
							scrollY: relativeY,
							activeChapterId,
							paragraphIndex,
							isCompleted: false,
							updatedAt: Date.now(),
						};
						localStorage.setItem(activeKey, JSON.stringify(activeState));
					}
				}

				cleanupOldProgress();
			} catch {
				// Safe fallback
			}
		};

		// Debounced scroll listener (300ms)
		const handleScroll = () => {
			if (timeoutId) clearTimeout(timeoutId);
			timeoutId = setTimeout(saveCurrentProgress, 300);
		};

		// Flush immediately when browser tab goes background / hidden
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				saveCurrentProgress();
			}
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			if (timeoutId) clearTimeout(timeoutId);
			window.removeEventListener('scroll', handleScroll);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, [bookId, chapterId, isContentReady, getStorageKey]);

	// 3. Auto-restore scroll position upon tab reload / content ready
	useEffect(() => {
		if (shouldSkipRestoration(bookId, chapterId, isContentReady, isRestoredRef.current)) return;

		const key = getStorageKey(bookId, chapterId);
		if (!key) return;

		const savedState = loadSavedReadingState(key);
		if (isValidResumeState(savedState, chapterId as string)) {
			// Double RAF / setTimeout ensures DOM layout & typography are computed before scrolling
			requestAnimationFrame(() => {
				setTimeout(() => {
					restoreSavedScrollPosition(savedState as ReadingState);
					isRestoredRef.current = true;
				}, 80);
			});
			return;
		}

		if (savedState?.isCompleted) {
			// Chapter was previously completed - start fresh from top and clear stale cache
			clearReadingProgress(bookId, chapterId);
		}

		// Default when no saved state exists or state was completed: Ensure scroll is 0!
		scrollToTopInstant();
		isRestoredRef.current = true;
	}, [bookId, chapterId, isContentReady, getStorageKey]);
}

function shouldSkipRestoration(bookId?: string, chapterId?: string, isContentReady?: boolean, isRestored?: boolean): boolean {
	return !bookId || !chapterId || !isContentReady || Boolean(isRestored);
}

function isValidResumeState(savedState: ReadingState | null, chapterId: string): boolean {
	return Boolean(savedState && savedState.chapterId === chapterId && !savedState.isCompleted);
}

function scrollToTopInstant(): void {
	if (typeof window !== 'undefined' && window.scrollTo) {
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
	}
}

function checkIsDifferentChapter(
	prevChapterId: string | undefined,
	currentChapterId: string,
	lastKey: string,
	currentKey: string
): boolean {
	const prevChanged = Boolean(prevChapterId && prevChapterId !== currentChapterId);
	const keyChanged = Boolean(lastKey && lastKey !== currentKey);
	return prevChanged || keyChanged;
}

function getPreviousChapterId(
	prevChapterId: string | undefined,
	currentChapterId: string,
	lastKey: string,
	bookId: string
): string | undefined {
	if (prevChapterId && prevChapterId !== currentChapterId) {
		return prevChapterId;
	}
	if (lastKey.startsWith(`${bookId}_`)) {
		return lastKey.replace(`${bookId}_`, '');
	}
	return undefined;
}

function loadSavedReadingState(key: string): ReadingState | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function flashParagraphHighlight(targetEl: HTMLElement): void {
	const highlightClasses = ['bg-primary/20', 'transition-colors', 'duration-500', 'rounded-lg'];
	targetEl.classList.add(...highlightClasses);
	setTimeout(() => {
		if (targetEl && targetEl.classList) {
			targetEl.classList.remove(...highlightClasses);
		}
	}, 2000);
}

function restoreByParagraphElement(paragraphIndex: number, activeChapterId?: string): boolean {
	let selector = `[data-paragraph-index="${paragraphIndex}"]`;
	if (activeChapterId) {
		selector = `#chapter-section-${activeChapterId} ${selector}`;
	}
	const targetEl = document.querySelector(selector) as HTMLElement | null;
	if (!targetEl || typeof targetEl.scrollIntoView !== 'function') return false;

	targetEl.scrollIntoView({ behavior: 'instant', block: 'start' });
	if (window.scrollY > 60) {
		window.scrollBy({ top: -70, behavior: 'instant' });
	}

	flashParagraphHighlight(targetEl);
	return true;
}

function restoreSavedScrollPosition(savedState: ReadingState): void {
	if (savedState.paragraphIndex !== undefined && savedState.paragraphIndex > 0) {
		if (restoreByParagraphElement(savedState.paragraphIndex, savedState.activeChapterId)) {
			return;
		}
	}

	if (savedState.scrollY > 50) {
		if (typeof window !== 'undefined' && window.scrollTo) {
			window.scrollTo({ top: savedState.scrollY, behavior: 'instant' });
			return;
		}
	}

	scrollToTopInstant();
}
