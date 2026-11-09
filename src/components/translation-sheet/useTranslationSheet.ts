import { useEffect, useRef, useState } from 'react';

import { AIRepository } from '@/repositories/AIRepository';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { SettingsRepository } from '@/repositories/SettingsRepository';

import {
	defaultOptions,
	extractConfig,
	extractRawQuotas,
	extractUniqueModels,
	type PoolStatus,
	type Tab,
	type TranslationOptions,
} from './translationHelpers';

import type { AIQuota } from '@/shared/types';
import type React from 'react';

function loadSavedTranslationSettings(isActive: () => boolean, setOptions: React.Dispatch<React.SetStateAction<TranslationOptions>>) {
	SettingsRepository.getSettings<{ value?: unknown }>('stories.ui.translate', true)
		.then((savedSettings) => {
			if (!isActive() || !savedSettings?.value) return;
			try {
				const settingVal = savedSettings.value;
				const parsed = typeof settingVal === 'string' ? JSON.parse(settingVal) : settingVal;
				if (parsed && typeof parsed === 'object') {
					const opts = parsed as Record<string, unknown>;
					if (opts.platform === 'VERTEX_API') opts.platform = 'AI_STUDIO';
					setOptions((prev) => ({ ...prev, ...opts }));
				}
			} catch (err) {
				console.warn('[TranslationSheet] Parse saved settings error:', err);
			}
		})
		.catch(() => {});
}

export function useTranslationOptions(activeTab: Tab) {
	const [options, setOptions] = useState<TranslationOptions>(defaultOptions);
	const [isOptionsLoaded, setIsOptionsLoaded] = useState(false);
	const [showConfig, setShowConfig] = useState(false);
	const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
	const [quotas, setQuotas] = useState<AIQuota[]>([]);
	const initialMount = useRef(true);

	useEffect(() => {
		let active = true;
		if (options.model && isOptionsLoaded) {
			const platform = options.platform || 'AI_STUDIO';
			ChapterRepository.getPoolStatus(options.model, platform)
				.then((res) => {
					if (active && res) setPoolStatus(res as PoolStatus);
				})
				.catch((err) => console.warn('Failed to fetch pool status:', err));
		}
		return () => {
			active = false;
		};
	}, [options.model, options.platform, activeTab, isOptionsLoaded, quotas]);

	useEffect(() => {
		let active = true;
		loadSavedTranslationSettings(() => active, setOptions);

		AIRepository.getQuotas()
			.then((res) => {
				if (!active) return;
				const rawQuotas = extractRawQuotas(res);
				setQuotas(rawQuotas as AIQuota[]);
				const cfg = extractConfig(res);
				if (cfg) {
					setOptions((prev) => {
						const newOptions = { ...prev, ...cfg };
						const uniqueModels = extractUniqueModels(rawQuotas);
						if (uniqueModels.length > 0) newOptions.availableModels = uniqueModels;
						return newOptions;
					});
				}
				setIsOptionsLoaded(true);
			})
			.catch((err) => {
				console.warn('AIRepository.getQuotas error, repairing database setting:', err);
				SettingsRepository.updateSettings('stories.ui.translate', defaultOptions)
					.then(() => AIRepository.getQuotas())
					.then((res) => {
						if (active && res) setQuotas(extractRawQuotas(res) as AIQuota[]);
					})
					.catch(() => {})
					.finally(() => {
						if (active) setIsOptionsLoaded(true);
					});
			});

		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (!isOptionsLoaded) return;
		if (initialMount.current) {
			initialMount.current = false;
			return;
		}
		const t = setTimeout(() => {
			const payload = {
				model: options.model,
				platform: options.platform || 'AI_STUDIO',
				minWords: options.minWords,
				maxWords: options.maxWords,
				temperature: options.temperature,
				forceRetranslate: options.forceRetranslate,
				batchingGroup: options.batchingGroup,
				availableModels: options.availableModels,
			};
			SettingsRepository.updateSettings('stories.ui.translate', payload).catch(() => {});
		}, 500);
		return () => clearTimeout(t);
	}, [options, isOptionsLoaded, quotas]);

	return {
		options,
		setOptions,
		showConfig,
		setShowConfig,
		poolStatus,
		setPoolStatus,
	};
}

export * from './useTranslationBatchPagination';
