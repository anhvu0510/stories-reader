import { create } from 'zustand';
import { ReaderConfig, ThemeType, FontType } from '../shared/types';
import { useAppStore } from './useAppStore';
import { SettingsRepository } from '../repositories/SettingsRepository';

const SETTINGS_KEY = 'stories.ui.config';

const defaultSettings: ReaderConfig = {
  theme: 'default',
  font: 'default',
  fontSize: 20,
  lineHeight: 1.4,
  groupLines: 1,
  batchChapterSize: 1,
  isEnabledReplace: true,
  voiceUri: '',
  speechRate: 1.0,
  bookLimit: 20,
  chapterLimit: 50,
};

function getInitialSettings(isOffline: boolean): ReaderConfig {
  const key = isOffline ? `${SETTINGS_KEY}.offline` : SETTINGS_KEY;
  try {
    const local = localStorage.getItem(key);
    if (local) {
      return { ...defaultSettings, ...JSON.parse(local) };
    }
  } catch {}
  return defaultSettings;
}

interface ReaderConfigStore extends ReaderConfig {
  setTheme: (theme: ThemeType) => void;
  setFont: (font: FontType) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (lineHeight: number) => void;
  setGroupLines: (groupLines: number) => void;
  setBatchChapterSize: (batchChapterSize: number) => void;
  setIsEnabledReplace: (enabled: boolean) => void;
  setVoiceUri: (voiceUri: string) => void;
  setSpeechRate: (speechRate: number) => void;
  setBookLimit: (limit: number) => void;
  setChapterLimit: (limit: number) => void;
  updateSettings: (partial: Partial<ReaderConfig>) => void;
  fetchServerConfig: () => Promise<void>;
}

let debounceTimeout: NodeJS.Timeout | null = null;

const syncWithApi = (next: ReaderConfig) => {
  const isOffline = useAppStore.getState().isOfflineMode;
  if (isOffline) return;

  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    const { voiceUri, speechRate, ...apiSync } = next;
    SettingsRepository.updateSettings(SETTINGS_KEY, apiSync);
  }, 800);
};

export const useReaderConfigStore = create<ReaderConfigStore>((set, get) => {
  const initial = getInitialSettings(useAppStore.getState().isOfflineMode);

  // Apply theme to DOM document immediately
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', initial.theme);
  }

  const persist = (next: ReaderConfig) => {
    const isOffline = useAppStore.getState().isOfflineMode;
    const storageKey = isOffline ? `${SETTINGS_KEY}.offline` : SETTINGS_KEY;
    localStorage.setItem(storageKey, JSON.stringify(next));
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next.theme);
    }
    syncWithApi(next);
  };

  return {
    ...initial,

    setTheme: (theme) => {
      set((state) => {
        const next = { ...state, theme };
        persist(next);
        return { theme };
      });
    },
    setFont: (font) => {
      set((state) => {
        const next = { ...state, font };
        persist(next);
        return { font };
      });
    },
    setFontSize: (fontSize) => {
      set((state) => {
        const next = { ...state, fontSize };
        persist(next);
        return { fontSize };
      });
    },
    setLineHeight: (lineHeight) => {
      set((state) => {
        const next = { ...state, lineHeight };
        persist(next);
        return { lineHeight };
      });
    },
    setGroupLines: (groupLines) => {
      set((state) => {
        const next = { ...state, groupLines };
        persist(next);
        return { groupLines };
      });
    },
    setBatchChapterSize: (batchChapterSize) => {
      const sanitized = Math.max(1, Math.min(20, Math.floor(batchChapterSize) || 1));
      set((state) => {
        const next = { ...state, batchChapterSize: sanitized };
        persist(next);
        return { batchChapterSize: sanitized };
      });
    },
    setIsEnabledReplace: (isEnabledReplace) => {
      set((state) => {
        const next = { ...state, isEnabledReplace };
        persist(next);
        return { isEnabledReplace };
      });
    },
    setVoiceUri: (voiceUri) => {
      set((state) => {
        const next = { ...state, voiceUri };
        persist(next);
        return { voiceUri };
      });
    },
    setSpeechRate: (speechRate) => {
      set((state) => {
        const next = { ...state, speechRate };
        persist(next);
        return { speechRate };
      });
    },
    setBookLimit: (bookLimit) => {
      set((state) => {
        const next = { ...state, bookLimit };
        persist(next);
        return { bookLimit };
      });
    },
    setChapterLimit: (chapterLimit) => {
      set((state) => {
        const next = { ...state, chapterLimit };
        persist(next);
        return { chapterLimit };
      });
    },
    updateSettings: (partial) => {
      set((state) => {
        const next = { ...state, ...partial };
        persist(next);
        return partial;
      });
    },
    fetchServerConfig: async () => {
      const isOffline = useAppStore.getState().isOfflineMode;
      if (isOffline) return;

      try {
        const res = await SettingsRepository.getSettings(SETTINGS_KEY);
        if (res) {
          let apiValue = res.value !== undefined ? res.value : res;
          if (typeof apiValue === 'string') {
            try {
              apiValue = JSON.parse(apiValue);
            } catch (e) {}
          }

          if (apiValue && typeof apiValue === 'object' && Object.keys(apiValue).length > 0 && !apiValue.error) {
            set((state) => {
              const next = { ...state, ...apiValue };
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
              if (typeof document !== 'undefined') {
                document.documentElement.setAttribute('data-theme', next.theme || state.theme);
              }
              return apiValue;
            });
          }
        }
      } catch (e) {
        console.warn('Failed to fetch server reader config:', e);
      }
    },
  };
});
