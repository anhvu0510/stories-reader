import { create } from 'zustand';

import { SettingsRepository } from '@/repositories/SettingsRepository';

import { getInitialSettings, parseSettingsValue, persistReaderConfig, SETTINGS_KEY } from './readerConfigHelpers';
import { useAppStore } from './useAppStore';

import type { EdgeBufferMode, FontType, ReaderConfig, ThemeType } from '@/shared/types';

export type { ReaderConfig };

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
	setEdgeBufferMode: (mode: EdgeBufferMode) => void;
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

type SetReaderConfig = (partial: Partial<ReaderConfigStore> | ((state: ReaderConfigStore) => Partial<ReaderConfigStore>)) => void;

function createFieldSetter<K extends keyof ReaderConfig>(set: SetReaderConfig, key: K) {
	return (value: ReaderConfig[K]) => {
		set((state) => {
			const next = { ...state, [key]: value };
			persistReaderConfig(next);
			return { [key]: value } as Partial<ReaderConfigStore>;
		});
	};
}

export const useReaderConfigStore = create<ReaderConfigStore>((set) => {
	const initial = getInitialSettings(useAppStore.getState().isOfflineMode);

	// Apply theme to DOM document immediately
	if (typeof document !== 'undefined') {
		document.documentElement.setAttribute('data-theme', initial.theme);
	}

	return {
		...initial,

		setTheme: createFieldSetter(set, 'theme'),
		setFont: createFieldSetter(set, 'font'),
		setFontSize: createFieldSetter(set, 'fontSize'),
		setLineHeight: createFieldSetter(set, 'lineHeight'),
		setGroupLines: createFieldSetter(set, 'groupLines'),
		setBatchChapterSize: (batchChapterSize) => {
			const sanitized = Math.max(1, Math.min(20, Math.floor(batchChapterSize) || 1));
			set((state) => {
				const next = { ...state, batchChapterSize: sanitized };
				persistReaderConfig(next);
				return { batchChapterSize: sanitized };
			});
		},
		setIsEnabledReplace: createFieldSetter(set, 'isEnabledReplace'),
		setVoiceUri: createFieldSetter(set, 'voiceUri'),
		setSpeechRate: createFieldSetter(set, 'speechRate'),
		setTTSEngine: createFieldSetter(set, 'ttsEngine'),
		setVieneuServerUrl: createFieldSetter(set, 'vieneuServerUrl'),
		setVieneuModel: createFieldSetter(set, 'vieneuModel'),
		setVieneuParameter: (key, value) => {
			set((state) => {
				const next = { ...state, [key]: value };
				persistReaderConfig(next);
				return { [key]: value } as Partial<ReaderConfig>;
			});
		},
		setEdgeVoiceUri: createFieldSetter(set, 'edgeVoiceUri'),
		setEdgeBufferMode: createFieldSetter(set, 'edgeBufferMode'),
		setShowTTSControlOnReader: createFieldSetter(set, 'showTTSControlOnReader'),
		setIsBgmPreviewing: (isBgmPreviewing) => {
			set({ isBgmPreviewing });
		},
		setBgmEnabled: createFieldSetter(set, 'bgmEnabled'),
		setBgmVolume: (bgmVolume) => {
			const sanitized = Math.max(0, Math.min(1, bgmVolume));
			set((state) => {
				const next = { ...state, bgmVolume: sanitized };
				persistReaderConfig(next);
				return { bgmVolume: sanitized };
			});
		},
		setBgmAudioUrl: createFieldSetter(set, 'bgmAudioUrl'),
		setBgmParameter: (key, value) => {
			set((state) => {
				const next = { ...state, [key]: value };
				persistReaderConfig(next);
				return { [key]: value } as Partial<ReaderConfig>;
			});
		},
		setBookLimit: createFieldSetter(set, 'bookLimit'),
		setChapterLimit: createFieldSetter(set, 'chapterLimit'),
		updateSettings: (partial) => {
			set((state) => {
				const next = { ...state, ...partial };
				persistReaderConfig(next);
				return partial;
			});
		},
		fetchServerConfig: async () => {
			const isOffline = useAppStore.getState().isOfflineMode;
			if (isOffline) return;

			try {
				const res = await SettingsRepository.getSettings(SETTINGS_KEY);
				const apiValue = parseSettingsValue(res);

				if (apiValue && typeof apiValue === 'object' && Object.keys(apiValue).length > 0 && !('error' in apiValue)) {
					set((state) => {
						const next = { ...state, ...apiValue };
						localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
						if (typeof document !== 'undefined') {
							document.documentElement.setAttribute('data-theme', next.theme || state.theme);
						}
						return apiValue;
					});
				}
			} catch (e) {
				console.warn('Failed to fetch server reader config:', e);
			}
		},
	};
});
