import { showToast } from '../components/Toast';

// API Types
export interface Book {
  bookId: string;
  bookName: string;
  chapterCount: number;
  totalTranslated: number;
  totalPending: number;
  createdAt: string;
  updatedAt: string;
  lastReadChapter: LastReadChapter;
  coverUrl?: string;
  author?: string;
  source?: string;
}

export interface LastReadChapter {
  chapterId: string
  chapterNumber: string
  title: string
}

export interface Chapter {
  chapterId: string;
  chapterNumber: number;
  title: string;
  state: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  updatedAt: string;
}

export interface ChapterContent {
  chapter: {
    chapterId: string;
    chapterNumber: number;
    title: string;
    bookName: string;
    state: string;
    totalTokens: number;
    content: string[];
    rootTab: string;
  };
  navigation?: {
    prev?: { chapterId: string | null };
    next?: { chapterId: string | null; chapterNumber?: number; title?: string };
  };
}

export interface Replacement {
  id: string;
  match: string;
  replacement: string;
  scope: 'chapter' | 'book' | 'global';
  bookId?: string;
  chapterId?: string;
}

export interface AIQuota {
  _id: string;
  model: string;
  platform: 'AI_STUDIO' | 'VERTEX_API';
  rpmLimit: number;
  tpmLimit: number;
  rpdLimit: number;
  isActive: boolean;
  requestsThisMinute?: number;
  tokensThisMinute?: number;
  requestsThisDay?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AIToken {
  _id: string;
  name: string;
  email: string;
  platform: 'AI_STUDIO' | 'VERTEX_API';
  model: string;
  status: 'active' | 'paused' | 'banned';
  priority: number;
  lastUsedAt?: string;
  totalRequests?: number;
  totalErrors?: number;
  createdAt: string;
  configAI?: any; // Used when creating/updating
  modelList: {
    model: string;
    rpmLimit: number;
    tpmLimit: number;
    rpdLimit: number;
    usageToday?: {
      rpd: number | null;
      rpm: number;
      tpm: number;
      rpdPercent: number;
    };
  }[];
  workerStatus?: {
    initialized: boolean;
    busy: number;
  };
}

export interface QuotaResponse {
  currentConfig: {
    model: string;
    platform?: string;
    minWords: number;
    maxWords: number;
    temperature: number;
    forceRetranslate: boolean;
  };
  availableModels: AIQuota[];
}

// Fallback Mock Data
const MOCK_REPLACEMENTS: Replacement[] = [
  { id: '1', match: 'tiểu tử', replacement: 'nhóc con', scope: 'global' },
  { id: '2', match: 'lão đại', replacement: 'đại ca', scope: 'book', bookId: 'b1' },
  { id: '3', match: 'nữ tử', replacement: 'cô gái', scope: 'chapter', chapterId: 'c1' },
];



const MOCK_CHAPTERS: Record<string, Chapter[]> = {
  'b3': [
    { chapterId: 'c1', chapterNumber: 1, title: 'Đêm trăng đầu tiên', state: 'SUCCEEDED', updatedAt: '2024-03-15T10:00:00Z' },
    { chapterId: 'c2', chapterNumber: 2, title: 'Tiếng gọi trong gió', state: 'PENDING', updatedAt: '2024-03-16T10:00:00Z' },
    { chapterId: 'c3', chapterNumber: 3, title: 'Bóng hình mờ ảo', state: 'PENDING', updatedAt: '2024-03-17T10:00:00Z' },
    { chapterId: 'c4', chapterNumber: 4, title: 'Quyết định cuối cùng', state: 'PENDING', updatedAt: '2024-03-17T12:00:00Z' },
    { chapterId: 'c5', chapterNumber: 5, title: 'Vực sâu (Sắp ra mắt)', state: 'FAILED', updatedAt: '2024-03-18T10:00:00Z' },
  ],
  'b1': [
    { chapterId: 'b1c8', chapterNumber: 8, title: 'Tiếng thét', state: 'SUCCEEDED', updatedAt: '2024-03-15T10:00:00Z' },
    { chapterId: 'b1c9', chapterNumber: 9, title: 'Kẻ săn mộng', state: 'SUCCEEDED', updatedAt: '2024-03-15T10:00:00Z' },
  ]
};



// API Implementation
export interface ApiDomain {
  id: string;
  name: string;
  url: string;
}

export const getApiDomains = (): ApiDomain[] => {
  try {
    const data = localStorage.getItem('API_DOMAINS_CONFIG');
    if (data) {
      const parsed = JSON.parse(data) as ApiDomain[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Fallback to old config
    const oldConfig = localStorage.getItem('API_DOMAIN_CONFIG');
    if (oldConfig) {
      return [{ id: 'legacy', name: 'Server Mặc định', url: oldConfig }];
    }
  } catch (e) {
    console.warn("Failed to parse api domains");
  }
  return [];
};

export const getActiveDomain = (): ApiDomain | null => {
  const domains = getApiDomains();
  if (domains.length === 0) return null;
  
  const activeId = localStorage.getItem('ACTIVE_API_DOMAIN_ID');
  if (activeId) {
    const activeDomain = domains.find(d => d.id === activeId);
    if (activeDomain) return activeDomain;
  }
  
  // Backwards compatibility: fallback to first domain
  return domains[0] || null;
};

const fetchWithRetry = async (path: string, options: RequestInit = {}, retries = 2, timeout = 15000): Promise<Response> => {
  const domain = getActiveDomain();
  if (!domain) {
    throw new Error('API_DOMAIN_NOT_SET');
  }

  const headers = {
    'ngrok-skip-browser-warning': 'true',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  let attempts = 0;
  let lastError: any;

  while (attempts <= retries) {
    try {
      const controller = new AbortController();
      const timeoutMillis = timeout; // 15s timeout
      const timeoutId = setTimeout(() => controller.abort(), timeoutMillis);

      const res = await fetch(`${domain.url}${path}`, { 
        ...options, 
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      return res; // Success
    } catch (err: any) {
      lastError = err;
      attempts++;
      if (attempts <= retries) {
        console.warn(`Request failed (${attempts}/${retries + 1}), retrying...`, err);
        await new Promise(resolve => setTimeout(resolve, 800)); // 800ms delay between retries
      }
    }
  }

  // If we reach here, all retries failed
  showToast(`Máy chủ không phản hồi. Vui lòng kiểm tra lại.`, 'error');
  window.dispatchEvent(new CustomEvent('open-global-settings', { detail: { tab: 'servers' } }));
  throw lastError;
};

const settingsCache: { [key: string]: { data: any; timestamp: number } } = {};
const pendingSettingsRequests: { [key: string]: Promise<any> } = {};

export const api = {
  testConnection: async (domainUrl: string): Promise<boolean> => {
    try {
      // Just check any lightweight endpoint, or the health endpoint if it exists
      const res = await fetch(`${domainUrl}/api/stories/setting/stories.ui.domain`);
      return res.ok;
    } catch {
      return false;
    }
  },
  getBooks: async (page = 1, search = '', current?: string, limit = 20): Promise<{ data: Book[], pagination: any }> => {
    try {
      let url = `/api/books?page=${page}&limit=${limit}&search=${search}`;
      if (current) {
        url += `&tab=${current}`;
      }
      const res = await fetchWithRetry(url, {}, 1, 1000);
      return await res.json();
    } catch (e: any) {
      if (e.message === 'API_DOMAIN_NOT_SET') {
        return { data: [], pagination: { currentPage: 1, totalPages: 0, total: 0 } };
      }
      console.warn("Failed to fetch from API, using mock data", e);
      return {
        data: [],
        pagination: { currentPage: 1, totalPages: 1, total: 0 }
      };
    }
  },

  getChapters: async (
    bookId: string,
    page: number = 1,
    limit: number = 50,
    sortBy: string = 'chapterNumber',
    sortOrder: string = 'ASC',
    state?: string,
    search?: string
  ): Promise<{ chapters: Chapter[], pagination: any }> => {
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });
      if (state && state !== 'all') query.append('state', state);
      if (search) query.append('search', search);

      const res = await fetchWithRetry(`/api/books/${bookId}/chapters?${query.toString()}`);
      return await res.json();
    } catch (e: any) {
      if (e.message === 'API_DOMAIN_NOT_SET') {
        return { chapters: [], pagination: { currentPage: 1, totalPages: 0, total: 0 } };
      }
      console.warn("Failed to fetch chapters, using mock data", e);
      let mockChapters = [...(MOCK_CHAPTERS[bookId] || [])];
      
      if (state && state !== 'all') {
        mockChapters = mockChapters.filter(c => c.state === state);
      }
      if (search) {
        mockChapters = mockChapters.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.chapterNumber.toString().includes(search));
      }
      
      if (sortBy === 'chapterNumber') {
        mockChapters.sort((a, b) => sortOrder === 'ASC' ? a.chapterNumber - b.chapterNumber : b.chapterNumber - a.chapterNumber);
      } else if (sortBy === 'updatedAt') {
        mockChapters.sort((a, b) => sortOrder === 'ASC' ? new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime() : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }
      
      const total = mockChapters.length;
      const totalPages = Math.ceil(total / limit);
      const paginatedChapters = mockChapters.slice((page - 1) * limit, page * limit);
      
      return {
        chapters: paginatedChapters,
        pagination: { currentPage: page, totalPages: Math.max(1, totalPages), total }
      };
    }
  },

  getChapterContent: async (chapterId: string, groupLines: number = 1, isEnabledReplace: boolean = true, rootTab=''): Promise<ChapterContent> => {
    try {
      const res = await fetchWithRetry(`/api/chapters/${chapterId}?groupLines=${groupLines}&isEnabledReplace=${isEnabledReplace}&rootTab=${rootTab}`);
      return await res.json();
    } catch (e: any) {
      if (e.message === 'API_DOMAIN_NOT_SET') {
        throw new Error("Không có kết nối API. Vui lòng cấu hình API Domain.");
      }
      console.warn("Failed to fetch chapter content, using mock data", e);
      throw new Error("Chapter not found in mock data");
    }
  },

  getReplacements: async (bookId?: string, chapterId?: string): Promise<{ data: Replacement[] }> => {
    try {
      const query = new URLSearchParams();
      if (bookId) query.append('bookId', bookId);
      if (chapterId) query.append('chapterId', chapterId);
      const res = await fetchWithRetry(`/api/replacements?${query.toString()}`);
      const rawData = await res.json();
      
      const dataArray = Array.isArray(rawData) ? rawData : (rawData.data || []);
      
      const mapped = dataArray.map((item: any) => ({
        id: item.id,
        match: item.original || item.match,
        replacement: item.replacement,
        scope: item.scope,
        bookId: item.bookId,
        chapterId: item.chapterId
      }));
      return { data: mapped };
    } catch (e: any) {
      if (e.message === 'API_DOMAIN_NOT_SET') {
        return { data: [] };
      }
      console.warn("Failed to fetch replacements, using mock data", e);
      return { data: MOCK_REPLACEMENTS };
    }
  },

  saveReplacement: async (data: Partial<Replacement>): Promise<Replacement> => {
    try {
      const isEditing = !!data.id;
      const url = isEditing ? `/api/replacements/${data.id}` : `/api/replacements`;
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload: any = { ...data, original: data.match };
      delete payload.match;

      const res = await fetchWithRetry(url, {
        method,
        body: JSON.stringify(payload)
      });
      const resData = await res.json();
      return {
        id: resData.id || data.id || Date.now().toString(),
        match: resData.original || payload.original || '',
        replacement: resData.replacement || '',
        scope: resData.scope || 'global',
        bookId: resData.bookId,
        chapterId: resData.chapterId,
      };
    } catch (e) {
      console.warn("Failed to save replacement, mocking...", e);
      return {
        id: data.id || Date.now().toString(),
        match: data.match || '',
        replacement: data.replacement || '',
        scope: data.scope || 'global',
        bookId: data.bookId,
        chapterId: data.chapterId,
      };
    }
  },

  deleteReplacement: async (id: string): Promise<void> => {
    try {
      await fetchWithRetry(`/api/replacements/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Failed to delete replacement, mocking...", e);
    }
  },

  getSettings: async (key: string, skipCache: boolean = false): Promise<any> => {
    const now = Date.now();
    const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
    
    // 1. Check in-memory cache
    if (!skipCache && settingsCache[key] && now - settingsCache[key].timestamp < CACHE_TTL_MS) {
      return settingsCache[key].data;
    }

    // 2. Avoid duplicate concurrent requests
    if (!skipCache && pendingSettingsRequests[key]) {
      return pendingSettingsRequests[key];
    }

    // 3. Fetch from API
    const request = (async () => {
      try {
        const res = await fetchWithRetry(`/api/stories/setting/${key}`, {}, 1, 1000);
        const data = await res.json();
        settingsCache[key] = { data, timestamp: Date.now() };
        try { localStorage.setItem(`setting_${key}`, JSON.stringify(data)); } catch(e){}
        return data;
      } catch (e) {
        console.warn(`Failed to fetch settings for key ${key}`, e);
        // Fallback to local storage if API fails
        try {
          const cached = localStorage.getItem(`setting_${key}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            settingsCache[key] = { data: parsed, timestamp: 0 }; // Mark as stale
            return parsed;
          }
        } catch (err) {}
        return null;
      } finally {
        delete pendingSettingsRequests[key];
      }
    })();

    pendingSettingsRequests[key] = request;
    return request;
  },

  updateSettings: async (key: string, value: any): Promise<any> => {
    try {
      // Update local storage and memory cache immediately for instant sync
      try { localStorage.setItem(`setting_${key}`, JSON.stringify({ value })); } catch(e){}
      settingsCache[key] = { data: { value }, timestamp: Date.now() };

      const res = await fetchWithRetry(`/api/stories/setting`, {
        method: 'POST',
        body: JSON.stringify({ key, value })
      });
      return await res.json();
    } catch (e) {
      console.warn(`Failed to update settings for key ${key}`, e);
      return null;
    }
  },

  getQuota: async (): Promise<QuotaResponse | null> => {
    try {
      const res = await fetchWithRetry('/api/quota');
      return await res.json();
    } catch(e: any) {
      if (e.message === 'API_DOMAIN_NOT_SET') {
        return {
          currentConfig: {
            model: 'gemini-flash-lite-latest',
            platform: 'VERTEX_API',
            minWords: 200,
            maxWords: 800,
            temperature: 0.4,
            forceRetranslate: true
          },
          availableModels: []
        };
      }
      console.warn("Failed to fetch quota, using mock data", e);
      return {
          currentConfig: {
            model: 'gemini-flash-lite-latest',
            platform: 'VERTEX_API',
            minWords: 200,
            maxWords: 800,
            temperature: 0.4,
            forceRetranslate: true
          },
          availableModels: [
            {
              _id: 'mock1',
              model: "gemini-flash-lite-latest",
              platform: "VERTEX_API",
              rpmLimit: 100,
              tpmLimit: 4000000,
              rpdLimit: 10000,
              isActive: true,
              requestsThisMinute: 15,
              requestsThisDay: 500
            }
          ]
      };
    }
  },

  getPoolStatus: async (model: string, platform: string): Promise<any | null> => {
    try {
      const res = await fetchWithRetry(`/api/ai-token/pool-status?model=${encodeURIComponent(model)}&platform=${encodeURIComponent(platform)}`);
      return await res.json();
    } catch (e: any) {
      if (e.message === 'API_DOMAIN_NOT_SET') {
        return { remain: 0, total: 0 };
      }
      console.warn('Failed to get pool status', e);
      return { remain: 0, total: 0 };
    }
  },

  createQuota: async (data: Partial<AIQuota>): Promise<AIQuota> => {
     const res = await fetchWithRetry('/api/quota', { method: 'POST', body: JSON.stringify(data) });
     return await res.json();
  },

  updateQuota: async (id: string, data: Partial<AIQuota>): Promise<AIQuota> => {
     const res = await fetchWithRetry(`/api/quota/${id}`, { method: 'PUT', body: JSON.stringify(data) });
     return await res.json();
  },

  deleteQuota: async (id: string): Promise<void> => {
     await fetchWithRetry(`/api/quota/${id}`, { method: 'DELETE' });
  },

  getTokens: async (platform?: string, status?: string): Promise<{ total: number, tokens: AIToken[] }> => {
    let url = '/api/ai-token';
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    if (status) params.append('status', status);
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    const res = await fetchWithRetry(url);
    if (!res) return { total: 0, tokens: [] };
    return await res.json();
  },

  createToken: async (data: Partial<AIToken>): Promise<AIToken> => {
     const res = await fetchWithRetry('/api/ai-token', { method: 'POST', body: JSON.stringify(data) });
     return await res.json();
  },

  updateToken: async (id: string, data: Partial<AIToken>): Promise<AIToken> => {
     const res = await fetchWithRetry(`/api/ai-token/${id}`, { method: 'PUT', body: JSON.stringify(data) });
     return await res.json();
  },

  deleteToken: async (id: string): Promise<void> => {
     await fetchWithRetry(`/api/ai-token/${id}`, { method: 'DELETE' });
  },

  translate: async (data: {
    mode: 'current' | 'batch_chapter' | 'story',
    model: string,
    platform?: string,
    minWords?: number,
    maxWords?: number,
    temperature?: number,
    retryTranslate?: boolean,
    batchingGroup?: boolean,
    bookId?: string | string[],
    chapterId?: string[],
    currentChapterId?: string,
  }): Promise<any> => {
    const res = await fetchWithRetry(`/stories/gemini-ai/translate`, {
      method: 'POST',
      body: JSON.stringify(data)
    }, 0); // DO NOT retry POST translations
    if (data.mode === 'current') {
      return await res.json();
    }
    return res;
  }
};
