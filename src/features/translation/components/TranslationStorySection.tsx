import { Check, Languages, RotateCcw, Search, Square, X } from 'lucide-react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';

import type { Book } from '@/shared/types';

interface TranslationStorySectionProps {
	books: Book[];
	searchBook: string;
	onSearchChange: (val: string) => void;
	selectedBooks: Set<string>;
	onToggleBook: (id: string) => void;
	onSelectAllBooks: () => void;
	onClearBooks: () => void;
}

function StoryListItem({ book, isSelected, onToggle }: { book: Book; isSelected: boolean; onToggle: () => void }) {
	const percent = book.chapterCount > 0 ? Math.round((book.totalTranslated / book.chapterCount) * 100) : 0;

	return (
		<div
			onClick={onToggle}
			className={cn(
				'group flex justify-between items-center px-3 py-2.5 cursor-pointer transition-all rounded-xl border relative shadow-xs gap-2.5 min-h-[48px]',
				isSelected
					? 'bg-primary/20 hover:bg-primary/25 border-primary/50 text-primary'
					: 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-on-surface'
			)}
		>
			<div className="flex items-center gap-2.5 overflow-hidden min-w-0 flex-1">
				<div
					className={cn(
						'flex items-center justify-center w-8 h-8 rounded-lg shrink-0 border transition-colors shadow-2xs',
						isSelected ? 'bg-primary/30 border-primary/70 text-primary font-extrabold' : 'bg-primary/10 border-primary/30 text-primary'
					)}
				>
					<Languages size={15} />
				</div>

				<div className="min-w-0 flex-1">
					<p className={cn('text-xs font-bold truncate', isSelected ? 'text-primary' : 'text-on-surface')}>{book.bookName}</p>
					{book.chapterCount > 0 && (
						<div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-mono mt-0.5">
							<span>
								{book.totalTranslated}/{book.chapterCount} chương ({percent}%)
							</span>
						</div>
					)}
				</div>
			</div>

			<div className="flex items-center gap-1.5 shrink-0">
				{isSelected ? (
					<div className="w-5 h-5 rounded-md bg-primary text-on-primary flex items-center justify-center font-bold shadow-2xs">
						<Check size={13} strokeWidth={3} />
					</div>
				) : (
					<Square size={16} className="text-on-surface-variant/40 group-hover:text-on-surface-variant/70" />
				)}
			</div>
		</div>
	);
}

export function TranslationStorySection({
	books,
	searchBook,
	onSearchChange,
	selectedBooks,
	onToggleBook,
	onSelectAllBooks,
	onClearBooks,
}: TranslationStorySectionProps) {
	const query = searchBook.trim().toLowerCase();
	const filteredBooks = books.filter((b) => b?.bookName && b.bookName.toLowerCase().includes(query));
	const selectedCount = selectedBooks.size;

	return (
		<div className="flex-1 flex flex-col min-h-0 space-y-2.5">
			{/* Search Stories */}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
				<input
					type="text"
					placeholder="Tìm truyện trong thư viện..."
					value={searchBook}
					onChange={(e) => onSearchChange(e.target.value)}
					className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-8 text-xs text-on-surface focus:outline-none focus:border-primary/60 transition-all placeholder:text-on-surface-variant/50"
				/>
				{searchBook && (
					<button
						type="button"
						onClick={() => onSearchChange('')}
						className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
					>
						<X size={14} />
					</button>
				)}
			</div>

			{/* Story Selection Toolbar */}
			<div className="flex items-center justify-between p-2 px-3 bg-white/[0.03] rounded-xl border border-white/10">
				<span
					className={cn(
						'text-xs font-mono font-black px-2 py-0.5 rounded-lg border transition-all',
						selectedCount > 0
							? 'bg-primary/20 text-primary border-primary/50 shadow-xs'
							: 'bg-white/5 text-on-surface-variant/70 border-white/10'
					)}
				>
					Đã chọn: {selectedCount}/{books.length} truyện
				</span>

				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={onSelectAllBooks}
						className="px-2.5 py-1 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-bold text-primary active:scale-95 transition-all cursor-pointer"
					>
						Tất cả
					</button>

					{selectedCount > 0 && (
						<button
							type="button"
							onClick={onClearBooks}
							className="px-2.5 py-1 rounded-lg border bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400 text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
						>
							<RotateCcw size={11} />
							<span>Bỏ chọn</span>
						</button>
					)}
				</div>
			</div>

			{/* Stories List */}
			<div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-1.5 p-0.5 min-h-[300px]">
				{filteredBooks.length === 0 ? (
					<div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium">Không tìm thấy truyện nào trong thư viện</div>
				) : (
					filteredBooks.map((book) => (
						<StoryListItem
							key={book.bookId}
							book={book}
							isSelected={selectedBooks.has(book.bookId)}
							onToggle={() => {
								triggerHaptic('light');
								onToggleBook(book.bookId);
							}}
						/>
					))
				)}
			</div>
		</div>
	);
}
