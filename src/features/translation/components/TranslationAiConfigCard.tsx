import { Check, ChevronDown, ChevronUp, Heading, Sparkles, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React from 'react';

import { DEFAULT_VERTEX_MODELS, type PoolStatus, type TranslationOptions } from '@/components/translation-sheet/translationHelpers';
import { triggerHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';
import { formatModelDisplayName } from '@/shared/utils/modelFormatters';

import type { AIQuota } from '@/shared/types';

interface TranslationAiConfigCardProps {
	options: TranslationOptions;
	setOptions: React.Dispatch<React.SetStateAction<TranslationOptions>>;
	showConfig: boolean;
	setShowConfig: (val: boolean) => void;
	poolStatus: PoolStatus | null;
	setPoolStatus: React.Dispatch<React.SetStateAction<PoolStatus | null>>;
	quotas?: AIQuota[];
	onDetectProperNouns: () => void;
	onTranslateChineseTitles: () => void;
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
	const rawModels = options.availableModels || DEFAULT_VERTEX_MODELS;
	const cleanModels = [...new Set(rawModels.map((m) => (typeof m === 'string' ? m.replace(/\s*\([VA]\)$/i, '').trim() : m)))] as string[];

	return (
		<div className="space-y-1.5">
			<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Mô hình AI:</span>
			<div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto hide-scrollbar p-0.5">
				{cleanModels.map((m) => {
					const isSelected = options.model === m;
					const formattedName = formatModelDisplayName(String(m));

					return (
						<button
							key={m}
							type="button"
							onClick={() => {
								triggerHaptic('selection');
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
								'px-2.5 py-2 rounded-xl text-left border transition-all flex items-center justify-between active:scale-95 cursor-pointer',
								isSelected
									? 'bg-primary/20 border-primary text-primary font-black shadow-xs'
									: 'bg-white/5 hover:bg-white/10 border-white/10 text-on-surface font-medium'
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
			{/* Giới hạn từ */}
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

			{/* Sáng tạo (Temperature) */}
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

export function TranslationAiConfigCard({
	options,
	setOptions,
	showConfig,
	setShowConfig,
	poolStatus,
	setPoolStatus,
	quotas = [],
	onDetectProperNouns,
	onTranslateChineseTitles,
}: TranslationAiConfigCardProps) {
	const modelLabel = formatModelDisplayName(options.model) || options.model || 'Gemini Flash';
	const showPool = Boolean(poolStatus && poolStatus.model === options.model);

	return (
		<div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden transition-all shadow-xs">
			{/* Top Bar: Clickable header */}
			<div
				onClick={() => {
					triggerHaptic('light');
					setShowConfig(!showConfig);
				}}
				className="flex items-center justify-between p-2.5 px-3 hover:bg-white/5 transition-colors cursor-pointer select-none"
			>
				<div className="flex items-center gap-2 min-w-0">
					<div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/30">
						<Sparkles size={13} />
					</div>
					<div className="min-w-0 flex items-center gap-1.5">
						<span className="text-xs font-mono font-bold text-on-surface truncate">{modelLabel}</span>
						{showPool && poolStatus && (
							<span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 border border-primary/30 text-primary shrink-0 flex items-center gap-1">
								<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
								RPD: {poolStatus.remain.toLocaleString()}/{poolStatus.total.toLocaleString()}
							</span>
						)}
					</div>
				</div>

				<div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
					<motion.button
						type="button"
						whileTap={{ scale: 0.88 }}
						onClick={() => {
							triggerHaptic('light');
							onDetectProperNouns();
						}}
						className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
						title="Phát hiện xưng hô / danh từ riêng"
						aria-label="Phát hiện xưng hô / danh từ riêng"
					>
						<UserCheck size={13} />
					</motion.button>

					<motion.button
						type="button"
						whileTap={{ scale: 0.88 }}
						onClick={() => {
							triggerHaptic('light');
							onTranslateChineseTitles();
						}}
						className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
						title="Dịch tiêu đề tiếng Trung"
						aria-label="Dịch tiêu đề tiếng Trung"
					>
						<Heading size={13} />
					</motion.button>

					<button
						type="button"
						onClick={() => {
							triggerHaptic('light');
							setShowConfig(!showConfig);
						}}
						className="w-7 h-7 rounded-lg hover:bg-white/10 text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer transition-colors"
						aria-label={showConfig ? 'Thu gọn cấu hình' : 'Mở rộng cấu hình'}
					>
						{showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
					</button>
				</div>
			</div>

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
