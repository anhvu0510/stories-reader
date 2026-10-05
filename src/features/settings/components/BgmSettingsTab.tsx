import React, { useState, useRef, useEffect } from 'react';
import {
	Music,
	Volume2,
	VolumeX,
	Play,
	Pause,
	Sliders,
	RotateCcw,
	Sparkles,
	Radio,
	Clock,
	ExternalLink,
	Waves,
	CloudRain,
	Piano,
	Info,
	Check,
	Loader2,
	ChevronDown,
	ChevronUp
} from 'lucide-react';

import { computeSubtleBgmVolume } from '@/hooks/useEdgeReadAloudBgm';
import { triggerHaptic } from '@/hooks/useHaptic';
import { getAssetUrl } from '@/shared/utils/assetUrl';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

const PRESET_MUSIC_LIST = [
	{
		id: 'synth',
		name: 'Synth Ambient',
		icon: Sparkles,
		url: '/audio/ambient-bgm.mp3'
	},
	{
		id: 'lofi',
		name: 'Lofi Piano',
		icon: Piano,
		url: '/audio/lofi-piano.mp3'
	},
	{
		id: 'ocean',
		name: 'Sóng Biển',
		icon: Waves,
		url: '/audio/ocean-waves.mp3'
	},
	{
		id: 'rain',
		name: 'Mưa Rơi',
		icon: CloudRain,
		url: '/audio/gentle-rain.mp3'
	}
];

function createFallbackAmbientBuffer(ctx: AudioContext): AudioBuffer {
	const sampleRate = ctx.sampleRate || 44100;
	const duration = 4.0;
	const numSamples = Math.floor(sampleRate * duration);
	const buffer = ctx.createBuffer(2, numSamples, sampleRate);
	if (!buffer || typeof buffer.getChannelData !== 'function') return buffer;

	const left = buffer.getChannelData(0);
	const right = buffer.getChannelData(1);
	for (let i = 0; i < numSamples; i++) {
		const t = i / sampleRate;
		const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
		const note1 = Math.sin(2 * Math.PI * 261.63 * t) * 0.15;
		const note2 = Math.sin(2 * Math.PI * 329.63 * t) * 0.12;
		const note3 = Math.sin(2 * Math.PI * 392.0 * t) * 0.1;
		const wave = (note1 + note2 + note3) * lfo;
		left[i] = wave;
		right[i] = wave;
	}
	return buffer;
}

export function BgmSettingsTab() {
	const {
		bgmEnabled = true,
		setBgmEnabled,
		bgmVolume = 0.2,
		setBgmVolume,
		bgmAudioUrl = '/audio/ambient-bgm.mp3',
		setBgmAudioUrl,
		bgmFadeInMs = 500,
		bgmFadeOutMs = 800,
		bgmStopDelayMs = 1500,
		bgmOnlyOnEdgeReadAloud = true,
		setBgmParameter
	} = useReaderConfigStore();

	const [customUrl, setCustomUrl] = useState(bgmAudioUrl);
	const [isPreviewing, setIsPreviewing] = useState(false);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);
	const [showAdvanced, setShowAdvanced] = useState(false);

	const previewAudioCtxRef = useRef<AudioContext | null>(null);
	const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
	const previewGainRef = useRef<GainNode | null>(null);

	useEffect(() => {
		return () => {
			stopPreview();
		};
	}, []);

	// Cập nhật âm lượng realtime khi đang phát preview
	useEffect(() => {
		if (previewGainRef.current && previewAudioCtxRef.current) {
			const ctx = previewAudioCtxRef.current;
			const gain = previewGainRef.current;
			const safeVolume = computeSubtleBgmVolume(bgmVolume);
			const now = ctx.currentTime;
			try {
				if (typeof gain.gain.setValueAtTime === 'function') {
					gain.gain.setValueAtTime(safeVolume, now);
				} else {
					gain.gain.value = safeVolume;
				}
			} catch {}
		}
	}, [bgmVolume]);

	const setIsBgmPreviewing = useReaderConfigStore((state) => state.setIsBgmPreviewing);

	const stopPreview = () => {
		if (previewSourceRef.current) {
			try {
				previewSourceRef.current.stop();
				previewSourceRef.current.disconnect();
			} catch {}
			previewSourceRef.current = null;
		}
		if (previewGainRef.current) {
			try {
				previewGainRef.current.disconnect();
			} catch {}
			previewGainRef.current = null;
		}
		if (previewAudioCtxRef.current && previewAudioCtxRef.current.state !== 'closed') {
			void previewAudioCtxRef.current.close();
			previewAudioCtxRef.current = null;
		}
		setIsPreviewing(false);
		setIsLoadingPreview(false);
		setIsBgmPreviewing?.(false);
	};

	const startPreview = async (urlToPlay?: string) => {
		stopPreview();

		try {
			setIsLoadingPreview(true);
			setIsBgmPreviewing?.(true);

			const AudioContextClass =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

			if (!AudioContextClass) {
				setIsLoadingPreview(false);
				return;
			}

			const ctx = new AudioContextClass();
			previewAudioCtxRef.current = ctx;

			const targetUrl = urlToPlay || bgmAudioUrl;
			const resolvedUrl = getAssetUrl(targetUrl);

			let buffer: AudioBuffer;
			try {
				const res = await fetch(resolvedUrl);
				if (res.ok === false) throw new Error(`HTTP error ${res.status}`);
				const contentType = res.headers?.get ? res.headers.get('content-type') || '' : '';
				if (contentType.includes('text/html')) {
					throw new Error('Received HTML instead of audio');
				}
				const arrayBuffer = await res.arrayBuffer();
				buffer = await ctx.decodeAudioData(arrayBuffer);
			} catch (err) {
				console.debug('[BgmSettingsTab] Load audio file failed, using fallback:', err);
				buffer = createFallbackAmbientBuffer(ctx);
			}

			if (ctx.state === 'suspended') {
				await ctx.resume();
			}

			const source = ctx.createBufferSource();
			source.buffer = buffer;
			source.loop = true;

			const gain = ctx.createGain();
			gain.gain.value = computeSubtleBgmVolume(bgmVolume);

			source.connect(gain);
			gain.connect(ctx.destination);
			source.start(0);

			previewSourceRef.current = source;
			previewGainRef.current = gain;
			setIsPreviewing(true);
		} catch (err) {
			console.error('Failed to preview BGM audio:', err);
			setIsPreviewing(false);
		} finally {
			setIsLoadingPreview(false);
		}
	};

	const togglePreview = async () => {
		if (isPreviewing) {
			stopPreview();
			return;
		}
		await startPreview();
	};

	const handleSelectPreset = (url: string) => {
		if (bgmAudioUrl === url) {
			void togglePreview();
			return;
		}

		const wasPreviewing = isPreviewing;
		stopPreview();
		setBgmAudioUrl(url);
		setCustomUrl(url);
		if (wasPreviewing) {
			void startPreview(url);
		}
	};

	const handleCustomUrlBlur = () => {
		if (customUrl && customUrl.trim() !== bgmAudioUrl) {
			stopPreview();
			setBgmAudioUrl(customUrl.trim());
		}
	};

	const handleResetDefaults = () => {
		stopPreview();
		setBgmEnabled(true);
		setBgmVolume(0.2);
		setBgmAudioUrl('/audio/ambient-bgm.mp3');
		setCustomUrl('/audio/ambient-bgm.mp3');
		setBgmParameter('bgmFadeInMs', 500);
		setBgmParameter('bgmFadeOutMs', 800);
		setBgmParameter('bgmStopDelayMs', 1500);
		setBgmParameter('bgmOnlyOnEdgeReadAloud', true);
	};

	const volumePercent = Math.round(bgmVolume * 100);

	return (
		<div className="space-y-2.5 text-on-surface select-none pb-4">
			{/* 1. Master Toggle & Live Sound Preview */}
			<div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 shadow-xs">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div
							className={`p-1.5 rounded-xl transition-all ${
								bgmEnabled
									? 'bg-primary/20 text-primary border border-primary/40'
									: 'bg-white/10 text-on-surface-variant'
							}`}
						>
							<Music size={16} />
						</div>
						<div className="flex items-center gap-1.5">
							<h3 className="text-xs font-bold text-on-surface">Nhạc Nền</h3>
						</div>
					</div>

					{/* Switch Toggle */}
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
							className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
								bgmEnabled ? 'translate-x-4' : 'translate-x-0'
							}`}
						/>
					</button>
				</div>

				{/* Quick Preview Bar */}
				<div className="flex items-center justify-between pt-1.5 border-t border-white/10 text-xs">
					<div className="flex items-center gap-1.5 text-on-surface-variant">
						<Radio
							size={12}
							className={isPreviewing ? 'text-primary animate-pulse' : 'text-on-surface-variant/60'}
						/>
						<span className="text-[11px] font-medium">
							{isLoadingPreview ? 'Đang tải...' : isPreviewing ? 'Đang phát thử' : 'Thử âm thanh'}
						</span>
					</div>

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
						{isLoadingPreview ? (
							<>
								<Loader2 size={12} className="animate-spin text-primary" />
								<span>Tải...</span>
							</>
						) : isPreviewing ? (
							<>
								<Pause size={12} className="fill-current" />
								<span>Tạm dừng</span>
							</>
						) : (
							<>
								<Play size={12} className="fill-current" />
								<span>Nghe thử</span>
							</>
						)}
					</button>
				</div>
			</div>

			{/* 2. Âm lượng (Compact Slider & Presets) */}
			<div
				className={`p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 shadow-xs transition-opacity ${
					!bgmEnabled ? 'opacity-40 pointer-events-none' : ''
				}`}
			>
				<div className="flex items-center justify-between">
					<div className="text-xs font-bold text-on-surface flex items-center gap-1.5">
						{volumePercent === 0 ? (
							<VolumeX size={14} className="text-rose-400" />
						) : (
							<Volume2 size={14} className="text-primary" />
						)}
						<span>Âm lượng</span>
					</div>
					<span className="px-2 py-0.5 rounded-lg bg-primary/20 text-primary border border-primary/30 font-mono font-bold text-xs">
						{volumePercent}%
					</span>
				</div>

				{/* Range Slider */}
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={bgmVolume}
					onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
					className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
				/>

				{/* Quick Volume Preset Chips */}
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

			{/* 3. Danh sách bản nhạc (Compact 2-Column Grid) */}
			<div
				className={`p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 shadow-xs transition-opacity ${
					!bgmEnabled ? 'opacity-40 pointer-events-none' : ''
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
									handleSelectPreset(preset.url);
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
											isSelected
												? 'bg-primary/30 border-primary/50 text-primary'
												: 'bg-white/10 border-white/15 text-on-surface-variant'
										}`}
									>
										{isPlayingThis ? (
											<Radio size={12} className="text-primary animate-pulse" />
										) : (
											<Icon size={12} />
										)}
									</div>
									<span
										className={`text-xs font-bold truncate ${
											isSelected ? 'text-primary font-black' : 'text-on-surface'
										}`}
									>
										{preset.name}
									</span>
								</div>
								{isSelected && (
									<Check size={12} strokeWidth={3} className="text-primary shrink-0" />
								)}
							</button>
						);
					})}
				</div>
			</div>

			{/* 4. Cấu hình Nâng cao (Collapsible Accordion) */}
			<div
				className={`rounded-2xl bg-white/5 border border-white/10 overflow-hidden shadow-xs transition-opacity ${
					!bgmEnabled ? 'opacity-40 pointer-events-none' : ''
				}`}
			>
				<button
					type="button"
					onClick={() => {
						triggerHaptic('light');
						setShowAdvanced(!showAdvanced);
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
						{/* URL tùy chỉnh */}
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
									onBlur={handleCustomUrlBlur}
									placeholder="https://.../audio.mp3"
									className="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none min-w-0 font-medium font-mono"
								/>
							</div>
						</div>
						{/* Fade In Ms */}
						<div className="space-y-1">
							<div className="flex justify-between text-xs">
								<span className="text-on-surface-variant text-[11px]">Fade In (tăng âm):</span>
								<span className="font-mono text-primary font-bold text-[11px]">{bgmFadeInMs} ms</span>
							</div>
							<input
								type="range"
								min="100"
								max="2000"
								step="100"
								value={bgmFadeInMs}
								onChange={(e) => setBgmParameter('bgmFadeInMs', parseInt(e.target.value, 10))}
								className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
							/>
						</div>

						{/* Fade Out Ms */}
						<div className="space-y-1">
							<div className="flex justify-between text-xs">
								<span className="text-on-surface-variant text-[11px]">Fade Out (giảm âm):</span>
								<span className="font-mono text-primary font-bold text-[11px]">{bgmFadeOutMs} ms</span>
							</div>
							<input
								type="range"
								min="100"
								max="3000"
								step="100"
								value={bgmFadeOutMs}
								onChange={(e) => setBgmParameter('bgmFadeOutMs', parseInt(e.target.value, 10))}
								className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
							/>
						</div>

						{/* Stop Delay Ms */}
						<div className="space-y-1">
							<div className="flex justify-between text-xs">
								<span className="text-on-surface-variant text-[11px] flex items-center gap-1">
									<Clock size={11} />
									Trễ chờ chuyển câu/dòng:
								</span>
								<span className="font-mono text-primary font-bold text-[11px]">{bgmStopDelayMs} ms</span>
							</div>
							<input
								type="range"
								min="0"
								max="5000"
								step="250"
								value={bgmStopDelayMs}
								onChange={(e) => setBgmParameter('bgmStopDelayMs', parseInt(e.target.value, 10))}
								className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
							/>
						</div>

						{/* Only on Edge Read Aloud toggle */}
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

			{/* Reset Defaults Action */}
			<div className="flex justify-end pt-0.5">
				<button
					type="button"
					onClick={() => {
						triggerHaptic('light');
						handleResetDefaults();
					}}
					className="px-2.5 py-1 text-xs font-bold text-on-surface-variant hover:text-on-surface bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
				>
					<RotateCcw size={12} />
					<span>Mặc định</span>
				</button>
			</div>
		</div>
	);
}
