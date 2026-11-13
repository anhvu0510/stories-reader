import React, { useRef } from 'react';

import { useCupertinoSwipeBack } from '@/hooks/useCupertinoSwipeBack';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { TranslationActionDock } from './components/TranslationActionDock';
import { TranslationAiConfigCard } from './components/TranslationAiConfigCard';
import { TranslationBatchSection } from './components/TranslationBatchSection';
import { TranslationHeader } from './components/TranslationHeader';
import { TranslationStorySection } from './components/TranslationStorySection';
import { useTranslationScreenState } from './hooks/useTranslationScreenState';

export function TranslationScreen() {
	const state = useTranslationScreenState();
	const screenRef = useRef<HTMLDivElement>(null);

	useDocumentTitle(state.book?.bookName ? `Dịch AI - ${state.book.bookName}` : 'Dịch AI');

	useCupertinoSwipeBack({
		containerRef: screenRef,
		onBack: state.handleBack,
	});

	const selectedCount = state.activeTab === 'batch_chapter' ? state.batch.selectedChapters.size : state.actions.selectedBooks.size;

	return (
		<div
			ref={screenRef}
			className="min-h-dvh w-full max-w-md mx-auto bg-background text-on-background pb-24 border-x border-outline-variant/20 shadow-2xl relative flex flex-col overflow-x-clip transition-colors duration-200"
		>
			<TranslationHeader
				book={state.book}
				activeTab={state.activeTab}
				setActiveTab={state.setActiveTab}
				onBack={state.handleBack}
				onRefresh={state.handleRefresh}
				loading={state.loadingBook}
			/>

			<main className="px-3.5 pt-3 flex-1 flex flex-col min-h-0 space-y-3 overflow-hidden">
				<TranslationAiConfigCard
					options={state.options}
					setOptions={state.setOptions}
					showConfig={state.showConfig}
					setShowConfig={state.setShowConfig}
					poolStatus={state.poolStatus}
					setPoolStatus={state.setPoolStatus}
					quotas={state.quotas}
					onDetectProperNouns={state.actions.handleDetectProperNouns}
					onTranslateChineseTitles={state.actions.handleTranslateChineseTitles}
				/>

				{state.activeTab === 'batch_chapter' && (
					<TranslationBatchSection
						batch={state.batch}
						selection={state.selection}
						chapterSearch={state.chapterSearch}
						setChapterSearch={state.setChapterSearch}
					/>
				)}

				{state.activeTab === 'story' && (
					<TranslationStorySection
						books={state.actions.books}
						searchBook={state.actions.searchBook}
						onSearchChange={state.actions.setSearchBook}
						selectedBooks={state.actions.selectedBooks}
						onToggleBook={state.toggleBook}
						onSelectAllBooks={state.handleSelectAllBooks}
						onClearBooks={state.handleClearBooks}
					/>
				)}
			</main>

			<TranslationActionDock
				isSubmitting={state.actions.isSubmitting}
				submittingType={state.actions.submittingType}
				syncButtonLabel={state.syncButtonLabel}
				asyncButtonLabel={state.asyncButtonLabel}
				selectedCount={selectedCount}
				onSubmit={state.actions.handleSubmit}
			/>
		</div>
	);
}
