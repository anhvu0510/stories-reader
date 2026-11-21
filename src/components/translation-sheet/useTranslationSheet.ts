import { useEffect, useRef, useState } from 'react';

import { AIRepository } from '@/repositories/AIRepository';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { SettingsRepository } from '@/repositories/SettingsRepository';

import {
	buildModelPlatformList,
	defaultOptions,
	extractConfig,
	extractRawQuotas,
	extractUniqueModels,
	type PoolStatus,
	type Tab,
	type TranslationOptions,
} from './translationHelpers';

import type { AIQuota } from '@/shared/types';

function parseSavedSettings(settingVal: unknown): Record<string, unknown> | null {
	if (!settingVal) return null;
	const parsed = typeof settingVal === 'string' ? JSON.parse(settingVal) : settingVal;
	if (!parsed || typeof parsed !== 'object') return null;
	return parsed as Record<string, unknown>;
}

export function useTranslationOptions(_activeTab?: Tab) {
	const [options, setOptions] = useState<TranslationOptions>(defaultOptions);
	const [isOptionsLoaded, setIsOptionsLoaded] = useState(false);
	const [showConfig, setShowConfig] = useState(false);
	const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
	const [quotas, setQuotas] = useState<AIQuota[]>([]);
	const initialMount = useRef(true);

	useEffect(() => {
		let active = true;
		if (options.model && isOptionsLoaded) {
			const matched = quotas.find((q) => q.model === options.model);
			const platform = options.platform || matched?.platform || '';
			ChapterRepository.getPoolStatus(options.model, platform)
				.then((res) => {
					if (active && res) setPoolStatus(res as PoolStatus);
				})
				.catch((err) => console.warn('Failed to fetch pool status:', err));
		}
		return () => {
			active = false;
		};
	}, [options.model, options.platform, isOptionsLoaded, quotas]);

	useEffect(() => {
		let active = true;

		Promise.all([
			SettingsRepository.getSettings<{ value?: unknown }>('stories.ui.translate', true).catch(() => null),
			AIRepository.getQuotas().catch((err) => {
				console.warn('AIRepository.getQuotas error, repairing database setting:', err);
				return SettingsRepository.updateSettings('stories.ui.translate', defaultOptions)
					.then(() => AIRepository.getQuotas())
					.catch(() => null);
			}),
		]).then(([savedSettings, res]) => {
			if (!active) return;
			const savedOpts = parseSavedSettings(savedSettings?.value);
			const rawQuotas = extractRawQuotas(res);
			const cfg = extractConfig(res);
			const modelList = buildModelPlatformList(rawQuotas, extractUniqueModels(rawQuotas));

			setQuotas(rawQuotas as AIQuota[]);
			setOptions((prev) => {
				const merged = { ...prev, ...(cfg || {}), ...(savedOpts || {}) };
				merged.availableModels = modelList.map((m) => m.model);

				const matched = modelList.find((m) => m.model === merged.model);
				if (matched) {
					merged.platform = matched.platform;
				} else if (modelList.length > 0) {
					merged.model = modelList[0].model;
					merged.platform = modelList[0].platform;
				} else {
					merged.model = '';
					merged.platform = '';
				}
				return merged;
			});
			setIsOptionsLoaded(true);
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
				platform: options.platform,
				minWords: options.minWords,
				maxWords: options.maxWords,
				temperature: options.temperature,
				forceRetranslate: options.forceRetranslate,
				batchingGroup: options.batchingGroup,
				stream: options.stream ?? true,
				availableModels: options.availableModels,
			};
			SettingsRepository.updateSettings('stories.ui.translate', payload).catch(() => {});
		}, 500);
		return () => clearTimeout(t);
	}, [options, isOptionsLoaded]);

	return {
		options,
		setOptions,
		showConfig,
		setShowConfig,
		poolStatus,
		setPoolStatus,
		quotas,
	};
}

export * from './useTranslationBatchPagination';
