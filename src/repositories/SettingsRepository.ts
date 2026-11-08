import { apiClient } from '@/services/apiClient';
import { useAppStore } from '@/stores/useAppStore';

const settingsCache: Record<string, { data: unknown; timestamp: number }> = {};

function readLocalSetting<T = unknown>(cacheKey: string): T | null {
	const local = localStorage.getItem(cacheKey);
	if (!local) return null;
	try {
		return JSON.parse(local) as T;
	} catch {
		// intentionally empty — invalid JSON in localStorage, skip cache entry
		return null;
	}
}

function writeLocalSetting(cacheKey: string, value: unknown): void {
	try {
		localStorage.setItem(cacheKey, JSON.stringify(value));
	} catch {
		// intentionally empty — localStorage may be unavailable (private mode / storage full)
	}
}

export const SettingsRepository = {
	async getSettings<T = unknown>(key: string, skipCache = false): Promise<T | null> {
		const isOffline = useAppStore.getState().isOfflineMode;
		const cacheKey = `setting_${key}`;
		const now = Date.now();

		// 1. Return from memory cache if fresh (30 sec TTL)
		if (!skipCache && settingsCache[key] && now - settingsCache[key].timestamp < 30 * 1000) {
			return settingsCache[key].data as T;
		}

		// 2. Return from LocalStorage if in offline mode
		if (isOffline) {
			const parsed = readLocalSetting<T>(cacheKey);
			if (parsed) {
				settingsCache[key] = { data: parsed, timestamp: now };
			}
			return parsed;
		}

		// 3. Fetch from original backend API endpoint `/api/stories/setting/${key}`
		try {
			const res = await apiClient.get<T>(`/api/stories/setting/${key}`, { silent: true });
			if (res) {
				settingsCache[key] = { data: res, timestamp: now };
				writeLocalSetting(cacheKey, res);
				return res;
			}
			return null;
		} catch (e) {
			console.warn(`Failed to fetch settings for key ${key} from API:`, e);
			const parsed = readLocalSetting<T>(cacheKey);
			if (parsed) {
				settingsCache[key] = { data: parsed, timestamp: 0 };
			}
			return parsed;
		}
	},

	async updateSettings<T = unknown>(key: string, value: T): Promise<unknown> {
		const isOffline = useAppStore.getState().isOfflineMode;
		const cacheKey = `setting_${key}`;

		// Update memory cache and local storage immediately for fast UI feedback
		writeLocalSetting(cacheKey, { value });
		settingsCache[key] = { data: { value }, timestamp: Date.now() };

		if (isOffline) {
			return { value };
		}

		const stringifiedValue = typeof value === 'string' ? value : JSON.stringify(value);

		// Post to original backend API endpoint `/api/stories/setting` silently (no loading overlay)
		try {
			const res = await apiClient.post('/api/stories/setting', { key, value: stringifiedValue }, { silent: true });
			return res;
		} catch (e) {
			console.warn(`Failed to sync settings for key ${key} to API:`, e);
			return { value };
		}
	},
};
