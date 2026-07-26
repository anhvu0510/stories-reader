import { apiClient } from '../services/apiClient';
import { useAppStore } from '../stores/useAppStore';

const settingsCache: { [key: string]: { data: any; timestamp: number } } = {};

export const SettingsRepository = {
  async getSettings(key: string, skipCache: boolean = false): Promise<any> {
    const isOffline = useAppStore.getState().isOfflineMode;
    const cacheKey = `setting_${key}`;
    const now = Date.now();

    // 1. Return from memory cache if fresh (10 min TTL)
    if (!skipCache && settingsCache[key] && now - settingsCache[key].timestamp < 10 * 60 * 1000) {
      return settingsCache[key].data;
    }

    // 2. Return from LocalStorage if in offline mode
    if (isOffline) {
      const local = localStorage.getItem(cacheKey);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          settingsCache[key] = { data: parsed, timestamp: now };
          return parsed;
        } catch (e) {}
      }
      return null;
    }

    // 3. Fetch from original backend API endpoint `/api/stories/setting/${key}`
    try {
      const res = await apiClient.get<any>(`/api/stories/setting/${key}`);
      if (res) {
        settingsCache[key] = { data: res, timestamp: now };
        try {
          localStorage.setItem(cacheKey, JSON.stringify(res));
        } catch (e) {}
        return res;
      }
      return null;
    } catch (e) {
      console.warn(`Failed to fetch settings for key ${key} from API:`, e);
      const local = localStorage.getItem(cacheKey);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          settingsCache[key] = { data: parsed, timestamp: 0 };
          return parsed;
        } catch (err) {}
      }
      return null;
    }
  },

  async updateSettings(key: string, value: any): Promise<any> {
    const isOffline = useAppStore.getState().isOfflineMode;
    const cacheKey = `setting_${key}`;

    // Update memory cache and local storage immediately for fast UI feedback
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ value }));
    } catch (e) {}
    settingsCache[key] = { data: { value }, timestamp: Date.now() };

    if (isOffline) return { value };

    // Post to original backend API endpoint `/api/stories/setting`
    try {
      const res = await apiClient.post('/api/stories/setting', { key, value });
      return res;
    } catch (e) {
      console.warn(`Failed to sync settings for key ${key} to API:`, e);
      return { value };
    }
  },
};
