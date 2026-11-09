import { useState, useRef } from 'react';

import { BottomDock } from '@/components/BottomDock';
import { OfflineManagerSheet } from '@/components/OfflineManagerSheet';
import { PullToRefresh } from '@/components/PullToRefresh';
import { GlobalSettingsSheet } from '@/features/settings/GlobalSettingsSheet';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { type SortByField, type SortOrderDirection } from '@/stores/useLibraryStore';
import { useModalStore } from '@/stores/useModalStore';

import { LibraryBookList, LibraryStickyHeaderSection } from './components/LibraryScreenSections';
import { SortSheet } from './components/SortSheet';
import { TagFilterSheet } from './components/TagFilterSheet';
import { useLibraryBooksState, useLibraryActionHandlers } from './hooks/useLibraryBooksState';
import { useLibraryScrollHeader, useLibrarySwipeTabs, useRestoreScrollOnLoad } from './hooks/useLibraryScrollAndSwipe';

function LibraryOfflineModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
	if (!isOpen) return null;
	return <OfflineManagerSheet onClose={onClose} />;
}

export function LibraryScreen() {
	useDocumentTitle();
	const state = useLibraryBooksState();
	const { books, page, totalPages, total, loading, search, tab, selectedTags, sortBy, sortOrder, setSavedScrollY, initialSavedScrollY } =
		state;

	const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
	const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);
	const { openSettings, isOfflineManagerOpen, closeOfflineManager } = useModalStore();

	useRestoreScrollOnLoad(loading, books.length > 0, initialSavedScrollY);

	const { isHeaderCollapsed, setIsHeaderCollapsed, headerCollapseOffset, headerContentRef } = useLibraryScrollHeader({
		loading,
		setSavedScrollY,
	});

	const {
		handlePageChange,
		handleSearchChange,
		handleSearchSubmit,
		handleTabChange,
		handleTagFilterApply,
		handleSortApply,
		handlePullRefresh,
	} = useLibraryActionHandlers(state, setIsHeaderCollapsed);

	const contentContainerRef = useRef<HTMLDivElement | null>(null);

	useLibrarySwipeTabs({
		tab,
		disabled: isTagFilterOpen || isSortSheetOpen || isOfflineManagerOpen,
		onTabChange: handleTabChange,
		contentContainerRef,
	});

	const defaultSortBy: SortByField = 'createdAt';
	const defaultSortOrder: SortOrderDirection = 'DESC';
	const isCustomSortActive = tab === 'ALL' && (sortBy !== defaultSortBy || sortOrder !== defaultSortOrder);
	const bottomPaddingClass = totalPages > 1 ? 'pb-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)]' : 'pb-12';

	return (
		<div
			className={`min-h-dvh w-full max-w-md mx-auto bg-background text-on-background ${bottomPaddingClass} border-x border-outline-variant/20 shadow-2xl relative overflow-x-clip transition-colors duration-200`}
		>
			<PullToRefresh onRefresh={handlePullRefresh} disabled={loading} showIndicator={false} />

			<LibraryStickyHeaderSection
				isHeaderCollapsed={isHeaderCollapsed}
				headerCollapseOffset={headerCollapseOffset}
				headerContentRef={headerContentRef}
				search={search}
				onSearchChange={handleSearchChange}
				onSubmitSearch={handleSearchSubmit}
				onOpenSettings={() => openSettings('reader')}
				onOpenTagFilter={() => setIsTagFilterOpen(true)}
				selectedTags={selectedTags}
				onOpenSort={tab === 'ALL' ? () => setIsSortSheetOpen(true) : undefined}
				isCustomSortActive={isCustomSortActive}
				onClearAllTags={() => handleTagFilterApply([])}
				onRemoveTag={(tag) => {
					const updated = selectedTags.filter((t) => t !== tag);
					handleTagFilterApply(updated);
				}}
				tab={tab}
				total={total}
				onTabChange={handleTabChange}
			/>

			<div ref={contentContainerRef} className="px-3.5 pt-3.5 space-y-3 will-change-transform">
				<LibraryBookList
					loading={loading}
					books={books}
					tab={tab}
					selectedTags={selectedTags}
					onClearTags={() => handleTagFilterApply([])}
					onOpenServerSettings={() => openSettings('servers')}
				/>
			</div>

			<GlobalSettingsSheet />
			<LibraryOfflineModal isOpen={isOfflineManagerOpen} onClose={closeOfflineManager} />

			<TagFilterSheet
				isOpen={isTagFilterOpen}
				selectedTags={selectedTags}
				onApply={handleTagFilterApply}
				onClose={() => setIsTagFilterOpen(false)}
			/>

			<SortSheet
				isOpen={isSortSheetOpen}
				currentSortBy={sortBy}
				currentSortOrder={sortOrder}
				defaultSortBy={defaultSortBy}
				defaultSortOrder={defaultSortOrder}
				onApply={handleSortApply}
				onClose={() => setIsSortSheetOpen(false)}
			/>

			<BottomDock page={page} totalPages={totalPages} total={total} loading={loading} onPageChange={handlePageChange} />
		</div>
	);
}
