import { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { BottomDock } from '@/components/BottomDock';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { PullToRefresh } from '@/components/PullToRefresh';
import { GlobalSettingsSheet } from '@/features/settings/GlobalSettingsSheet';
import { useCupertinoSwipeBack } from '@/hooks/useCupertinoSwipeBack';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { triggerHaptic } from '@/hooks/useHaptic';
import { downloadManager } from '@/lib/DownloadManager';

import { ChapterHeader, ChapterListContent } from './components/ChapterListSections';
import { useChapterListData } from './hooks/useChapterListData';

export function ChapterListScreen() {
	const { bookId } = useParams<{ bookId: string }>();
	const navigate = useNavigate();

	const {
		book,
		isFav,
		chapters,
		filteredChapters,
		loading,
		loadingMore,
		search,
		filterState,
		sortOrder,
		activeRange,
		showToast,
		setFilterState,
		setSortOrder,
		handleToggleFavorite,
		handleSearchChange,
		handleRangeSelect,
		handlePullRefresh,
		fetchChapters,
	} = useChapterListData(bookId);

	useDocumentTitle(book?.bookName);

	const screenRef = useRef<HTMLDivElement>(null);
	useCupertinoSwipeBack({
		containerRef: screenRef,
		onBack: () => {
			triggerHaptic('light');
			navigate('/');
		},
	});

	return (
		<div
			ref={screenRef}
			className="min-h-dvh w-full max-w-md mx-auto bg-background text-on-background pb-28 border-x border-outline-variant/20 shadow-2xl relative overflow-x-clip transition-colors duration-200"
		>
			<PullToRefresh onRefresh={handlePullRefresh} disabled={loading} showIndicator={false} />

			<ChapterHeader
				book={book}
				chaptersCount={chapters.length}
				isFav={isFav}
				loading={loading}
				search={search}
				filterState={filterState}
				sortOrder={sortOrder}
				activeRange={activeRange}
				onBack={() => {
					triggerHaptic('light');
					navigate('/');
				}}
				onToggleFavorite={handleToggleFavorite}
				onDownload={() => {
					if (!book) return;
					triggerHaptic('light');
					downloadManager.addBook(book.bookId, book.bookName);
					showToast(`Đã thêm "${book.bookName}" vào hàng đợi tải xuống`, 'info');
				}}
				onRefresh={() => {
					triggerHaptic('light');
					fetchChapters(1, search, filterState, sortOrder, false);
				}}
				onOpenTranslate={() => {
					if (!bookId) return;
					triggerHaptic('light');
					navigate(`/book/${bookId}/translate`);
				}}
				onSearchChange={handleSearchChange}
				onFilterStateChange={(val) => {
					triggerHaptic('selection');
					setFilterState(val);
				}}
				onToggleSort={() => {
					triggerHaptic('selection');
					setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
				}}
				onRangeSelect={handleRangeSelect}
			/>

			<main className="px-3.5 pt-3">
				<ChapterListContent
					loading={loading}
					chapters={chapters}
					filteredChapters={filteredChapters}
					book={book}
					bookId={bookId}
					loadingMore={loadingMore}
				/>
			</main>

			<LoadingOverlay isLoading={loading} />
			<GlobalSettingsSheet />
			<BottomDock />
		</div>
	);
}
