import { AlertCircle, Check, CheckCircle2, Clock, Eye, EyeOff, Languages, RotateCcw, Search, Square } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import { getChapterBadgeClass } from './translationHelpers';

import type { Book, Chapter } from '@/shared/types';

function ChapterStateIcon({ state }: { state?: string }) {
	if (state === 'SUCCEEDED') {
		return <CheckCircle2 size={13} className="text-primary shrink-0" title="Đã dịch" />;
	}
	if (state === 'FAILED') {
		return <AlertCircle size={13} className="text-rose-400 shrink-0" title="Lỗi dịch" />;
	}
	return <Clock size={13} className="text-amber-400/80 shrink-0" title="Chưa dịch" />;
}

export interface ChapterBatchControlsProps {
	selectedCount: number;
	chaptersCount: number;
	onClearSelection: () => void;
	showOnlyPending: boolean;
	onTogglePending: (val: boolean) => void;
	rangeStart: string;
	setRangeStart: (val: string) => void;
	rangeEnd: string;
	setRangeEnd: (val: string) => void;
	onSelectRange: () => void;
	onSelectAll: () => void;
	onSelectPending: () => void;
}

export function ChapterBatchControls({
	selectedCount,
	chaptersCount,
	onClearSelection,
	showOnlyPending,
	onTogglePending,
	rangeStart,
	setRangeStart,
	rangeEnd,
	setRangeEnd,
	onSelectRange,
	onSelectAll,
	onSelectPending,
}: ChapterBatchControlsProps) {
	return (
		<div className="flex flex-col gap-2.5 mb-3 bg-white/[0.02] p-2.5 rounded-2xl border border-white/10">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Chọn chương</span>
					<span
						className={cn(
							'text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md border transition-all',
							selectedCount > 0
								? 'bg-primary/20 text-primary border-primary/50 shadow-xs'
								: 'bg-white/5 text-on-surface-variant/70 border-white/10'
						)}
					>
						{selectedCount}/{chaptersCount}
					</span>
				</div>

				<div className="flex items-center gap-1.5">
					{selectedCount > 0 && (
						<button
							onClick={onClearSelection}
							className="p-1.5 rounded-lg border bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400 active:scale-95 transition-all flex items-center justify-center"
							title="Bỏ chọn tất cả"
							aria-label="Bỏ chọn"
						>
							<RotateCcw size={13} />
						</button>
					)}

					<label
						className={cn(
							'p-1.5 rounded-lg border transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center',
							showOnlyPending
								? 'bg-primary/20 text-primary border-primary/60 shadow-xs'
								: 'bg-white/5 text-on-surface-variant/70 border-white/10 hover:bg-white/10'
						)}
						title="Ẩn chương đã dịch"
					>
						<input
							type="checkbox"
							checked={showOnlyPending}
							onChange={(e) => onTogglePending(e.target.checked)}
							className="sr-only"
							aria-label="Ẩn đã dịch"
						/>
						{showOnlyPending ? <EyeOff size={13} /> : <Eye size={13} />}
					</label>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
				<div className="flex items-center gap-1">
					<button
						onClick={onSelectAll}
						className="px-2.5 py-1 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-bold text-primary active:scale-95 transition-all"
					>
						Tất cả
					</button>
					<button
						onClick={onSelectPending}
						className="px-2.5 py-1 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-bold text-primary active:scale-95 transition-all"
					>
						Chưa dịch
					</button>
				</div>

				<div className="flex items-center gap-1.5 ml-auto">
					<span className="text-[10px] text-on-surface-variant/70 font-medium">Từ</span>
					<input
						type="number"
						placeholder="..."
						value={rangeStart}
						onChange={(e) => setRangeStart(e.target.value)}
						className="w-11 bg-black/30 border border-white/15 px-1 py-0.5 rounded-md text-[11px] font-mono text-primary text-center outline-none focus:border-primary/70 transition-all"
					/>
					<span className="text-[10px] text-on-surface-variant/50">-</span>
					<input
						type="number"
						placeholder="..."
						value={rangeEnd}
						onChange={(e) => setRangeEnd(e.target.value)}
						className="w-11 bg-black/30 border border-white/15 px-1 py-0.5 rounded-md text-[11px] font-mono text-primary text-center outline-none focus:border-primary/70 transition-all"
					/>
					<button
						onClick={onSelectRange}
						className="text-[10px] bg-primary text-on-primary border border-primary/70 shadow-xs px-2.5 py-1 rounded-md font-extrabold hover:brightness-110 active:scale-95 transition-all"
					>
						Chọn
					</button>
				</div>
			</div>
		</div>
	);
}

export interface BatchChapterListProps {
	chapters: Chapter[];
	showOnlyPending: boolean;
	selectedChapters: Set<string>;
	currentChapterId?: string;
	currentChapterNumber?: number;
	initialSelectedChapters: string[];
	chapterListRef: React.RefObject<HTMLDivElement | null>;
	activeItemRef: React.RefObject<HTMLDivElement | null>;
	onScroll: () => void;
	onToggleChapter: (id: string) => void;
}

export function BatchChapterList({
	chapters,
	showOnlyPending,
	selectedChapters,
	currentChapterId,
	currentChapterNumber,
	initialSelectedChapters,
	chapterListRef,
	activeItemRef,
	onScroll,
	onToggleChapter,
}: BatchChapterListProps) {
	const activeChapterId = initialSelectedChapters[0] || currentChapterId;
	const filtered = [...chapters]
		.sort((a, b) => a.chapterNumber - b.chapterNumber)
		.filter((chap) => !showOnlyPending || chap.state === 'PENDING' || chap.state === 'FAILED');

	return (
		<div ref={chapterListRef} onScroll={onScroll} className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-1.5 p-1 min-h-[30vh]">
			{filtered.map((chap) => {
				const isCurrentChapter = chap.chapterId === activeChapterId || chap.chapterNumber === currentChapterNumber;
				const isSelected = selectedChapters.has(chap.chapterId);
				const badgeClass = getChapterBadgeClass(isSelected, chap.state);
				return (
					<div
						key={chap.chapterId}
						id={`chapter-item-${chap.chapterNumber}`}
						ref={isCurrentChapter ? activeItemRef : undefined}
						onClick={() => onToggleChapter(chap.chapterId)}
						className={cn(
							'group flex justify-between items-center px-2.5 py-1.5 cursor-pointer transition-all rounded-lg border relative shadow-xs gap-2',
							isSelected
								? 'bg-primary/20 hover:bg-primary/25 border border-primary/50 text-primary'
								: 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-on-surface'
						)}
					>
						<div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
							<div
								className={cn(
									'shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-tight border transition-colors shadow-2xs',
									badgeClass
								)}
							>
								CH {chap.chapterNumber}
							</div>

							<span
								className={cn(
									'text-[12px] truncate font-medium transition-colors flex-1 min-w-0',
									isSelected ? 'text-primary font-bold drop-shadow-xs' : 'text-on-surface'
								)}
							>
								{chap.title || `Chương ${chap.chapterNumber}`}
							</span>
						</div>

						<div className="flex items-center gap-1.5 shrink-0">
							<ChapterStateIcon state={chap.state} />

							{isSelected ? (
								<Check size={14} className="text-primary flex-shrink-0 font-bold" />
							) : (
								<Square size={14} className="text-on-surface-variant/30 flex-shrink-0" />
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}

export interface StoryTabContentProps {
	books: Book[];
	searchBook: string;
	onSearchChange: (val: string) => void;
	selectedBooks: Set<string>;
	onToggleBook: (id: string) => void;
}

export function StoryTabContent({ books, searchBook, onSearchChange, selectedBooks, onToggleBook }: StoryTabContentProps) {
	const query = searchBook.toLowerCase();
	const filteredBooks = books.filter((b) => b?.bookName && b.bookName.toLowerCase().includes(query));

	return (
		<div className="flex-1 flex flex-col min-h-0">
			<div className="relative mb-3">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant sm:left-3.5" size={12} />
				<input
					type="text"
					placeholder="Tìm truyện..."
					value={searchBook}
					onChange={(e) => onSearchChange(e.target.value)}
					className="w-full bg-white/5 dark:bg-white/5 border border-blue-500/20 dark:border-blue-400/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)] rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-all placeholder:text-on-surface-variant/70"
				/>
			</div>
			<div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-1.5 p-1 min-h-[30vh]">
				{filteredBooks.length === 0 ? (
					<div className="py-12 text-center text-xs text-on-surface-variant/60 font-medium">Không tìm thấy truyện nào trong thư viện</div>
				) : (
					filteredBooks.map((book) => {
						const isSelected = selectedBooks.has(book.bookId);
						return (
							<div
								key={book.bookId}
								onClick={() => onToggleBook(book.bookId)}
								className={cn(
									'group flex justify-between items-center px-2.5 py-1.5 cursor-pointer transition-all rounded-lg border relative shadow-xs gap-2',
									isSelected
										? 'bg-primary/20 hover:bg-primary/25 border border-primary/50 text-primary'
										: 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-on-surface'
								)}
							>
								<div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
									<div
										className={cn(
											'flex items-center justify-center p-1 rounded-md shrink-0 border transition-colors shadow-2xs',
											isSelected
												? 'bg-primary/30 border-primary/70 text-primary font-extrabold'
												: 'bg-primary/10 border-primary/30 text-primary'
										)}
									>
										<Languages size={12} />
									</div>
									<span
										className={cn(
											'text-[12px] truncate font-medium transition-colors flex-1 min-w-0',
											isSelected ? 'text-primary font-bold drop-shadow-xs' : 'text-on-surface'
										)}
									>
										{book.bookName}
									</span>
								</div>
								{isSelected ? (
									<Check size={14} className="text-primary flex-shrink-0 font-bold" />
								) : (
									<Square size={14} className="text-on-surface-variant/30 flex-shrink-0" />
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

export function CurrentTabContent({ currentChapterName, currentBookName }: { currentChapterName?: string; currentBookName?: string }) {
	const title = currentChapterName ? currentChapterName : 'Chưa chọn chương';
	return (
		<div className="flex-1 flex flex-col items-center justify-center text-center py-6 h-full my-auto">
			<p className="text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Chương đang mở</p>
			<h3 className="font-serif text-lg sm:text-xl font-bold text-primary leading-snug">{title}</h3>
			<p className="text-xs sm:text-sm text-on-surface-variant mt-2 font-medium">{currentBookName}</p>
		</div>
	);
}
