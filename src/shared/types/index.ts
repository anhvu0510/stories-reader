export interface LastReadChapter {
  chapterId: string;
  chapterNumber: string;
  title: string;
}

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
  tags?: string[];
  pointOfView?: string;
  isFavorite?: boolean;
}

export interface Chapter {
  chapterId: string;
  chapterNumber: number;
  title: string;
  state: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  updatedAt: string;
  bookId?: string;
}

export interface ChapterNavigation {
  prev?: { chapterId: string | null };
  next?: { chapterId: string | null; chapterNumber?: number; title?: string };
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
    compressedContent?: Uint8Array;
    rootTab: string;
  };
  navigation?: ChapterNavigation;
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
  configAI?: any;
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

export interface ApiDomain {
  id: string;
  name: string;
  url: string;
}

export type ThemeType = 'default' | 'sepia' | 'amoled' | 'midnight' | 'obsidian' | 'coffee' | 'modern-vn';
export type FontType = 'default' | 'palatino' | 'bookerly' | 'font_viet_tay' | 'merriweather' | 'lora' | 'charter';

export interface ReaderConfig {
  theme: ThemeType;
  font: FontType;
  fontSize: number;
  lineHeight: number;
  groupLines: number;
  isEnabledReplace: boolean;
  voiceUri: string;
  speechRate: number;
  bookLimit: number;
  chapterLimit: number;
}
