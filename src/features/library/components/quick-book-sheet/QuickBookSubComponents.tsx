import { X, Download, Search, RefreshCw, Trash2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { ChapterItem } from '@/features/chapter-list/components/ChapterItem';
import { triggerHaptic } from '@/hooks/useHaptic';

import type { Book, Chapter } from '@/shared/types';

function QuickBookOfflineAction({
	isOfflineMode,
	isDownloaded,
	onDownload,
	onDeleteOffline,
}: {
	isOfflineMode: boolean;
	isDownloaded: boolean;
	onDownload: () => void;
	onDeleteOffline: () => void;
}) {
	if (isOfflineMode) return null;
	if (isDownloaded) {
		return (
			<motion.button
				whileTap={{ scale: 0.88 }}
				onClick={() => {
					triggerHaptic('warning');
					onDeleteOffline();
				}}
				className="w-8 h-8 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors flex items-center justify-center cursor-pointer"
				title="Xóa khỏi máy"
				aria-label="Xóa khỏi máy"
			>
				<Trash2 size={16} />
			</motion.button>
		);
	}
	return (
		<motion.button
			whileTap={{ scale: 0.88 }}
			onClick={() => {
				triggerHaptic('light');
				onDownload();
			}}
			className="w-8 h-8 rounded-full bg-white/10 border border-white/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.4)] text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer"
			title="Tải về ngoại tuyến"
			aria-label="Tải về ngoại tuyến"
		>
			<Download size={16} />
		</motion.button>
	);
}

export function QuickBookChapterList({
	loading,
	chapters,
	lastReadChapter,
	activeItemRef,
	onSelectChapter,
}: {
	loading: boolean;
	chapters: Chapter[];
	lastReadChapter?: Book['lastReadChapter'];
	activeItemRef: React.RefObject<HTMLDivElement | null>;
	onSelectChapter: (chapterId: string) => void;
}) {
	if (loading && chapters.length === 0) {
		return (
			<div className="py-16 text-center space-y-2 text-on-surface-variant">
				<RefreshCw size={20} className="animate-spin text-primary mx-auto" />
				<p className="text-xs font-medium">Đang tải danh sách chương...</p>
			</div>
		);
	}
	if (chapters.length === 0) {
		return <div className="py-12 text-center text-xs text-on-surface-variant/60 font-medium">Không tìm thấy chương nào</div>;
	}

	const lastId = lastReadChapter?.chapterId;
	const lastNum = lastReadChapter?.chapterNumber === undefined ? undefined : Number(lastReadChapter.chapterNumber);

	return (
		<>
			{chapters.map((c) => {
				const isLastRead = Boolean((lastId && c.chapterId === lastId) || (lastNum !== undefined && c.chapterNumber === lastNum));

				return (
					<ChapterItem
						key={c.chapterId}
						ref={isLastRead ? activeItemRef : null}
						chapter={c}
						isActive={isLastRead}
						onClick={() => onSelectChapter(c.chapterId)}
					/>
				);
			})}
		</>
	);
}

function QuickBookTranslateButton({
	isOfflineMode,
	pendingCount,
	onOpenTranslation,
}: {
	isOfflineMode: boolean;
	pendingCount: number;
	onOpenTranslation: () => void;
}) {
	if (isOfflineMode) return null;
	return (
		<motion.button
			type="button"
			whileTap={{ scale: 0.88 }}
			onClick={onOpenTranslation}
			className="relative w-8 h-8 rounded-full bg-white/10 border border-white/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.4)] text-on-surface-variant hover:text-primary hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer"
			title={pendingCount > 0 ? `Chờ dịch: ${pendingCount} chương (Mở Dịch AI)` : 'Mở Dịch AI'}
			aria-label="Mở Dịch AI"
		>
			<Sparkles size={16} className={pendingCount > 0 ? 'text-primary animate-pulse' : ''} />
			{pendingCount > 0 && (
				<span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-primary text-on-primary font-mono font-black text-[8px] flex items-center justify-center leading-none shadow-xs">
					{pendingCount > 99 ? '99+' : pendingCount}
				</span>
			)}
		</motion.button>
	);
}

function QuickBookTags({ tags }: { tags?: string[] }) {
	if (!tags || tags.length === 0) return null;
	return (
		<div className="flex flex-wrap items-center gap-1 pt-0.5">
			{tags.map((tag) => (
				<span
					key={tag}
					className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-white/10 border border-white/15 text-on-surface-variant shrink-0"
				>
					#{tag}
				</span>
			))}
		</div>
	);
}

export function QuickBookTopLoading({ loadingTop }: { loadingTop: boolean }) {
	if (!loadingTop) return null;
	return (
		<div className="py-2.5 flex items-center justify-center gap-2 text-xs font-mono text-primary/80">
			<RefreshCw size={14} className="animate-spin text-primary" />
			<span>Đang tải thêm chương trước...</span>
		</div>
	);
}

export function QuickBookBottomLoading({ loadingBottom }: { loadingBottom: boolean }) {
	if (!loadingBottom) return null;
	return (
		<div className="space-y-1.5 mt-2">
			{[1, 2, 3, 4, 5].map((idx) => (
				<div
					key={`sk-bottom-${idx}`}
					className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-between"
				>
					<div className="h-4 w-36 bg-on-surface-variant/20 rounded" />
					<div className="h-4 w-12 bg-primary/20 rounded-lg" />
				</div>
			))}
		</div>
	);
}

export interface QuickBookHeaderProps {
	book: Book;
	isOfflineMode: boolean;
	isDownloaded: boolean;
	pendingCount: number;
	percent: number;
	search: string;
	onOpenTranslation: () => void;
	onDownload: () => void;
	onDeleteOffline: () => void;
	onClose: () => void;
	onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onClearSearch: () => void;
}

export function QuickBookHeader({
	book,
	isOfflineMode,
	isDownloaded,
	pendingCount,
	percent,
	search,
	onOpenTranslation,
	onDownload,
	onDeleteOffline,
	onClose,
	onSearchChange,
	onClearSearch,
}: QuickBookHeaderProps) {
	return (
		<div className="pt-2 px-3.5 pb-1.5 border-b border-white/10 space-y-1.5 flex-shrink-0 bg-transparent relative z-20">
			{/* Drag Handle */}
			<div className="w-8 h-1 rounded-full bg-white/25 dark:bg-white/20 mx-auto mb-1 flex-shrink-0" />

			{/* Row 1: Title + Action Icon Buttons */}
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-xs sm:text-sm font-extrabold text-on-surface tracking-tight leading-snug truncate flex-1 min-w-0">
					{book.bookName}
				</h2>

				<div className="flex items-center gap-1.5 shrink-0">
					<QuickBookTranslateButton isOfflineMode={isOfflineMode} pendingCount={pendingCount} onOpenTranslation={onOpenTranslation} />

					<QuickBookOfflineAction
						isOfflineMode={isOfflineMode}
						isDownloaded={isDownloaded}
						onDownload={onDownload}
						onDeleteOffline={onDeleteOffline}
					/>

					<motion.button
						whileTap={{ scale: 0.88 }}
						onClick={() => {
							triggerHaptic('light');
							onClose();
						}}
						className="w-8 h-8 rounded-full bg-white/10 border border-white/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.4)] text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer"
						title="Đóng"
						aria-label="Đóng"
					>
						<X size={17} />
					</motion.button>
				</div>
			</div>

			{/* Row 2: Progress Stat & Bar */}
			<div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant/80">
				<span>
					Đã dịch:{' '}
					<b className="text-on-surface">
						{book.totalTranslated}/{book.chapterCount}
					</b>{' '}
					ch ({percent}%)
				</span>
				<div className="w-16 bg-white/10 border border-white/15 h-1 rounded-full overflow-hidden ml-2 shrink-0">
					<div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
				</div>
			</div>

			{/* Row 3: Tags List */}
			<QuickBookTags tags={book.tags} />

			{/* Row 4: Mobile-optimized Search Bar */}
			<div className="relative pt-0.5">
				<Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none" />
				<input
					type="text"
					placeholder="Tìm nhanh số hoặc tên chương..."
					value={search}
					onChange={onSearchChange}
					className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/10 border border-white/15 text-sm sm:text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 font-medium transition-all"
				/>
				{search && (
					<motion.button
						whileTap={{ scale: 0.85 }}
						type="button"
						onClick={onClearSearch}
						className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface"
						title="Xóa tìm kiếm"
					>
						<X size={13} />
					</motion.button>
				)}
			</div>
		</div>
	);
}
