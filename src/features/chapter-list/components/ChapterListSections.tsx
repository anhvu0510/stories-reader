import { ArrowLeft, Search, RefreshCw, Download, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { ChapterItem } from './ChapterItem';
import { ChapterRangeSelector } from './ChapterRangeSelector';

import type { Chapter, Book } from '@/shared/types';

function ChapterSkeletonList() {
	return (
		<div className="space-y-2 opacity-50 relative">
			{[1, 2, 3, 4, 5, 6].map((idx) => (
				<div
					key={idx}
					className="h-14 rounded-2xl bg-white/[0.03] border border-outline-variant/30 animate-pulse flex items-center px-4 justify-between"
				>
					<div className="h-4 w-40 bg-on-surface-variant/20 rounded" />
					<div className="h-5 w-12 bg-primary/20 rounded-xl" />
				</div>
			))}
		</div>
	);
}

interface LastReadBannerProps {
	lastReadChapter?: {
		chapterId: string;
		chapterNumber?: number | string;
		title?: string;
	};
	bookId: string;
}

function ChapterLastReadBanner({ lastReadChapter, bookId }: LastReadBannerProps) {
	if (!lastReadChapter?.chapterId) return null;
	const num = Number(lastReadChapter.chapterNumber || 1);
	return (
		<div className="mb-2 space-y-1.5">
			<div className="text-[11px] font-mono font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1 px-1">
				<span>📌 Chương đọc gần đây</span>
			</div>
			<ChapterItem
				chapter={{
					chapterId: lastReadChapter.chapterId,
					chapterNumber: num,
					title: lastReadChapter.title || `Chương ${num}`,
					state: 'SUCCEEDED',
					updatedAt: new Date().toISOString(),
					bookId,
				}}
				isActive={true}
				bookId={bookId}
			/>
		</div>
	);
}

export interface ChapterListContentProps {
	loading: boolean;
	chapters: Chapter[];
	filteredChapters: Chapter[];
	book: Book | null;
	bookId: string | undefined;
	loadingMore: boolean;
}

function ChapterItemsList({
	chapters,
	lastReadId,
	lastReadNumber,
	bookId,
}: {
	chapters: Chapter[];
	lastReadId?: string;
	lastReadNumber?: number;
	bookId: string;
}) {
	return (
		<>
			{chapters.map((chapter) => {
				const isCurrentReading = Boolean(
					(lastReadId && chapter.chapterId === lastReadId) || (lastReadNumber && chapter.chapterNumber === lastReadNumber)
				);
				return <ChapterItem key={chapter.chapterId} chapter={chapter} bookId={bookId} isActive={isCurrentReading} />;
			})}
		</>
	);
}

function ChapterListSpinner({ loadingMore }: { loadingMore: boolean }) {
	if (!loadingMore) return null;
	return (
		<div className="py-4 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2 font-mono">
			<RefreshCw size={14} className="animate-spin text-primary" />
			<span>Đang tải thêm chương tiếp theo...</span>
		</div>
	);
}

export function ChapterListContent({ loading, chapters, filteredChapters, book, bookId, loadingMore }: ChapterListContentProps) {
	if (loading && chapters.length === 0) {
		return <ChapterSkeletonList />;
	}
	if (filteredChapters.length === 0) {
		return (
			<div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium">Không tìm thấy chương nào trong khoảng này</div>
		);
	}

	const lastRead = book?.lastReadChapter;
	const safeBookId = bookId || '';

	return (
		<div className="flex flex-col gap-2">
			<ChapterLastReadBanner lastReadChapter={lastRead} bookId={safeBookId} />

			<div className="text-[11px] font-mono font-black text-on-surface-variant/70 uppercase tracking-wider flex items-center justify-between px-1 pt-1 pb-0.5">
				<span>📚 Tất cả chương</span>
			</div>

			<ChapterItemsList
				chapters={filteredChapters}
				lastReadId={lastRead?.chapterId}
				lastReadNumber={Number(lastRead?.chapterNumber)}
				bookId={safeBookId}
			/>

			<ChapterListSpinner loadingMore={loadingMore} />
		</div>
	);
}

interface HeaderActionsProps {
	book: Book | null;
	isFav: boolean;
	loading: boolean;
	onToggleFavorite: () => void;
	onDownload: () => void;
	onRefresh: () => void;
}

function ChapterHeaderActions({ book, isFav, loading, onToggleFavorite, onDownload, onRefresh }: HeaderActionsProps) {
	const favBtnClass = isFav
		? 'bg-rose-500/15 border-rose-500/40 text-rose-500 shadow-xs'
		: 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-rose-400';
	const favHeartClass = isFav ? 'fill-rose-500 text-rose-500' : '';

	return (
		<div className="flex items-center gap-1.5">
			{book && (
				<>
					<motion.button
						type="button"
						whileTap={{ scale: 0.88 }}
						onClick={onToggleFavorite}
						className={`w-9 h-9 rounded-full border transition-all flex items-center justify-center cursor-pointer ${favBtnClass}`}
						title={isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
					>
						<Heart size={15} className={favHeartClass} />
					</motion.button>

					<motion.button
						whileTap={{ scale: 0.88 }}
						onClick={onDownload}
						className="w-9 h-9 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer"
						title="Tải về bộ truyện"
					>
						<Download size={15} />
					</motion.button>
				</>
			)}

			<motion.button
				whileTap={{ scale: 0.88 }}
				onClick={onRefresh}
				disabled={loading}
				className="w-9 h-9 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer"
				title="Làm mới"
			>
				<RefreshCw size={15} className={loading ? 'animate-spin text-primary' : ''} />
			</motion.button>
		</div>
	);
}

interface SearchSortBarProps {
	search: string;
	filterState: string;
	sortOrder: 'ASC' | 'DESC';
	onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onFilterStateChange: (val: string) => void;
	onToggleSort: () => void;
}

function ChapterSearchSortBar({ search, filterState, sortOrder, onSearchChange, onFilterStateChange, onToggleSort }: SearchSortBarProps) {
	const isAsc = sortOrder === 'ASC';
	return (
		<div className="flex items-center gap-2">
			<div className="relative flex-1">
				<Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
				<input
					type="text"
					placeholder="Tìm số/tên chương..."
					value={search}
					onChange={onSearchChange}
					className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-surface-container border border-outline-variant/30 text-sm sm:text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 font-medium"
				/>
			</div>

			<select
				value={filterState}
				onChange={(e) => onFilterStateChange(e.target.value)}
				className="px-2.5 py-2 rounded-xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface font-mono font-bold cursor-pointer"
			>
				<option value="all">Tất cả</option>
				<option value="SUCCEEDED">Đã dịch</option>
				<option value="PENDING">Chưa dịch</option>
				<option value="FAILED">Lỗi</option>
			</select>

			<motion.button
				whileTap={{ scale: 0.88 }}
				onClick={onToggleSort}
				className="w-9 h-9 rounded-xl bg-surface-container border border-outline-variant/30 text-xs font-mono font-extrabold text-primary flex items-center justify-center cursor-pointer shrink-0"
				title={isAsc ? 'Sắp xếp: Tăng dần (Bấm để giảm dần)' : 'Sắp xếp: Giảm dần (Bấm để tăng dần)'}
			>
				{isAsc ? '▲' : '▼'}
			</motion.button>
		</div>
	);
}

export interface ChapterHeaderProps {
	book: Book | null;
	chaptersCount: number;
	isFav: boolean;
	loading: boolean;
	search: string;
	filterState: string;
	sortOrder: 'ASC' | 'DESC';
	activeRange: string;
	onBack: () => void;
	onToggleFavorite: () => void;
	onDownload: () => void;
	onRefresh: () => void;
	onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onFilterStateChange: (val: string) => void;
	onToggleSort: () => void;
	onRangeSelect: (range: string, start?: number, end?: number) => void;
}

export function ChapterHeader({
	book,
	chaptersCount,
	isFav,
	loading,
	search,
	filterState,
	sortOrder,
	activeRange,
	onBack,
	onToggleFavorite,
	onDownload,
	onRefresh,
	onSearchChange,
	onFilterStateChange,
	onToggleSort,
	onRangeSelect,
}: ChapterHeaderProps) {
	return (
		<header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-outline-variant/20 px-3.5 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 space-y-2.5 w-full max-w-md mx-auto">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<motion.button
						whileTap={{ scale: 0.88 }}
						onClick={onBack}
						className="w-9 h-9 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer"
						title="Về Thư viện"
					>
						<ArrowLeft size={16} />
					</motion.button>
					<div className="min-w-0">
						<h1 className="text-sm font-extrabold text-on-surface truncate">{book?.bookName || 'Đang tải...'}</h1>
						<p className="text-[10px] font-mono text-on-surface-variant/70 truncate">
							{book?.author || 'Vô danh'} • {book?.chapterCount || chaptersCount} CHƯƠNG
						</p>
					</div>
				</div>

				<ChapterHeaderActions
					book={book}
					isFav={isFav}
					loading={loading}
					onToggleFavorite={onToggleFavorite}
					onDownload={onDownload}
					onRefresh={onRefresh}
				/>
			</div>

			<ChapterSearchSortBar
				search={search}
				filterState={filterState}
				sortOrder={sortOrder}
				onSearchChange={onSearchChange}
				onFilterStateChange={onFilterStateChange}
				onToggleSort={onToggleSort}
			/>

			{book && (
				<ChapterRangeSelector totalChapters={book.chapterCount || chaptersCount} activeRange={activeRange} onRangeSelect={onRangeSelect} />
			)}
		</header>
	);
}
