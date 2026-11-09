import { Sparkles, BookOpen, Trash2, Heart, MoreVertical, AlertCircle } from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';

import type { useLongPress } from '@/hooks/useLongPress';
import type { Book } from '@/shared/types';

function BookProgressBadge({ readCount, progressPct }: { readCount: number; progressPct: number }) {
	if (readCount === 0) {
		return (
			<span className="inline-flex items-center gap-1 px-1.5 py-0.25 rounded-md text-[10px] font-semibold bg-white/5 text-on-surface-variant/70 border border-white/10 shrink-0">
				<span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/40 shrink-0" />
				<span>Chưa đọc</span>
			</span>
		);
	}
	if (progressPct >= 100) {
		return (
			<span className="inline-flex items-center gap-1 px-1.5 py-0.25 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 shadow-[0_1px_4px_rgba(52,211,153,0.15)]">
				<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
				<span>Đã xong • 100%</span>
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 px-1.5 py-0.25 rounded-md text-[10px] font-bold bg-primary/15 text-primary border border-primary/30 shrink-0 shadow-[0_1px_4px_rgba(245,158,11,0.15)]">
			<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
			<span>Đang đọc • {progressPct}%</span>
		</span>
	);
}

function BookCardCoverIcon({ chapterCount, isDownloaded }: { chapterCount: number; isDownloaded: boolean }) {
	const countLabel = chapterCount > 9999 ? `${(chapterCount / 1000).toFixed(1)}k` : chapterCount;
	return (
		<div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-b from-primary/30 via-primary/20 to-primary/10 border-2 border-primary/70 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.6),_0_4px_14px_rgba(245,158,11,0.2)] flex flex-col items-center justify-center p-0.5 shrink-0 overflow-hidden group-hover:border-primary group-hover:scale-105 transition-all">
			<BookOpen size={16} className="text-primary shrink-0 drop-shadow-xs" />
			<span className="text-[9px] font-mono font-black text-primary leading-tight whitespace-nowrap px-0.5 text-center mt-0.5">
				{countLabel} ch
			</span>
			{isDownloaded && (
				<span
					className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
					title="Đã tải offline"
				/>
			)}
		</div>
	);
}

function BookCardMicroStats({
	readCount,
	chapterCount,
	progressPct,
	totalTranslated,
	totalPending,
	activeTab,
	unTranslatedCount,
}: {
	readCount: number;
	chapterCount: number;
	progressPct: number;
	totalTranslated: number;
	totalPending: number;
	activeTab?: string;
	unTranslatedCount: number;
}) {
	const showPending = activeTab === 'AI' || unTranslatedCount > 0;
	const pendingCount = totalPending || unTranslatedCount;

	return (
		<div className="flex items-center gap-1 text-[10px] font-mono whitespace-nowrap shrink-0 ml-auto">
			<span
				className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded-md bg-primary/15 text-primary font-bold border border-primary/30"
				title={`Đã đọc: ${readCount}/${chapterCount} (${progressPct}%)`}
			>
				<BookOpen size={9} />
				<span>
					{readCount}/{chapterCount}
				</span>
			</span>

			<span
				className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded-md bg-primary/15 text-primary font-bold border border-primary/30"
				title={`Đã dịch: ${totalTranslated}/${chapterCount}`}
			>
				<Sparkles size={9} />
				<span>{totalTranslated}</span>
			</span>

			{showPending && (
				<span
					className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded-md bg-rose-500/15 text-rose-300 font-bold"
					title={`Chưa dịch: ${pendingCount}`}
				>
					<AlertCircle size={9} />
					<span>{pendingCount}</span>
				</span>
			)}
		</div>
	);
}

export interface DeleteModalProps {
	confirmType: 'ONLINE' | 'OFFLINE' | null;
	bookName: string;
	isDeleting: boolean;
	onClose: () => void;
	onConfirm: () => void;
}

export function BookDeleteConfirmModal({ confirmType, bookName, isDeleting, onClose, onConfirm }: DeleteModalProps) {
	if (!confirmType || typeof document === 'undefined') return null;
	const isOnline = confirmType === 'ONLINE';

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
			onClick={() => !isDeleting && onClose()}
		>
			<div
				className="w-full max-w-sm bg-black/40 backdrop-blur-[6px] border border-blue-500/30 dark:border-blue-400/25 rounded-3xl p-5 shadow-[0_16px_36px_rgba(0,0,0,0.5),_inset_0_1px_0.5px_0_rgba(255,255,255,0.45)] space-y-4 animate-in zoom-in-95 duration-200"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center gap-3">
					<div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)] flex items-center justify-center text-rose-400 shrink-0">
						<Trash2 size={22} />
					</div>
					<div>
						<h3 className="text-base font-bold text-on-surface">{isOnline ? 'Xóa truyện khỏi hệ thống?' : 'Xóa truyện khỏi máy?'}</h3>
						<p className="text-xs font-mono text-on-surface-variant/70">Xác nhận thao tác xóa</p>
					</div>
				</div>

				<div className="p-3 rounded-2xl bg-white/5 border border-outline-variant/30 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] space-y-1">
					<p className="text-xs font-bold text-primary line-clamp-1">{bookName}</p>
					<p className="text-[11.5px] text-on-surface-variant leading-relaxed">
						{isOnline
							? 'Tất cả các chương, bản dịch AI và dữ liệu liên quan sẽ bị xóa vĩnh viễn khỏi server và không thể khôi phục.'
							: 'Dữ liệu chương đã tải xuống trên thiết bị này sẽ bị xóa khỏi máy.'}
					</p>
				</div>

				<div className="flex items-center justify-end gap-2 pt-1">
					<button
						type="button"
						disabled={isDeleting}
						onClick={onClose}
						className="px-4 py-2 rounded-xl bg-white/5 border border-blue-500/20 dark:border-blue-400/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)] text-on-surface hover:bg-white/15 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
					>
						Hủy
					</button>
					<button
						type="button"
						disabled={isDeleting}
						onClick={onConfirm}
						className="px-4 py-2 rounded-xl bg-gradient-to-b from-rose-500 via-rose-600 to-rose-700 hover:brightness-110 active:scale-95 text-white text-xs font-bold border border-rose-400/60 shadow-[0_4px_16px_rgba(225,29,72,0.5),_inset_0_1px_1px_rgba(255,255,255,0.4)] transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
					>
						{isDeleting ? (
							<span>Đang xóa...</span>
						) : (
							<>
								<Trash2 size={14} />
								<span>{isOnline ? 'Xóa vĩnh viễn' : 'Xóa khỏi máy'}</span>
							</>
						)}
					</button>
				</div>
			</div>
		</div>,
		document.body
	);
}

export interface BookCardMainProps {
	book: Book;
	isFav: boolean;
	isSelected?: boolean;
	isDownloaded: boolean;
	formattedDate: string;
	readCount: number;
	progressPct: number;
	activeTab?: string;
	unTranslatedCount: number;
	longPressHandlers: ReturnType<typeof useLongPress>;
	onToggleFavorite: (e: React.MouseEvent) => void;
	onOpenActionSheet: (e: React.MouseEvent) => void;
}

export function BookCardMain({
	book,
	isFav,
	isSelected,
	isDownloaded,
	formattedDate,
	readCount,
	progressPct,
	activeTab,
	unTranslatedCount,
	longPressHandlers,
	onToggleFavorite,
	onOpenActionSheet,
}: BookCardMainProps) {
	const cardBorderClass = isSelected
		? 'bg-primary/20 hover:bg-primary/25 backdrop-blur-md border-2 border-primary shadow-[0_4px_20px_rgba(245,158,11,0.35),_inset_0_1.5px_1.5px_rgba(255,255,255,0.6)] text-primary'
		: 'bg-surface-container/35 hover:bg-surface-container/60 backdrop-blur-md border-2 border-outline-variant/60 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.25),_0_8px_24px_rgba(0,0,0,0.35)] hover:border-primary/80 hover:shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.5),_0_12px_32px_rgba(245,158,11,0.2)] text-on-surface';

	const favBtnClass = isFav ? 'text-rose-500 hover:text-rose-600' : 'text-on-surface-variant/40 hover:text-rose-400 hover:bg-rose-500/10';

	const lastRead = book.lastReadChapter;

	return (
		<div className="relative overflow-hidden rounded-2xl w-full select-none">
			<div
				{...longPressHandlers}
				className={`group relative z-10 rounded-2xl border p-2 sm:p-2.5 transition-all duration-200 ease-out cursor-pointer flex items-center gap-2.5 overflow-hidden active:scale-[0.99] ${cardBorderClass}`}
			>
				<BookCardCoverIcon chapterCount={book.chapterCount} isDownloaded={isDownloaded} />

				<div className="flex-1 min-w-0 space-y-1">
					<div className="flex items-start justify-between gap-1.5 min-w-0">
						<h3 className="text-[13px] font-bold text-on-surface leading-snug tracking-tight group-hover:text-primary transition-colors line-clamp-2 min-w-0 flex-1">
							{book.bookName}
						</h3>
						<div className="flex items-center gap-1 shrink-0 pt-0.5">
							<button
								type="button"
								onClick={onToggleFavorite}
								className={`p-0.5 rounded-full transition-all active:scale-90 cursor-pointer ${favBtnClass}`}
								title={isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
								aria-label={isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
							>
								<Heart size={13} className={isFav ? 'fill-rose-500 text-rose-500' : ''} />
							</button>

							<button
								type="button"
								onClick={onOpenActionSheet}
								className="p-0.5 rounded-full text-on-surface-variant/40 hover:text-primary hover:bg-primary/10 transition-all active:scale-90 cursor-pointer"
								title="Tùy chọn thao tác"
								aria-label={`Tùy chọn cho truyện ${book.bookName}`}
							>
								<MoreVertical size={13} />
							</button>

							<span className="text-[10px] font-mono text-on-surface-variant/60 whitespace-nowrap ml-0.5">{formattedDate}</span>
						</div>
					</div>

					<div className="space-y-0.5">
						<div className="flex items-center gap-1.5 text-[10.5px] text-on-surface-variant min-w-0">
							{lastRead?.chapterId ? (
								<>
									<span className="px-1.5 py-0.25 rounded-md bg-gradient-to-b from-emerald-400/30 via-emerald-500/20 to-emerald-600/10 border border-emerald-400/70 text-emerald-300 font-mono font-black text-[10px] shrink-0 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.5),_0_2px_8px_rgba(52,211,153,0.3)]">
										Ch.{lastRead.chapterNumber}
									</span>
									<span className="truncate text-on-surface-variant/90 text-[10px] font-medium min-w-0 flex-1">
										{lastRead.title || `Chương ${lastRead.chapterNumber}`}
									</span>
								</>
							) : (
								<span className="text-[10px] text-on-surface-variant/50 italic">Chưa đọc</span>
							)}
						</div>
						{readCount > 0 && (
							<div className="w-full bg-black/40 border border-white/10 h-1 rounded-full overflow-hidden p-[1px] shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]">
								<div
									className="bg-gradient-to-r from-primary via-primary-fixed to-primary-fixed-dim h-full rounded-full transition-all duration-300 shadow-[0_0_8px_var(--primary)]"
									style={{ width: `${progressPct}%` }}
								/>
							</div>
						)}
					</div>

					<div className="flex items-center justify-between gap-1.5 min-w-0 pt-0.5">
						<div className="flex items-center gap-1 min-w-0">
							<BookProgressBadge readCount={readCount} progressPct={progressPct} />
						</div>

						<BookCardMicroStats
							readCount={readCount}
							chapterCount={book.chapterCount}
							progressPct={progressPct}
							totalTranslated={book.totalTranslated}
							totalPending={book.totalPending}
							activeTab={activeTab}
							unTranslatedCount={unTranslatedCount}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
