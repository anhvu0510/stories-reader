import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Clock, Sparkles, Library, X, RotateCcw, Heart, Search, Tag, ArrowUpDown } from 'lucide-react';

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
import { useLibraryStore, SortByField, SortOrderDirection } from '@/stores/useLibraryStore';
import { useModalStore } from '@/stores/useModalStore';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { useToastStore } from '@/stores/useToastStore';

import { BookCard } from './components/BookCard';
import { LibraryHeader } from './components/LibraryHeader';
import { SortSheet } from './components/SortSheet';
import { TagFilterSheet } from './components/TagFilterSheet';

import type { Book } from '@/shared/types';

const TABS: readonly ['ALL', 'HISTORY', 'FAVORITE', 'AI'] = ['ALL', 'HISTORY', 'FAVORITE', 'AI'] as const;

export function LibraryScreen() {
	useDocumentTitle();
	const { savedPage, savedTab, savedSearch, savedTags, savedSortBy, savedSortOrder, savedScrollY, setLibraryState, setSort } = useLibraryStore();

	const [books, setBooks] = useState<Book[]>([]);
	const [page, setPage] = useState(savedPage || 1);
	const [totalPages, setTotalPages] = useState(1);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);

	const [search, setSearch] = useState(savedSearch || '');
	const [appliedSearch, setAppliedSearch] = useState(savedSearch || '');
	const [tab, setTab] = useState<'ALL' | 'HISTORY' | 'FAVORITE' | 'AI'>(savedTab);
	const [selectedTags, setSelectedTags] = useState<string[]>(savedTags || []);
	const initialSortBy: SortByField = savedSortBy === 'updatedAt' ? 'updatedAt' : 'createdAt';
	const [sortBy, setSortByState] = useState<SortByField>(initialSortBy);
	const [sortOrder, setSortOrderState] = useState<SortOrderDirection>(savedSortOrder || 'DESC');

	const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
	const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);

	const isOfflineMode = useAppStore((state) => state.isOfflineMode);
	const showToast = useToastStore((state) => state.showToast);
	const bookLimit = useReaderConfigStore((state) => state.bookLimit || 20);
	const { openSettings, isOfflineManagerOpen, closeOfflineManager } = useModalStore();

	const mainScrollRef = useRef<HTMLDivElement | null>(null);
	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isRestoredRef = useRef(false);
	const fetchIdRef = useRef(0);
	const tabCacheRef = useRef<Record<string, { books: Book[]; totalPages: number; total: number }>>({});

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

	// Track and save scroll position on main container scroll
	const handleMainScroll = () => {
		if (mainScrollRef.current) {
			setLibraryState(page, tab, search, selectedTags, sortBy, sortOrder, mainScrollRef.current.scrollTop);
		}
	};

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
			const q = querySearch !== undefined ? querySearch : appliedSearch;
			const t = activeTab !== undefined ? activeTab : tab;
			const tg = filterTags !== undefined ? filterTags : selectedTags;

			let sBy: SortByField;
			let sOrder: SortOrderDirection = 'DESC';

			if (t === 'HISTORY') {
				sBy = 'lastedReadAt';
			} else if (t === 'ALL') {
				const rawSortBy = currentSortBy !== undefined ? currentSortBy : sortBy;
				sBy = rawSortBy === 'updatedAt' ? 'updatedAt' : 'createdAt';
				sOrder = currentSortOrder !== undefined ? currentSortOrder : sortOrder;
			} else {
				sBy = 'createdAt';
			}

			try {
				const res = options
					? await BookRepository.getBooks(targetPage, bookLimit, q, t, sBy, sOrder, tg, options)
					: await BookRepository.getBooks(targetPage, bookLimit, q, t, sBy, sOrder, tg);
				if (fetchId !== fetchIdRef.current) return;
				const fetchedBooks = res.books || [];
				const { currentPage, totalPages: pagesCount, total: totalCount } = res.pagination || {};

				setBooks(fetchedBooks);
				setPage(currentPage || targetPage);
				setTotalPages(pagesCount || 1);
				setTotal(totalCount || fetchedBooks.length);

				// Cache per-tab results for instantaneous 60fps tab switching
				const cacheKey = `${t}-${targetPage}-${q}-${tg.join(',')}-${sBy}-${sOrder}`;
				tabCacheRef.current[cacheKey] = {
					books: fetchedBooks,
					totalPages: pagesCount || 1,
					total: totalCount || fetchedBooks.length
				};
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

	// Restore scroll position after initial loading finishes
	useEffect(() => {
		if (!loading && books.length > 0 && !isRestoredRef.current) {
			isRestoredRef.current = true;
			if (typeof window !== 'undefined') {
				window.scrollTo(0, 0);
			}
			if (savedScrollY > 0 && mainScrollRef.current) {
				requestAnimationFrame(() => {
					if (mainScrollRef.current) {
						mainScrollRef.current.scrollTop = savedScrollY;
					}
				});
			} else if (mainScrollRef.current) {
				mainScrollRef.current.scrollTop = 0;
			}
		}
	}, [loading, books, savedScrollY]);

	// Page change handler
	const handlePageChange = (newPage: number) => {
		setPage(newPage);
		setLibraryState(newPage, tab, search, selectedTags, sortBy, sortOrder, 0);
		if (mainScrollRef.current) {
			mainScrollRef.current.scrollTop = 0;
		}
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
	};

	// Tab switch handler: resets page and passes new tab to API
	const handleTabChange = useCallback(
		(newTab: 'ALL' | 'HISTORY' | 'FAVORITE' | 'AI') => {
			if (newTab === tab) return;
			triggerHaptic('selection');

			setTab(newTab);
			setPage(1);

			// Fast cache lookup: if tab was previously loaded, show it immediately without flash
			let sBy: SortByField = 'createdAt';
			let sOrder: SortOrderDirection = 'DESC';
			if (newTab === 'HISTORY') {
				sBy = 'lastedReadAt';
			} else if (newTab === 'ALL') {
				sBy = sortBy === 'updatedAt' ? 'updatedAt' : 'createdAt';
				sOrder = sortOrder;
			}
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
			if (mainScrollRef.current) {
				mainScrollRef.current.scrollTop = 0;
			}
		},
		[tab, sortBy, sortOrder, appliedSearch, selectedTags, search, setLibraryState]
	);

	// Native Swipe Gestures for Mobile Tab Switching with Smooth Transitions
	const contentContainerRef = useRef<HTMLDivElement | null>(null);

	const handleSwipeLeft = useCallback(() => {
		const currentIndex = TABS.indexOf(tab);
		if (currentIndex < TABS.length - 1) {
			handleTabChange(TABS[currentIndex + 1]);
		}
	}, [tab, handleTabChange]);

	const handleSwipeRight = useCallback(() => {
		const currentIndex = TABS.indexOf(tab);
		if (currentIndex > 0) {
			handleTabChange(TABS[currentIndex - 1]);
		}
	}, [tab, handleTabChange]);

	const handleDragStart = useCallback(() => {
		if (contentContainerRef.current) {
			contentContainerRef.current.style.transition = 'none';
		}
	}, []);

	const handleDragMove = useCallback((offset: number) => {
		if (!contentContainerRef.current) return;
		const currentIndex = TABS.indexOf(tab);
		// Apply rubber-band damping at boundaries
		let effectiveOffset = offset;
		if ((currentIndex === 0 && offset > 0) || (currentIndex === TABS.length - 1 && offset < 0)) {
			effectiveOffset = offset * 0.25;
		}
		contentContainerRef.current.style.transform = `translate3d(${effectiveOffset}px, 0, 0)`;
	}, [tab]);

	const handleDragEnd = useCallback(() => {
		if (!contentContainerRef.current) return;
		contentContainerRef.current.style.transition = 'transform 240ms cubic-bezier(0.2, 0, 0, 1)';
		contentContainerRef.current.style.transform = 'translate3d(0px, 0, 0)';
	}, []);

	useSwipeGesture({
		onSwipeLeft: handleSwipeLeft,
		onSwipeRight: handleSwipeRight,
		onDragStart: handleDragStart,
		onDragMove: handleDragMove,
		onDragEnd: handleDragEnd,
		threshold: 45,
		minVelocity: 0.35,
		disabled: isTagFilterOpen || isSortSheetOpen || isOfflineManagerOpen
	});


	// Tag filter apply handler
	const handleTagFilterApply = (newTags: string[]) => {
		triggerHaptic('light');
		setSelectedTags(newTags);
		setPage(1);
		setLibraryState(1, tab, search, newTags, sortBy, sortOrder, 0);
		if (mainScrollRef.current) {
			mainScrollRef.current.scrollTop = 0;
		}
	};

	// Sort apply handler
	const handleSortApply = (newSortBy: SortByField, newSortOrder: SortOrderDirection) => {
		triggerHaptic('selection');
		setSortByState(newSortBy);
		setSortOrderState(newSortOrder);
		setSort(newSortBy, newSortOrder);
		setPage(1);
		if (mainScrollRef.current) {
			mainScrollRef.current.scrollTop = 0;
		}
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
		<div className="h-dvh w-full max-w-md mx-auto bg-background text-on-background border-x border-outline-variant/20 shadow-2xl relative overflow-hidden flex flex-col transition-colors duration-200">
			{/* Pull-to-refresh clear-cache gesture */}
			<PullToRefresh
				onRefresh={handlePullRefresh}
				containerRef={mainScrollRef}
				disabled={loading}
				showIndicator={false}
			/>

			{/* Main Scroll Container covering entire screen so items scroll UNDER sticky glass header */}
			<main ref={mainScrollRef} onScroll={handleMainScroll} className="flex-1 overflow-y-auto hide-scrollbar no-scrollbar relative">
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
					{selectedTags.length > 0 && (
						<div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 border-b border-primary/20 overflow-x-auto hide-scrollbar">
							<button
								onClick={() => handleTagFilterApply([])}
								className="text-[10.5px] font-bold text-error hover:underline shrink-0 flex items-center gap-1 mr-0.5 px-1.5 py-0.5 rounded-md hover:bg-error/10 active:scale-95 transition-all"
								title="Xóa tất cả tags đang lọc"
							>
								<RotateCcw size={11} />
								<span>Xóa lọc</span>
							</button>
							{selectedTags.map((tag) => (
								<span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary text-on-primary shrink-0 shadow-xs">
									<span>#{tag}</span>
									<button
										onClick={() => {
											const updated = selectedTags.filter((t) => t !== tag);
											handleTagFilterApply(updated);
										}}
										className="hover:opacity-80 active:scale-90"
										title={`Bỏ tag ${tag}`}
									>
										<X size={11} />
									</button>
								</span>
							))}
						</div>
					)}

					{/* Navigation Tabs (Full Width One UI Segmented Capsule) */}
					<div className="px-3.5 pt-1 pb-2 border-t border-white/10 dark:border-white/5 bg-transparent">
						{/* Full-Width Spacious Segmented Capsule Tabs */}
						<div className="grid grid-cols-4 gap-1 p-1 bg-white/[0.04] dark:bg-white/[0.04] border border-white/10 dark:border-white/10 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] box-border">
							{[
								{
									id: 'ALL',
									label: 'Tất cả',
									title: 'Tất cả truyện',
									Icon: Library,
									activeText: 'text-primary font-bold',
									activePill: 'bg-gradient-to-b from-primary/30 to-primary/10 border-primary/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]'
								},
								{
									id: 'HISTORY',
									label: 'Lịch sử',
									title: 'Lịch sử đọc',
									Icon: Clock,
									activeText: 'text-primary font-bold',
									activePill: 'bg-gradient-to-b from-primary/30 to-primary/10 border-primary/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]'
								},
								{
									id: 'FAVORITE',
									label: 'Yêu thích',
									title: 'Truyện yêu thích',
									Icon: Heart,
									activeText: 'text-rose-400 font-bold',
									activePill: 'bg-gradient-to-b from-rose-500/30 to-rose-500/10 border-rose-500/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]'
								},
								{
									id: 'AI',
									label: 'Dịch AI',
									title: 'Truyện dịch AI',
									Icon: Sparkles,
									activeText: 'text-emerald-400 font-bold',
									activePill: 'bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 border-emerald-400/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]'
								}
							].map((t) => {
								const isActive = tab === t.id;
								return (
									<motion.button
										key={t.id}
										whileTap={{ scale: 0.95 }}
										onClick={() => handleTabChange(t.id as any)}
										title={t.title}
										className={`relative h-9 flex items-center justify-center gap-1.5 rounded-full transition-colors duration-200 cursor-pointer ${isActive ? `${t.activeText} font-bold` : 'text-on-surface-variant/75 hover:text-on-surface'}`}
									>
										{isActive && (
											<motion.div
												layoutId="active-tab-glass-pill"
												transition={{
													type: 'spring',
													stiffness: 340,
													damping: 30
												}}
												className={`absolute inset-0 rounded-full border ${t.activePill}`}
											/>
										)}
										<t.Icon
											size={13.5}
											className={`shrink-0 relative z-10 ${t.id === 'FAVORITE' && isActive ? 'fill-rose-500 text-rose-500' : isActive ? t.activeText : 'text-on-surface-variant/60'}`}
										/>
										<span className="text-xs tracking-tight font-bold relative z-10 whitespace-nowrap flex items-center">
											{t.label}
											{isActive && total > 0 && (
												<sup className="text-[9px] font-mono font-semibold ml-0.5 -top-1 opacity-80 leading-none">
													{total}
												</sup>
											)}
										</span>
									</motion.button>
								);
							})}
						</div>
					</div>
				</div>

				{/* Book Cards List Content Container */}
				<div ref={contentContainerRef} className="px-3.5 pt-3.5 pb-28 space-y-3 will-change-transform">
					{loading && books.length === 0 ? (
						<div className="space-y-3 relative">
							{[1, 2, 3, 4].map((idx) => (
								<div key={idx} className="h-28 rounded-2xl bg-white/[0.03] border border-outline-variant/30 animate-pulse p-3 flex gap-3 opacity-60">
									<div className="w-16 h-20 bg-on-surface-variant/20 rounded-xl shrink-0" />
									<div className="flex-1 space-y-2 py-1">
										<div className="h-4 w-3/4 bg-on-surface-variant/20 rounded" />
										<div className="h-3 w-1/2 bg-on-surface-variant/20 rounded" />
										<div className="h-3 w-1/4 bg-primary/20 rounded pt-2" />
									</div>
								</div>
							))}
						</div>
					) : books.length === 0 && !loading ? (
						<div className="text-center py-16 space-y-3">
							<div className="w-12 h-12 rounded-full bg-surface-container mx-auto flex items-center justify-center text-on-surface-variant">
								{tab === 'FAVORITE' ? <Heart size={20} className="text-rose-500" /> : <BookOpen size={20} />}
							</div>
							<p className="text-xs font-medium text-on-surface-variant/60">
								{selectedTags.length > 0
									? 'Không tìm thấy truyện nào phù hợp với bộ lọc tags'
									: tab === 'HISTORY'
										? 'Chưa có lịch sử đọc truyện nào'
										: tab === 'FAVORITE'
											? 'Chưa có truyện nào trong danh sách yêu thích'
											: tab === 'AI'
												? 'Không có truyện nào đang chờ dịch AI'
												: 'Không tìm thấy truyện nào trong thư viện'}
							</p>
							{selectedTags.length > 0 ? (
								<button onClick={() => handleTagFilterApply([])} className="text-xs font-bold text-primary hover:underline">
									Xóa bộ lọc tags
								</button>
							) : (
								<button
									onClick={() => openSettings('servers')}
									className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-all active:scale-95 cursor-pointer mt-1"
								>
									<span>Cấu hình Máy chủ</span>
								</button>
							)}
						</div>
					) : (
						<div className="flex flex-col gap-3">
							{books.map((book) => (
								<BookCard key={book.bookId} book={book} activeTab={tab} />
							))}
						</div>
					)}
				</div>
			</main>

			{/* Global Settings & Modals */}
			<GlobalSettingsSheet />
			{isOfflineManagerOpen && <OfflineManagerSheet onClose={closeOfflineManager} />}

			{/* Tag Filter Bottom Sheet */}
			<TagFilterSheet isOpen={isTagFilterOpen} selectedTags={selectedTags} onApply={handleTagFilterApply} onClose={() => setIsTagFilterOpen(false)} />

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
