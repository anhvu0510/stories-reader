import { SettingsRepository } from '@/repositories/SettingsRepository';

import { useAppStore } from './useAppStore';

import type { ReaderConfig } from '@/shared/types';

export const SETTINGS_KEY = 'stories.ui.config';

export function parseSettingsValue(res: unknown): unknown {
	if (!res) return null;
	const apiValue = (res as { value?: unknown }).value ?? res;
	if (typeof apiValue !== 'string') return apiValue;
	try {
		return JSON.parse(apiValue);
	} catch {
		return null;
	}
}

export const defaultSettings: ReaderConfig = {
	theme: 'default',
	font: 'default',
	fontSize: 18,
	lineHeight: 1.4,
	groupLines: 1,
	batchChapterSize: 1,
	isEnabledReplace: true,
	voiceUri: '',
	speechRate: 1.8,
	bookLimit: 20,
	chapterLimit: 50,
	ttsEngine: 'vieneu',
	vieneuServerUrl: '',
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
	edgeBufferMode: 'file',
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

export function getInitialSettings(isOffline: boolean): ReaderConfig {
	const key = isOffline ? `${SETTINGS_KEY}.offline` : SETTINGS_KEY;
	try {
		const local = localStorage.getItem(key);
		if (local) {
			return { ...defaultSettings, ...JSON.parse(local) };
		}
	} catch {
		// intentionally empty — localStorage may be unavailable in private mode
	}
	return defaultSettings;
}

let debounceTimeout: NodeJS.Timeout | null = null;

export const syncWithApi = (next: ReaderConfig) => {
	const isOffline = useAppStore.getState().isOfflineMode;
	if (isOffline) return;

	if (debounceTimeout) clearTimeout(debounceTimeout);
	debounceTimeout = setTimeout(() => {
		const { voiceUri: _voiceUri, speechRate: _speechRate, ...apiSync } = next;
		SettingsRepository.updateSettings(SETTINGS_KEY, apiSync);
	}, 800);
};

export const persistReaderConfig = (next: ReaderConfig) => {
	const isOffline = useAppStore.getState().isOfflineMode;
	const storageKey = isOffline ? `${SETTINGS_KEY}.offline` : SETTINGS_KEY;
	localStorage.setItem(storageKey, JSON.stringify(next));
	if (typeof document !== 'undefined') {
		document.documentElement.setAttribute('data-theme', next.theme);
	}
	syncWithApi(next);
};
