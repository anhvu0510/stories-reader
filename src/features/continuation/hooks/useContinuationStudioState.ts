import { useState, useEffect, useCallback } from 'react';

import { continuationService } from '@/services/continuationService';

import { useAutopilotActions } from './useAutopilotActions';
import { useAutopilotPoller } from './useAutopilotPoller';

import type { StudioHubResponse, StoryBranchRecord } from '../types';

export function useContinuationStudioState(bookId?: string) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [hubData, setHubData] = useState<StudioHubResponse | null>(null);
	const [activeTab, setActiveTab] = useState<'autopilot' | 'world' | 'voice'>('autopilot');
	const [selectedBranchId, setSelectedBranchId] = useState<string>('');
	const [batchTarget, setBatchTarget] = useState<number>(5);
	const [showNewBranchModal, setShowNewBranchModal] = useState(false);

	const fetchHub = useCallback(
		async (targetBranchId?: string) => {
			if (!bookId) return;
			try {
				const data = await continuationService.getStudioHub(bookId, targetBranchId);
				setHubData(data);
				if (data.currentBranch && !targetBranchId) {
					setSelectedBranchId(data.currentBranch.branchId);
				}
				setError(null);
			} catch (err: unknown) {
				const msg = (err as Error)?.message || 'Không thể tải dữ liệu Studio';
				setError(msg);
			} finally {
				setLoading(false);
			}
		},
		[bookId]
	);

	useEffect(() => {
		fetchHub();
	}, [fetchHub]);

	const currentBranch: StoryBranchRecord | null =
		hubData?.branches.find((b) => b.branchId === selectedBranchId) || hubData?.currentBranch || null;
	const isRunning = currentBranch?.autopilot?.status === 'RUNNING';

	useAutopilotPoller({
		selectedBranchId,
		isRunning,
		setHubData,
		onCompleted: (bId) => fetchHub(bId),
	});

	const actions = useAutopilotActions({
		bookId,
		selectedBranchId,
		batchTarget,
		onBranchCreated: (newBranchId) => {
			setSelectedBranchId(newBranchId);
			setShowNewBranchModal(false);
		},
		onRefresh: (bId) => fetchHub(bId),
	});

	return {
		loading,
		error,
		hubData,
		activeTab,
		selectedBranchId,
		currentBranch,
		batchTarget,
		isActionPending: actions.isActionPending,
		isRunning,
		showNewBranchModal,
		setActiveTab,
		setBatchTarget,
		setShowNewBranchModal,
		handleSelectBranch: (bId: string) => {
			setSelectedBranchId(bId);
			fetchHub(bId);
		},
		handleStartAutopilot: actions.handleStartAutopilot,
		handlePauseAutopilot: actions.handlePauseAutopilot,
		handleStopAutopilot: actions.handleStopAutopilot,
		handleCreateBranch: actions.handleCreateBranch,
		refetch: () => fetchHub(selectedBranchId),
	};
}
