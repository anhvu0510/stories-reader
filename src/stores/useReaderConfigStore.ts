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
  ttsEngine: 'vieneu',
  vieneuServerUrl: 'https://api-anhvu0510.duckdns.org/vieneu-tts',
  vieneuModel: '',
  vieneuTemperature: 0.8,
  vieneuTopK: 25,
  vieneuTopP: 0.95,
  vieneuMaxNewFrames: 300,
  vieneuRepetitionPenalty: 1.2,
  vieneuRepetitionWindow: 80,
  vieneuSteps: 8,
  vieneuCfg: 2.0,
  vieneuSway: -1.0,
  vieneuMaxChars: 140,
  vieneuDenoise: true,
  vieneuUseRefCodes: true,
  vieneuApplyWatermark: true,
  vieneuOutputSampleRate: 0,
  edgeVoiceUri: 'vi-VN-HoaiMyNeural',
  showTTSControlOnReader: true,
  bgmEnabled: true,
  bgmVolume: 0.2,
  bgmAudioUrl: '/audio/ambient-bgm.mp3',
  bgmFadeInMs: 500,
  bgmFadeOutMs: 800,
  bgmStopDelayMs: 1500,
  bgmOnlyOnEdgeReadAloud: true,
  isBgmPreviewing: false,
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
  setTTSEngine: (engine: 'vieneu' | 'edge' | 'browser') => void;
  setVieneuServerUrl: (url: string) => void;
  setVieneuModel: (model: string) => void;
  setVieneuParameter: <K extends keyof ReaderConfig>(key: K, value: ReaderConfig[K]) => void;
  setEdgeVoiceUri: (uri: string) => void;
  setShowTTSControlOnReader: (enabled: boolean) => void;
  bgmOnlyOnEdgeReadAloud?: boolean;
  isBgmPreviewing?: boolean;
  setIsBgmPreviewing?: (isBgmPreviewing: boolean) => void;
  setBgmEnabled: (enabled: boolean) => void;
  setBgmVolume: (volume: number) => void;
  setBgmAudioUrl: (url: string) => void;
  setBgmParameter: <K extends keyof ReaderConfig>(key: K, value: ReaderConfig[K]) => void;
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
    setTTSEngine: (ttsEngine) => {
      set((state) => {
        const next = { ...state, ttsEngine };
        persist(next);
        return { ttsEngine };
      });
    },
    setVieneuServerUrl: (vieneuServerUrl) => {
      set((state) => {
        const next = { ...state, vieneuServerUrl };
        persist(next);
        return { vieneuServerUrl };
      });
    },
    setVieneuModel: (vieneuModel) => {
      set((state) => {
        const next = { ...state, vieneuModel };
        persist(next);
        return { vieneuModel };
      });
    },
    setVieneuParameter: (key, value) => {
      set((state) => {
        const next = { ...state, [key]: value };
        persist(next);
        return { [key]: value } as Partial<ReaderConfig>;
      });
    },
    setEdgeVoiceUri: (edgeVoiceUri) => {
      set((state) => {
        const next = { ...state, edgeVoiceUri };
        persist(next);
        return { edgeVoiceUri };
      });
    },
    setShowTTSControlOnReader: (showTTSControlOnReader) => {
      set((state) => {
        const next = { ...state, showTTSControlOnReader };
        persist(next);
        return { showTTSControlOnReader };
      });
    },
    setIsBgmPreviewing: (isBgmPreviewing) => {
      set({ isBgmPreviewing });
    },
    setBgmEnabled: (bgmEnabled) => {
      set((state) => {
        const next = { ...state, bgmEnabled };
        persist(next);
        return { bgmEnabled };
      });
    },
    setBgmVolume: (bgmVolume) => {
      const sanitized = Math.max(0, Math.min(1, bgmVolume));
      set((state) => {
        const next = { ...state, bgmVolume: sanitized };
        persist(next);
        return { bgmVolume: sanitized };
      });
    },
    setBgmAudioUrl: (bgmAudioUrl) => {
      set((state) => {
        const next = { ...state, bgmAudioUrl };
        persist(next);
        return { bgmAudioUrl };
      });
    },
    setBgmParameter: (key, value) => {
      set((state) => {
        const next = { ...state, [key]: value };
        persist(next);
        return { [key]: value } as Partial<ReaderConfig>;
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
