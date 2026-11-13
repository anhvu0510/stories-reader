import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { BottomSheet } from '@/components/BottomSheet';
import { triggerHaptic } from '@/hooks/useHaptic';
import { downloadManager } from '@/lib/DownloadManager';
import { offlineDb } from '@/lib/offlineDb';
import { openChapter } from '@/shared/utils/openChapter';
import { useAppStore } from '@/stores/useAppStore';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { useToastStore } from '@/stores/useToastStore';

import {
	QuickBookBottomLoading,
	QuickBookChapterList,
	QuickBookHeader,
	QuickBookTopLoading,
} from './quick-book-sheet/QuickBookSubComponents';
import { useQuickBookChapters } from './quick-book-sheet/useQuickBookChapters';

import type { Book } from '@/shared/types';

interface QuickBookSheetProps {
	book: Book;
	onClose: () => void;
}

export function QuickBookSheet({ book, onClose }: QuickBookSheetProps) {
	const navigate = useNavigate();
	const showToast = useToastStore((state) => state.showToast);
	const isOfflineMode = useAppStore((state) => state.isOfflineMode);
	const configChapterLimit = useReaderConfigStore((state) => state.chapterLimit || 50);

	const [isDownloaded, setIsDownloaded] = useState(false);

	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const activeItemRef = useRef<HTMLDivElement | null>(null);

	const { chapters, loading, loadingBottom, loadingTop, search, setSearch, loadInitialChapters, handleScroll, handleSearchChange } =
		useQuickBookChapters({
			book,
			configChapterLimit,
			scrollContainerRef,
			activeItemRef,
		});

	useEffect(() => {
		offlineDb.getBook(book.bookId).then((b) => setIsDownloaded(Boolean(b)));
	}, [book.bookId]);

	const handleDownloadBook = () => {
		downloadManager.addBook(book.bookId, book.bookName);
		showToast(`Đã thêm "${book.bookName}" vào hàng đợi tải xuống`, 'info');
		onClose();
	};

	const handleDeleteOfflineBook = async () => {
		if (window.confirm(`Bạn có chắc chắn muốn xóa "${book.bookName}" khỏi máy?`)) {
			await offlineDb.deleteBook(book.bookId);
			setIsDownloaded(false);
			showToast(`Đã xóa "${book.bookName}" khỏi máy`, 'success');
			window.dispatchEvent(new CustomEvent('app-refresh'));
			onClose();
		}
	};

	const percent = book.chapterCount > 0 ? Math.round((book.totalTranslated / book.chapterCount) * 100) : 0;
	const pendingCount = book.totalPending || Math.max(0, book.chapterCount - book.totalTranslated);

	const handleSelectChapter = (chapterId: string) => {
		onClose();
		openChapter(book.bookId, chapterId);
	};

	return (
		<>
			<BottomSheet isOpen={true} onClose={onClose} ariaLabel={book.bookName} maxHeight="h-[82vh] max-h-[90dvh]" showDragHandle={false}>
				<QuickBookHeader
					book={book}
					isOfflineMode={isOfflineMode}
					isDownloaded={isDownloaded}
					pendingCount={pendingCount}
					percent={percent}
					search={search}
					onOpenTranslation={() => {
						triggerHaptic('light');
						onClose();
						navigate(`/book/${book.bookId}/translate`);
					}}
					onDownload={handleDownloadBook}
					onDeleteOffline={handleDeleteOfflineBook}
					onClose={onClose}
					onSearchChange={handleSearchChange}
					onClearSearch={() => {
						triggerHaptic('light');
						setSearch('');
						loadInitialChapters('');
					}}
				/>

				<div
					ref={scrollContainerRef}
					onScroll={handleScroll}
					className="p-3 pb-8 overflow-y-auto hide-scrollbar overscroll-contain flex-1 min-h-0 space-y-1.5"
				>
					<QuickBookTopLoading loadingTop={loadingTop} />

					<QuickBookChapterList
						loading={loading}
						chapters={chapters}
						lastReadChapter={book.lastReadChapter}
						activeItemRef={activeItemRef}
						onSelectChapter={handleSelectChapter}
					/>

					<QuickBookBottomLoading loadingBottom={loadingBottom} />
				</div>
			</BottomSheet>
		</>
	);
}
