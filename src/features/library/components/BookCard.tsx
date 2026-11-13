import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { triggerHaptic } from '@/hooks/useHaptic';
import { useLongPress } from '@/hooks/useLongPress';
import { downloadManager } from '@/lib/DownloadManager';
import { offlineDb } from '@/lib/offlineDb';
import { BookRepository } from '@/repositories/BookRepository';
import { openChapter } from '@/shared/utils/openChapter';
import { useAppStore } from '@/stores/useAppStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useToastStore } from '@/stores/useToastStore';

import { BookCardMain, BookDeleteConfirmModal } from './book-card/BookCardSubComponents';
import { BookFloatMenu } from './BookFloatMenu';
import { QuickBookSheet } from './QuickBookSheet';

import type { Book } from '@/shared/types';

function formatDate(dateStr?: string): string {
	if (!dateStr) return '23-07-2026';
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

interface BookCardProps {
	key?: React.Key;
	book: Book;
	activeTab?: 'ALL' | 'HISTORY' | 'FAVORITE' | 'AI';
	onSelect?: (bookId: string) => void;
	isSelected?: boolean;
	isSelectionMode?: boolean;
	onRefresh?: () => void;
	onTagClick?: (tag: string) => void;
}

function useBookCardState(book: Book, activeTab?: string, isSelectionMode?: boolean, onSelect?: (bookId: string) => void) {
	const navigate = useNavigate();
	const [showQuickSheet, setShowQuickSheet] = useState(false);
	const [showActionSheet, setShowActionSheet] = useState(false);
	const [isDownloaded, setIsDownloaded] = useState(false);
	const [deleteConfirmType, setDeleteConfirmType] = useState<'ONLINE' | 'OFFLINE' | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const showToast = useToastStore((state) => state.showToast);

	useEffect(() => {
		let isMounted = true;
		offlineDb.getBook(book.bookId).then((b) => {
			if (isMounted) setIsDownloaded(Boolean(b));
		});
		return () => {
			isMounted = false;
		};
	}, [book.bookId]);

	const handleToggleFavorite = async (e: React.MouseEvent) => {
		e.stopPropagation();
		triggerHaptic('selection');
		try {
			const res = await BookRepository.toggleFavorite(book.bookId);
			triggerHaptic('success');
			showToast(res.isFavorite ? `Đã thêm "${book.bookName}" vào yêu thích` : `Đã bỏ "${book.bookName}" khỏi yêu thích`, 'success');
			window.dispatchEvent(new CustomEvent('favorites-updated'));
		} catch {
			triggerHaptic('warning');
			showToast('Không thể cập nhật trạng thái yêu thích', 'error');
		}
	};

	const handleCardClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		triggerHaptic('light');

		if (isSelectionMode && onSelect) {
			onSelect(book.bookId);
			return;
		}
		if (activeTab === 'HISTORY' && book.lastReadChapter?.chapterId) {
			openChapter(book.bookId, book.lastReadChapter.chapterId);
			return;
		}
		if (activeTab === 'AI') {
			navigate(`/book/${book.bookId}/translate`);
			return;
		}
		setShowQuickSheet(true);
	};

	const handleReadContinue = () => {
		if (book.lastReadChapter?.chapterId) {
			openChapter(book.bookId, book.lastReadChapter.chapterId);
		} else {
			setShowQuickSheet(true);
		}
	};

	const handleOpenTranslation = () => {
		navigate(`/book/${book.bookId}/translate`);
	};

	const handleOpenNewTab = () => {
		const url = book.lastReadChapter?.chapterId
			? `#/book/${book.bookId}/chapter/${book.lastReadChapter.chapterId}`
			: `#/book/${book.bookId}`;
		window.open(url, '_blank');
	};

	const handleDownloadBook = () => {
		downloadManager.addBook(book.bookId, book.bookName);
		showToast(`Đã thêm "${book.bookName}" vào hàng đợi tải xuống`, 'info');
	};

	const handleConfirmDelete = async () => {
		if (!deleteConfirmType) return;
		setIsDeleting(true);
		try {
			if (deleteConfirmType === 'ONLINE') {
				await BookRepository.deleteBook(book.bookId);
				showToast(`Đã xóa bộ truyện "${book.bookName}" khỏi hệ thống`, 'success');
			} else {
				await offlineDb.deleteBook(book.bookId);
				setIsDownloaded(false);
				showToast(`Đã xóa "${book.bookName}" khỏi máy`, 'success');
			}
			setDeleteConfirmType(null);
			window.dispatchEvent(new CustomEvent('app-refresh'));
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Không thể xóa';
			showToast(`Lỗi khi xóa bộ truyện: ${message}`, 'error');
		} finally {
			setIsDeleting(false);
		}
	};

	return {
		showQuickSheet,
		setShowQuickSheet,
		showActionSheet,
		setShowActionSheet,
		isDownloaded,
		deleteConfirmType,
		setDeleteConfirmType,
		isDeleting,
		handleToggleFavorite,
		handleCardClick,
		handleReadContinue,
		handleOpenTranslation,
		handleOpenNewTab,
		handleDownloadBook,
		handleConfirmDelete,
	};
}

export const BookCard = React.memo(function BookCard({ book, activeTab, onSelect, isSelected, isSelectionMode }: BookCardProps) {
	const isOfflineMode = useAppStore((state) => state.isOfflineMode);
	const isFav = useFavoriteStore((state) => state.favoriteBookIds.includes(book.bookId)) || Boolean(book.isFavorite);

	const {
		showQuickSheet,
		setShowQuickSheet,
		showActionSheet,
		setShowActionSheet,
		isDownloaded,
		deleteConfirmType,
		setDeleteConfirmType,
		isDeleting,
		handleToggleFavorite,
		handleCardClick,
		handleReadContinue,
		handleOpenTranslation,
		handleOpenNewTab,
		handleDownloadBook,
		handleConfirmDelete,
	} = useBookCardState(book, activeTab, isSelectionMode, onSelect);

	const readCount: number = Number(book.lastReadChapter?.chapterNumber || 0);
	const unTranslatedCount = Math.max(0, book.chapterCount - book.totalTranslated);
	const formattedDate = formatDate(book.updatedAt || book.lastedReadAt);
	const progressPct = book.chapterCount > 0 ? Math.min(100, Math.round((readCount / book.chapterCount) * 100)) : 0;

	const longPressHandlers = useLongPress({
		threshold: 400,
		moveTolerance: 10,
		onLongPress: () => {
			setShowActionSheet(true);
		},
		onClick: handleCardClick,
	});

	return (
		<>
			<BookCardMain
				book={book}
				isFav={isFav}
				isSelected={isSelected}
				isDownloaded={isDownloaded}
				formattedDate={formattedDate}
				readCount={readCount}
				progressPct={progressPct}
				activeTab={activeTab}
				unTranslatedCount={unTranslatedCount}
				longPressHandlers={longPressHandlers}
				onToggleFavorite={handleToggleFavorite}
				onOpenActionSheet={(e) => {
					e.stopPropagation();
					triggerHaptic('light');
					setShowActionSheet(true);
				}}
			/>

			<BookFloatMenu
				book={book}
				isOpen={showActionSheet}
				onClose={() => setShowActionSheet(false)}
				isDownloaded={isDownloaded}
				isOfflineMode={isOfflineMode}
				isFavorite={isFav}
				readCount={readCount}
				unTranslatedCount={unTranslatedCount}
				onReadContinue={handleReadContinue}
				onOpenQuickSheet={() => setShowQuickSheet(true)}
				onOpenTranslationSheet={handleOpenTranslation}
				onDownloadBook={handleDownloadBook}
				onOpenDeleteOffline={() => setDeleteConfirmType('OFFLINE')}
				onOpenDeleteOnline={() => setDeleteConfirmType('ONLINE')}
				onToggleFavorite={handleToggleFavorite}
				onOpenNewTab={handleOpenNewTab}
			/>

			{showQuickSheet && <QuickBookSheet book={book} onClose={() => setShowQuickSheet(false)} />}

			<BookDeleteConfirmModal
				confirmType={deleteConfirmType}
				bookName={book.bookName}
				isDeleting={isDeleting}
				onClose={() => setDeleteConfirmType(null)}
				onConfirm={handleConfirmDelete}
			/>
		</>
	);
});
