import { BookOpen, Clock, Sparkles, Library, X, RotateCcw, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { BottomDock } from '@/components/BottomDock';
import { OfflineManagerSheet } from '@/components/OfflineManagerSheet';
import { PullToRefresh } from '@/components/PullToRefresh';
import { GlobalSettingsSheet } from '@/features/settings/GlobalSettingsSheet';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { triggerHaptic } from '@/hooks/useHaptic';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { BookRepository } from '@/repositories/BookRepository';
import { clearAllCaches } from '@/shared/utils/cacheUtils';
import { useAppStore } from '@/stores/useAppStore';
import { useLibraryStore, type SortByField, type SortOrderDirection } from '@/stores/useLibraryStore';
import { useModalStore } from '@/stores/useModalStore';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { useToastStore } from '@/stores/useToastStore';

import { BookCard } from './components/BookCard';
import { LibraryHeader } from './components/LibraryHeader';
import { SortSheet } from './components/SortSheet';
import { TagFilterSheet } from './components/TagFilterSheet';

import type { Book } from '@/shared/types';
import type { LucideIcon } from 'lucide-react';

const TABS: readonly ['ALL', 'HISTORY', 'FAVORITE', 'AI'] = ['ALL', 'HISTORY', 'FAVORITE', 'AI'] as const;
type LibraryTab = (typeof TABS)[number];

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

interface TabItemConfig {
	id: LibraryTab;
	label: string;
	title: string;
	Icon: LucideIcon;
	activeText: string;
	activePill: string;
}

const TAB_ITEMS: TabItemConfig[] = [
	{
		id: 'ALL',
		label: 'Tất cả',
		title: 'Tất cả truyện',
		Icon: Library,
		activeText: 'text-primary font-bold',
		activePill: 'bg-gradient-to-b from-primary/30 to-primary/10 border-primary/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	},
	{
		id: 'HISTORY',
		label: 'Lịch sử',
		title: 'Lịch sử đọc',
		Icon: Clock,
		activeText: 'text-primary font-bold',
		activePill: 'bg-gradient-to-b from-primary/30 to-primary/10 border-primary/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	},
	{
		id: 'FAVORITE',
		label: 'Yêu thích',
		title: 'Truyện yêu thích',
		Icon: Heart,
		activeText: 'text-rose-400 font-bold',
		activePill: 'bg-gradient-to-b from-rose-500/30 to-rose-500/10 border-rose-500/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	},
	{
		id: 'AI',
		label: 'Dịch AI',
		title: 'Truyện dịch AI',
		Icon: Sparkles,
		activeText: 'text-emerald-400 font-bold',
		activePill:
			'bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 border-emerald-400/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	},
];

function getTabIconClass(tId: LibraryTab, isActive: boolean, activeText: string): string {
	if (tId === 'FAVORITE' && isActive) return 'fill-rose-500 text-rose-500';
	if (isActive) return activeText;
	return 'text-on-surface-variant/60';
}

function LibraryTabsNav({
	currentTab,
	total,
	onTabChange,
}: {
	currentTab: LibraryTab;
	total: number;
	onTabChange: (tab: LibraryTab) => void;
}) {
	return (
		<div className="px-3.5 pt-1 pb-2 border-t border-white/10 dark:border-white/5 bg-transparent">
			<div className="grid grid-cols-4 gap-1 p-1 bg-white/[0.04] dark:bg-white/[0.04] border border-white/10 dark:border-white/10 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] box-border">
				{TAB_ITEMS.map((t) => {
					const isActive = currentTab === t.id;
					return (
						<motion.button
							key={t.id}
							whileTap={{ scale: 0.95 }}
							onClick={() => onTabChange(t.id)}
							title={t.title}
							className={`relative h-9 flex items-center justify-center gap-1.5 rounded-full transition-colors duration-200 cursor-pointer ${
								isActive ? `${t.activeText} font-bold` : 'text-on-surface-variant/75 hover:text-on-surface'
							}`}
						>
							{isActive && (
								<motion.div
									layoutId="active-tab-glass-pill"
									transition={{
										type: 'spring',
										stiffness: 340,
										damping: 30,
									}}
									className={`absolute inset-0 rounded-full border ${t.activePill}`}
								/>
							)}
							<t.Icon size={13.5} className={`shrink-0 relative z-10 ${getTabIconClass(t.id, isActive, t.activeText)}`} />
							<span className="text-xs tracking-tight font-bold relative z-10 whitespace-nowrap flex items-center">
								{t.label}
								{isActive && total > 0 && (
									<sup className="text-[9px] font-mono font-semibold ml-0.5 -top-1 opacity-80 leading-none">{total}</sup>
								)}
							</span>
						</motion.button>
					);
				})}
			</div>
		</div>
	);
}

function getEmptyMessage(selectedTags: string[], tab: LibraryTab): string {
	if (selectedTags.length > 0) return 'Không tìm thấy truyện nào phù hợp với bộ lọc tags';
	if (tab === 'HISTORY') return 'Chưa có lịch sử đọc truyện nào';
	if (tab === 'FAVORITE') return 'Chưa có truyện nào trong danh sách yêu thích';
	if (tab === 'AI') return 'Không có truyện nào đang chờ dịch AI';
	return 'Không tìm thấy truyện nào trong thư viện';
}

function LibraryBookListSkeleton() {
	return (
		<div className="space-y-3 relative">
			{[1, 2, 3, 4].map((idx) => (
				<div
					key={idx}
					className="h-28 rounded-2xl bg-white/[0.03] border border-outline-variant/30 animate-pulse p-3 flex gap-3 opacity-60"
				>
					<div className="w-16 h-20 bg-on-surface-variant/20 rounded-xl shrink-0" />
					<div className="flex-1 space-y-2 py-1">
						<div className="h-4 w-3/4 bg-on-surface-variant/20 rounded" />
						<div className="h-3 w-1/2 bg-on-surface-variant/20 rounded" />
						<div className="h-3 w-1/4 bg-primary/20 rounded pt-2" />
					</div>
				</div>
			))}
		</div>
	);
}

function LibraryEmptyState({
	tab,
	selectedTags,
	onClearTags,
	onOpenServerSettings,
}: {
	tab: LibraryTab;
	selectedTags: string[];
	onClearTags: () => void;
	onOpenServerSettings: () => void;
}) {
	const emptyMessage = getEmptyMessage(selectedTags, tab);
	return (
		<div className="text-center py-16 space-y-3">
			<div className="w-12 h-12 rounded-full bg-surface-container mx-auto flex items-center justify-center text-on-surface-variant">
				{tab === 'FAVORITE' ? <Heart size={20} className="text-rose-500" /> : <BookOpen size={20} />}
			</div>
			<p className="text-xs font-medium text-on-surface-variant/60">{emptyMessage}</p>
			{selectedTags.length > 0 ? (
				<button onClick={onClearTags} className="text-xs font-bold text-primary hover:underline">
					Xóa bộ lọc tags
				</button>
			) : (
				<button
					onClick={onOpenServerSettings}
					className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-all active:scale-95 cursor-pointer mt-1"
				>
					<span>Cấu hình Máy chủ</span>
				</button>
			)}
		</div>
	);
}

function LibraryBookList({
	loading,
	books,
	tab,
	selectedTags,
	onClearTags,
	onOpenServerSettings,
}: {
	loading: boolean;
	books: Book[];
	tab: LibraryTab;
	selectedTags: string[];
	onClearTags: () => void;
	onOpenServerSettings: () => void;
}) {
	if (loading && books.length === 0) {
		return <LibraryBookListSkeleton />;
	}
	if (books.length === 0 && !loading) {
		return (
			<LibraryEmptyState tab={tab} selectedTags={selectedTags} onClearTags={onClearTags} onOpenServerSettings={onOpenServerSettings} />
		);
	}
	return (
		<div className="flex flex-col gap-3">
			{books.map((book) => (
				<BookCard key={book.bookId} book={book} activeTab={tab} />
			))}
		</div>
	);
}

function LibraryTagBadges({
	selectedTags,
	onClearAll,
	onRemoveTag,
}: {
	selectedTags: string[];
	onClearAll: () => void;
	onRemoveTag: (tag: string) => void;
}) {
	if (selectedTags.length === 0) return null;
	return (
		<div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 border-b border-primary/20 overflow-x-auto hide-scrollbar">
			<button
				onClick={onClearAll}
				className="text-[10.5px] font-bold text-error hover:underline shrink-0 flex items-center gap-1 mr-0.5 px-1.5 py-0.5 rounded-md hover:bg-error/10 active:scale-95 transition-all"
				title="Xóa tất cả tags đang lọc"
			>
				<RotateCcw size={11} />
				<span>Xóa lọc</span>
			</button>
			{selectedTags.map((tag) => (
				<span
					key={tag}
					className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary text-on-primary shrink-0 shadow-xs"
				>
					<span>#{tag}</span>
					<button onClick={() => onRemoveTag(tag)} className="hover:opacity-80 active:scale-90" title={`Bỏ tag ${tag}`}>
						<X size={11} />
					</button>
				</span>
			))}
		</div>
	);
}

function useRestoreScrollOnLoad(loading: boolean, hasBooks: boolean, savedScrollY: number) {
	const isRestoredRef = useRef(false);
	useEffect(() => {
		if (!loading && hasBooks && !isRestoredRef.current) {
			isRestoredRef.current = true;
			if (typeof window !== 'undefined') {
				if (savedScrollY > 0) {
					requestAnimationFrame(() => {
						window.scrollTo({ top: savedScrollY, behavior: 'instant' });
					});
				} else {
					window.scrollTo({ top: 0, behavior: 'instant' });
				}
			}
		}
	}, [loading, hasBooks, savedScrollY]);
}

function useLibrarySwipeTabs({
	tab,
	disabled,
	onTabChange,
	contentContainerRef,
}: {
	tab: LibraryTab;
	disabled: boolean;
	onTabChange: (newTab: LibraryTab) => void;
	contentContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
	const handleSwipeLeft = useCallback(() => {
		const currentIndex = TABS.indexOf(tab);
		if (currentIndex < TABS.length - 1) {
			onTabChange(TABS[currentIndex + 1]);
		}
	}, [tab, onTabChange]);

	const handleSwipeRight = useCallback(() => {
		const currentIndex = TABS.indexOf(tab);
		if (currentIndex > 0) {
			onTabChange(TABS[currentIndex - 1]);
		}
	}, [tab, onTabChange]);

	const handleDragStart = useCallback(() => {
		if (contentContainerRef.current) {
			contentContainerRef.current.style.transition = 'none';
		}
	}, [contentContainerRef]);

	const handleDragMove = useCallback(
		(offset: number) => {
			if (!contentContainerRef.current) return;
			const currentIndex = TABS.indexOf(tab);
			let effectiveOffset = offset;
			if ((currentIndex === 0 && offset > 0) || (currentIndex === TABS.length - 1 && offset < 0)) {
				effectiveOffset = offset * 0.25;
			}
			contentContainerRef.current.style.transform = `translate3d(${effectiveOffset}px, 0, 0)`;
		},
		[tab, contentContainerRef]
	);

	const handleDragEnd = useCallback(() => {
		if (!contentContainerRef.current) return;
		contentContainerRef.current.style.transition = 'transform 240ms cubic-bezier(0.2, 0, 0, 1)';
		contentContainerRef.current.style.transform = 'translate3d(0px, 0, 0)';
	}, [contentContainerRef]);

	useSwipeGesture({
		onSwipeLeft: handleSwipeLeft,
		onSwipeRight: handleSwipeRight,
		onDragStart: handleDragStart,
		onDragMove: handleDragMove,
		onDragEnd: handleDragEnd,
		threshold: 70,
		minVelocity: 0.45,
		disabled,
	});
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

function resetScrollTop() {
	if (typeof window !== 'undefined') {
		window.scrollTo({ top: 0, behavior: 'instant' });
	}
}

function LibraryOfflineModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
	if (!isOpen) return null;
	return <OfflineManagerSheet onClose={onClose} />;
}

export function LibraryScreen() {
	useDocumentTitle();
	const { savedPage, savedTab, savedSearch, savedTags, savedSortBy, savedSortOrder, savedScrollY, setLibraryState, setSort } =
		useLibraryStore();

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

	const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
	const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);

	const isOfflineMode = useAppStore((state) => state.isOfflineMode);
	const showToast = useToastStore((state) => state.showToast);
	const readerLimit = useReaderConfigStore((state) => state.bookLimit);
	const bookLimit = readerLimit || 20;
	const { openSettings, isOfflineManagerOpen, closeOfflineManager } = useModalStore();

	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const fetchIdRef = useRef(0);
	const tabCacheRef = useRef<Record<string, { books: Book[]; totalPages: number; total: number }>>({});

	useRestoreScrollOnLoad(loading, books.length > 0, savedScrollY);

	// Sync state to useLibraryStore whenever page, tab, search, selectedTags, sortBy, sortOrder changes
	useEffect(() => {
		setLibraryState(page, tab, search, selectedTags, sortBy, sortOrder);
	}, [page, tab, search, selectedTags, sortBy, sortOrder, setLibraryState]);

	// Clean up search timeout on unmount
	useEffect(() => {
		return () => {
			if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
		};
	}, []);

	// Track and save scroll position on window scroll
	useEffect(() => {
		const handleScroll = () => {
			setLibraryState(page, tab, search, selectedTags, sortBy, sortOrder, window.scrollY);
		};
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	}, [page, tab, search, selectedTags, sortBy, sortOrder, setLibraryState]);

	// Fetch paginated books directly from backend API with tab, tags, and sort filter
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

	// Page change handler
	const handlePageChange = (newPage: number) => {
		setPage(newPage);
		setLibraryState(newPage, tab, search, selectedTags, sortBy, sortOrder, 0);
		resetScrollTop();
	};

	// Optimized Debounced search handler (400ms delay + immediate clear)
	const handleSearchChange = (val: string) => {
		setSearch(val);
		if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

		if (val.trim() === '') {
			setPage(1);
			setAppliedSearch('');
			setLibraryState(1, tab, '', selectedTags, sortBy, sortOrder, 0);
			return;
		}

		searchTimeoutRef.current = setTimeout(() => {
			setPage(1);
			setAppliedSearch(val);
			setLibraryState(1, tab, val, selectedTags, sortBy, sortOrder, 0);
		}, 400);
	};

	// Immediate search submit handler (e.g. Enter key or Search icon click)
	const handleSearchSubmit = () => {
		if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
		setPage(1);
		setAppliedSearch(search);
		setLibraryState(1, tab, search, selectedTags, sortBy, sortOrder, 0);
		resetScrollTop();
	};

	// Tab switch handler: resets page and passes new tab to API
	const handleTabChange = useCallback(
		(newTab: 'ALL' | 'HISTORY' | 'FAVORITE' | 'AI') => {
			if (newTab === tab) return;
			triggerHaptic('selection');

			setTab(newTab);
			setPage(1);

			// Fast cache lookup: if tab was previously loaded, show it immediately without flash
			const { sBy, sOrder } = resolveSortParams(newTab, sortBy, sortBy, sortOrder, sortOrder);
			const nextCacheKey = `${newTab}-1-${appliedSearch}-${selectedTags.join(',')}-${sBy}-${sOrder}`;
			const cached = tabCacheRef.current[nextCacheKey];
			if (cached) {
				setBooks(cached.books);
				setTotalPages(cached.totalPages);
				setTotal(cached.total);
			} else {
				setBooks([]);
			}

			setLibraryState(1, newTab, search, selectedTags, sortBy, sortOrder, 0);
			resetScrollTop();
		},
		[tab, sortBy, sortOrder, appliedSearch, selectedTags, search, setLibraryState]
	);

	// Native Swipe Gestures for Mobile Tab Switching with Smooth Transitions
	const contentContainerRef = useRef<HTMLDivElement | null>(null);

	useLibrarySwipeTabs({
		tab,
		disabled: isTagFilterOpen || isSortSheetOpen || isOfflineManagerOpen,
		onTabChange: handleTabChange,
		contentContainerRef,
	});

	// Tag filter apply handler
	const handleTagFilterApply = (newTags: string[]) => {
		triggerHaptic('light');
		setSelectedTags(newTags);
		setPage(1);
		setLibraryState(1, tab, search, newTags, sortBy, sortOrder, 0);
		resetScrollTop();
	};

	// Sort apply handler
	const handleSortApply = (newSortBy: SortByField, newSortOrder: SortOrderDirection) => {
		triggerHaptic('selection');
		setSortByState(newSortBy);
		setSortOrderState(newSortOrder);
		setSort(newSortBy, newSortOrder);
		setPage(1);
		resetScrollTop();
	};

	const defaultSortBy: SortByField = 'createdAt';
	const defaultSortOrder: SortOrderDirection = 'DESC';
	const isCustomSortActive = tab === 'ALL' && (sortBy !== defaultSortBy || sortOrder !== defaultSortOrder);

	const handlePullRefresh = useCallback(async () => {
		tabCacheRef.current = {};
		await clearAllCaches();
		setPage(1);
		await fetchBooks(1, appliedSearch, tab, selectedTags, sortBy, sortOrder, { forceFresh: true });
	}, [fetchBooks, appliedSearch, tab, selectedTags, sortBy, sortOrder]);

	return (
		<div className="min-h-dvh w-full max-w-md mx-auto bg-background text-on-background pb-20 border-x border-outline-variant/20 shadow-2xl relative overflow-x-hidden transition-colors duration-200">
			{/* Pull-to-refresh clear-cache gesture */}
			<PullToRefresh onRefresh={handlePullRefresh} disabled={loading} showIndicator={false} />

			{/* Unified Pinned Sticky Header (Title + Search + Tabs fixed together at top-0) */}
			<div className="sticky top-0 z-30 bg-background/98 dark:bg-background/98 backdrop-blur-md border-b border-outline-variant/20 transition-all duration-300">
				<LibraryHeader
					searchQuery={search}
					onSearchChange={handleSearchChange}
					onSubmitSearch={handleSearchSubmit}
					onOpenSettings={() => openSettings('reader')}
					onOpenTagFilter={() => setIsTagFilterOpen(true)}
					activeTagsCount={selectedTags.length}
					onOpenSort={tab === 'ALL' ? () => setIsSortSheetOpen(true) : undefined}
					isCustomSortActive={isCustomSortActive}
				/>

				{/* Active Tag Filter Pills Row */}
				<LibraryTagBadges
					selectedTags={selectedTags}
					onClearAll={() => handleTagFilterApply([])}
					onRemoveTag={(tag) => {
						const updated = selectedTags.filter((t) => t !== tag);
						handleTagFilterApply(updated);
					}}
				/>

				{/* Navigation Tabs (Full Width One UI Segmented Capsule) */}
				<LibraryTabsNav currentTab={tab} total={total} onTabChange={handleTabChange} />
			</div>

			{/* Book Cards List Content Container */}
			<div ref={contentContainerRef} className="px-3.5 pt-3.5 space-y-3 will-change-transform">
				<LibraryBookList
					loading={loading}
					books={books}
					tab={tab}
					selectedTags={selectedTags}
					onClearTags={() => handleTagFilterApply([])}
					onOpenServerSettings={() => openSettings('servers')}
				/>
			</div>

			{/* Global Settings & Modals */}
			<GlobalSettingsSheet />
			<LibraryOfflineModal isOpen={isOfflineManagerOpen} onClose={closeOfflineManager} />

			{/* Tag Filter Bottom Sheet */}
			<TagFilterSheet
				isOpen={isTagFilterOpen}
				selectedTags={selectedTags}
				onApply={handleTagFilterApply}
				onClose={() => setIsTagFilterOpen(false)}
			/>

			{/* Sort Options Bottom Sheet */}
			<SortSheet
				isOpen={isSortSheetOpen}
				currentSortBy={sortBy}
				currentSortOrder={sortOrder}
				defaultSortBy={defaultSortBy}
				defaultSortOrder={defaultSortOrder}
				onApply={handleSortApply}
				onClose={() => setIsSortSheetOpen(false)}
			/>

			{/* Floating Paging Capsule Bottom Dock connected to Server-Side Tab API Pagination */}
			<BottomDock page={page} totalPages={totalPages} total={total} loading={loading} onPageChange={handlePageChange} />
		</div>
	);
}
