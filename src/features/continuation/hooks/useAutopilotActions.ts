import { useState } from 'react';

import { continuationService, type CreateBranchPayload } from '@/services/continuationService';
import { useToastStore } from '@/stores/useToastStore';

interface UseAutopilotActionsProps {
	bookId?: string;
	selectedBranchId: string;
	batchTarget: number;
	onBranchCreated: (branchId: string) => void;
	onRefresh: (branchId?: string) => Promise<void>;
}

export function useAutopilotActions({ bookId, selectedBranchId, batchTarget, onBranchCreated, onRefresh }: UseAutopilotActionsProps) {
	const [isActionPending, setIsActionPending] = useState(false);
	const showToast = useToastStore((state) => state.showToast);

	const handleStartAutopilot = async () => {
		if (!selectedBranchId || isActionPending) return;
		setIsActionPending(true);
		try {
			await continuationService.startAutopilot(selectedBranchId, {
				targetCount: batchTarget,
				autoPublish: true,
				model: 'deepseek-ai/deepseek-v4.1-flash-1017',
				platform: 'DEPLOYAI',
			});
			showToast(`🚀 Đã khởi động Autopilot viết ${batchTarget} chương!`, 'success');
			await onRefresh(selectedBranchId);
		} catch (err: unknown) {
			showToast((err as Error)?.message || 'Lỗi khởi động Autopilot', 'error');
		} finally {
			setIsActionPending(false);
		}
	};

	const handlePauseAutopilot = async () => {
		if (!selectedBranchId || isActionPending) return;
		setIsActionPending(true);
		try {
			await continuationService.pauseAutopilot(selectedBranchId);
			showToast('⏸️ Đã tạm dừng Autopilot', 'info');
			await onRefresh(selectedBranchId);
		} catch (err: unknown) {
			showToast((err as Error)?.message || 'Lỗi tạm dừng Autopilot', 'error');
		} finally {
			setIsActionPending(false);
		}
	};

	const handleStopAutopilot = async () => {
		if (!selectedBranchId || isActionPending) return;
		setIsActionPending(true);
		try {
			await continuationService.stopAutopilot(selectedBranchId);
			showToast('⏹️ Đã dừng hẳn Autopilot', 'info');
			await onRefresh(selectedBranchId);
		} catch (err: unknown) {
			showToast((err as Error)?.message || 'Lỗi dừng Autopilot', 'error');
		} finally {
			setIsActionPending(false);
		}
	};

	const handleCreateBranch = async (payload: CreateBranchPayload) => {
		if (!bookId) return;
		setIsActionPending(true);
		try {
			const newBranch = await continuationService.createBranch(bookId, payload);
			showToast(`🌿 Đã tạo nhánh mới "${newBranch.title}"!`, 'success');
			await onRefresh(newBranch.branchId);
			onBranchCreated(newBranch.branchId);
		} catch (err: unknown) {
			showToast((err as Error)?.message || 'Không thể tạo nhánh mới', 'error');
		} finally {
			setIsActionPending(false);
		}
	};

	return {
		isActionPending,
		handleStartAutopilot,
		handlePauseAutopilot,
		handleStopAutopilot,
		handleCreateBranch,
	};
}
