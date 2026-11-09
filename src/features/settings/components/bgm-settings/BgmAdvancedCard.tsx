import { Sliders, Clock, ExternalLink, Info, ChevronDown, ChevronUp } from 'lucide-react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

import type { ReaderConfig } from '@/stores/useReaderConfigStore';

function BgmTimingSlider({
	label,
	value,
	min,
	max,
	step,
	onChange,
	icon,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (val: number) => void;
	icon?: React.ReactNode;
}) {
	return (
		<div className="space-y-1">
			<div className="flex justify-between text-xs">
				<span className="text-on-surface-variant text-[11px] flex items-center gap-1">
					{icon}
					{label}
				</span>
				<span className="font-mono text-primary font-bold text-[11px]">{value} ms</span>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(parseInt(e.target.value, 10))}
				className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
			/>
		</div>
	);
}

export interface BgmAdvancedCardProps {
	bgmEnabled: boolean;
	showAdvanced: boolean;
	setShowAdvanced: (show: boolean | ((prev: boolean) => boolean)) => void;
	customUrl: string;
	setCustomUrl: (url: string) => void;
	onBlurCustomUrl: () => void;
	bgmFadeInMs: number;
	bgmFadeOutMs: number;
	bgmStopDelayMs: number;
	bgmOnlyOnEdgeReadAloud: boolean;
	setBgmParameter: <K extends keyof ReaderConfig>(key: K, value: ReaderConfig[K]) => void;
}

export function BgmAdvancedCard({
	bgmEnabled,
	showAdvanced,
	setShowAdvanced,
	customUrl,
	setCustomUrl,
	onBlurCustomUrl,
	bgmFadeInMs,
	bgmFadeOutMs,
	bgmStopDelayMs,
	bgmOnlyOnEdgeReadAloud,
	setBgmParameter,
}: BgmAdvancedCardProps) {
	return (
		<div
			className={`rounded-2xl bg-white/5 border border-white/10 overflow-hidden shadow-xs transition-opacity ${
				bgmEnabled ? '' : 'opacity-40 pointer-events-none'
			}`}
		>
			<button
				type="button"
				onClick={() => {
					triggerHaptic('light');
					setShowAdvanced((prev) => !prev);
				}}
				className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-on-surface hover:bg-white/5 transition-colors cursor-pointer"
			>
				<span className="flex items-center gap-1.5">
					<Sliders size={13} className="text-primary" />
					<span>Cấu hình nâng cao</span>
				</span>
				{showAdvanced ? (
					<ChevronUp size={13} className="text-on-surface-variant" />
				) : (
					<ChevronDown size={13} className="text-on-surface-variant" />
				)}
			</button>

			{showAdvanced && (
				<div className="p-3 border-t border-white/10 space-y-2.5 bg-black/20 animate-in fade-in duration-200">
					<div className="space-y-1">
						<span className="text-on-surface-variant text-[11px] flex items-center gap-1">
							<ExternalLink size={11} />
							URL nhạc tùy chỉnh:
						</span>
						<div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-xl border border-white/15 focus-within:ring-1 focus-within:ring-primary/60">
							<input
								type="url"
								value={customUrl}
								onChange={(e) => setCustomUrl(e.target.value)}
								onBlur={onBlurCustomUrl}
								placeholder="https://.../audio.mp3"
								className="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none min-w-0 font-medium font-mono"
							/>
						</div>
					</div>

					<BgmTimingSlider
						label="Fade In (tăng âm):"
						value={bgmFadeInMs}
						min={100}
						max={2000}
						step={100}
						onChange={(val) => setBgmParameter('bgmFadeInMs', val)}
					/>

					<BgmTimingSlider
						label="Fade Out (giảm âm):"
						value={bgmFadeOutMs}
						min={100}
						max={3000}
						step={100}
						onChange={(val) => setBgmParameter('bgmFadeOutMs', val)}
					/>

					<BgmTimingSlider
						label="Trễ chờ chuyển câu/dòng:"
						value={bgmStopDelayMs}
						min={0}
						max={5000}
						step={250}
						icon={<Clock size={11} />}
						onChange={(val) => setBgmParameter('bgmStopDelayMs', val)}
					/>

					<div className="flex items-center justify-between pt-1 border-t border-white/10">
						<span className="text-xs text-on-surface font-medium flex items-center gap-1">
							<Info size={12} className="text-primary" />
							Chỉ phát khi đọc giọng Edge
						</span>
						<button
							type="button"
							onClick={() => {
								triggerHaptic('light');
								setBgmParameter('bgmOnlyOnEdgeReadAloud', !bgmOnlyOnEdgeReadAloud);
							}}
							className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
								bgmOnlyOnEdgeReadAloud ? 'bg-primary' : 'bg-white/20'
							}`}
							title="Chuyển đổi kích hoạt nhạc nền"
						>
							<div
								className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform ${
									bgmOnlyOnEdgeReadAloud ? 'translate-x-3.5' : 'translate-x-0'
								}`}
							/>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
