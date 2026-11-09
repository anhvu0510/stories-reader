import { Download, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useCallback, useEffect, useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { ChapterItem } from '@/features/chapter-list/components/ChapterItem';
import { triggerHaptic } from '@/hooks/useHaptic';
import { downloadManager, type DownloadTask } from '@/lib/DownloadManager';
import { offlineDb } from '@/lib/offlineDb';
import { useToastStore } from '@/stores/useToastStore';

import { useQuickChapterPagination } from './quick-chapter-select/useQuickChapterSelect';

import type { Chapter } from '@/shared/types';

function useOfflineBookControls(bookId: string, bookName?: string) {
	const showToast = useToastStore((state) => state.showToast);
	const [isDownloaded, setIsDownloaded] = useState(false);
	const [downloadTask, setDownloadTask] = useState<DownloadTask | undefined>(() => downloadManager.getTask(bookId));
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	useEffect(() => {
		offlineDb.getBook(bookId).then((b) => setIsDownloaded(Boolean(b)));

		const updateTask = () => {
			setDownloadTask(downloadManager.getTask(bookId));
			offlineDb.getBook(bookId).then((b) => setIsDownloaded(Boolean(b)));
		};

		updateTask();
		const unsubscribe = downloadManager.subscribe(updateTask);
		window.addEventListener('download-queue-updated', updateTask);

		return () => {
			unsubscribe();
			window.removeEventListener('download-queue-updated', updateTask);
		};
	}, [bookId]);

	const handleDownloadBook = useCallback(() => {
		const targetBookName = bookName || 'Truyện';
		downloadManager.addBook(bookId, targetBookName);
		showToast(`Đã thêm vào hàng đợi tải xuống`, 'info');
	}, [bookId, bookName, showToast]);

	const handleConfirmDelete = useCallback(async () => {
		setShowDeleteConfirm(false);
		const targetBookName = bookName || 'Truyện';
		await offlineDb.deleteBook(bookId);
		setIsDownloaded(false);
		showToast(`Đã xóa "${targetBookName}" khỏi máy`, 'success');
		window.dispatchEvent(new CustomEvent('app-refresh'));
	}, [bookId, bookName, showToast]);

	return {
		isDownloaded,
		downloadTask,
		showDeleteConfirm,
		setShowDeleteConfirm,
		handleDownloadBook,
		handleConfirmDelete,
	};
}

function ChapterSkeletonItem() {
	return (
		<div className="w-full p-3 rounded-2xl bg-white/5 dark:bg-white/[0.04] border border-white/10 flex items-center gap-3 animate-pulse">
			<div className="w-12 h-7 rounded-xl bg-on-surface-variant/15 flex-shrink-0" />
			<div className="flex-1 space-y-1.5 min-w-0">
				<div className="h-4 w-3/4 bg-on-surface-variant/20 rounded-md" />
				<div className="h-3 w-1/3 bg-on-surface-variant/15 rounded-md" />
			</div>
			<div className="w-8 h-8 rounded-full bg-on-surface-variant/15 flex-shrink-0" />
		</div>
	);
}

function getDownloadButtonClass(isDownloaded: boolean, isDownloading: boolean): string {
	if (isDownloaded) return 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/20';
	if (isDownloading) return 'text-primary bg-primary/10';
	return 'text-on-surface-variant hover:text-on-surface hover:bg-white/10';
}

function renderDownloadButtonIcon(isDownloaded: boolean, isDownloading: boolean) {
	if (isDownloading) return <RefreshCw size={16} className="animate-spin text-primary" />;
	if (isDownloaded) return <Trash2 size={16} />;
	return <Download size={16} />;
}

interface QuickChapterHeaderProps {
	isDownloaded: boolean;
	downloadTask?: DownloadTask;
	search: string;
	onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onClearSearch: () => void;
	onOpenDeleteConfirm: () => void;
	onDownloadBook: () => void;
	onClose: () => void;
}

function QuickChapterHeader({
	isDownloaded,
	downloadTask,
	search,
	onSearchChange,
	onClearSearch,
	onOpenDeleteConfirm,
	onDownloadBook,
	onClose,
}: QuickChapterHeaderProps) {
	const isDownloading = Boolean(downloadTask && (downloadTask.status === 'downloading' || downloadTask.status === 'waiting'));
	const downloadBtnClass = getDownloadButtonClass(isDownloaded, isDownloading);

	return (
		<div className="pt-2.5 px-4 pb-2 border-b border-white/10 space-y-2 flex-shrink-0 bg-transparent relative z-20">
			<div className="w-10 h-1 rounded-full bg-white/25 dark:bg-white/20 mx-auto mb-1.5 flex-shrink-0" />

			<div className="flex items-center justify-between">
				<h3 className="text-sm font-extrabold text-on-surface tracking-tight">Danh Sách Chương</h3>
				<div className="flex items-center gap-1.5">
					<motion.button
						whileTap={{ scale: 0.88 }}
						onClick={() => {
							if (isDownloaded) {
								triggerHaptic('warning');
								onOpenDeleteConfirm();
								return;
							}
							triggerHaptic('light');
							onDownloadBook();
						}}
						disabled={isDownloading}
						title={isDownloaded ? 'Xóa dữ liệu ngoại tuyến' : 'Tải bộ truyện về đọc offline'}
						aria-label={isDownloaded ? 'Xóa dữ liệu ngoại tuyến' : 'Tải bộ truyện về đọc offline'}
						className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${downloadBtnClass}`}
					>
						{renderDownloadButtonIcon(isDownloaded, isDownloading)}
					</motion.button>

					<motion.button
						whileTap={{ scale: 0.88 }}
						onClick={() => {
							triggerHaptic('light');
							onClose();
						}}
						className="w-9 h-9 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
						title="Đóng"
						aria-label="Đóng bảng chọn chương"
					>
						<X size={18} />
					</motion.button>
				</div>
			</div>

			<div className="relative pt-1">
				<Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none" />
				<input
					type="text"
					placeholder="Tìm nhanh số hoặc tên chương..."
					value={search}
					onChange={onSearchChange}
					className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/10 border border-white/15 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] text-sm sm:text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 font-medium transition-all"
				/>
				{search && (
					<motion.button
						whileTap={{ scale: 0.85 }}
						type="button"
						onClick={() => {
							triggerHaptic('light');
							onClearSearch();
						}}
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

interface QuickChapterListBodyProps {
	chapters: Chapter[];
	loading: boolean;
	loadingTop: boolean;
	loadingBottom: boolean;
	currentChapterId?: string;
	currentChapterNumber?: number;
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	activeItemRef: React.RefObject<HTMLDivElement | null>;
	onScroll: () => void;
	onSelectChapter: (chapterId: string) => void;
}

function renderChapterListContent(
	chapters: Chapter[],
	loading: boolean,
	loadingBottom: boolean,
	currentChapterId: string | undefined,
	currentChapterNumber: number | undefined,
	activeItemRef: React.RefObject<HTMLDivElement | null>,
	onSelectChapter: (chapterId: string) => void
) {
	if (loading && chapters.length === 0) {
		return (
			<div className="space-y-2 py-2">
				{[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
					<ChapterSkeletonItem key={`sk-init-${idx}`} />
				))}
			</div>
		);
	}
	if (chapters.length === 0) {
		return <div className="py-12 text-center text-xs text-on-surface-variant font-medium">Không tìm thấy chương nào</div>;
	}
	return (
		<>
			{chapters.map((c, idx) => {
				const isCurrent = Boolean(
					(currentChapterId && c.chapterId === currentChapterId) ||
					(currentChapterNumber !== undefined && c.chapterNumber === currentChapterNumber)
				);

				return (
					<ChapterItem
						key={c.chapterId || `chap-${c.chapterNumber || idx}-${idx}`}
						ref={isCurrent ? activeItemRef : null}
						chapter={c}
						isActive={isCurrent}
						showStatus={true}
						onClick={() => onSelectChapter(c.chapterId)}
					/>
				);
			})}

			{loadingBottom && (
				<div className="space-y-2 mt-2">
					{[1, 2, 3, 4, 5].map((idx) => (
						<ChapterSkeletonItem key={`sk-bottom-${idx}`} />
					))}
				</div>
			)}
		</>
	);
}

function QuickChapterListBody({
	chapters,
	loading,
	loadingTop,
	loadingBottom,
	currentChapterId,
	currentChapterNumber,
	scrollContainerRef,
	activeItemRef,
	onScroll,
	onSelectChapter,
}: QuickChapterListBodyProps) {
	return (
		<div
			ref={scrollContainerRef}
			onScroll={onScroll}
			className="p-3 pb-8 overflow-y-auto hide-scrollbar overscroll-contain flex-1 min-h-0 space-y-1.5"
		>
			{loadingTop && (
				<div className="space-y-2 mb-2">
					{[1, 2, 3, 4, 5].map((idx) => (
						<ChapterSkeletonItem key={`sk-top-${idx}`} />
					))}
				</div>
			)}

			{renderChapterListContent(chapters, loading, loadingBottom, currentChapterId, currentChapterNumber, activeItemRef, onSelectChapter)}
		</div>
	);
}

function DeleteOfflineConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
	return (
		<div className="fixed inset-0 z-[99990] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
			<div className="bg-surface/90 dark:bg-surface/90 backdrop-blur-2xl text-on-surface w-full max-w-xs sm:max-w-sm rounded-3xl p-5 border border-outline-variant/30 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
				<div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
					<Trash2 size={24} />
				</div>

				<div className="text-center space-y-1.5">
					<h3 className="text-base font-bold text-on-surface">Xóa dữ liệu ngoại tuyến?</h3>
					<p className="text-xs text-on-surface-variant/80 leading-relaxed">Xoá toàn bộ các chương đã tải về sẽ bị xóa khỏi máy.</p>
				</div>

				<div className="flex items-center gap-2 pt-1">
					<motion.button
						whileTap={{ scale: 0.95 }}
						onClick={() => {
							triggerHaptic('light');
							onCancel();
						}}
						className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
					>
						Hủy
					</motion.button>
					<motion.button
						whileTap={{ scale: 0.95 }}
						onClick={() => {
							triggerHaptic('warning');
							onConfirm();
						}}
						className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-colors cursor-pointer"
					>
						Xóa khỏi máy
					</motion.button>
				</div>
			</div>
		</div>
	);
}

interface QuickChapterSelectSheetProps {
	bookId: string;
	bookName?: string;
	currentChapterId?: string;
	currentChapterNumber?: number;
	onClose: () => void;
}

export function QuickChapterSelectSheet({
	bookId,
	bookName,
	currentChapterId,
	currentChapterNumber,
	onClose,
}: QuickChapterSelectSheetProps) {
	const pagination = useQuickChapterPagination(bookId, currentChapterNumber, onClose);
	const offline = useOfflineBookControls(bookId, bookName);

	return (
		<>
			<BottomSheet isOpen={true} onClose={onClose} ariaLabel="Danh Sách Chương" maxHeight="h-[78vh] max-h-[85dvh]" showDragHandle={false}>
				<QuickChapterHeader
					isDownloaded={offline.isDownloaded}
					downloadTask={offline.downloadTask}
					search={pagination.search}
					onSearchChange={pagination.handleSearchChange}
					onClearSearch={pagination.handleClearSearch}
					onOpenDeleteConfirm={() => offline.setShowDeleteConfirm(true)}
					onDownloadBook={offline.handleDownloadBook}
					onClose={onClose}
				/>

				<QuickChapterListBody
					chapters={pagination.chapters}
					loading={pagination.loading}
					loadingTop={pagination.loadingTop}
					loadingBottom={pagination.loadingBottom}
					currentChapterId={currentChapterId}
					currentChapterNumber={currentChapterNumber}
					scrollContainerRef={pagination.scrollContainerRef}
					activeItemRef={pagination.activeItemRef}
					onScroll={pagination.handleScroll}
					onSelectChapter={pagination.handleSelectChapter}
				/>
			</BottomSheet>

			{offline.showDeleteConfirm && (
				<DeleteOfflineConfirmModal onCancel={() => offline.setShowDeleteConfirm(false)} onConfirm={offline.handleConfirmDelete} />
			)}
		</>
	);
}
