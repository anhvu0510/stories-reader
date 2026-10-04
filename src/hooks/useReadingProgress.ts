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

export const clearReadingProgress = (bookId?: string, chapterId?: string) => {
	if (!bookId || !chapterId) return;
	try {
		localStorage.removeItem(`${STORAGE_PREFIX}${bookId}_${chapterId}`);
	} catch {
		// Safe fallback
	}
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

		if (keys.length > MAX_PROGRESS_ITEMS) {
			const items: { key: string; updatedAt: number }[] = [];
			for (const k of keys) {
				try {
					const raw = localStorage.getItem(k);
					if (raw) {
						const parsed: ReadingState = JSON.parse(raw);
						items.push({ key: k, updatedAt: parsed.updatedAt || 0 });
					} else {
						items.push({ key: k, updatedAt: 0 });
					}
				} catch {
					items.push({ key: k, updatedAt: 0 });
				}
			}

			// Sort ascending (oldest first)
			items.sort((a, b) => a.updatedAt - b.updatedAt);

			// Remove excess oldest items
			const deleteCount = items.length - MAX_PROGRESS_ITEMS;
			for (let i = 0; i < deleteCount; i++) {
				localStorage.removeItem(items[i].key);
			}
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
		const isDifferentChapter = (prevChapterIdRef.current && prevChapterIdRef.current !== chapterId) || (lastActiveChapterKey && lastActiveChapterKey !== currentKey);

		if (isDifferentChapter) {
			const prevCId =
				prevChapterIdRef.current && prevChapterIdRef.current !== chapterId
					? prevChapterIdRef.current
					: lastActiveChapterKey.startsWith(`${bookId}_`)
						? lastActiveChapterKey.replace(`${bookId}_`, '')
						: undefined;

			if (prevCId && prevCId !== chapterId) {
				const oldKey = getStorageKey(bookId, prevCId);
				if (oldKey) {
					try {
						localStorage.removeItem(oldKey);
					} catch {
						// Safe fallback
					}
				}
			}

			// Khi chuyển sang chapter mới trong phiên đọc:
			// Xóa sạch tiến độ cũ của chapter đích để tránh nhảy xuống cuối trang, bắt đầu từ đỉnh 0px
			clearReadingProgress(bookId, chapterId);
			isRestoredRef.current = true;
			if (typeof window !== 'undefined' && window.scrollTo) {
				window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
			}
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

				let activeChapterId: string | undefined;
				let paragraphIndex: number | undefined;

				// Detect current paragraph visible near top of reader viewport (~100px)
				if (typeof document !== 'undefined' && typeof document.elementFromPoint === 'function') {
					const topOffset = 100;
					const x = window.innerWidth / 2;
					const el = document.elementFromPoint(x, topOffset);
					const paraEl = el?.closest('[data-paragraph-index]') as HTMLElement | null;
					if (paraEl) {
						const pIdx = paraEl.getAttribute('data-paragraph-index');
						if (pIdx !== null) {
							paragraphIndex = parseInt(pIdx, 10);
						}
						const sectionEl = paraEl.closest('[data-chapter-id]') as HTMLElement | null;
						if (sectionEl) {
							activeChapterId = sectionEl.getAttribute('data-chapter-id') || undefined;
						}
					}
				}

				const currentY = window.scrollY || 0;
				const totalHeight = typeof document !== 'undefined' ? document.documentElement.scrollHeight - window.innerHeight : 0;
				const isCompleted = totalHeight > 0 && currentY >= totalHeight - 60;

				const state: ReadingState = {
					chapterId,
					scrollY: currentY,
					activeChapterId,
					paragraphIndex,
					isCompleted,
					updatedAt: Date.now()
				};

				localStorage.setItem(key, JSON.stringify(state));

				// In multi-chapter batch mode: calculate relative scrollY against the active chapter's section
				// to prevent giant global scroll offsets from dumping the user at the bottom when reading standalone
				if (activeChapterId && activeChapterId !== chapterId) {
					const activeKey = getStorageKey(bookId, activeChapterId);
					if (activeKey) {
						let relativeY = 0;
						if (typeof document !== 'undefined') {
							const sectionEl = document.getElementById(`chapter-section-${activeChapterId}`);
							if (sectionEl) {
								relativeY = Math.max(0, currentY - sectionEl.offsetTop);
							}
						}
						const activeState: ReadingState = {
							chapterId: activeChapterId,
							scrollY: relativeY,
							activeChapterId,
							paragraphIndex,
							isCompleted: false,
							updatedAt: Date.now()
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
		if (!bookId || !chapterId || !isContentReady || isRestoredRef.current) return;

		const key = getStorageKey(bookId, chapterId);
		if (!key) return;

		try {
			const raw = localStorage.getItem(key);
			if (raw) {
				const savedState: ReadingState = JSON.parse(raw);
				if (savedState.chapterId === chapterId && !savedState.isCompleted) {
					// Double RAF / setTimeout ensures DOM layout & typography are computed before scrolling
					requestAnimationFrame(() => {
						setTimeout(() => {
							let restoredByElement = false;

							// Priority 1: Restore precision scroll by target paragraph element
							if (savedState.paragraphIndex !== undefined && savedState.paragraphIndex > 0) {
								let selector = `[data-paragraph-index="${savedState.paragraphIndex}"]`;
								if (savedState.activeChapterId) {
									selector = `#chapter-section-${savedState.activeChapterId} ${selector}`;
								}
								const targetEl = document.querySelector(selector) as HTMLElement | null;
								if (targetEl && typeof targetEl.scrollIntoView === 'function') {
									targetEl.scrollIntoView({
										behavior: 'instant',
										block: 'start'
									});
									// Adjust for sticky header height (~70px)
									if (window.scrollY > 60) {
										window.scrollBy({ top: -70, behavior: 'instant' });
									}

									// Visual Flash Highlight feedback on restored paragraph for 2 seconds
									const highlightClasses = ['bg-primary/20', 'transition-colors', 'duration-500', 'rounded-lg'];
									targetEl.classList.add(...highlightClasses);
									setTimeout(() => {
										if (targetEl && targetEl.classList) {
											targetEl.classList.remove(...highlightClasses);
										}
									}, 2000);

									restoredByElement = true;
								}
							}

							// Priority 2: Fallback to pixel scrollY position
							if (!restoredByElement && savedState.scrollY > 50) {
								if (typeof window !== 'undefined' && window.scrollTo) {
									window.scrollTo({
										top: savedState.scrollY,
										behavior: 'instant'
									});
								}
								restoredByElement = true;
							}

							if (!restoredByElement) {
								if (typeof window !== 'undefined' && window.scrollTo) {
									window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
								}
							}

							isRestoredRef.current = true;
						}, 80);
					});
					return;
				} else if (savedState.isCompleted) {
					// Chapter was previously completed - start fresh from top and clear stale cache
					clearReadingProgress(bookId, chapterId);
				}
			}
		} catch {
			// Safe fallback
		}

		// Default when no saved state exists or state was completed: Ensure scroll is 0!
		if (typeof window !== 'undefined' && window.scrollTo) {
			window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		}
		isRestoredRef.current = true;
	}, [bookId, chapterId, isContentReady, getStorageKey]);
}
