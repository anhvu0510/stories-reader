import { offlineDb } from '@/lib/offlineDb';
import { apiClient } from '@/services/apiClient';
import { MOCK_REPLACEMENTS } from '@/services/mockData';
import { useAppStore } from '@/stores/useAppStore';

import type { Replacement } from '@/shared/types';

export const ReplacementRepository = {
	async getReplacements(): Promise<Replacement[]> {
		const isOffline = useAppStore.getState().isOfflineMode;
		if (isOffline) {
			return await offlineDb.getReplacements();
		}

		try {
			const res = await apiClient.get<any>('/api/replacements');
			return res?.data || (Array.isArray(res) ? res : []);
		} catch (e) {
			const offline = await offlineDb.getReplacements();
			return offline.length > 0 ? offline : MOCK_REPLACEMENTS;
		}
	},

	async addReplacement(rep: Omit<Replacement, 'id'>): Promise<Replacement> {
		const isOffline = useAppStore.getState().isOfflineMode;
		const newRep: Replacement = {
			...rep,
			id: Date.now().toString()
		};

		if (!isOffline) {
			try {
				const res = await apiClient.post<any>('/api/replacements', rep);
				if (res?.id) newRep.id = res.id;
			} catch (e) {
				console.warn('Failed to add replacement via API', e);
			}
		}

		await offlineDb.saveReplacement(newRep);
		return newRep;
	},

	async deleteReplacement(id: string): Promise<boolean> {
		const isOffline = useAppStore.getState().isOfflineMode;
		if (!isOffline) {
			try {
				await apiClient.delete(`/api/replacements/${id}`);
			} catch (e) {
				console.warn('Failed to delete replacement via API', e);
			}
		}

		await offlineDb.deleteReplacement(id);
		return true;
	}
};
