import { useEffect, useRef } from 'react';

import { continuationService } from '@/services/continuationService';
import { useToastStore } from '@/stores/useToastStore';

import type { StudioHubResponse } from '../types';

interface UseAutopilotPollerProps {
	selectedBranchId: string;
	isRunning: boolean;
	setHubData: React.Dispatch<React.SetStateAction<StudioHubResponse | null>>;
	onCompleted: (branchId: string) => void;
}

export function useAutopilotPoller({ selectedBranchId, isRunning, setHubData, onCompleted }: UseAutopilotPollerProps) {
	const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
	const showToast = useToastStore((state) => state.showToast);

	useEffect(() => {
		if (!selectedBranchId || !isRunning) {
			if (pollTimerRef.current) {
				clearInterval(pollTimerRef.current);
				pollTimerRef.current = null;
			}
			return;
		}

		pollTimerRef.current = setInterval(async () => {
			try {
				const statusRes = await continuationService.getAutopilotStatus(selectedBranchId);
				setHubData((prev) => {
					if (!prev) return null;
					return {
						...prev,
						branches: prev.branches.map((b) =>
							b.branchId === selectedBranchId
								? {
										...b,
										autopilot: statusRes.autopilot,
										lastWrittenChapter: statusRes.lastWrittenChapter,
									}
								: b
						),
					};
				});

				if (statusRes.autopilot.status !== 'RUNNING') {
					if (statusRes.autopilot.status === 'COMPLETED') {
						showToast('🎉 Đợt viết Autopilot đã hoàn tất!', 'success');
					}
					onCompleted(selectedBranchId);
				}
			} catch {
				// NOTE: Bỏ qua lỗi polling mạng nhẹ.
			}
		}, 3000);

		return () => {
			if (pollTimerRef.current) {
				clearInterval(pollTimerRef.current);
				pollTimerRef.current = null;
			}
		};
	}, [selectedBranchId, isRunning, setHubData, onCompleted, showToast]);
}
