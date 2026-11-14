import { Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useEffect, useMemo, useState } from 'react';

import {
	buildModelPlatformList,
	type ModelPlatformOption,
	type PoolStatus,
	type TranslationOptions,
} from '@/components/translation-sheet/translationHelpers';
import { triggerHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';
import {
	formatCompactNumber,
	formatModelDisplayName,
	formatPlatformDisplayName,
	getPlatformBadgeClass,
} from '@/shared/utils/modelFormatters';

import type { AIQuota } from '@/shared/types';

interface TranslationAiConfigCardProps {
	options: TranslationOptions;
	setOptions: React.Dispatch<React.SetStateAction<TranslationOptions>>;
	showConfig: boolean;
	setShowConfig: (val: boolean) => void;
	poolStatus: PoolStatus | null;
	setPoolStatus: React.Dispatch<React.SetStateAction<PoolStatus | null>>;
	quotas?: AIQuota[];
}

function PlatformFilterTabs({
	platforms,
	activePlatform,
	onSelect,
}: {
	platforms: string[];
	activePlatform: string;
	onSelect: (plat: string) => void;
}) {
	if (platforms.length <= 1) return null;

	return (
		<div
			data-testid="platform-filter-tabs"
			className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1 overflow-x-auto hide-scrollbar"
		>
			{platforms.map((plat) => {
				const isActive = activePlatform === plat;
				const label = formatPlatformDisplayName(plat);
				return (
					<button
						key={plat}
						type="button"
						onClick={() => {
							triggerHaptic('selection');
							onSelect(plat);
						}}
						className={cn(
							'px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer',
							isActive
								? 'bg-primary/20 text-primary border border-primary/50 shadow-xs'
								: 'text-on-surface-variant/70 hover:text-on-surface'
						)}
					>
						{label}
					</button>
				);
			})}
		</div>
	);
}

function AIModelGrid({
	models,
	selectedModel,
	selectedPlatform,
	onSelect,
}: {
	models: ModelPlatformOption[];
	selectedModel: string;
	selectedPlatform?: string;
	onSelect: (item: ModelPlatformOption) => void;
}) {
	if (models.length === 0) {
		return (
			<div className="py-4 px-2 text-center text-on-surface-variant bg-white/[0.02] border border-white/5 rounded-xl">
				<p className="font-bold text-xs text-amber-400/90">Chưa có mô hình AI từ máy chủ</p>
				<p className="text-[10px] mt-1 text-on-surface-variant/60">Vui lòng kiểm tra lại cấu hình Quota ở Cài đặt</p>
			</div>
		);
	}

	return (
		<div data-testid="ai-model-grid" className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto hide-scrollbar p-0.5">
			{models.map((item) => {
				const isSelected = selectedModel === item.model && (selectedPlatform ? selectedPlatform === item.platform : true);
				const displayTitle = formatModelDisplayName(item.model) || item.model;

				return (
					<button
						key={`${item.platform}:::${item.model}`}
						type="button"
						title={item.model}
						onClick={() => onSelect(item)}
						className={cn(
							'group px-2.5 py-2 rounded-xl text-left border transition-all flex items-center justify-between gap-1.5 active:scale-[0.98] cursor-pointer min-h-[42px]',
							isSelected
								? 'bg-primary/15 border-primary/80 text-primary font-bold shadow-xs'
								: 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-white/20 text-on-surface font-medium'
						)}
					>
						<span className="font-mono text-[11px] leading-tight line-clamp-2 break-words flex-1">{displayTitle}</span>
						<span
							className={cn(
								'w-4 h-4 rounded-full flex items-center justify-center border transition-colors shrink-0',
								isSelected ? 'bg-primary border-primary text-on-primary' : 'border-white/15 bg-white/[0.03] group-hover:border-white/30'
							)}
						>
							{isSelected && <Check size={10} strokeWidth={3} />}
						</span>
					</button>
				);
			})}
		</div>
	);
}

function AIModelPicker({
	options,
	setOptions,
	setPoolStatus,
	quotas = [],
}: {
	options: TranslationOptions;
	setOptions: React.Dispatch<React.SetStateAction<TranslationOptions>>;
	setPoolStatus: React.Dispatch<React.SetStateAction<PoolStatus | null>>;
	quotas?: AIQuota[];
}) {
	const modelList = useMemo(() => buildModelPlatformList(quotas, options.availableModels), [quotas, options.availableModels]);

	const availablePlatforms = useMemo(() => {
		return Array.from(new Set(modelList.map((m) => m.platform).filter(Boolean)));
	}, [modelList]);

	const [selectedPlatformTab, setSelectedPlatformTab] = useState<string | null>(null);

	useEffect(() => {
		setSelectedPlatformTab(null);
	}, [options.platform]);

	const activePlatform = useMemo(() => {
		if (selectedPlatformTab && availablePlatforms.includes(selectedPlatformTab)) {
			return selectedPlatformTab;
		}
		if (options.platform && availablePlatforms.includes(options.platform)) {
			return options.platform;
		}
		return availablePlatforms[0] || '';
	}, [selectedPlatformTab, options.platform, availablePlatforms]);

	const displayedModels = useMemo(() => {
		if (!activePlatform) return modelList;
		return modelList.filter((m) => m.platform === activePlatform);
	}, [modelList, activePlatform]);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Mô hình AI theo Platform:</span>
			</div>

			<PlatformFilterTabs platforms={availablePlatforms} activePlatform={activePlatform} onSelect={setSelectedPlatformTab} />

			<AIModelGrid
				models={displayedModels}
				selectedModel={options.model}
				selectedPlatform={options.platform}
				onSelect={(item) => {
					triggerHaptic('selection');
					setOptions({
						...options,
						model: item.model,
						platform: item.platform,
					});
					setPoolStatus(null);
				}}
			/>
		</div>
	);
}

function AIParameterControls({
	options,
	setOptions,
}: {
	options: TranslationOptions;
	setOptions: React.Dispatch<React.SetStateAction<TranslationOptions>>;
}) {
	return (
		<div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
			<div className="flex flex-col gap-1">
				<label className="text-[9px] font-bold text-on-surface-variant/70 uppercase">GIỚI HẠN TỪ</label>
				<div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10">
					<input
						type="number"
						value={options.minWords}
						onChange={(e) => setOptions({ ...options, minWords: Number(e.target.value) })}
						className="w-full bg-transparent text-[11px] font-bold text-center focus:outline-none text-on-surface"
					/>
					<span className="text-on-surface-variant/30 text-[10px]">-</span>
					<input
						type="number"
						value={options.maxWords}
						onChange={(e) => setOptions({ ...options, maxWords: Number(e.target.value) })}
						className="w-full bg-transparent text-[11px] font-bold text-center focus:outline-none text-on-surface"
					/>
				</div>
			</div>

			<div className="flex flex-col gap-1">
				<div className="flex justify-between items-center px-0.5">
					<label className="text-[9px] font-bold text-on-surface-variant/70 uppercase">SÁNG TẠO</label>
					<span className="text-[10px] font-mono font-bold text-primary">{Number(options.temperature).toFixed(1)}</span>
				</div>
				<div className="bg-white/5 rounded-lg p-1.5 px-2 h-full flex items-center border border-white/10">
					<input
						type="range"
						min="0"
						max="1"
						step="0.1"
						value={options.temperature}
						onChange={(e) => setOptions({ ...options, temperature: Number(e.target.value) })}
						className="w-full accent-primary h-1 bg-outline-variant/20 rounded-full appearance-none cursor-pointer"
					/>
				</div>
			</div>
		</div>
	);
}

function ConfigCardHeader({
	modelLabel,
	platformLabel,
	platformBadge,
	poolStatus,
	showPool,
	showConfig,
	onToggle,
}: {
	modelLabel: string;
	platformLabel: string;
	platformBadge: string;
	poolStatus: PoolStatus | null;
	showPool: boolean;
	showConfig: boolean;
	onToggle: () => void;
}) {
	return (
		<div
			onClick={onToggle}
			className="flex items-center justify-between p-2.5 px-3 hover:bg-white/5 transition-colors cursor-pointer select-none gap-2"
		>
			<div className="flex items-center gap-2 min-w-0 flex-1">
				<div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/30">
					<Sparkles size={13} />
				</div>
				<div className="min-w-0 flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
					<span className="text-xs font-mono font-bold text-on-surface truncate">{modelLabel}</span>
					{platformLabel && (
						<span className={cn('text-[9px] font-bold px-1.5 py-0.2 rounded border font-mono tracking-wider shrink-0', platformBadge)}>
							{platformLabel}
						</span>
					)}
				</div>
			</div>

			<div className="flex items-center gap-1.5 shrink-0">
				{showPool && poolStatus && (
					<span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 border border-primary/30 text-primary shrink-0 flex items-center gap-1 font-mono">
						<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
						RPD: {formatCompactNumber(poolStatus.remain)}/{formatCompactNumber(poolStatus.total)}
					</span>
				)}
				<div className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors">
					{showConfig ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
				</div>
			</div>
		</div>
	);
}

export function TranslationAiConfigCard({
	options,
	setOptions,
	showConfig,
	setShowConfig,
	poolStatus,
	setPoolStatus,
	quotas = [],
}: TranslationAiConfigCardProps) {
	const modelLabel = formatModelDisplayName(options.model) || options.model || 'Chưa chọn model AI';
	const platformLabel = options.platform ? formatPlatformDisplayName(options.platform) : '';
	const platformBadge = getPlatformBadgeClass(options.platform);
	const showPool = Boolean(poolStatus && poolStatus.model === options.model);

	return (
		<div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden transition-all shadow-xs">
			<ConfigCardHeader
				modelLabel={modelLabel}
				platformLabel={platformLabel}
				platformBadge={platformBadge}
				poolStatus={poolStatus}
				showPool={showPool}
				showConfig={showConfig}
				onToggle={() => {
					triggerHaptic('light');
					setShowConfig(!showConfig);
				}}
			/>

			{/* Expandable Configuration Body */}
			<AnimatePresence>
				{showConfig && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.2 }}
						className="p-3 border-t border-white/10 space-y-3 bg-black/20"
					>
						<AIModelPicker options={options} setOptions={setOptions} setPoolStatus={setPoolStatus} quotas={quotas} />
						<AIParameterControls options={options} setOptions={setOptions} />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
