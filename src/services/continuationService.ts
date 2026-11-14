import { apiClient } from './apiClient';

import type {
	StudioHubResponse,
	StoryBranchRecord,
	AutopilotStatusRecord,
	StoryStateRecord,
	BranchMode,
} from '@/features/continuation/types';

export interface CreateBranchPayload {
	mode: BranchMode;
	forkAtChapter?: number;
	targetThreadId?: string;
	counterfactualPremise?: string;
	userDirection?: string;
	chapterCount?: number;
	model?: string;
	platform?: string;
}

export interface StartAutopilotPayload {
	targetCount?: number;
	autoPublish?: boolean;
	model?: string;
	platform?: string;
}

export const continuationService = {
	async getStudioHub(bookId: string, branchId?: string): Promise<StudioHubResponse> {
		const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
		const res = await apiClient.get<{ data?: StudioHubResponse } & StudioHubResponse>(
			`/api/stories/${encodeURIComponent(bookId)}/continuation/hub${query}`
		);
		return res.data || res;
	},

	async createBranch(bookId: string, payload: CreateBranchPayload): Promise<StoryBranchRecord> {
		const res = await apiClient.post<{ data?: StoryBranchRecord } & StoryBranchRecord>(
			`/api/stories/${encodeURIComponent(bookId)}/continuation/branches`,
			payload
		);
		return res.data || res;
	},

	async startAutopilot(branchId: string, payload: StartAutopilotPayload): Promise<{ ok: boolean; autopilot: AutopilotStatusRecord }> {
		const res = await apiClient.post<{ ok: boolean; autopilot: AutopilotStatusRecord }>(
			`/api/stories/continuation/branches/${encodeURIComponent(branchId)}/autopilot`,
			payload
		);
		return res;
	},

	async pauseAutopilot(branchId: string): Promise<{ ok: boolean; autopilot: AutopilotStatusRecord }> {
		const res = await apiClient.post<{ ok: boolean; autopilot: AutopilotStatusRecord }>(
			`/api/stories/continuation/branches/${encodeURIComponent(branchId)}/autopilot/pause`
		);
		return res;
	},

	async stopAutopilot(branchId: string): Promise<{ ok: boolean; autopilot: AutopilotStatusRecord }> {
		const res = await apiClient.post<{ ok: boolean; autopilot: AutopilotStatusRecord }>(
			`/api/stories/continuation/branches/${encodeURIComponent(branchId)}/autopilot/stop`
		);
		return res;
	},

	async getAutopilotStatus(
		branchId: string
	): Promise<{ ok: boolean; autopilot: AutopilotStatusRecord; lastWrittenChapter: number; totalPlanned: number }> {
		const res = await apiClient.get<{
			ok: boolean;
			autopilot: AutopilotStatusRecord;
			lastWrittenChapter: number;
			totalPlanned: number;
		}>(`/api/stories/continuation/branches/${encodeURIComponent(branchId)}/autopilot/status`);
		return res;
	},

	async publishBranch(branchId: string, allowNonMain = true): Promise<{ ok: boolean; publishedCount: number }> {
		const res = await apiClient.post<{ ok: boolean; publishedCount: number }>(
			`/api/stories/continuation/branches/${encodeURIComponent(branchId)}/publish`,
			{ allowNonMain }
		);
		return res;
	},

	async saveStoryState(bookId: string, state: Partial<StoryStateRecord>): Promise<StoryStateRecord> {
		const res = await apiClient.put<{ data?: StoryStateRecord } & StoryStateRecord>(
			`/api/stories/${encodeURIComponent(bookId)}/continuation/state`,
			state
		);
		return res.data || res;
	},
};
