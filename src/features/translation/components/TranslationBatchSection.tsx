import { AlertCircle, Check, CheckCircle2, Clock, Eye, EyeOff, RotateCcw, Search, Square, X } from 'lucide-react';
import React from 'react';

import { getChapterBadgeClass } from '@/components/translation-sheet/translationHelpers';
import { triggerHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';

import type { useBatchSelectionHandlers } from '@/components/translation-sheet/useTranslationActions';
import type { useTranslationBatchPagination } from '@/components/translation-sheet/useTranslationSheet';

interface TranslationBatchSectionProps {
	batch: ReturnType<typeof useTranslationBatchPagination>;
	selection: ReturnType<typeof useBatchSelectionHandlers>;
	chapterSearch: string;
	setChapterSearch: (val: string) => void;
	currentChapterId?: string;
}

function ChapterStateIcon({ state }: { state?: string }) {
	if (state === 'SUCCEEDED') {
		return (
			<span title="Đã dịch">
				<CheckCircle2 size={13} className="text-primary shrink-0" role="img" aria-label="Đã dịch" />
			</span>
		);
	}
	if (state === 'FAILED') {
		return (
			<span title="Lỗi dịch">
				<AlertCircle size={13} className="text-rose-400 shrink-0" role="img" aria-label="Lỗi dịch" />
			</span>
		);
	}
	return (
		<span title="Chưa dịch">
			<Clock size={13} className="text-amber-400/80 shrink-0" role="img" aria-label="Chưa dịch" />
		</span>
	);
}

function ChapterBatchControlsBar({
	batch,
	selection,
}: {
	batch: ReturnType<typeof useTranslationBatchPagination>;
	selection: ReturnType<typeof useBatchSelectionHandlers>;
}) {
	const selectedCount = batch.selectedChapters.size;
	const totalCount = batch.chapters.length;

	return (
		<div className="flex flex-col gap-2 p-2.5 bg-white/[0.03] rounded-2xl border border-white/10 shadow-xs">
			{/* Row 1: Selected counter + Clear + Quick select pills + Hide succeeded */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-1.5 min-w-0">
					<span
						className={cn(
							'text-xs font-mono font-black px-2 py-0.5 rounded-lg border transition-all truncate',
							selectedCount > 0
								? 'bg-primary/20 text-primary border-primary/50 shadow-xs'
								: 'bg-white/5 text-on-surface-variant/70 border-white/10'
						)}
					>
						Đã chọn: {selectedCount}/{totalCount}
					</span>

					{selectedCount > 0 && (
						<button
							type="button"
							onClick={() => {
								triggerHaptic('light');
								batch.setSelectedChapters(new Set());
							}}
							className="px-2 py-0.5 rounded-lg border bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400 text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
							title="Bỏ chọn tất cả"
						>
							<RotateCcw size={11} />
							<span>Bỏ</span>
						</button>
					)}
				</div>

				<div className="flex items-center gap-1.5 shrink-0">
					<button
						type="button"
						onClick={() => {
							triggerHaptic('selection');
							selection.handleSelectAll();
						}}
						className="px-2 py-1 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-bold text-primary active:scale-95 transition-all cursor-pointer"
					>
						Tất cả
					</button>

					<button
						type="button"
						onClick={() => {
							triggerHaptic('selection');
							selection.handleSelectPending();
						}}
						className="px-2 py-1 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-bold text-amber-400 active:scale-95 transition-all cursor-pointer"
					>
						Chưa dịch
					</button>

					<label
						className={cn(
							'p-1.5 rounded-lg border transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center',
							batch.showOnlyPending
								? 'bg-primary/20 text-primary border-primary/60 shadow-xs'
								: 'bg-white/5 text-on-surface-variant/70 border-white/10 hover:bg-white/10'
						)}
						title={batch.showOnlyPending ? 'Đang ẩn chương đã dịch' : 'Ẩn chương đã dịch'}
					>
						<input
							type="checkbox"
							checked={batch.showOnlyPending}
							onChange={(e) => batch.setShowOnlyPending(e.target.checked)}
							className="sr-only"
							aria-label="Ẩn đã dịch"
						/>
						{batch.showOnlyPending ? <EyeOff size={13} /> : <Eye size={13} />}
					</label>
				</div>
			</div>

			{/* Row 2: Range selector */}
			<div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5 text-[11px]">
				<span className="text-[10px] text-on-surface-variant/70 font-semibold uppercase">Chọn khoảng:</span>
				<div className="flex items-center gap-1.5 ml-auto">
					<span className="text-[10px] text-on-surface-variant/60 font-medium">Từ</span>
					<input
						type="number"
						placeholder="1"
						value={batch.rangeStart}
						onChange={(e) => batch.setRangeStart(e.target.value)}
						className="w-12 bg-black/30 border border-white/15 px-1 py-1 rounded-lg text-xs font-mono text-primary text-center outline-none focus:border-primary/70 transition-all"
					/>
					<span className="text-[10px] text-on-surface-variant/40">-</span>
					<input
						type="number"
						placeholder="50"
						value={batch.rangeEnd}
						onChange={(e) => batch.setRangeEnd(e.target.value)}
						className="w-12 bg-black/30 border border-white/15 px-1 py-1 rounded-lg text-xs font-mono text-primary text-center outline-none focus:border-primary/70 transition-all"
					/>
					<button
						type="button"
						onClick={() => {
							triggerHaptic('selection');
							selection.handleSelectRange();
						}}
						className="text-xs bg-primary text-on-primary border border-primary/70 shadow-xs px-3 py-1 rounded-lg font-extrabold hover:brightness-110 active:scale-95 transition-all cursor-pointer"
					>
						Chọn
					</button>
				</div>
			</div>
		</div>
	);
}

export function TranslationBatchSection({
	batch,
	selection,
	chapterSearch,
	setChapterSearch,
	currentChapterId,
}: TranslationBatchSectionProps) {
	const query = chapterSearch.trim().toLowerCase();

	const filteredChapters = [...batch.chapters]
		.sort((a, b) => a.chapterNumber - b.chapterNumber)
		.filter((chap) => {
			if (batch.showOnlyPending && chap.state === 'SUCCEEDED') return false;
			if (!query) return true;
			const matchNumber = String(chap.chapterNumber).includes(query);
			const matchTitle = chap.title?.toLowerCase().includes(query);
			return matchNumber || matchTitle;
		});

	return (
		<div className="flex-1 flex flex-col min-h-0 space-y-2.5">
			{/* Chapter Search Bar */}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
				<input
					type="text"
					placeholder="Tìm theo số chương hoặc tiêu đề..."
					value={chapterSearch}
					onChange={(e) => setChapterSearch(e.target.value)}
					className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-8 text-xs text-on-surface focus:outline-none focus:border-primary/60 transition-all placeholder:text-on-surface-variant/50"
				/>
				{chapterSearch && (
					<button
						type="button"
						onClick={() => setChapterSearch('')}
						className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
					>
						<X size={14} />
					</button>
				)}
			</div>

			<ChapterBatchControlsBar batch={batch} selection={selection} />

			{/* Chapter List */}
			<div
				ref={batch.chapterListRef}
				onScroll={batch.handleScroll}
				className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-1.5 p-0.5 min-h-[300px]"
			>
				{filteredChapters.length === 0 ? (
					<div className="py-16 text-center text-xs text-on-surface-variant/60 font-medium">Không có chương nào phù hợp</div>
				) : (
					filteredChapters.map((chap) => {
						const isSelected = batch.selectedChapters.has(chap.chapterId);
						const isCurrent = chap.chapterId === currentChapterId;
						const badgeClass = getChapterBadgeClass(isSelected, chap.state);

						return (
							<div
								key={chap.chapterId}
								id={`chapter-item-${chap.chapterNumber}`}
								ref={isCurrent ? batch.activeItemRef : undefined}
								onClick={() => {
									triggerHaptic('light');
									selection.toggleChapter(chap.chapterId);
								}}
								className={cn(
									'group flex justify-between items-center px-3 py-2.5 cursor-pointer transition-all rounded-xl border relative shadow-xs gap-2.5 min-h-[44px]',
									isSelected
										? 'bg-primary/20 hover:bg-primary/25 border-primary/50 text-primary'
										: 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-on-surface'
								)}
							>
								<div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
									<div
										className={cn(
											'shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold tracking-tight border transition-colors shadow-2xs',
											badgeClass
										)}
									>
										CH {chap.chapterNumber}
									</div>

									<span
										className={cn(
											'text-xs truncate font-medium transition-colors flex-1 min-w-0',
											isSelected ? 'text-primary font-bold' : 'text-on-surface'
										)}
									>
										{chap.title || `Chương ${chap.chapterNumber}`}
									</span>
								</div>

								<div className="flex items-center gap-2 shrink-0">
									<ChapterStateIcon state={chap.state} />

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
					})
				)}
			</div>
		</div>
	);
}
