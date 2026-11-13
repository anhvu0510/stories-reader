import { Check, ChevronDown, ChevronUp, Heading, Loader, Send, Settings2, UserCheck, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';
import { formatModelDisplayName, formatPlatformDisplayName, getPlatformBadgeClass } from '@/shared/utils/modelFormatters';

import { buildModelPlatformList, type PoolStatus, type TranslationOptions } from './translationHelpers';

import type { AIQuota } from '@/shared/types';

function PoolStatusBadge({ poolStatus }: { poolStatus: PoolStatus }) {
	const isRemainPositive = poolStatus.remain > 0;
	const dotClass = isRemainPositive ? 'bg-primary animate-pulse' : 'bg-rose-500';
	const textClass = isRemainPositive ? 'text-primary' : 'text-rose-400';
	const totalLabel = poolStatus.total > 0 ? poolStatus.total.toLocaleString() : '∞';

	return (
		<span className="ml-2 text-[9px] font-bold text-on-surface-variant bg-white/10 px-1.5 py-0.5 rounded border border-blue-500/20 flex items-center gap-1">
			<div className={`w-1 h-1 rounded-full ${dotClass}`} />
			RPD: <span className={textClass}>{poolStatus.remain.toLocaleString()}</span>/{totalLabel}
		</span>
	);
}

interface AIConfigDropdownProps {
	options: TranslationOptions;
	setOptions: React.Dispatch<React.SetStateAction<TranslationOptions>>;
	setPoolStatus: React.Dispatch<React.SetStateAction<PoolStatus | null>>;
	quotas?: AIQuota[];
}

function AIWordsAndTempInputs({
	options,
	setOptions,
}: {
	options: TranslationOptions;
	setOptions: React.Dispatch<React.SetStateAction<TranslationOptions>>;
}) {
	return (
		<div className="grid grid-cols-2 gap-2">
			<div className="flex flex-col gap-1">
				<label className="text-[9px] font-bold text-on-surface-variant/70 uppercase px-0.5">GIỚI HẠN TỪ</label>
				<div className="flex items-center bg-surface-container-highest rounded-lg p-0.5">
					<input
						type="number"
						value={options.minWords}
						onChange={(e) => setOptions({ ...options, minWords: Number(e.target.value) })}
						className="w-full bg-transparent text-[11px] font-bold text-center focus:outline-none"
					/>
					<span className="text-on-surface-variant/30 text-[10px]">-</span>
					<input
						type="number"
						value={options.maxWords}
						onChange={(e) => setOptions({ ...options, maxWords: Number(e.target.value) })}
						className="w-full bg-transparent text-[11px] font-bold text-center focus:outline-none"
					/>
				</div>
			</div>

			<div className="flex flex-col gap-1">
				<div className="flex justify-between items-center px-0.5">
					<label className="text-[9px] font-bold text-on-surface-variant/70 uppercase">SÁNG TẠO</label>
					<span className="text-[10px] font-bold text-primary">{Number(options.temperature).toFixed(1)}</span>
				</div>
				<div className="bg-surface-container-highest rounded-lg p-1 px-2 h-full flex items-center">
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

function AIConfigDropdown({ options, setOptions, setPoolStatus, quotas = [] }: AIConfigDropdownProps) {
	const modelList = buildModelPlatformList(quotas, options.availableModels);
	const availablePlatforms = React.useMemo(() => {
		return Array.from(new Set(modelList.map((m) => m.platform).filter(Boolean)));
	}, [modelList]);

	const [activePlatform, setActivePlatform] = React.useState<string>(() => {
		if (options.platform && availablePlatforms.includes(options.platform)) {
			return options.platform;
		}
		return availablePlatforms[0] || '';
	});

	React.useEffect(() => {
		if (options.platform && availablePlatforms.includes(options.platform)) {
			setActivePlatform(options.platform);
		} else if (availablePlatforms.length > 0 && !availablePlatforms.includes(activePlatform)) {
			setActivePlatform(availablePlatforms[0]);
		}
	}, [options.platform, availablePlatforms, activePlatform]);

	const displayedModels = React.useMemo(() => {
		if (!activePlatform) return modelList;
		return modelList.filter((m) => m.platform === activePlatform);
	}, [modelList, activePlatform]);

	return (
		<div className="px-3 p-3 flex flex-col gap-2.5 max-h-[35vh] overflow-y-auto hide-scrollbar">
			<AIWordsAndTempInputs options={options} setOptions={setOptions} />

			<div className="space-y-2 pt-1">
				<div className="flex items-center justify-between">
					<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Mô hình AI:</span>
				</div>

				{availablePlatforms.length > 1 && (
					<div className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1 overflow-x-auto hide-scrollbar">
						{availablePlatforms.map((plat) => {
							const isPlatActive = activePlatform === plat;
							return (
								<button
									key={plat}
									type="button"
									onClick={() => {
										triggerHaptic('selection');
										setActivePlatform(plat);
									}}
									className={cn(
										'px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer',
										isPlatActive
											? 'bg-primary/20 text-primary border border-primary/50 shadow-xs'
											: 'text-on-surface-variant/70 hover:text-on-surface'
									)}
								>
									{formatPlatformDisplayName(plat)}
								</button>
							);
						})}
					</div>
				)}

				{displayedModels.length === 0 ? (
					<div className="py-3 px-2 text-center text-on-surface-variant bg-white/[0.02] border border-white/5 rounded-xl">
						<p className="font-bold text-xs text-amber-400/90">Chưa có mô hình AI từ máy chủ</p>
						<p className="text-[10px] mt-0.5 text-on-surface-variant/60">Vui lòng kiểm tra Quota ở Cài đặt</p>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto hide-scrollbar p-0.5">
						{displayedModels.map((item) => {
							const isSelected = options.model === item.model && (options.platform ? options.platform === item.platform : true);
							const formattedName = formatModelDisplayName(item.model);
							const badgeClass = getPlatformBadgeClass(item.platform);
							const platName = formatPlatformDisplayName(item.platform);

							return (
								<button
									key={`${item.platform}:::${item.model}`}
									type="button"
									onClick={() => {
										triggerHaptic('selection');
										setOptions({
											...options,
											model: item.model,
											platform: item.platform,
										});
										setPoolStatus(null);
									}}
									className={cn(
										'px-2.5 py-2 rounded-xl text-left border transition-all flex flex-col justify-between active:scale-95 cursor-pointer min-h-[54px]',
										isSelected
											? 'bg-primary/20 hover:bg-primary/25 border-2 border-primary text-primary font-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]'
											: 'bg-white/5 hover:bg-white/10 border border-white/10 text-on-surface font-medium'
									)}
								>
									<div className="flex items-center justify-between w-full gap-1 mb-1">
										<span className={cn('text-[9px] font-bold px-1.5 py-0.2 rounded border font-mono tracking-wider', badgeClass)}>
											{platName}
										</span>
										{isSelected && <Check size={13} className="text-primary shrink-0 font-bold" />}
									</div>
									<div className="font-mono font-bold text-[11px] truncate w-full" title={item.model}>
										{formattedName || item.model}
									</div>
								</button>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

interface TranslationConfigBarProps {
	showConfig: boolean;
	onToggleConfig: () => void;
	poolStatus: PoolStatus | null;
	currentModel?: string;
	onDetectProperNouns: () => void;
	onTranslateChineseTitles: () => void;
	options: TranslationOptions;
	setOptions: React.Dispatch<React.SetStateAction<TranslationOptions>>;
	setPoolStatus: React.Dispatch<React.SetStateAction<PoolStatus | null>>;
	quotas?: AIQuota[];
}

export function TranslationSheetConfigBar({
	showConfig,
	onToggleConfig,
	poolStatus,
	currentModel,
	onDetectProperNouns,
	onTranslateChineseTitles,
	options,
	setOptions,
	setPoolStatus,
	quotas,
}: TranslationConfigBarProps) {
	const showPoolStatus = Boolean(poolStatus && poolStatus.model === currentModel);

	return (
		<div className="flex-shrink-0 bg-white/[0.03] border-b border-white/10">
			<div
				className="w-full flex items-center justify-between py-2 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:bg-white/5 transition-colors cursor-pointer select-none"
				onClick={onToggleConfig}
			>
				<div className="flex items-center gap-2">
					<Settings2 size={13} />
					<span>Cấu hình AI</span>
					{options.platform && (
						<span
							className={cn(
								'text-[9px] font-bold px-1.5 py-0.2 rounded border font-mono tracking-wider',
								getPlatformBadgeClass(options.platform)
							)}
						>
							{formatPlatformDisplayName(options.platform)}
						</span>
					)}
					{showPoolStatus && poolStatus && <PoolStatusBadge poolStatus={poolStatus} />}
				</div>
				<div className="flex items-center gap-2">
					<motion.button
						whileTap={{ scale: 0.9 }}
						onClick={(e) => {
							e.stopPropagation();
							triggerHaptic('light');
							onDetectProperNouns();
						}}
						className="w-7.5 h-7.5 rounded-lg transition-colors border bg-white/5 border-blue-500/20 text-on-surface-variant hover:text-on-surface hover:bg-white/10 flex items-center justify-center cursor-pointer"
						title="Phát hiện xưng hô / danh từ riêng"
						aria-label="Phát hiện xưng hô / danh từ riêng"
					>
						<UserCheck size={14} />
					</motion.button>

					<motion.button
						whileTap={{ scale: 0.9 }}
						onClick={(e) => {
							e.stopPropagation();
							triggerHaptic('light');
							onTranslateChineseTitles();
						}}
						className="w-7.5 h-7.5 rounded-lg transition-colors border bg-white/5 border-blue-500/20 text-on-surface-variant hover:text-on-surface hover:bg-white/10 flex items-center justify-center cursor-pointer"
						title="Dịch tiêu đề tiếng Trung"
						aria-label="Dịch tiêu đề tiếng Trung"
					>
						<Heading size={14} />
					</motion.button>
					{showConfig ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
				</div>
			</div>

			{showConfig && <AIConfigDropdown options={options} setOptions={setOptions} setPoolStatus={setPoolStatus} quotas={quotas} />}
		</div>
	);
}

interface TranslationSheetActionButtonsProps {
	isSubmitting: boolean;
	submittingType: 'sync' | 'async' | null;
	syncButtonLabel: string;
	asyncButtonLabel: string;
	disabled?: boolean;
	onSubmit: (sync: boolean) => void;
}

export function TranslationSheetActionButtons({
	isSubmitting,
	submittingType,
	syncButtonLabel,
	asyncButtonLabel,
	disabled = false,
	onSubmit,
}: TranslationSheetActionButtonsProps) {
	const isSyncSubmitting = isSubmitting && submittingType === 'sync';
	const isAsyncSubmitting = isSubmitting && submittingType === 'async';
	const isDisabled = isSubmitting || disabled;

	return (
		<div className="flex-shrink-0 p-3 sm:p-4 border-t border-outline-variant/20 bg-white/[0.03] dark:bg-white/[0.03] backdrop-blur-md pb-safe">
			<div className="flex items-center gap-2 sm:gap-3">
				<button
					onClick={() => onSubmit(true)}
					disabled={isDisabled}
					className="flex-1 py-3 sm:py-3.5 bg-primary/25 hover:bg-primary/35 backdrop-blur-md border-2 border-primary/70 text-primary rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold font-sans flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.3),_inset_0_1.5px_1.5px_rgba(255,255,255,0.6)] disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{isSyncSubmitting ? (
						<Loader size={16} className="animate-spin sm:w-4 sm:h-4 text-primary" />
					) : (
						<Zap size={16} className="fill-primary text-primary sm:w-4 sm:h-4" />
					)}
					<span>{syncButtonLabel}</span>
				</button>

				<button
					onClick={() => onSubmit(false)}
					disabled={isDisabled}
					className="flex-1 py-3 sm:py-3.5 bg-white/10 hover:bg-white/15 backdrop-blur-md border-2 border-outline-variant/60 text-on-surface rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold font-sans flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.3),_inset_0_1.5px_1.5px_rgba(255,255,255,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{isAsyncSubmitting ? (
						<Loader size={16} className="animate-spin sm:w-4 sm:h-4 text-on-surface" />
					) : (
						<Send size={16} className="sm:w-4 sm:h-4 text-on-surface-variant" />
					)}
					<span>{asyncButtonLabel}</span>
				</button>
			</div>
		</div>
	);
}
