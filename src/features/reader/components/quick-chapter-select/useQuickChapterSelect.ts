import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { ChapterRepository } from '@/repositories/ChapterRepository';
import { openChapter } from '@/shared/utils/openChapter';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

import type { Chapter } from '@/shared/types';
import type React from 'react';

function computeInitialChapterRange(currentChapterNumber: number | undefined, limit: number) {
	if (!currentChapterNumber) {
		return { start: 1, end: undefined };
	}
	return {
		start: Math.max(1, currentChapterNumber - 5),
		end: currentChapterNumber + limit,
	};
}

function getChapterExtremes(newChapters: Chapter[], limit: number, isSearch: boolean) {
	const min = Math.min(...newChapters.map((c) => c.chapterNumber));
	const max = Math.max(...newChapters.map((c) => c.chapterNumber));
	return {
		min,
		max,
		hasMoreTop: !isSearch && min > 1,
		hasMoreBottom: newChapters.length >= limit,
	};
}

function mergeAppendedChapters(prev: Chapter[], incoming: Chapter[]): Chapter[] {
	const existingIds = new Set(prev.map((c) => c.chapterId));
	const uniqueNew = incoming.filter((c) => !existingIds.has(c.chapterId));
	return [...prev, ...uniqueNew];
}

function mergePrependedChapters(prev: Chapter[], incoming: Chapter[]): Chapter[] {
	const existingIds = new Set(prev.map((c) => c.chapterId));
	const uniqueNew = incoming.filter((c) => !existingIds.has(c.chapterId));
	return [...uniqueNew, ...prev];
}

async function queryChapterSlice(
	bookId: string,
	limit: number,
	searchQuery: string,
	startChapter?: number,
	endChapter?: number
): Promise<Chapter[]> {
	const res = await ChapterRepository.getChapters(bookId, 1, limit, 'chapterNumber', 'ASC', 'all', searchQuery, startChapter, endChapter);
	return res.chapters || [];
}

function useBodyScrollLock() {
	useEffect(() => {
		if (typeof document === 'undefined') return;
		const originalBodyOverflow = document.body.style.overflow;
		const originalHtmlOverflow = document.documentElement.style.overflow;

		document.body.style.overflow = 'hidden';
		document.documentElement.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = originalBodyOverflow;
			document.documentElement.style.overflow = originalHtmlOverflow;
		};
	}, []);
}

interface ScrollCompensationOptions {
	chapters: Chapter[];
	loading: boolean;
	loadingTop: boolean;
	hasMoreTop: boolean;
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	activeItemRef: React.RefObject<HTMLDivElement | null>;
	isInitialScrollDoneRef: React.MutableRefObject<boolean>;
	pendingPrependScrollRef: React.MutableRefObject<{ prevHeight: number; prevTop: number } | null>;
	lastScrollTopRef: React.MutableRefObject<number>;
	fetchPrevTopPageRef: React.MutableRefObject<() => Promise<void>>;
}

function useQuickChapterScrollEffects({
	chapters,
	loading,
	loadingTop,
	hasMoreTop,
	scrollContainerRef,
	activeItemRef,
	isInitialScrollDoneRef,
	pendingPrependScrollRef,
	lastScrollTopRef,
	fetchPrevTopPageRef,
}: ScrollCompensationOptions) {
	useEffect(() => {
		if (loading || loadingTop || !hasMoreTop || !isInitialScrollDoneRef.current || !scrollContainerRef.current) return;
		const { scrollHeight, clientHeight } = scrollContainerRef.current;
		if (scrollHeight > 0 && scrollHeight <= clientHeight + 50) {
			fetchPrevTopPageRef.current();
		}
	}, [loading, loadingTop, hasMoreTop, chapters.length, isInitialScrollDoneRef, scrollContainerRef, fetchPrevTopPageRef]);

	const scrollToActive = useCallback(() => {
		if (!activeItemRef.current || !scrollContainerRef.current) return;
		const container = scrollContainerRef.current;
		const activeEl = activeItemRef.current;
		const targetScrollTop = Math.max(0, activeEl.offsetTop - container.clientHeight / 3);
		container.scrollTop = targetScrollTop;
		lastScrollTopRef.current = targetScrollTop;
	}, [activeItemRef, scrollContainerRef, lastScrollTopRef]);

	useLayoutEffect(() => {
		if (!pendingPrependScrollRef.current || !scrollContainerRef.current) return;
		const { prevHeight, prevTop } = pendingPrependScrollRef.current;
		pendingPrependScrollRef.current = null;
		const newHeight = scrollContainerRef.current.scrollHeight;
		const diff = newHeight - prevHeight;
		if (diff > 0) {
			scrollContainerRef.current.scrollTop = prevTop + diff;
			lastScrollTopRef.current = prevTop + diff;
		}
	}, [chapters, pendingPrependScrollRef, scrollContainerRef, lastScrollTopRef]);

	useLayoutEffect(() => {
		if (loading || chapters.length === 0 || isInitialScrollDoneRef.current) return;
		requestAnimationFrame(() => {
			scrollToActive();
			setTimeout(() => {
				isInitialScrollDoneRef.current = true;
			}, 100);
		});
	}, [loading, chapters, scrollToActive, isInitialScrollDoneRef]);
}

interface BoundsState {
	min: number;
	max: number;
	hasMoreTop: boolean;
	hasMoreBottom: boolean;
}

async function runNextBottomFetch(
	bookId: string,
	limit: number,
	search: string,
	max: number,
	setChapters: React.Dispatch<React.SetStateAction<Chapter[]>>,
	setBounds: React.Dispatch<React.SetStateAction<BoundsState>>
) {
	const newChapters = await queryChapterSlice(bookId, limit, search, max + 1);
	if (newChapters.length === 0) {
		setBounds((prev) => ({ ...prev, hasMoreBottom: false }));
		return;
	}
	setChapters((prev) => mergeAppendedChapters(prev, newChapters));
	const nextMax = Math.max(...newChapters.map((c) => c.chapterNumber));
	setBounds((prev) => ({ ...prev, max: nextMax, hasMoreBottom: newChapters.length >= limit }));
}

async function runPrevTopFetch(
	bookId: string,
	limit: number,
	search: string,
	min: number,
	container: HTMLDivElement | null,
	pendingPrependScrollRef: React.MutableRefObject<{ prevHeight: number; prevTop: number } | null>,
	setChapters: React.Dispatch<React.SetStateAction<Chapter[]>>,
	setBounds: React.Dispatch<React.SetStateAction<BoundsState>>
) {
	const newChapters = await queryChapterSlice(bookId, limit, search, Math.max(1, min - limit), min - 1);
	if (newChapters.length === 0) {
		setBounds((prev) => ({ ...prev, hasMoreTop: false }));
		return;
	}
	if (container) {
		pendingPrependScrollRef.current = { prevHeight: container.scrollHeight, prevTop: container.scrollTop };
	}
	setChapters((prev) => mergePrependedChapters(prev, newChapters));
	const nextMin = Math.min(...newChapters.map((c) => c.chapterNumber));
	setBounds((prev) => ({ ...prev, min: nextMin, hasMoreTop: nextMin > 1 }));
}

export function useQuickChapterPagination(bookId: string, currentChapterNumber: number | undefined, onClose: () => void) {
	useBodyScrollLock();
	const configChapterLimit = useReaderConfigStore((state) => state.chapterLimit || 50);
	const [chapters, setChapters] = useState<Chapter[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingBottom, setLoadingBottom] = useState(false);
	const [loadingTop, setLoadingTop] = useState(false);
	const [bounds, setBounds] = useState<BoundsState>({ min: 1, max: 1, hasMoreTop: false, hasMoreBottom: true });
	const [search, setSearch] = useState('');

	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const activeItemRef = useRef<HTMLDivElement | null>(null);
	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isInitialScrollDoneRef = useRef(false);
	const pendingPrependScrollRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
	const lastScrollTopRef = useRef<number>(0);
	const fetchIdRef = useRef(0);
	const fetchPrevTopPageRef = useRef<() => Promise<void>>(() => Promise.resolve());

	useEffect(() => () => void (searchTimeoutRef.current && clearTimeout(searchTimeoutRef.current)), []);

	const loadInitialChapters = useCallback(
		async (searchQuery: string = '') => {
			const fetchId = ++fetchIdRef.current;
			setLoading(true);
			isInitialScrollDoneRef.current = false;
			const range = searchQuery ? undefined : computeInitialChapterRange(currentChapterNumber, configChapterLimit);
			try {
				const newChapters = await queryChapterSlice(bookId, configChapterLimit, searchQuery, range?.start, range?.end);
				if (fetchId !== fetchIdRef.current) return;
				setChapters(newChapters);
				const nextBounds =
					newChapters.length > 0
						? getChapterExtremes(newChapters, configChapterLimit, Boolean(searchQuery))
						: { min: 1, max: 1, hasMoreTop: false, hasMoreBottom: false };
				setBounds(nextBounds);
			} catch (err) {
				console.warn('[useQuickChapterPagination] Failed to load initial chapters:', err);
			} finally {
				if (fetchId === fetchIdRef.current) setLoading(false);
			}
		},
		[bookId, currentChapterNumber, configChapterLimit]
	);

	useEffect(() => void loadInitialChapters(''), [loadInitialChapters]);
	const hasMoreTop = bounds.hasMoreTop;
	useQuickChapterScrollEffects({
		chapters,
		loading,
		loadingTop,
		hasMoreTop,
		scrollContainerRef,
		activeItemRef,
		isInitialScrollDoneRef,
		pendingPrependScrollRef,
		lastScrollTopRef,
		fetchPrevTopPageRef,
	});

	const fetchNextBottomPage = async () => {
		if (loadingBottom || !bounds.hasMoreBottom || search || !isInitialScrollDoneRef.current) return;
		setLoadingBottom(true);
		try {
			await runNextBottomFetch(bookId, configChapterLimit, search, bounds.max, setChapters, setBounds);
		} catch (err) {
			console.warn('[useQuickChapterPagination] Failed to load next bottom page:', err);
		} finally {
			setLoadingBottom(false);
		}
	};

	const fetchPrevTopPage = async () => {
		if (loadingTop || !bounds.hasMoreTop || bounds.min <= 1 || search || !isInitialScrollDoneRef.current) return;
		setLoadingTop(true);
		const container = scrollContainerRef.current;
		try {
			await runPrevTopFetch(bookId, configChapterLimit, search, bounds.min, container, pendingPrependScrollRef, setChapters, setBounds);
		} catch (err) {
			console.warn('[useQuickChapterPagination] Failed to load prev top page:', err);
		} finally {
			setLoadingTop(false);
		}
	};
	fetchPrevTopPageRef.current = fetchPrevTopPage;

	const handleScroll = () => {
		if (!scrollContainerRef.current || loading || !isInitialScrollDoneRef.current) return;
		const { scrollTop, clientHeight, scrollHeight } = scrollContainerRef.current;
		const isScrollingUp = scrollTop < lastScrollTopRef.current;
		const isScrollingDown = scrollTop > lastScrollTopRef.current;
		lastScrollTopRef.current = scrollTop;
		if (isScrollingDown && scrollTop + clientHeight >= scrollHeight - 300) fetchNextBottomPage();
		if (isScrollingUp && scrollTop <= 80) fetchPrevTopPage();
	};

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setSearch(val);
		if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
		searchTimeoutRef.current = setTimeout(() => loadInitialChapters(val), 300);
	};

	return {
		chapters,
		loading,
		loadingTop,
		loadingBottom,
		search,
		scrollContainerRef,
		activeItemRef,
		handleScroll,
		handleSearchChange,
		handleClearSearch: () => {
			setSearch('');
			loadInitialChapters('');
		},
		handleSelectChapter: (chapterId: string) => {
			onClose();
			openChapter(bookId, chapterId);
		},
	};
}
