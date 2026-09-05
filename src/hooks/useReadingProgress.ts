import { useEffect, useRef, useCallback } from 'react';

export interface ReadingState {
  chapterId: string;
  scrollY: number;
  activeChapterId?: string;
  paragraphIndex?: number;
  updatedAt: number;
}

const STORAGE_PREFIX = 'reading_progress_';
const MAX_PROGRESS_ITEMS = 20;

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

/**
 * Custom hook to cleanly persist and auto-restore reading scroll position
 * per book and chapter, preventing unwanted reloads and lost scroll states.
 */
export function useReadingProgress(
  bookId: string | undefined,
  chapterId: string | undefined,
  isContentReady: boolean
) {
  const isRestoredRef = useRef(false);
  const prevChapterIdRef = useRef<string | undefined>(undefined);

  const getStorageKey = useCallback((bId?: string, cId?: string) => {
    if (!bId || !cId) return null;
    return `${STORAGE_PREFIX}${bId}_${cId}`;
  }, []);

  // 1. Reset scroll and clear previous chapter progress on Chapter Change
  useEffect(() => {
    if (!bookId || !chapterId) return;

    if (prevChapterIdRef.current && prevChapterIdRef.current !== chapterId) {
      // Chapter changed! Clean up previous chapter reading progress from localStorage
      const oldKey = getStorageKey(bookId, prevChapterIdRef.current);
      if (oldKey) {
        try {
          localStorage.removeItem(oldKey);
        } catch {
          // Safe fallback
        }
      }

      // Reset scroll to top
      isRestoredRef.current = true;
      if (typeof window !== 'undefined' && window.scrollTo) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    } else if (!prevChapterIdRef.current) {
      isRestoredRef.current = false;
    }

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

        const state: ReadingState = {
          chapterId,
          scrollY: window.scrollY || 0,
          activeChapterId,
          paragraphIndex,
          updatedAt: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(state));
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
        if (savedState.chapterId === chapterId) {
          // Double RAF / setTimeout ensures DOM layout & typography are computed before scrolling
          requestAnimationFrame(() => {
            setTimeout(() => {
              let restoredByElement = false;

              // Priority 1: Restore precision scroll by target paragraph element
              if (savedState.paragraphIndex !== undefined) {
                let selector = `[data-paragraph-index="${savedState.paragraphIndex}"]`;
                if (savedState.activeChapterId) {
                  selector = `#chapter-section-${savedState.activeChapterId} ${selector}`;
                }
                const targetEl = document.querySelector(selector) as HTMLElement | null;
                if (targetEl && typeof targetEl.scrollIntoView === 'function') {
                  targetEl.scrollIntoView({ behavior: 'instant', block: 'start' });
                  // Adjust for sticky header height (~70px)
                  if (window.scrollY > 60) {
                    window.scrollBy({ top: -70, behavior: 'instant' });
                  }

                  // Visual Flash Highlight feedback on restored paragraph for 2 seconds (pure background color, zero text movement)
                  const highlightClasses = [
                    'bg-primary/20',
                    'transition-colors',
                    'duration-500',
                    'rounded-lg',
                  ];
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
              if (!restoredByElement && savedState.scrollY > 0) {
                if (typeof window !== 'undefined' && window.scrollTo) {
                  window.scrollTo({ top: savedState.scrollY, behavior: 'instant' });
                }
              }

              isRestoredRef.current = true;
            }, 100);
          });
          return;
        }
      }
    } catch {
      // Safe fallback
    }

    isRestoredRef.current = true;
  }, [bookId, chapterId, isContentReady, getStorageKey]);
}

