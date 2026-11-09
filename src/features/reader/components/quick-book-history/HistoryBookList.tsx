import { BookOpen, Clock, Layers, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

import { triggerHaptic } from '@/hooks/useHaptic';

import type { Book } from '@/shared/types';

function formatDate(dateStr?: string) {
	if (!dateStr) return '--';
	try {
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return dateStr;
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${day}-${month}-${year}`;
	} catch {
		return dateStr;
	}
}

function getBookReadCount(book: Book): number {
	if (book.lastReadChapter?.chapterNumber !== undefined) return Number(book.lastReadChapter.chapterNumber);
	return book.totalTranslated > 0 ? 1 : 0;
}

function getBookRawDate(book: Book): string | undefined {
	return book.lastedReadAt || book.updatedAt || book.createdAt;
}

interface BookCardTheme {
	cardClass: string;
	badgeClass: string;
	titleClass: string;
	chapterBadgeClass: string;
	chapterTitleClass: string;
	dateRowClass: string;
	dateIconClass: string;
	readCountClass: string;
	readCountIconClass: string;
	translatedClass: string;
}

const PINNED_THEME: BookCardTheme = {
	cardClass:
		'group relative z-10 rounded-xl p-2.5 transition-colors cursor-pointer flex items-center justify-between gap-2.5 shadow-xs hover:shadow-md overflow-hidden bg-primary/20 hover:bg-primary/25 border border-primary/50 border-l-4 border-l-primary text-primary shadow-xs',
	badgeClass:
		'w-9 h-9 rounded-lg flex flex-col items-center justify-center flex-shrink-0 font-mono shadow-2xs bg-primary/30 border border-primary/70 text-primary font-extrabold shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.5)]',
	titleClass: 'text-xs font-extrabold leading-tight tracking-tight transition-colors truncate text-primary font-black drop-shadow-xs',
	chapterBadgeClass:
		'px-1.5 py-0.5 min-w-[28px] h-5 rounded-md font-mono font-extrabold text-[9.5px] whitespace-nowrap flex items-center justify-center shrink-0 shadow-2xs bg-primary/25 border border-primary/50 text-primary',
	chapterTitleClass: 'truncate block text-[10.5px] font-medium text-primary/90',
	dateRowClass: 'flex items-center gap-1 shrink-0 text-primary/80 font-medium',
	dateIconClass: 'text-primary/70',
	readCountClass:
		'inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md font-bold shrink-0 border border-emerald-400/40 bg-emerald-400/20 text-emerald-300',
	readCountIconClass: 'text-emerald-300',
	translatedClass:
		'inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md font-bold shrink-0 border border-primary/40 bg-primary/20 text-primary',
};

const UNPINNED_THEME: BookCardTheme = {
	cardClass:
		'group relative z-10 rounded-xl p-2.5 transition-colors cursor-pointer flex items-center justify-between gap-2.5 shadow-xs hover:shadow-md overflow-hidden bg-white/[0.04] dark:bg-white/[0.04] hover:bg-white/[0.08] dark:hover:bg-white/[0.08] border border-white/10 dark:border-white/10 border-l-4 border-l-primary shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.15)] hover:border-primary/50 text-on-surface',
	badgeClass:
		'w-9 h-9 rounded-lg flex flex-col items-center justify-center flex-shrink-0 font-mono shadow-2xs bg-primary/10 border border-primary/30 text-primary/90 font-bold',
	titleClass: 'text-xs font-extrabold leading-tight tracking-tight transition-colors truncate text-on-surface group-hover:text-primary',
	chapterBadgeClass:
		'px-1.5 py-0.5 min-w-[28px] h-5 rounded-md font-mono font-extrabold text-[9.5px] whitespace-nowrap flex items-center justify-center shrink-0 shadow-2xs bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	chapterTitleClass: 'truncate block text-[10.5px] font-medium text-on-surface-variant/90',
	dateRowClass: 'flex items-center gap-1 shrink-0 text-on-surface-variant/70',
	dateIconClass: 'text-on-surface-variant/60',
	readCountClass:
		'inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md font-bold shrink-0 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
	readCountIconClass: 'text-emerald-400',
	translatedClass:
		'inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md font-bold shrink-0 border border-primary/30 bg-primary/10 text-primary',
};

interface HistoryBookCardProps {
	key?: string;
	book: Book;
	isPinned: boolean;
	onSwap: (book: Book) => void;
}

function HistoryBookCard({ book, isPinned, onSwap }: HistoryBookCardProps) {
	const rawDate = getBookRawDate(book);
	const formattedDate = formatDate(rawDate);
	const readCount = getBookReadCount(book);
	const theme = isPinned ? PINNED_THEME : UNPINNED_THEME;

	return (
		<motion.div
			key={book.bookId}
			whileTap={{ scale: 0.98 }}
			onClick={() => {
				triggerHaptic('light');
				onSwap(book);
			}}
			className={theme.cardClass}
		>
			<div className={theme.badgeClass}>
				<span className="text-[7px] font-extrabold uppercase tracking-wider leading-none flex items-center gap-0.5 text-primary/80">
					<Layers size={8} /> TỔNG
				</span>
				<span className="text-xs font-black leading-none mt-0.5 text-primary">{book.chapterCount}</span>
			</div>

			<div className="flex-1 min-w-0 space-y-1">
				<h4 className={theme.titleClass}>{book.bookName}</h4>

				{book.lastReadChapter?.chapterId && (
					<div className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden">
						<span className={theme.chapterBadgeClass}>Ch.{book.lastReadChapter.chapterNumber}</span>
						{book.lastReadChapter.title && (
							<div className="flex-1 min-w-0 overflow-hidden">
								<span className={theme.chapterTitleClass}>{book.lastReadChapter.title}</span>
							</div>
						)}
					</div>
				)}

				<div className="flex items-center gap-1.5 text-[9.5px] font-mono whitespace-nowrap flex-nowrap shrink-0 overflow-hidden pt-0.5">
					<div className={theme.dateRowClass}>
						<Clock size={10} className={theme.dateIconClass} />
						<span>{formattedDate}</span>
					</div>

					<span className={theme.readCountClass}>
						<BookOpen size={10} className={theme.readCountIconClass} />
						<span>{readCount}</span>
					</span>

					<span className={theme.translatedClass}>
						<Sparkles size={10} className="text-primary" />
						<span>{book.totalTranslated}</span>
					</span>
				</div>
			</div>
		</motion.div>
	);
}

function HistoryEmptyState({ isSearching, searchQuery }: { isSearching: boolean; searchQuery: string }) {
	return (
		<div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium">
			{isSearching ? `Không tìm thấy truyện phù hợp với "${searchQuery}"` : 'Chưa có lịch sử đọc truyện nào'}
		</div>
	);
}

function HistoryResultsSection({
	displayBooks,
	isSearching,
	loadingMore,
	searchQuery,
	onSwapBook,
}: {
	displayBooks: Book[];
	isSearching: boolean;
	loadingMore: boolean;
	searchQuery: string;
	onSwapBook: (book: Book) => void;
}) {
	if (displayBooks.length === 0) {
		if (!isSearching) return null;
		return (
			<div className="py-10 text-center text-xs text-on-surface-variant/60 font-medium">
				Không tìm thấy truyện phù hợp với "{searchQuery}"
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-[10px] font-mono font-extrabold text-on-surface-variant/70 uppercase tracking-widest px-1">
				<span>{isSearching ? 'KẾT QUẢ TÌM KIẾM' : 'DANH SÁCH LỊCH SỬ'}</span>
				<span>{displayBooks.length} truyện</span>
			</div>
			<div className="space-y-3">
				{displayBooks.map((b) => (
					<HistoryBookCard key={b.bookId} book={b} isPinned={false} onSwap={onSwapBook} />
				))}
			</div>
			{loadingMore && (
				<div className="py-2.5 text-center text-xs text-primary font-medium flex items-center justify-center gap-2">
					<span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
					<span>Đang tải thêm...</span>
				</div>
			)}
		</div>
	);
}

export interface HistoryListContentProps {
	loading: boolean;
	loadingMore: boolean;
	searchQuery: string;
	currentBook?: Book;
	otherBooks: Book[];
	displayBooks: Book[];
	onSwapBook: (book: Book) => void;
}

export function HistoryListContent({
	loading,
	loadingMore,
	searchQuery,
	currentBook,
	otherBooks,
	displayBooks,
	onSwapBook,
}: HistoryListContentProps) {
	if (loading) {
		return <div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium" />;
	}

	const isSearching = Boolean(searchQuery.trim());

	if (displayBooks.length === 0 && !currentBook) {
		return <HistoryEmptyState isSearching={isSearching} searchQuery={searchQuery} />;
	}

	return (
		<>
			{currentBook && !isSearching && (
				<div className="space-y-1.5 pb-1">
					<HistoryBookCard book={currentBook} isPinned={true} onSwap={onSwapBook} />
					{otherBooks.length > 0 && <div className="h-px w-full bg-outline-variant/30 my-2.5" />}
				</div>
			)}

			<HistoryResultsSection
				displayBooks={displayBooks}
				isSearching={isSearching}
				loadingMore={loadingMore}
				searchQuery={searchQuery}
				onSwapBook={onSwapBook}
			/>
		</>
	);
}
