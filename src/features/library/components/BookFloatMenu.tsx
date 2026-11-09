import {
	BookOpen,
	Sparkles,
	Download,
	ExternalLink,
	Heart,
	ListTree,
	X,
	RefreshCw,
	Languages,
	Users,
	Tags,
	ChevronRight,
	Trash2,
} from 'lucide-react';
import React from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { triggerHaptic } from '@/hooks/useHaptic';
import { AIRepository } from '@/repositories/AIRepository';
import { useToastStore } from '@/stores/useToastStore';

import type { Book } from '@/shared/types';

export interface BookFloatMenuProps {
	book: Book;
	isOpen: boolean;
	onClose: () => void;
	isDownloaded: boolean;
	isOfflineMode: boolean;
	isFavorite: boolean;
	readCount?: number;
	unTranslatedCount: number;
	onReadContinue: () => void;
	onOpenQuickSheet: () => void;
	onOpenTranslationSheet: () => void;
	onDownloadBook: () => void;
	onOpenDeleteOffline: () => void;
	onOpenDeleteOnline: () => void;
	onToggleFavorite: (e: React.MouseEvent) => void;
	onOpenNewTab: () => void;
}

function FloatMenuTile({
	onClick,
	iconBgClass,
	labelHoverClass,
	label,
	children,
}: {
	onClick: (e: React.MouseEvent) => void;
	iconBgClass: string;
	labelHoverClass: string;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex flex-col items-center justify-center p-1.5 rounded-2xl hover:bg-white/[0.06] active:scale-90 transition-all cursor-pointer group text-center"
		>
			<div
				className={`w-11 h-11 rounded-2xl border flex items-center justify-center group-hover:scale-105 transition-transform mb-1 shadow-xs ${iconBgClass}`}
			>
				{children}
			</div>
			<span className={`text-[11px] font-semibold text-on-surface-variant ${labelHoverClass} transition-colors truncate max-w-full`}>
				{label}
			</span>
		</button>
	);
}

interface BookFloatMenuGridProps {
	isDownloaded: boolean;
	isOfflineMode: boolean;
	isFavorite: boolean;
	onAction: (action: () => void) => void;
	onOpenQuickSheet: () => void;
	onOpenNewTab: () => void;
	onDownloadBook: () => void;
	onToggleFavorite: (e: React.MouseEvent) => void;
	onOpenTranslationSheet: () => void;
	onTranslateTitles: () => void;
	onDetectProperNouns: () => void;
	onDetectTagsAndPov: () => void;
}

function BookFloatMenuGrid({
	isDownloaded,
	isOfflineMode,
	isFavorite,
	onAction,
	onOpenQuickSheet,
	onOpenNewTab,
	onDownloadBook,
	onToggleFavorite,
	onOpenTranslationSheet,
	onTranslateTitles,
	onDetectProperNouns,
	onDetectTagsAndPov,
}: BookFloatMenuGridProps) {
	const downloadBgClass = isDownloaded
		? 'bg-emerald-500/15 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
		: 'bg-sky-500/15 hover:bg-sky-500/20 border-sky-500/30 text-sky-400';

	const favBgClass = isFavorite
		? 'bg-rose-500/20 border-rose-500/40 text-rose-500'
		: 'bg-white/10 hover:bg-white/15 border-white/15 text-on-surface-variant';

	return (
		<div className="grid grid-cols-4 gap-y-3 gap-x-1.5 sm:gap-x-2">
			<FloatMenuTile
				onClick={() => onAction(onOpenQuickSheet)}
				iconBgClass="bg-white/10 hover:bg-white/15 border-white/15 text-on-surface"
				labelHoverClass="group-hover:text-on-surface"
				label="Mục lục"
			>
				<ListTree size={19} />
			</FloatMenuTile>

			<FloatMenuTile
				onClick={() => onAction(onOpenNewTab)}
				iconBgClass="bg-sky-500/15 hover:bg-sky-500/20 border-sky-500/30 text-sky-400"
				labelHoverClass="group-hover:text-sky-400"
				label="Tab mới"
			>
				<ExternalLink size={19} />
			</FloatMenuTile>

			<FloatMenuTile
				onClick={() => onAction(onDownloadBook)}
				iconBgClass={downloadBgClass}
				labelHoverClass="group-hover:text-emerald-400"
				label={isDownloaded ? 'Đồng bộ lại' : 'Tải về'}
			>
				{isDownloaded ? <RefreshCw size={18} /> : <Download size={19} />}
			</FloatMenuTile>

			<FloatMenuTile
				onClick={(e) => {
					triggerHaptic('selection');
					onToggleFavorite(e);
				}}
				iconBgClass={favBgClass}
				labelHoverClass="group-hover:text-rose-400"
				label={isFavorite ? 'Đã thích' : 'Yêu thích'}
			>
				<Heart size={19} className={isFavorite ? 'fill-rose-500' : ''} />
			</FloatMenuTile>

			<FloatMenuTile
				onClick={() => onAction(onOpenTranslationSheet)}
				iconBgClass="bg-indigo-500/15 hover:bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
				labelHoverClass="group-hover:text-indigo-400"
				label="Dịch AI"
			>
				<Sparkles size={19} />
			</FloatMenuTile>

			{!isOfflineMode && (
				<>
					<FloatMenuTile
						onClick={onTranslateTitles}
						iconBgClass="bg-amber-500/15 hover:bg-amber-500/20 border-amber-500/30 text-amber-400"
						labelHoverClass="group-hover:text-amber-400"
						label="Dịch tiêu đề"
					>
						<Languages size={19} />
					</FloatMenuTile>

					<FloatMenuTile
						onClick={onDetectProperNouns}
						iconBgClass="bg-teal-500/15 hover:bg-teal-500/20 border-teal-500/30 text-teal-400"
						labelHoverClass="group-hover:text-teal-400"
						label="Dịch tên"
					>
						<Users size={19} />
					</FloatMenuTile>

					<FloatMenuTile
						onClick={onDetectTagsAndPov}
						iconBgClass="bg-violet-500/15 hover:bg-violet-500/20 border-violet-500/30 text-violet-400"
						labelHoverClass="group-hover:text-violet-400"
						label="Dịch POV"
					>
						<Tags size={19} />
					</FloatMenuTile>
				</>
			)}
		</div>
	);
}

function BookFloatMenuHeader({
	bookName,
	isOfflineMode,
	onClose,
	onDeleteOnline,
}: {
	bookName: string;
	isOfflineMode: boolean;
	onClose: () => void;
	onDeleteOnline: () => void;
}) {
	return (
		<div className="flex items-center justify-between px-4 py-2.5 border-b border-outline-variant/30 flex-shrink-0 bg-white/[0.02]">
			<div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
				<div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/50 text-primary flex items-center justify-center p-0.5 shrink-0 shadow-xs">
					<BookOpen size={14} />
				</div>
				<h3 className="text-sm font-bold text-on-surface truncate leading-tight">{bookName}</h3>
			</div>

			<div className="flex items-center gap-1.5 shrink-0">
				{!isOfflineMode && (
					<button
						type="button"
						onClick={onDeleteOnline}
						className="w-7 h-7 rounded-full bg-rose-500/10 border border-rose-500/25 shadow-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-all flex items-center justify-center cursor-pointer active:scale-90"
						title="Xóa truyện khỏi hệ thống"
						aria-label="Xóa truyện khỏi hệ thống"
					>
						<Trash2 size={13} />
					</button>
				)}

				<button
					type="button"
					onClick={() => {
						triggerHaptic('light');
						onClose();
					}}
					className="w-7 h-7 rounded-full bg-white/10 border border-white/20 shadow-xs text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-all flex items-center justify-center cursor-pointer active:scale-90"
					title="Đóng"
					aria-label="Đóng"
				>
					<X size={15} />
				</button>
			</div>
		</div>
	);
}

export const BookFloatMenu = React.memo(function BookFloatMenu({
	book,
	isOpen,
	onClose,
	isDownloaded,
	isOfflineMode,
	isFavorite,
	onReadContinue,
	onOpenQuickSheet,
	onOpenTranslationSheet,
	onDownloadBook,
	onOpenDeleteOnline,
	onToggleFavorite,
	onOpenNewTab,
}: BookFloatMenuProps) {
	const showToast = useToastStore((state) => state.showToast);

	const handleAction = (action: () => void) => {
		triggerHaptic('selection');
		onClose();
		action();
	};

	const handleTranslateTitles = () => {
		triggerHaptic('selection');
		onClose();
		showToast('Đã gửi yêu cầu dịch tiêu đề', 'success');
		AIRepository.translateChineseTitles({ bookId: book.bookId }).catch((err) => {
			console.warn('translateChineseTitles error:', err);
		});
	};

	const handleDetectProperNouns = () => {
		triggerHaptic('selection');
		onClose();
		showToast('Đã gửi yêu cầu dịch tên', 'success');
		AIRepository.detectProperNouns({ bookId: book.bookId }).catch((err) => {
			console.warn('detectProperNouns error:', err);
		});
	};

	const handleDetectTagsAndPov = () => {
		triggerHaptic('selection');
		onClose();
		showToast('Đã gửi yêu cầu dịch POV', 'success');
		AIRepository.detectTagsAndPov({ bookId: book.bookId }).catch((err) => {
			console.warn('detectTagsAndPov error:', err);
		});
	};

	return (
		<BottomSheet
			isOpen={isOpen}
			onClose={onClose}
			ariaLabel={`Thao tác cho truyện ${book.bookName}`}
			maxHeight="max-h-[85dvh]"
			className="p-0"
		>
			<div className="flex flex-col text-on-surface">
				<BookFloatMenuHeader
					bookName={book.bookName}
					isOfflineMode={isOfflineMode}
					onClose={onClose}
					onDeleteOnline={() => handleAction(onOpenDeleteOnline)}
				/>

				<div className="p-3 sm:p-4">
					<button
						type="button"
						onClick={() => handleAction(onReadContinue)}
						className="w-full mb-3 flex items-center justify-between px-3.5 py-2 rounded-2xl bg-gradient-to-r from-primary/25 via-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 active:scale-[0.98] border border-primary/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),_0_2px_10px_rgba(245,158,11,0.15)] transition-all cursor-pointer group"
					>
						<div className="flex items-center gap-2.5 min-w-0">
							<div className="w-7 h-7 rounded-xl bg-primary/30 border border-primary/60 flex items-center justify-center text-primary shrink-0 shadow-xs">
								<BookOpen size={15} />
							</div>
							<div className="flex items-baseline gap-1.5 truncate text-left">
								<span className="text-xs font-bold text-primary">Đọc tiếp</span>
								<span className="text-[11px] font-mono text-on-surface-variant truncate">
									{book.lastReadChapter?.chapterNumber ? `Chương ${book.lastReadChapter.chapterNumber}` : 'Chương 1'}
								</span>
							</div>
						</div>
						<ChevronRight size={15} className="text-primary/70 group-hover:translate-x-0.5 transition-transform shrink-0" />
					</button>

					<BookFloatMenuGrid
						isDownloaded={isDownloaded}
						isOfflineMode={isOfflineMode}
						isFavorite={isFavorite}
						onAction={handleAction}
						onOpenQuickSheet={onOpenQuickSheet}
						onOpenNewTab={onOpenNewTab}
						onDownloadBook={onDownloadBook}
						onToggleFavorite={onToggleFavorite}
						onOpenTranslationSheet={onOpenTranslationSheet}
						onTranslateTitles={handleTranslateTitles}
						onDetectProperNouns={handleDetectProperNouns}
						onDetectTagsAndPov={handleDetectTagsAndPov}
					/>
				</div>
			</div>
		</BottomSheet>
	);
});

export { BookFloatMenu as BookActionSheet };
export type { BookFloatMenuProps as BookActionSheetProps };
