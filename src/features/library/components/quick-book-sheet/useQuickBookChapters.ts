import {
	useState,
	useEffect,
	useLayoutEffect,
	useCallback,
	useRef,
	type RefObject,
	type MutableRefObject,
	type ChangeEvent,
	type Dispatch,
	type SetStateAction,
} from 'react';

import { ChapterRepository } from '@/repositories/ChapterRepository';

import type { Book, Chapter } from '@/shared/types';

function computeChapterWindow(
	lastReadChapterNumber: string | number | undefined,
	totalChapters: number,
	chapterLimit: number,
	searchQuery: string
): { startChapterNumber?: number; endChapterNumber?: number } {
	if (searchQuery) return {};
	const target = lastReadChapterNumber ? Math.max(1, Number(lastReadChapterNumber)) : 1;
	const remainingAhead = totalChapters > 0 ? Math.max(0, totalChapters - target) : 0;
	const neededBehind = Math.max(5, chapterLimit - remainingAhead);
	return {
		startChapterNumber: Math.max(1, target - neededBehind),
		endChapterNumber: target + chapterLimit,
	};
}

function computeChapterBounds(newChapters: Chapter[], searchQuery: string, totalChapters: number, chapterLimit: number) {
	if (newChapters.length === 0) {
		return { minNum: 1, maxNum: 1, moreTop: false, moreBottom: false };
	}
	const minNum = Math.min(...newChapters.map((c) => c.chapterNumber));
	const maxNum = Math.max(...newChapters.map((c) => c.chapterNumber));
	return {
		minNum,
		maxNum,
		moreTop: !searchQuery && minNum > 1,
		moreBottom: maxNum < (totalChapters || 999999) && newChapters.length >= chapterLimit,
	};
}

async function fetchPrevTopChapters(
	bookId: string,
	minChapterNum: number,
	configChapterLimit: number,
	search: string,
	scrollContainerRef: RefObject<HTMLDivElement | null>,
	pendingPrependScrollRef: MutableRefObject<{ prevHeight: number; prevTop: number } | null>,
	setters: {
		setChapters: Dispatch<SetStateAction<Chapter[]>>;
		setMinChapterNum: (n: number) => void;
		setHasMoreTop: (h: boolean) => void;
		setLoadingTop: (l: boolean) => void;
	}
) {
	setters.setLoadingTop(true);
	const targetToChapter = minChapterNum - 1;
	const targetFromChapter = Math.max(1, minChapterNum - configChapterLimit);

	try {
		const res = await ChapterRepository.getChapters(
			bookId,
			1,
			configChapterLimit,
			'chapterNumber',
			'ASC',
			'all',
			search,
			targetFromChapter,
			targetToChapter
		);

		const newChapters = res.chapters || [];
		if (newChapters.length === 0) {
			setters.setHasMoreTop(false);
			return;
		}

		const container = scrollContainerRef.current;
		if (container) {
			pendingPrependScrollRef.current = { prevHeight: container.scrollHeight, prevTop: container.scrollTop };
		}

		setters.setChapters((prev) => {
			const existingIds = new Set(prev.map((c) => c.chapterId));
			return [...newChapters.filter((c) => !existingIds.has(c.chapterId)), ...prev];
		});
		const newMin = Math.min(...newChapters.map((c) => c.chapterNumber));
		setters.setMinChapterNum(newMin);
		setters.setHasMoreTop(newMin > 1);
	} catch {
		// Ignore
	} finally {
		setters.setLoadingTop(false);
	}
}

async function fetchNextBottomChapters(
	bookId: string,
	maxChapterNum: number,
	configChapterLimit: number,
	search: string,
	setters: {
		setChapters: Dispatch<SetStateAction<Chapter[]>>;
		setMaxChapterNum: (n: number) => void;
		setHasMoreBottom: (h: boolean) => void;
		setLoadingBottom: (l: boolean) => void;
	}
) {
	setters.setLoadingBottom(true);
	try {
		const res = await ChapterRepository.getChapters(
			bookId,
			1,
			configChapterLimit,
			'chapterNumber',
			'ASC',
			'all',
			search,
			maxChapterNum + 1
		);
		const newChapters = res.chapters || [];
		if (newChapters.length === 0) {
			setters.setHasMoreBottom(false);
			return;
		}
		setters.setChapters((prev) => {
			const existingIds = new Set(prev.map((c) => c.chapterId));
			return [...prev, ...newChapters.filter((c) => !existingIds.has(c.chapterId))];
		});
		setters.setMaxChapterNum(Math.max(...newChapters.map((c) => c.chapterNumber)));
		setters.setHasMoreBottom(newChapters.length >= configChapterLimit);
	} catch {
		// Ignore
	} finally {
		setters.setLoadingBottom(false);
	}
}

function useQuickBookScrollPositioning(
	loading: boolean,
	loadingTop: boolean,
	hasMoreTop: boolean,
	chapters: Chapter[],
	scrollContainerRef: RefObject<HTMLDivElement | null>,
	activeItemRef: RefObject<HTMLDivElement | null>,
	isInitialScrollDoneRef: MutableRefObject<boolean>,
	pendingPrependScrollRef: MutableRefObject<{ prevHeight: number; prevTop: number } | null>,
	lastScrollTopRef: MutableRefObject<number>,
	fetchPrevTopPage: () => void
) {
	useEffect(() => {
		if (!loading && !loadingTop && hasMoreTop && isInitialScrollDoneRef.current && scrollContainerRef.current) {
			const { scrollHeight, clientHeight } = scrollContainerRef.current;
			if (scrollHeight > 0 && scrollHeight <= clientHeight + 50) fetchPrevTopPage();
		}
	}, [loading, loadingTop, hasMoreTop, chapters.length, fetchPrevTopPage, isInitialScrollDoneRef, scrollContainerRef]);

	useLayoutEffect(() => {
		if (pendingPrependScrollRef.current && scrollContainerRef.current) {
			const { prevHeight, prevTop } = pendingPrependScrollRef.current;
			pendingPrependScrollRef.current = null;
			const diff = scrollContainerRef.current.scrollHeight - prevHeight;
			if (diff > 0) {
				scrollContainerRef.current.scrollTop = prevTop + diff;
				lastScrollTopRef.current = prevTop + diff;
			}
		}
	}, [chapters, pendingPrependScrollRef, scrollContainerRef, lastScrollTopRef]);

	useLayoutEffect(() => {
		if (!loading && chapters.length > 0 && !isInitialScrollDoneRef.current) {
			requestAnimationFrame(() => {
				if (activeItemRef.current && scrollContainerRef.current) {
					const container = scrollContainerRef.current;
					const targetScrollTop = Math.max(0, activeItemRef.current.offsetTop - container.clientHeight / 3);
					container.scrollTop = targetScrollTop;
					lastScrollTopRef.current = targetScrollTop;
				}
				setTimeout(() => {
					isInitialScrollDoneRef.current = true;
				}, 100);
			});
		}
	}, [loading, chapters, activeItemRef, scrollContainerRef, lastScrollTopRef, isInitialScrollDoneRef]);
}

function shouldLoadBottom(
	isScrollingDown: boolean,
	scrollTop: number,
	clientHeight: number,
	scrollHeight: number,
	loadingBottom: boolean,
	hasMoreBottom: boolean,
	search: string
): boolean {
	if (!isScrollingDown || loadingBottom || !hasMoreBottom || Boolean(search)) return false;
	return scrollTop + clientHeight >= scrollHeight - 300;
}

async function executeInitialChapterLoad(
	book: Book,
	configChapterLimit: number,
	searchQuery: string,
	fetchIdRef: MutableRefObject<number>,
	isInitialScrollDoneRef: MutableRefObject<boolean>,
	setters: {
		setLoading: (l: boolean) => void;
		setChapters: Dispatch<SetStateAction<Chapter[]>>;
		setMinChapterNum: (n: number) => void;
		setMaxChapterNum: (n: number) => void;
		setHasMoreTop: (h: boolean) => void;
		setHasMoreBottom: (h: boolean) => void;
	}
) {
	const fetchId = ++fetchIdRef.current;
	setters.setLoading(true);
	isInitialScrollDoneRef.current = false;

	const { startChapterNumber, endChapterNumber } = computeChapterWindow(
		book.lastReadChapter?.chapterNumber,
		book.chapterCount || 0,
		configChapterLimit,
		searchQuery
	);

	try {
		const res = await ChapterRepository.getChapters(
			book.bookId,
			1,
			configChapterLimit + 10,
			'chapterNumber',
			'ASC',
			'all',
			searchQuery,
			startChapterNumber,
			endChapterNumber
		);
		if (fetchId !== fetchIdRef.current) return;

		const newChapters = res.chapters || [];
		setters.setChapters(newChapters);
		const bounds = computeChapterBounds(newChapters, searchQuery, book.chapterCount, configChapterLimit);
		setters.setMinChapterNum(bounds.minNum);
		setters.setMaxChapterNum(bounds.maxNum);
		setters.setHasMoreTop(bounds.moreTop);
		setters.setHasMoreBottom(bounds.moreBottom);
	} catch {
		// Ignore error
	} finally {
		if (fetchId === fetchIdRef.current) setters.setLoading(false);
	}
}

export function useQuickBookChapters({
	book,
	configChapterLimit,
	scrollContainerRef,
	activeItemRef,
}: {
	book: Book;
	configChapterLimit: number;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	activeItemRef: RefObject<HTMLDivElement | null>;
}) {
	const [chapters, setChapters] = useState<Chapter[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingBottom, setLoadingBottom] = useState(false);
	const [loadingTop, setLoadingTop] = useState(false);

	const [hasMoreTop, setHasMoreTop] = useState(false);
	const [hasMoreBottom, setHasMoreBottom] = useState(true);
	const [minChapterNum, setMinChapterNum] = useState<number>(1);
	const [maxChapterNum, setMaxChapterNum] = useState<number>(1);
	const [search, setSearch] = useState('');

	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isInitialScrollDoneRef = useRef(false);
	const pendingPrependScrollRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
	const lastScrollTopRef = useRef<number>(0);
	const fetchIdRef = useRef(0);

	const fetchPrevTopPage = useCallback(async () => {
		if (loadingTop || !hasMoreTop || minChapterNum <= 1 || search || !isInitialScrollDoneRef.current) return;
		await fetchPrevTopChapters(book.bookId, minChapterNum, configChapterLimit, search, scrollContainerRef, pendingPrependScrollRef, {
			setChapters,
			setMinChapterNum,
			setHasMoreTop,
			setLoadingTop,
		});
	}, [loadingTop, hasMoreTop, minChapterNum, search, configChapterLimit, book.bookId, scrollContainerRef]);

	const loadInitialChapters = useCallback(
		async (searchQuery: string = '') => {
			await executeInitialChapterLoad(book, configChapterLimit, searchQuery, fetchIdRef, isInitialScrollDoneRef, {
				setLoading,
				setChapters,
				setMinChapterNum,
				setMaxChapterNum,
				setHasMoreTop,
				setHasMoreBottom,
			});
		},
		[book, configChapterLimit]
	);

	useEffect(() => {
		loadInitialChapters('');
	}, [loadInitialChapters]);

	useQuickBookScrollPositioning(
		loading,
		loadingTop,
		hasMoreTop,
		chapters,
		scrollContainerRef,
		activeItemRef,
		isInitialScrollDoneRef,
		pendingPrependScrollRef,
		lastScrollTopRef,
		fetchPrevTopPage
	);

	const handleScroll = () => {
		const container = scrollContainerRef.current;
		if (!container || loading || !isInitialScrollDoneRef.current) return;
		const { scrollTop, clientHeight, scrollHeight } = container;
		const isScrollingUp = scrollTop < lastScrollTopRef.current;
		const isScrollingDown = scrollTop > lastScrollTopRef.current;
		lastScrollTopRef.current = scrollTop;

		if (shouldLoadBottom(isScrollingDown, scrollTop, clientHeight, scrollHeight, loadingBottom, hasMoreBottom, search)) {
			fetchNextBottomChapters(book.bookId, maxChapterNum, configChapterLimit, search, {
				setChapters,
				setMaxChapterNum,
				setHasMoreBottom,
				setLoadingBottom,
			});
		}

		if (isScrollingUp && scrollTop <= 80) fetchPrevTopPage();
	};

	const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setSearch(val);
		if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
		searchTimeoutRef.current = setTimeout(() => loadInitialChapters(val), 300);
	};

	return {
		chapters,
		loading,
		loadingBottom,
		loadingTop,
		search,
		setSearch,
		loadInitialChapters,
		handleScroll,
		handleSearchChange,
	};
}
