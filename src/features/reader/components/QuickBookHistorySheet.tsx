import { Clock, Search, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BottomSheet } from '@/components/BottomSheet';
import { useGlobalLoading } from '@/hooks/useGlobalLoading';
import { triggerHaptic } from '@/hooks/useHaptic';
import { BookRepository } from '@/repositories/BookRepository';
import { openChapter } from '@/shared/utils/openChapter';

import { HistoryListContent } from './quick-book-history/HistoryBookList';

import type { Book } from '@/shared/types';

interface QuickBookHistorySheetProps {
	currentBookId?: string;
	onClose: () => void;
}

const PAGE_SIZE = 20;

async function fetchHistoryFallback(querySearch: string): Promise<Book[]> {
	try {
		const fallbackRes = await BookRepository.getBooks(1, PAGE_SIZE, querySearch, 'ALL', 'lastedReadAt', 'DESC');
		return (fallbackRes.books || []).filter((b) => b.lastReadChapter || b.totalTranslated > 0);
	} catch {
		return [];
	}
}

async function loadHistoryPage(querySearch: string, pageToLoad: number) {
	try {
		const res = await BookRepository.getBooks(pageToLoad, PAGE_SIZE, querySearch, 'HISTORY', 'lastedReadAt', 'DESC');
		const books = res.books ?? [];
		const totalPages = res.pagination?.totalPages ?? 1;
		const hasMore = pageToLoad < totalPages && books.length === PAGE_SIZE;

		if (books.length > 0 || pageToLoad > 1) {
			return { books, hasMore };
		}
		const fallback = await fetchHistoryFallback(querySearch);
		return { books: fallback, hasMore: fallback.length === PAGE_SIZE };
	} catch {
		if (pageToLoad === 1) {
			const fallback = await fetchHistoryFallback(querySearch);
			return { books: fallback, hasMore: fallback.length === PAGE_SIZE };
		}
		return { books: [], hasMore: false };
	}
}

function mergeUniqueBooks(prev: Book[], incoming: Book[]): Book[] {
	const existingIds = new Set(prev.map((b) => b.bookId));
	const uniqueNew = incoming.filter((b) => !existingIds.has(b.bookId));
	return [...prev, ...uniqueNew];
}

interface QuickBookHistoryHeaderProps {
	booksCount: number;
	searchQuery: string;
	onSearchChange: (val: string) => void;
	onSearchSubmit: () => void;
	onClose: () => void;
}

function QuickBookHistoryHeader({ booksCount, searchQuery, onSearchChange, onSearchSubmit, onClose }: QuickBookHistoryHeaderProps) {
	return (
		<div className="pt-2.5 px-4 pb-2.5 border-b border-white/10 space-y-2 flex-shrink-0 bg-transparent relative z-20">
			<div className="w-10 h-1 rounded-full bg-white/30 mx-auto flex-shrink-0" />

			<div className="flex items-center justify-between">
				<h3 className="text-xs font-black text-on-surface tracking-tight flex items-center gap-1.5 uppercase">
					<Clock size={15} className="text-primary" /> LỊCH SỬ ĐỌC TRUYỆN ({booksCount})
				</h3>
				<motion.button
					whileTap={{ scale: 0.88 }}
					onClick={() => {
						triggerHaptic('light');
						onClose();
					}}
					className="w-9 h-9 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer"
					title="Đóng"
					aria-label="Đóng"
				>
					<X size={16} />
				</motion.button>
			</div>

			<div className="relative">
				<button
					type="button"
					onClick={onSearchSubmit}
					className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-primary transition-colors cursor-pointer"
					title="Bấm để tìm kiếm"
				>
					<Search size={14} />
				</button>
				<input
					type="text"
					placeholder="Tìm kiếm truyện trong lịch sử (nhấn Enter)..."
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							onSearchSubmit();
						}
					}}
					className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/10 dark:bg-white/10 border border-white/15 text-sm sm:text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 font-medium shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] transition-all"
				/>
				{searchQuery && (
					<motion.button
						whileTap={{ scale: 0.85 }}
						onClick={() => {
							triggerHaptic('light');
							onSearchChange('');
						}}
						className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface"
						title="Xóa từ khóa"
					>
						<X size={13} />
					</motion.button>
				)}
			</div>
		</div>
	);
}

export function QuickBookHistorySheet({ currentBookId, onClose }: QuickBookHistorySheetProps) {
	const navigate = useNavigate();
	const [historyBooks, setHistoryBooks] = useState<Book[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	useGlobalLoading(loading && historyBooks.length === 0);
	const [searchQuery, setSearchQuery] = useState('');
	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);

	const fetchHistoryBooks = useCallback(async (querySearch: string = '', pageToLoad: number = 1, isLoadMore: boolean = false) => {
		setLoadingMore(isLoadMore);
		if (!isLoadMore) setLoading(true);

		try {
			const { books, hasMore: nextHasMore } = await loadHistoryPage(querySearch, pageToLoad);
			setHasMore(nextHasMore);
			setPage(pageToLoad);

			if (isLoadMore) {
				setHistoryBooks((prev) => mergeUniqueBooks(prev, books));
				return;
			}
			setHistoryBooks(books);
		} finally {
			setLoadingMore(false);
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchHistoryBooks('', 1, false);
	}, [fetchHistoryBooks]);

	const handleScroll = () => {
		if (!scrollContainerRef.current || loading || loadingMore || !hasMore) return;
		const { scrollTop, clientHeight, scrollHeight } = scrollContainerRef.current;
		if (scrollTop + clientHeight < scrollHeight - 150) return;
		fetchHistoryBooks(searchQuery, page + 1, true);
	};

	const handleSearchChange = (val: string) => {
		setSearchQuery(val);
		if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

		if (val.trim() === '') {
			fetchHistoryBooks('', 1, false);
			return;
		}

		searchTimeoutRef.current = setTimeout(() => {
			fetchHistoryBooks(val, 1, false);
		}, 650);
	};

	const handleSearchSubmit = () => {
		if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
		fetchHistoryBooks(searchQuery, 1, false);
	};

	const handleSwapBook = (book: Book) => {
		onClose();
		if (book.lastReadChapter?.chapterId) {
			openChapter(book.bookId, book.lastReadChapter.chapterId);
			return;
		}
		navigate(`/book/${book.bookId}`);
	};

	const currentBook = historyBooks.find((b) => b.bookId === currentBookId);
	const otherBooks = historyBooks.filter((b) => b.bookId !== currentBookId);
	const displayBooks = searchQuery.trim() ? historyBooks : otherBooks;

	return (
		<BottomSheet isOpen={true} onClose={onClose} ariaLabel="Lịch Sử Đọc Truyện" maxHeight="h-[78vh] max-h-[90dvh]" showDragHandle={false}>
			<QuickBookHistoryHeader
				booksCount={historyBooks.length}
				searchQuery={searchQuery}
				onSearchChange={handleSearchChange}
				onSearchSubmit={handleSearchSubmit}
				onClose={onClose}
			/>

			<div
				ref={scrollContainerRef}
				onScroll={handleScroll}
				className="p-3 overflow-y-auto hide-scrollbar overscroll-contain flex-1 min-h-0 space-y-3"
			>
				<HistoryListContent
					loading={loading}
					loadingMore={loadingMore}
					searchQuery={searchQuery}
					currentBook={currentBook}
					otherBooks={otherBooks}
					displayBooks={displayBooks}
					onSwapBook={handleSwapBook}
				/>
			</div>
		</BottomSheet>
	);
}
