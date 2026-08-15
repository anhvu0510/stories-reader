import { apiClient } from '../services/apiClient';
import { useAppStore } from '../stores/useAppStore';
import { TagCategory } from '../shared/constants/tags';

export interface GetTagsResult {
  categories: TagCategory[];
  tags: string[];
}

export const TagRepository = {
  async getTags(): Promise<GetTagsResult> {
    const isOffline = useAppStore.getState().isOfflineMode;
    if (isOffline) {
      return {
        categories: [],
        tags: [],
      };
    }

    try {
      const res = await apiClient.get<any>('/api/tags');
      if (res && Array.isArray(res.categories)) {
        return {
          categories: res.categories,
          tags: res.tags || res.categories.flatMap((c: TagCategory) => c.tags),
        };
      }
    } catch (e) {
      console.warn('Failed to fetch tags from backend API:', e);
    }

    return {
      categories: [],
      tags: [],
    };
  },
};
