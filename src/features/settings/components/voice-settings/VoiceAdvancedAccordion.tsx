import { Zap, Smartphone, RotateCcw, Radio, Settings2, ChevronDown, ChevronUp, Loader2, Server } from 'lucide-react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';
import { type NativeTTSEngine } from '@/services/nativeTtsService';
import { type VieNeuModel, DEFAULT_VIENEU_SERVER_URL } from '@/services/ttsService';

import { EDGE_BUFFER_MODES } from './voiceSettingsHelpers';

import type { EdgeBufferMode } from '@/shared/types';
import type { ReaderConfig } from '@/stores/useReaderConfigStore';

function VieneuParamsForm({
	isTurbo,
	vieneuTemperature,
	vieneuTopK,
	vieneuTopP,
	vieneuMaxNewFrames,
	vieneuSteps,
	vieneuCfg,
	setVieneuParameter,
}: {
	isTurbo: boolean;
	vieneuTemperature: number;
	vieneuTopK: number;
	vieneuTopP: number;
	vieneuMaxNewFrames: number;
	vieneuSteps: number;
	vieneuCfg: number;
	setVieneuParameter: <K extends keyof ReaderConfig>(key: K, value: ReaderConfig[K]) => void;
}) {
	if (isTurbo) {
		return (
			<div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 mt-1.5 text-[10px]">
				<label>
					Temperature
					<input
						type="number"
						min="0.1"
						max="2"
						step="0.05"
						value={vieneuTemperature}
						onChange={(e) => setVieneuParameter('vieneuTemperature', Number(e.target.value))}
						className="w-full mt-1 px-2 py-1 rounded-lg bg-white/10 border border-white/15 text-on-surface"
					/>
				</label>
				<label>
					Top K
					<input
						type="number"
						min="1"
						max="100"
						value={vieneuTopK}
						onChange={(e) => setVieneuParameter('vieneuTopK', Number(e.target.value))}
						className="w-full mt-1 px-2 py-1 rounded-lg bg-white/10 border border-white/15 text-on-surface"
					/>
				</label>
				<label>
					Top P
					<input
						type="number"
						min="0.1"
						max="1"
						step="0.01"
						value={vieneuTopP}
						onChange={(e) => setVieneuParameter('vieneuTopP', Number(e.target.value))}
						className="w-full mt-1 px-2 py-1 rounded-lg bg-white/10 border border-white/15 text-on-surface"
					/>
				</label>
				<label>
					Max frames
					<input
						type="number"
						min="32"
						max="600"
						value={vieneuMaxNewFrames}
						onChange={(e) => setVieneuParameter('vieneuMaxNewFrames', Number(e.target.value))}
						className="w-full mt-1 px-2 py-1 rounded-lg bg-white/10 border border-white/15 text-on-surface"
					/>
				</label>
			</div>
		);
	}
	return (
		<div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 mt-1.5 text-[10px]">
			<label>
				Steps
				<input
					type="number"
					min="1"
					max="32"
					value={vieneuSteps}
					onChange={(e) => setVieneuParameter('vieneuSteps', Number(e.target.value))}
					className="w-full mt-1 px-2 py-1 rounded-lg bg-white/10 border border-white/15 text-on-surface"
				/>
			</label>
			<label>
				CFG
				<input
					type="number"
					min="0"
					max="10"
					step="0.1"
					value={vieneuCfg}
					onChange={(e) => setVieneuParameter('vieneuCfg', Number(e.target.value))}
					className="w-full mt-1 px-2 py-1 rounded-lg bg-white/10 border border-white/15 text-on-surface"
				/>
			</label>
		</div>
	);
}

function EdgeBufferModeSection({
	activeEdgeBufferMode,
	edgeBufferMode,
	setEdgeBufferMode,
}: {
	activeEdgeBufferMode: { badge: string; description: string };
	edgeBufferMode: EdgeBufferMode;
	setEdgeBufferMode: (m: EdgeBufferMode) => void;
}) {
	return (
		<div className="space-y-1.5 pt-1">
			<div className="flex items-center justify-between">
				<label className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
					<Zap size={12} className="text-primary" /> Bộ đệm âm thanh Edge TTS (Native)
				</label>
				<span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
					{activeEdgeBufferMode.badge}
				</span>
			</div>
			<div className="grid grid-cols-3 gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
				{EDGE_BUFFER_MODES.map((mode) => (
					<button
						key={mode.value}
						type="button"
						aria-pressed={edgeBufferMode === mode.value}
						onClick={() => {
							triggerHaptic('light');
							setEdgeBufferMode(mode.value);
						}}
						className={`min-w-0 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
							edgeBufferMode === mode.value ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface hover:bg-white/10'
						}`}
					>
						<span className="w-full truncate">{mode.title}</span>
						<span
							className={`w-full truncate text-[9px] opacity-80 ${
								edgeBufferMode === mode.value ? 'text-on-primary' : 'text-on-surface-variant'
							}`}
						>
							{mode.subtitle}
						</span>
					</button>
				))}
			</div>
			<p className="text-[10px] text-on-surface-variant/70 leading-relaxed px-0.5">{activeEdgeBufferMode.description}</p>
		</div>
	);
}

function VieneuServerConfigSection({
	vieneuServerUrl,
	setVieneuServerUrl,
	onTestConnection,
	isPingTesting,
}: {
	vieneuServerUrl: string;
	setVieneuServerUrl: (url: string) => void;
	onTestConnection: () => void;
	isPingTesting: boolean;
}) {
	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between">
				<label className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
					<Server size={12} className="text-primary" /> Địa chỉ máy chủ VieNeu AI
				</label>
				<button
					type="button"
					onClick={() => setVieneuServerUrl(DEFAULT_VIENEU_SERVER_URL)}
					className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer opacity-80 hover:opacity-100"
				>
					<RotateCcw size={10} /> Mặc định
				</button>
			</div>

			<div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/15 focus-within:ring-1 focus-within:ring-primary/60">
				<input
					type="text"
					value={vieneuServerUrl}
					onChange={(e) => setVieneuServerUrl(e.target.value)}
					placeholder="https://..."
					className="w-full bg-transparent px-2 py-0.5 text-xs font-mono text-on-surface focus:outline-none font-bold placeholder:text-on-surface-variant/40 min-w-0"
				/>
				<button
					type="button"
					onClick={onTestConnection}
					disabled={isPingTesting}
					className="w-7 h-7 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary flex items-center justify-center shrink-0 transition-all active:scale-90 cursor-pointer disabled:opacity-50"
					title="Kiểm tra kết nối"
				>
					{isPingTesting ? <Loader2 size={12} className="animate-spin text-primary" /> : <Radio size={12} />}
				</button>
			</div>
		</div>
	);
}

export interface VoiceAdvancedAccordionProps {
	showAdvancedSettings: boolean;
	setShowAdvancedSettings: React.Dispatch<React.SetStateAction<boolean>>;
	vieneuServerUrl: string;
	setVieneuServerUrl: (url: string) => void;
	onTestConnection: () => void;
	isPingTesting: boolean;
	vieneuModels: VieNeuModel[];
	vieneuModel: string;
	setVieneuModel: (m: string) => void;
	setVoiceUri: (v: string) => void;
	nativeEngines: NativeTTSEngine[];
	activeNativeEngine: string;
	onSwitchNativeEngine: (name: string) => void;
	activeEdgeBufferMode: { badge: string; description: string };
	edgeBufferMode: EdgeBufferMode;
	setEdgeBufferMode: (m: EdgeBufferMode) => void;
	showAdvancedParams: boolean;
	setShowAdvancedParams: React.Dispatch<React.SetStateAction<boolean>>;
	vieneuTemperature: number;
	vieneuTopK: number;
	vieneuTopP: number;
	vieneuMaxNewFrames: number;
	vieneuSteps: number;
	vieneuCfg: number;
	setVieneuParameter: <K extends keyof ReaderConfig>(key: K, value: ReaderConfig[K]) => void;
}

export function VoiceAdvancedAccordion({
	showAdvancedSettings,
	setShowAdvancedSettings,
	vieneuServerUrl,
	setVieneuServerUrl,
	onTestConnection,
	isPingTesting,
	vieneuModels,
	vieneuModel,
	setVieneuModel,
	setVoiceUri,
	nativeEngines,
	activeNativeEngine,
	onSwitchNativeEngine,
	activeEdgeBufferMode,
	edgeBufferMode,
	setEdgeBufferMode,
	showAdvancedParams,
	setShowAdvancedParams,
	vieneuTemperature,
	vieneuTopK,
	vieneuTopP,
	vieneuMaxNewFrames,
	vieneuSteps,
	vieneuCfg,
	setVieneuParameter,
}: VoiceAdvancedAccordionProps) {
	return (
		<div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden shadow-xs">
			<button
				type="button"
				onClick={() => setShowAdvancedSettings((prev) => !prev)}
				className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-on-surface hover:bg-white/5 transition-colors cursor-pointer"
			>
				<div className="flex items-center gap-2">
					<Settings2 size={14} className="text-primary" />
					<span>Cài đặt máy chủ & kỹ thuật</span>
				</div>
				{showAdvancedSettings ? (
					<ChevronUp size={14} className="text-on-surface-variant" />
				) : (
					<ChevronDown size={14} className="text-on-surface-variant" />
				)}
			</button>

			{showAdvancedSettings && (
				<div className="p-3 border-t border-white/10 space-y-3 bg-black/20 animate-in fade-in duration-200">
					<VieneuServerConfigSection
						vieneuServerUrl={vieneuServerUrl}
						setVieneuServerUrl={setVieneuServerUrl}
						onTestConnection={onTestConnection}
						isPingTesting={isPingTesting}
					/>

					{vieneuModels.length > 0 && (
						<div className="space-y-1">
							<label className="text-[11px] font-bold text-on-surface-variant">Model VieNeu AI</label>
							<select
								value={vieneuModel}
								onChange={(e) => {
									setVieneuModel(e.target.value);
									setVoiceUri('');
								}}
								className="w-full px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/60 font-bold"
							>
								{vieneuModels.map((m) => (
									<option key={m.id} value={m.id} className="bg-background text-on-background">
										{m.id} {m.active ? '(Đang chạy)' : ''}
									</option>
								))}
							</select>
						</div>
					)}

					{nativeEngines.length > 0 && (
						<div className="space-y-1">
							<label className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
								<Smartphone size={12} className="text-primary" /> Engine giọng đọc Android
							</label>
							<select
								value={activeNativeEngine}
								onChange={(e) => onSwitchNativeEngine(e.target.value)}
								className="w-full px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/60 font-bold"
							>
								{nativeEngines.map((eng) => (
									<option key={eng.name} value={eng.name} className="bg-background text-on-background">
										{eng.label} ({eng.name})
									</option>
								))}
							</select>
						</div>
					)}

					<EdgeBufferModeSection
						activeEdgeBufferMode={activeEdgeBufferMode}
						edgeBufferMode={edgeBufferMode}
						setEdgeBufferMode={setEdgeBufferMode}
					/>

					<div className="pt-1">
						<button
							type="button"
							onClick={() => setShowAdvancedParams((prev) => !prev)}
							className="text-[10px] font-mono font-bold text-on-surface-variant/80 hover:text-on-surface flex items-center gap-1 cursor-pointer"
						>
							<span>{showAdvancedParams ? '▼ Thu gọn tham số máy học' : '▶ Tham số kỹ thuật AI (Temperature, Steps...)'}</span>
						</button>

						{showAdvancedParams && (
							<VieneuParamsForm
								isTurbo={Boolean(vieneuModel?.endsWith('turbo'))}
								vieneuTemperature={vieneuTemperature}
								vieneuTopK={vieneuTopK}
								vieneuTopP={vieneuTopP}
								vieneuMaxNewFrames={vieneuMaxNewFrames}
								vieneuSteps={vieneuSteps}
								vieneuCfg={vieneuCfg}
								setVieneuParameter={setVieneuParameter}
							/>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
