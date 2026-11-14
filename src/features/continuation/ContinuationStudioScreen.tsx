import { Loader2, AlertCircle } from 'lucide-react';
import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { PullToRefresh } from '@/components/PullToRefresh';
import { useCupertinoSwipeBack } from '@/hooks/useCupertinoSwipeBack';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { triggerHaptic } from '@/hooks/useHaptic';

import { BranchAutopilotTab } from './components/BranchAutopilotTab';
import { NewBranchModal } from './components/NewBranchModal';
import { StudioHeader } from './components/StudioHeader';
import { StudioTabsNav } from './components/StudioTabsNav';
import { VoiceSettingsTab } from './components/VoiceSettingsTab';
import { WorldModelTab } from './components/WorldModelTab';
import { useContinuationStudioState } from './hooks/useContinuationStudioState';

function StudioStateFallback({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
	if (loading) {
		return (
			<div className="min-h-dvh w-full max-w-md mx-auto bg-background flex flex-col items-center justify-center p-6 text-center">
				<Loader2 size={32} className="animate-spin text-primary mb-3" />
				<p className="text-xs text-on-surface-variant font-mono">Đang tải dữ liệu Continuation Studio...</p>
			</div>
		);
	}

	return (
		<div className="min-h-dvh w-full max-w-md mx-auto bg-background flex flex-col items-center justify-center p-6 text-center">
			<AlertCircle size={40} className="text-error mb-3" />
			<h2 className="text-sm font-bold text-on-surface mb-1">Không thể tải Studio</h2>
			<p className="text-xs text-on-surface-variant mb-4">{error || 'Dữ liệu không khả dụng'}</p>
			<button onClick={onRetry} className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold cursor-pointer">
				Thử lại
			</button>
		</div>
	);
}

function StudioActiveTabContent({
	activeTab,
	bookId,
	state,
}: {
	activeTab: 'autopilot' | 'world' | 'voice';
	bookId: string;
	state: ReturnType<typeof useContinuationStudioState>;
}) {
	const storyState = state.hubData?.storyState || null;

	if (activeTab === 'world') {
		return <WorldModelTab storyState={storyState} />;
	}

	if (activeTab === 'voice') {
		return <VoiceSettingsTab styleFingerprint={storyState?.styleFingerprint} />;
	}

	return (
		<BranchAutopilotTab
			bookId={bookId}
			branch={state.currentBranch}
			batchTarget={state.batchTarget}
			isRunning={state.isRunning}
			isPending={state.isActionPending}
			onSetBatchTarget={state.setBatchTarget}
			onStartAutopilot={state.handleStartAutopilot}
			onPauseAutopilot={state.handlePauseAutopilot}
			onStopAutopilot={state.handleStopAutopilot}
		/>
	);
}

export function ContinuationStudioScreen() {
	const { bookId } = useParams<{ bookId: string }>();
	const navigate = useNavigate();
	const state = useContinuationStudioState(bookId);

	const title = state.hubData?.book?.bookName ? `Studio Viết Tiếp - ${state.hubData.book.bookName}` : 'Studio Viết Tiếp';
	useDocumentTitle(title);

	const screenRef = useRef<HTMLDivElement>(null);
	useCupertinoSwipeBack({
		containerRef: screenRef,
		onBack: () => {
			triggerHaptic('light');
			navigate(`/book/${bookId || ''}`);
		},
	});

	if (state.loading || state.error || !state.hubData) {
		return <StudioStateFallback loading={state.loading} error={state.error} onRetry={state.refetch} />;
	}

	const { book, storyState, branches } = state.hubData;
	const safeBookId = bookId || '';

	return (
		<div
			ref={screenRef}
			className="min-h-dvh w-full max-w-md mx-auto bg-background text-on-background pb-16 border-x border-outline-variant/20 shadow-2xl relative overflow-x-clip transition-colors duration-200"
		>
			<PullToRefresh onRefresh={state.refetch} disabled={state.isRunning} showIndicator={false} />

			<StudioHeader
				bookName={book.bookName}
				author={book.author}
				branches={branches}
				selectedBranchId={state.selectedBranchId}
				onBack={() => navigate(`/book/${safeBookId}`)}
				onSelectBranch={state.handleSelectBranch}
				onOpenNewBranch={() => state.setShowNewBranchModal(true)}
			/>

			<StudioTabsNav activeTab={state.activeTab} onSelectTab={state.setActiveTab} />

			<div className="px-3.5 pt-1">
				<StudioActiveTabContent activeTab={state.activeTab} bookId={safeBookId} state={state} />
			</div>

			<NewBranchModal
				isOpen={state.showNewBranchModal}
				isPending={state.isActionPending}
				lastIngestedChapter={storyState?.lastIngestedChapter || 0}
				onClose={() => state.setShowNewBranchModal(false)}
				onSubmit={state.handleCreateBranch}
			/>
		</div>
	);
}
