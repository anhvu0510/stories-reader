import { useState, useEffect, useCallback, useRef } from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';
import { BookRepository } from '@/repositories/BookRepository';
import { clearAllCaches } from '@/shared/utils/cacheUtils';
import { useAppStore } from '@/stores/useAppStore';
import { useLibraryStore, type SortByField, type SortOrderDirection } from '@/stores/useLibraryStore';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { useToastStore } from '@/stores/useToastStore';

import { resetScrollTop, type LibraryTab } from './useLibraryScrollAndSwipe';

import type { Book } from '@/shared/types';

function resolveSortParams(
	tab: string,
	currentSortBy?: SortByField,
	sortBy?: SortByField,
	currentSortOrder?: SortOrderDirection,
	sortOrder?: SortOrderDirection
): { sBy: SortByField; sOrder: SortOrderDirection } {
	if (tab === 'HISTORY') {
		return { sBy: 'lastedReadAt', sOrder: 'DESC' };
	}
	if (tab === 'ALL') {
		const rawSortBy = currentSortBy ?? sortBy;
		return {
			sBy: rawSortBy === 'updatedAt' ? 'updatedAt' : 'createdAt',
			sOrder: currentSortOrder ?? sortOrder ?? 'DESC',
		};
	}
	return { sBy: 'createdAt', sOrder: 'DESC' };
}

function applyBooksResult(
	res: { books?: Book[]; pagination?: { currentPage?: number; totalPages?: number; total?: number } },
	targetPage: number,
	cacheKey: string,
	tabCache: Record<string, { books: Book[]; totalPages: number; total: number }>,
	setters: {
		setBooks: (b: Book[]) => void;
		setPage: (p: number) => void;
		setTotalPages: (tp: number) => void;
		setTotal: (t: number) => void;
	}
) {
	const fetchedBooks = res.books || [];
	const { currentPage, totalPages: pagesCount, total: totalCount } = res.pagination || {};
	const finalTotalPages = pagesCount || 1;
	const finalTotal = totalCount || fetchedBooks.length;

	setters.setBooks(fetchedBooks);
	setters.setPage(currentPage || targetPage);
	setters.setTotalPages(finalTotalPages);
	setters.setTotal(finalTotal);

	tabCache[cacheKey] = {
		books: fetchedBooks,
		totalPages: finalTotalPages,
		total: finalTotal,
	};
}

function fetchBooksFromRepo(
	targetPage: number,
	bookLimit: number,
	q: string,
	t: string,
	sBy: string,
	sOrder: string,
	tg: string[],
	options?: { forceFresh?: boolean }
) {
	if (options) {
		return BookRepository.getBooks(targetPage, bookLimit, q, t, sBy, sOrder, tg, options);
	}
	return BookRepository.getBooks(targetPage, bookLimit, q, t, sBy, sOrder, tg);
}

function getInitialLibraryState(
	savedPage?: number,
	savedSearch?: string,
	savedTags?: string[],
	savedSortBy?: string,
	savedSortOrder?: SortOrderDirection
) {
	return {
		page: savedPage || 1,
		search: savedSearch || '',
		tags: savedTags || [],
		sortBy: (savedSortBy === 'updatedAt' ? 'updatedAt' : 'createdAt') as SortByField,
		sortOrder: savedSortOrder || 'DESC',
	};
}

export function useLibraryBooksState() {
	const { savedPage, savedTab, savedSearch, savedTags, savedSortBy, savedSortOrder, setLibraryState, setSavedScrollY, setSort } =
		useLibraryStore();
	const [initialSavedScrollY] = useState(() => useLibraryStore.getState().savedScrollY);
	const initState = getInitialLibraryState(savedPage, savedSearch, savedTags, savedSortBy, savedSortOrder);

	const [books, setBooks] = useState<Book[]>([]);
	const [page, setPage] = useState(initState.page);
	const [totalPages, setTotalPages] = useState(1);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);

	const [search, setSearch] = useState(initState.search);
	const [appliedSearch, setAppliedSearch] = useState(initState.search);
	const [tab, setTab] = useState<LibraryTab>(savedTab);
	const [selectedTags, setSelectedTags] = useState<string[]>(initState.tags);
	const [sortBy, setSortByState] = useState<SortByField>(initState.sortBy);
	const [sortOrder, setSortOrderState] = useState<SortOrderDirection>(initState.sortOrder);

	const isOfflineMode = useAppStore((state) => state.isOfflineMode);
	const showToast = useToastStore((state) => state.showToast);
	const bookLimit = useReaderConfigStore((state) => state.bookLimit) || 20;

	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const fetchIdRef = useRef(0);
	const tabCacheRef = useRef<Record<string, { books: Book[]; totalPages: number; total: number }>>({});

	useEffect(() => {
		setLibraryState(page, tab, search, selectedTags, sortBy, sortOrder);
	}, [page, tab, search, selectedTags, sortBy, sortOrder, setLibraryState]);

	const fetchBooks = useCallback(
		async (
			targetPage: number,
			querySearch?: string,
			activeTab?: string,
			filterTags?: string[],
			currentSortBy?: SortByField,
			currentSortOrder?: SortOrderDirection,
			options?: { forceFresh?: boolean }
		) => {
			const fetchId = ++fetchIdRef.current;
			setLoading(true);
			const q = querySearch ?? appliedSearch;
			const t = activeTab ?? tab;
			const tg = filterTags ?? selectedTags;
			const { sBy, sOrder } = resolveSortParams(t, currentSortBy, sortBy, currentSortOrder, sortOrder);

			try {
				const res = await fetchBooksFromRepo(targetPage, bookLimit, q, t, sBy, sOrder, tg, options);
				if (fetchId !== fetchIdRef.current) return;
				const cacheKey = `${t}-${targetPage}-${q}-${tg.join(',')}-${sBy}-${sOrder}`;
				applyBooksResult(res, targetPage, cacheKey, tabCacheRef.current, {
					setBooks,
					setPage,
					setTotalPages,
					setTotal,
				});
			} catch {
				if (fetchId === fetchIdRef.current) {
					showToast('Không thể tải danh sách truyện', 'error');
				}
			} finally {
				if (fetchId === fetchIdRef.current) {
					setLoading(false);
				}
			}
		},
		[appliedSearch, tab, selectedTags, sortBy, sortOrder, bookLimit, showToast]
	);

	useEffect(() => {
		fetchBooks(page, appliedSearch, tab, selectedTags, sortBy, sortOrder);
		const handleRefresh = () => {
			fetchBooks(page, appliedSearch, tab, selectedTags, sortBy, sortOrder);
		};
		window.addEventListener('app-refresh', handleRefresh);
		window.addEventListener('offline-mode-changed', handleRefresh);
		window.addEventListener('favorites-updated', handleRefresh);
		return () => {
			window.removeEventListener('app-refresh', handleRefresh);
			window.removeEventListener('offline-mode-changed', handleRefresh);
			window.removeEventListener('favorites-updated', handleRefresh);
		};
	}, [page, appliedSearch, tab, selectedTags, sortBy, sortOrder, isOfflineMode, bookLimit, fetchBooks]);

	return {
		books,
		setBooks,
		page,
		setPage,
		totalPages,
		setTotalPages,
		total,
		setTotal,
		loading,
		search,
		setSearch,
		appliedSearch,
		setAppliedSearch,
		tab,
		setTab,
		selectedTags,
		setSelectedTags,
		sortBy,
		setSortByState,
		sortOrder,
		setSortOrderState,
		setLibraryState,
		setSavedScrollY,
		setSort,
		initialSavedScrollY,
		searchTimeoutRef,
		tabCacheRef,
		fetchBooks,
	};
}

export function useLibraryActionHandlers(s: ReturnType<typeof useLibraryBooksState>, setIsHeaderCollapsed: (collapsed: boolean) => void) {
	const handlePageChange = (newPage: number) => {
		setIsHeaderCollapsed(false);
		s.setPage(newPage);
		s.setLibraryState(newPage, s.tab, s.search, s.selectedTags, s.sortBy, s.sortOrder, 0);
		resetScrollTop();
	};

	const handleSearchChange = (val: string) => {
		setIsHeaderCollapsed(false);
		s.setSearch(val);
		if (s.searchTimeoutRef.current) clearTimeout(s.searchTimeoutRef.current);

		if (val.trim() === '') {
			s.setPage(1);
			s.setAppliedSearch('');
			s.setLibraryState(1, s.tab, '', s.selectedTags, s.sortBy, s.sortOrder, 0);
			return;
		}

		s.searchTimeoutRef.current = setTimeout(() => {
			s.setPage(1);
			s.setAppliedSearch(val);
			s.setLibraryState(1, s.tab, val, s.selectedTags, s.sortBy, s.sortOrder, 0);
		}, 400);
	};

	const handleSearchSubmit = () => {
		if (s.searchTimeoutRef.current) clearTimeout(s.searchTimeoutRef.current);
		setIsHeaderCollapsed(false);
		s.setPage(1);
		s.setAppliedSearch(s.search);
		s.setLibraryState(1, s.tab, s.search, s.selectedTags, s.sortBy, s.sortOrder, 0);
		resetScrollTop();
	};

	const handleTabChange = useCallback(
		(newTab: LibraryTab) => {
			if (newTab === s.tab) return;
			triggerHaptic('selection');
			setIsHeaderCollapsed(false);

			s.setTab(newTab);
			s.setPage(1);

			const { sBy, sOrder } = resolveSortParams(newTab, s.sortBy, s.sortBy, s.sortOrder, s.sortOrder);
			const nextCacheKey = `${newTab}-1-${s.appliedSearch}-${s.selectedTags.join(',')}-${sBy}-${sOrder}`;
			const cached = s.tabCacheRef.current[nextCacheKey];
			if (cached) {
				s.setBooks(cached.books);
				s.setTotalPages(cached.totalPages);
				s.setTotal(cached.total);
			} else {
				s.setBooks([]);
			}

			s.setLibraryState(1, newTab, s.search, s.selectedTags, s.sortBy, s.sortOrder, 0);
			resetScrollTop();
		},
		[s, setIsHeaderCollapsed]
	);

	const handleTagFilterApply = (newTags: string[]) => {
		triggerHaptic('light');
		setIsHeaderCollapsed(false);
		s.setSelectedTags(newTags);
		s.setPage(1);
		s.setLibraryState(1, s.tab, s.search, newTags, s.sortBy, s.sortOrder, 0);
		resetScrollTop();
	};

	const handleSortApply = (newSortBy: SortByField, newSortOrder: SortOrderDirection) => {
		triggerHaptic('selection');
		setIsHeaderCollapsed(false);
		s.setSortByState(newSortBy);
		s.setSortOrderState(newSortOrder);
		s.setSort(newSortBy, newSortOrder);
		s.setPage(1);
		resetScrollTop();
	};

	const handlePullRefresh = useCallback(async () => {
		s.tabCacheRef.current = {};
		await clearAllCaches();
		s.setPage(1);
		await s.fetchBooks(1, s.appliedSearch, s.tab, s.selectedTags, s.sortBy, s.sortOrder, { forceFresh: true });
	}, [s]);

	return {
		handlePageChange,
		handleSearchChange,
		handleSearchSubmit,
		handleTabChange,
		handleTagFilterApply,
		handleSortApply,
		handlePullRefresh,
	};
}
