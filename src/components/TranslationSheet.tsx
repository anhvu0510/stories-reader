import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

import { BottomSheet } from './BottomSheet';
import { TabButton, TranslationSheetActionButtons, TranslationSheetConfigBar } from './translation-sheet/TranslationConfigSection';
import {
	getAsyncButtonLabel,
	getSyncButtonLabel,
	resolveTranslationSheetProps,
	type Tab,
	type TranslationSheetProps,
} from './translation-sheet/translationHelpers';
import { BatchChapterList, ChapterBatchControls, CurrentTabContent, StoryTabContent } from './translation-sheet/TranslationTabViews';
import { useBatchSelectionHandlers, useTranslationActions } from './translation-sheet/useTranslationActions';
import { useTranslationBatchPagination, useTranslationOptions } from './translation-sheet/useTranslationSheet';

function TranslationSheetHeader({
	activeTab,
	setActiveTab,
	disableCurrent,
	onClose,
}: {
	activeTab: Tab;
	setActiveTab: (tab: Tab) => void;
	disableCurrent: boolean;
	onClose: () => void;
}) {
	return (
		<div className="flex-shrink-0 pt-2 px-3 pb-2 border-b border-white/10 bg-transparent relative z-20">
			<div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2" />
			<div className="flex items-center justify-between gap-2">
				<div className="flex bg-white/10 p-0.5 rounded-lg border border-white/15 flex-1 gap-0.5">
					<TabButton active={activeTab === 'current'} onClick={() => setActiveTab('current')} disabled={disableCurrent}>
						Hiện tại
					</TabButton>
					<TabButton active={activeTab === 'batch_chapter'} onClick={() => setActiveTab('batch_chapter')}>
						Nhiều chương
					</TabButton>
					<TabButton active={activeTab === 'story'} onClick={() => setActiveTab('story')}>
						Truyện
					</TabButton>
				</div>
				<motion.button
					whileTap={{ scale: 0.88 }}
					onClick={() => {
						triggerHaptic('light');
						onClose();
					}}
					className="w-8.5 h-8.5 bg-white/10 border border-white/20 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer shrink-0"
					title="Đóng"
					aria-label="Đóng"
				>
					<X size={16} />
				</motion.button>
			</div>
		</div>
	);
}

function computeSheetLabels(
	actions: { isSubmitting: boolean; submittingType: 'sync' | 'async' | null; selectedBooks: Set<string> },
	activeTab: Tab,
	selectedChaptersCount: number
) {
	return {
		sync: getSyncButtonLabel(actions.isSubmitting, actions.submittingType, activeTab, selectedChaptersCount, actions.selectedBooks.size),
		async: getAsyncButtonLabel(actions.isSubmitting, actions.submittingType, activeTab, selectedChaptersCount, actions.selectedBooks.size),
	};
}

export function TranslationSheet(props: TranslationSheetProps) {
	const {
		onClose,
		currentBookName,
		currentChapterName,
		currentBookId,
		currentChapterId,
		currentChapterNumber,
		initialTab,
		initialSelectedChapters,
		onSuccess,
		disableCurrent,
	} = resolveTranslationSheetProps(props);

	const [activeTab, setActiveTab] = useState<Tab>(initialTab);
	const { options, setOptions, showConfig, setShowConfig, poolStatus, setPoolStatus, quotas } = useTranslationOptions(activeTab);

	const batch = useTranslationBatchPagination(activeTab, currentBookId, currentChapterNumber, initialSelectedChapters);
	const actions = useTranslationActions({
		activeTab,
		currentBookId,
		currentChapterId,
		initialSelectedChapters,
		options,
		batch,
		onClose,
		onSuccess,
	});
	const selection = useBatchSelectionHandlers(currentBookId, batch, actions.setIsSubmitting);

	const toggleBook = (id: string) => {
		const next = new Set(actions.selectedBooks);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		actions.setSelectedBooks(next);
	};

	const labels = computeSheetLabels(actions, activeTab, batch.selectedChapters.size);

	return (
		<BottomSheet
			isOpen={true}
			onClose={onClose}
			ariaLabel="Mở Dịch AI"
			maxHeight="h-[78vh] min-h-[520px] max-h-[85dvh]"
			showDragHandle={false}
		>
			<TranslationSheetHeader activeTab={activeTab} setActiveTab={setActiveTab} disableCurrent={disableCurrent} onClose={onClose} />

			<TranslationSheetConfigBar
				showConfig={showConfig}
				onToggleConfig={() => setShowConfig(!showConfig)}
				poolStatus={poolStatus}
				currentModel={options.model}
				onDetectProperNouns={actions.handleDetectProperNouns}
				onTranslateChineseTitles={actions.handleTranslateChineseTitles}
				options={options}
				setOptions={setOptions}
				setPoolStatus={setPoolStatus}
				quotas={quotas}
			/>

			<div className="flex-1 overflow-y-auto hide-scrollbar p-4 sm:p-5 flex flex-col min-h-0">
				{activeTab === 'current' && <CurrentTabContent currentChapterName={currentChapterName} currentBookName={currentBookName} />}

				{activeTab === 'batch_chapter' && (
					<div className="flex-1 flex flex-col min-h-0">
						<ChapterBatchControls
							selectedCount={batch.selectedChapters.size}
							chaptersCount={batch.chapters.length}
							onClearSelection={() => batch.setSelectedChapters(new Set())}
							showOnlyPending={batch.showOnlyPending}
							onTogglePending={batch.setShowOnlyPending}
							rangeStart={batch.rangeStart}
							setRangeStart={batch.setRangeStart}
							rangeEnd={batch.rangeEnd}
							setRangeEnd={batch.setRangeEnd}
							onSelectRange={selection.handleSelectRange}
							onSelectAll={selection.handleSelectAll}
							onSelectPending={selection.handleSelectPending}
						/>
						<BatchChapterList
							chapters={batch.chapters}
							showOnlyPending={batch.showOnlyPending}
							selectedChapters={batch.selectedChapters}
							currentChapterId={currentChapterId}
							currentChapterNumber={currentChapterNumber}
							initialSelectedChapters={initialSelectedChapters}
							chapterListRef={batch.chapterListRef}
							activeItemRef={batch.activeItemRef}
							onScroll={batch.handleScroll}
							onToggleChapter={selection.toggleChapter}
						/>
					</div>
				)}

				{activeTab === 'story' && (
					<StoryTabContent
						books={actions.books}
						searchBook={actions.searchBook}
						onSearchChange={actions.setSearchBook}
						selectedBooks={actions.selectedBooks}
						onToggleBook={toggleBook}
					/>
				)}
			</div>

			<TranslationSheetActionButtons
				isSubmitting={actions.isSubmitting}
				submittingType={actions.submittingType}
				syncButtonLabel={labels.sync}
				asyncButtonLabel={labels.async}
				disabled={!options.model}
				onSubmit={actions.handleSubmit}
			/>
		</BottomSheet>
	);
}
