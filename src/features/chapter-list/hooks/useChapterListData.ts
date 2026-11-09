import {
	useState,
	useEffect,
	useCallback,
	useRef,
	type Dispatch,
	type SetStateAction,
	type ChangeEvent,
	type MutableRefObject,
} from 'react';

import { BookRepository } from '@/repositories/BookRepository';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { clearAllCaches } from '@/shared/utils/cacheUtils';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { useToastStore } from '@/stores/useToastStore';

import type { Chapter, Book } from '@/shared/types';

function mergeChapters(prev: Chapter[], newChapters: Chapter[]): Chapter[] {
	const existingIds = new Set(prev.map((c) => c.chapterId));
	const uniqueNew = newChapters.filter((c) => !existingIds.has(c.chapterId));
	return [...prev, ...uniqueNew];
}

function applyChapterResult(
	res: { chapters?: Chapter[]; pagination?: { totalPages?: number } },
	targetPage: number,
	isAppend: boolean,
	setChapters: Dispatch<SetStateAction<Chapter[]>>,
	setPage: (p: number) => void,
	setHasMore: (h: boolean) => void
) {
	const newChapters = res.chapters || [];
	const totalPages = res.pagination?.totalPages || 1;

	if (isAppend) {
		setChapters((prev) => mergeChapters(prev, newChapters));
	} else {
		setChapters(newChapters);
	}

	setPage(targetPage);
	setHasMore(targetPage < totalPages && newChapters.length > 0);
}

async function loadBookIfMissing(bookId: string, hasBook: boolean, isAppend: boolean): Promise<Book | null> {
	if (hasBook || isAppend) return null;
	return await BookRepository.getBook(bookId);
}

interface ExecuteFetchParams {
	bookId: string;
	targetPage: number;
	chapterLimit: number;
	searchQuery: string;
	targetState: string;
	targetSort: 'ASC' | 'DESC';
	isAppend: boolean;
	options?: { forceFresh?: boolean };
	fetchIdRef: MutableRefObject<number>;
	hasBook: boolean;
	setBook: (b: Book) => void;
	setChapters: Dispatch<SetStateAction<Chapter[]>>;
	setPage: (p: number) => void;
	setHasMore: (h: boolean) => void;
	setLoading: (l: boolean) => void;
	setLoadingMore: (lm: boolean) => void;
	showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

async function executeFetchChapters(p: ExecuteFetchParams) {
	const fetchId = ++p.fetchIdRef.current;
	p.setLoadingMore(p.isAppend);
	p.setLoading(!p.isAppend);

	try {
		const loadedBook = await loadBookIfMissing(p.bookId, p.hasBook, p.isAppend);
		if (loadedBook) p.setBook(loadedBook);

		const res = await ChapterRepository.getChapters(
			p.bookId,
			p.targetPage,
			p.chapterLimit,
			'chapterNumber',
			p.targetSort,
			p.targetState,
			p.searchQuery,
			undefined,
			undefined,
			p.options
		);

		if (fetchId !== p.fetchIdRef.current) return;
		applyChapterResult(res, p.targetPage, p.isAppend, p.setChapters, p.setPage, p.setHasMore);
	} catch {
		if (fetchId === p.fetchIdRef.current) {
			p.showToast('Lỗi khi tải danh sách chương', 'error');
		}
	} finally {
		if (fetchId === p.fetchIdRef.current) {
			p.setLoading(false);
			p.setLoadingMore(false);
		}
	}
}

async function toggleBookFavorite(
	bookId: string | undefined,
	book: Book | null,
	setBook: (b: Book) => void,
	showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
) {
	if (!bookId) return;
	try {
		const res = await BookRepository.toggleFavorite(bookId);
		showToast(
			res.isFavorite ? `Đã thêm "${book?.bookName || 'truyện'}" vào yêu thích` : `Đã bỏ "${book?.bookName || 'truyện'}" khỏi yêu thích`,
			'success'
		);
		if (book) setBook({ ...book, isFavorite: res.isFavorite });
		window.dispatchEvent(new CustomEvent('favorites-updated'));
	} catch {
		showToast('Không thể cập nhật trạng thái yêu thích', 'error');
	}
}

export function useChapterListData(bookId: string | undefined) {
	const [book, setBook] = useState<Book | null>(null);
	const isFav = useFavoriteStore((state) => (bookId ? state.isFavorite(bookId) : false)) || Boolean(book?.isFavorite);

	const [chapters, setChapters] = useState<Chapter[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);

	const [search, setSearch] = useState('');
	const [filterState, setFilterState] = useState<string>('all');
	const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
	const [activeRange, setActiveRange] = useState<string>('all');
	const [rangeBounds, setRangeBounds] = useState<{ start?: number; end?: number }>({});

	const showToast = useToastStore((state) => state.showToast);
	const chapterLimit = useReaderConfigStore((state) => state.chapterLimit || 50);
	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const fetchIdRef = useRef(0);
	const searchRef = useRef(search);
	searchRef.current = search;
	const bookRef = useRef(book);
	bookRef.current = book;

	const handleToggleFavorite = () => toggleBookFavorite(bookId, book, setBook, showToast);

	const fetchChapters = useCallback(
		async (
			targetPage: number,
			searchQuery: string,
			targetState: string,
			targetSort: 'ASC' | 'DESC',
			isAppend: boolean = false,
			options?: { forceFresh?: boolean }
		) => {
			if (!bookId) return;
			await executeFetchChapters({
				bookId,
				targetPage,
				chapterLimit,
				searchQuery,
				targetState,
				targetSort,
				isAppend,
				options,
				fetchIdRef,
				hasBook: Boolean(bookRef.current),
				setBook,
				setChapters,
				setPage,
				setHasMore,
				setLoading,
				setLoadingMore,
				showToast,
			});
		},
		[bookId, chapterLimit, showToast]
	);

	useEffect(() => {
		fetchChapters(1, searchRef.current, filterState, sortOrder, false);
	}, [filterState, sortOrder, fetchChapters]);

	const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setSearch(val);
		if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
		searchTimeoutRef.current = setTimeout(() => {
			fetchChapters(1, val, filterState, sortOrder, false);
		}, 300);
	};

	useEffect(() => {
		const handleScroll = () => {
			if (loading || loadingMore || !hasMore) return;
			if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 450) {
				fetchChapters(page + 1, search, filterState, sortOrder, true);
			}
		};
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	}, [loading, loadingMore, hasMore, page, search, filterState, sortOrder, fetchChapters]);

	const handleRangeSelect = (range: string, start?: number, end?: number) => {
		setActiveRange(range);
		setRangeBounds({ start, end });
	};

	const filteredChapters = chapters.filter((c) => {
		if (rangeBounds.start !== undefined && rangeBounds.end !== undefined) {
			return c.chapterNumber >= rangeBounds.start && c.chapterNumber <= rangeBounds.end;
		}
		return true;
	});

	const handlePullRefresh = useCallback(async () => {
		await clearAllCaches();
		await fetchChapters(1, search, filterState, sortOrder, false, { forceFresh: true });
	}, [fetchChapters, search, filterState, sortOrder]);

	return {
		book,
		isFav,
		chapters,
		filteredChapters,
		loading,
		loadingMore,
		search,
		filterState,
		sortOrder,
		activeRange,
		showToast,
		setFilterState,
		setSortOrder,
		handleToggleFavorite,
		handleSearchChange,
		handleRangeSelect,
		handlePullRefresh,
		fetchChapters,
	};
}
