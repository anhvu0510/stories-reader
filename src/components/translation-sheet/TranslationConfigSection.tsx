import { Check, ChevronDown, ChevronUp, Heading, Loader, Send, Settings2, UserCheck, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';
import { formatModelDisplayName } from '@/shared/utils/modelFormatters';

import { DEFAULT_VERTEX_MODELS, getTabButtonClass, type PoolStatus, type TranslationOptions } from './translationHelpers';

import type { AIQuota } from '@/shared/types';

export function TabButton({
	active,
	children,
	onClick,
	disabled,
}: {
	active: boolean;
	children: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
}) {
	const btnClass = getTabButtonClass(active, disabled);
	return (
		<motion.button
			whileTap={disabled ? undefined : { scale: 0.94 }}
			onClick={() => {
				if (!disabled) {
					triggerHaptic('selection');
					onClick();
				}
			}}
			disabled={disabled}
			className={`flex-1 py-1.5 min-h-[32px] text-xs font-bold rounded-md transition-all duration-200 flex items-center justify-center ${btnClass}`}
		>
			{children}
		</motion.button>
	);
}

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

function AIConfigDropdown({ options, setOptions, setPoolStatus, quotas = [] }: AIConfigDropdownProps) {
	const rawModels = options.availableModels || DEFAULT_VERTEX_MODELS;
	const cleanModels = [...new Set(rawModels.map((m) => (typeof m === 'string' ? m.replace(/\s*\([VA]\)$/i, '').trim() : m)))] as string[];

	return (
		<div className="px-3 p-3 flex flex-col gap-2.5 max-h-[35vh] overflow-y-auto hide-scrollbar">
			<div className="grid grid-cols-2 gap-2">
				<div className="flex flex-col gap-1">
					<label className="text-[9px] font-bold text-on-surface-variant/70 uppercase px-0.5">GIỚI HẠN TỪ</label>
					<div className="flex items-center bg-surface-container-highest rounded-lg p-0.5">
						<input
							type="number"
							value={options.minWords}
							onChange={(e) =>
								setOptions({
									...options,
									minWords: Number(e.target.value),
								})
							}
							className="w-full bg-transparent text-[11px] font-bold text-center focus:outline-none"
						/>
						<span className="text-on-surface-variant/30 text-[10px]">-</span>
						<input
							type="number"
							value={options.maxWords}
							onChange={(e) =>
								setOptions({
									...options,
									maxWords: Number(e.target.value),
								})
							}
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
							onChange={(e) =>
								setOptions({
									...options,
									temperature: Number(e.target.value),
								})
							}
							className="w-full accent-primary h-1 bg-outline-variant/20 rounded-full appearance-none cursor-pointer"
						/>
					</div>
				</div>
			</div>
			<div className="space-y-2 pt-1">
				<div className="flex items-center justify-between">
					<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Mô hình AI:</span>
				</div>

				<div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto hide-scrollbar p-0.5">
					{cleanModels.map((m) => {
						const isSelected = options.model === m;
						const formattedName = formatModelDisplayName(String(m));

						return (
							<button
								key={m}
								onClick={() => {
									const matched = quotas.find((q) => q.model === m);
									const targetPlatform = matched?.platform || (m.toLowerCase().includes('deepseek') ? 'DEPLOYAI' : 'AI_STUDIO');
									setOptions({
										...options,
										model: m,
										platform: targetPlatform,
									});
									setPoolStatus(null);
								}}
								className={cn(
									'px-3 py-2 rounded-xl text-left border transition-all flex items-center justify-between active:scale-95',
									isSelected
										? 'bg-primary/20 hover:bg-primary/25 border-2 border-primary text-primary font-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]'
										: 'bg-white/5 hover:bg-white/10 border border-white/10 text-on-surface font-medium'
								)}
							>
								<div className="min-w-0 pr-1 flex-1">
									<div className={`font-mono font-bold text-[11px] truncate ${isSelected ? 'text-primary font-black' : 'text-on-surface'}`}>
										{formattedName || m}
									</div>
								</div>
								{isSelected && <Check size={13} className="text-primary shrink-0 font-bold ml-1" />}
							</button>
						);
					})}
				</div>
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
	onSubmit: (sync: boolean) => void;
}

export function TranslationSheetActionButtons({
	isSubmitting,
	submittingType,
	syncButtonLabel,
	asyncButtonLabel,
	onSubmit,
}: TranslationSheetActionButtonsProps) {
	const isSyncSubmitting = isSubmitting && submittingType === 'sync';
	const isAsyncSubmitting = isSubmitting && submittingType === 'async';

	return (
		<div className="flex-shrink-0 p-3 sm:p-4 border-t border-outline-variant/20 bg-white/[0.03] dark:bg-white/[0.03] backdrop-blur-md pb-safe">
			<div className="flex items-center gap-2 sm:gap-3">
				<button
					onClick={() => onSubmit(true)}
					disabled={isSubmitting}
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
					disabled={isSubmitting}
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
