import { Music, Volume2, VolumeX, Play, Pause, Radio, Check, Loader2 } from 'lucide-react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

import { PRESET_MUSIC_LIST } from './bgmPresets';

function getPreviewStatusText(isLoadingPreview: boolean, isPreviewing: boolean): string {
	if (isLoadingPreview) return 'Đang tải...';
	if (isPreviewing) return 'Đang phát thử';
	return 'Thử âm thanh';
}

function BgmPlayButton({
	bgmEnabled,
	isLoadingPreview,
	isPreviewing,
	togglePreview,
}: {
	bgmEnabled: boolean;
	isLoadingPreview: boolean;
	isPreviewing: boolean;
	togglePreview: () => void;
}) {
	let icon = <Play size={12} className="fill-current" />;
	let text = 'Nghe thử';
	if (isLoadingPreview) {
		icon = <Loader2 size={12} className="animate-spin text-primary" />;
		text = 'Tải...';
	} else if (isPreviewing) {
		icon = <Pause size={12} className="fill-current" />;
		text = 'Tạm dừng';
	}

	return (
		<button
			type="button"
			onClick={() => {
				triggerHaptic('light');
				togglePreview();
			}}
			disabled={!bgmEnabled || isLoadingPreview}
			className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs active:scale-95 cursor-pointer ${
				isPreviewing
					? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
					: 'bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30'
			} disabled:opacity-40 disabled:pointer-events-none`}
		>
			{icon}
			<span>{text}</span>
		</button>
	);
}

export interface BgmMasterCardProps {
	bgmEnabled: boolean;
	setBgmEnabled: (enabled: boolean) => void;
	isPreviewing: boolean;
	isLoadingPreview: boolean;
	togglePreview: () => void;
}

export function BgmMasterCard({ bgmEnabled, setBgmEnabled, isPreviewing, isLoadingPreview, togglePreview }: BgmMasterCardProps) {
	return (
		<div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 shadow-xs">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div
						className={`p-1.5 rounded-xl transition-all ${
							bgmEnabled ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-white/10 text-on-surface-variant'
						}`}
					>
						<Music size={16} />
					</div>
					<div className="flex items-center gap-1.5">
						<h3 className="text-xs font-bold text-on-surface">Nhạc Nền</h3>
					</div>
				</div>

				<button
					type="button"
					onClick={() => {
						triggerHaptic('light');
						setBgmEnabled(!bgmEnabled);
					}}
					className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
						bgmEnabled ? 'bg-primary' : 'bg-white/20'
					}`}
					title={bgmEnabled ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
					aria-label="Chuyển đổi bật tắt nhạc nền"
				>
					<div
						className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${bgmEnabled ? 'translate-x-4' : 'translate-x-0'}`}
					/>
				</button>
			</div>

			<div className="flex items-center justify-between pt-1.5 border-t border-white/10 text-xs">
				<div className="flex items-center gap-1.5 text-on-surface-variant">
					<Radio size={12} className={isPreviewing ? 'text-primary animate-pulse' : 'text-on-surface-variant/60'} />
					<span className="text-[11px] font-medium">{getPreviewStatusText(isLoadingPreview, isPreviewing)}</span>
				</div>

				<BgmPlayButton
					bgmEnabled={bgmEnabled}
					isLoadingPreview={isLoadingPreview}
					isPreviewing={isPreviewing}
					togglePreview={togglePreview}
				/>
			</div>
		</div>
	);
}

export interface BgmVolumeCardProps {
	bgmEnabled: boolean;
	bgmVolume: number;
	setBgmVolume: (vol: number) => void;
}

export function BgmVolumeCard({ bgmEnabled, bgmVolume, setBgmVolume }: BgmVolumeCardProps) {
	const volumePercent = Math.round(bgmVolume * 100);

	return (
		<div
			className={`p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 shadow-xs transition-opacity ${
				bgmEnabled ? '' : 'opacity-40 pointer-events-none'
			}`}
		>
			<div className="flex items-center justify-between">
				<div className="text-xs font-bold text-on-surface flex items-center gap-1.5">
					{volumePercent === 0 ? <VolumeX size={14} className="text-rose-400" /> : <Volume2 size={14} className="text-primary" />}
					<span>Âm lượng</span>
				</div>
				<span className="px-2 py-0.5 rounded-lg bg-primary/20 text-primary border border-primary/30 font-mono font-bold text-xs">
					{volumePercent}%
				</span>
			</div>

			<input
				type="range"
				min="0"
				max="1"
				step="0.05"
				value={bgmVolume}
				onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
				className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
			/>

			<div className="flex items-center justify-between gap-1 pt-0.5">
				{[0.1, 0.2, 0.35, 0.5, 0.75].map((presetVol) => {
					const pct = Math.round(presetVol * 100);
					const isSelected = Math.abs(bgmVolume - presetVol) < 0.03;
					return (
						<button
							key={presetVol}
							type="button"
							onClick={() => {
								triggerHaptic('light');
								setBgmVolume(presetVol);
							}}
							className={`flex-1 py-1 text-[11px] font-mono font-bold rounded-lg border transition-all text-center active:scale-95 cursor-pointer ${
								isSelected
									? 'bg-primary/25 text-primary border-primary/50 shadow-xs'
									: 'bg-white/5 border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/10'
							}`}
						>
							{pct}%
						</button>
					);
				})}
			</div>
		</div>
	);
}

export interface BgmPresetGridProps {
	bgmEnabled: boolean;
	bgmAudioUrl: string;
	isPreviewing: boolean;
	onSelectPreset: (url: string) => void;
}

export function BgmPresetGrid({ bgmEnabled, bgmAudioUrl, isPreviewing, onSelectPreset }: BgmPresetGridProps) {
	return (
		<div
			className={`p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 shadow-xs transition-opacity ${
				bgmEnabled ? '' : 'opacity-40 pointer-events-none'
			}`}
		>
			<div className="flex items-center justify-between px-0.5">
				<h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
					<Music size={13} className="text-primary" />
					<span>Giai điệu</span>
				</h4>
			</div>

			<div className="grid grid-cols-2 gap-1.5">
				{PRESET_MUSIC_LIST.map((preset) => {
					const Icon = preset.icon;
					const isSelected = bgmAudioUrl === preset.url;
					const isPlayingThis = isSelected && isPreviewing;

					return (
						<button
							key={preset.id}
							type="button"
							onClick={() => {
								triggerHaptic('light');
								onSelectPreset(preset.url);
							}}
							className={`px-2.5 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer active:scale-95 ${
								isSelected
									? 'bg-primary/20 border-primary/60 text-primary shadow-xs'
									: 'bg-white/5 hover:bg-white/10 border-white/10 text-on-surface'
							}`}
						>
							<div className="flex items-center gap-2 min-w-0 flex-1">
								<div
									className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
										isSelected ? 'bg-primary/30 border-primary/50 text-primary' : 'bg-white/10 border-white/15 text-on-surface-variant'
									}`}
								>
									{isPlayingThis ? <Radio size={12} className="text-primary animate-pulse" /> : <Icon size={12} />}
								</div>
								<span className={`text-xs font-bold truncate ${isSelected ? 'text-primary font-black' : 'text-on-surface'}`}>
									{preset.name}
								</span>
							</div>
							{isSelected && <Check size={12} strokeWidth={3} className="text-primary shrink-0" />}
						</button>
					);
				})}
			</div>
		</div>
	);
}

export { BgmAdvancedCard, type BgmAdvancedCardProps } from './BgmAdvancedCard';
