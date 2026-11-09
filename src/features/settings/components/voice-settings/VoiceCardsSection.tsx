import { Volume2, Zap, Sparkles, Smartphone, Play, Square, User, Mic, Check, Gauge, AlertCircle, Loader2, Minus, Plus } from 'lucide-react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

import { SPEED_PRESETS, type UnifiedVoiceItem } from './voiceSettingsHelpers';

function renderGenderIcon(gender: 'female' | 'male' | 'device') {
	if (gender === 'female') return <Mic size={12} />;
	if (gender === 'male') return <User size={12} />;
	return <Smartphone size={12} />;
}

export function VoiceCategorySwitcher({
	activeFilter,
	setActiveFilter,
	counts,
}: {
	activeFilter: 'edge' | 'vieneu' | 'browser';
	setActiveFilter: (f: 'edge' | 'vieneu' | 'browser') => void;
	counts: { edge: number; vieneu: number; browser: number };
}) {
	return (
		<div className="p-1 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-1 shadow-xs">
			<button
				type="button"
				onClick={() => {
					triggerHaptic('light');
					setActiveFilter('edge');
				}}
				className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
					activeFilter === 'edge'
						? 'bg-primary/20 hover:bg-primary/25 border border-primary/50 text-primary font-black shadow-xs'
						: 'text-on-surface-variant hover:text-on-surface border border-transparent hover:bg-white/5'
				}`}
			>
				<Zap size={13} className={activeFilter === 'edge' ? 'text-primary' : 'opacity-60'} />
				<span className="truncate">Edge Cloud</span>
				<span className="text-[10px] font-mono opacity-70">({counts.edge})</span>
			</button>

			<button
				type="button"
				onClick={() => {
					triggerHaptic('light');
					setActiveFilter('vieneu');
				}}
				className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
					activeFilter === 'vieneu'
						? 'bg-primary/20 hover:bg-primary/25 border border-primary/50 text-primary font-black shadow-xs'
						: 'text-on-surface-variant hover:text-on-surface border border-transparent hover:bg-white/5'
				}`}
			>
				<Sparkles size={13} className={activeFilter === 'vieneu' ? 'text-primary' : 'opacity-60'} />
				<span className="truncate">VieNeu AI</span>
				<span className="text-[10px] font-mono opacity-70">({counts.vieneu})</span>
			</button>

			<button
				type="button"
				onClick={() => {
					triggerHaptic('light');
					setActiveFilter('browser');
				}}
				className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
					activeFilter === 'browser'
						? 'bg-primary/20 hover:bg-primary/25 border border-primary/50 text-primary font-black shadow-xs'
						: 'text-on-surface-variant hover:text-on-surface border border-transparent hover:bg-white/5'
				}`}
			>
				<Smartphone size={13} className={activeFilter === 'browser' ? 'text-primary' : 'opacity-60'} />
				<span className="truncate">Thiết bị</span>
				<span className="text-[10px] font-mono opacity-70">({counts.browser})</span>
			</button>
		</div>
	);
}

function VoiceCard({
	item,
	isSelected,
	isPlaying,
	onSelect,
	onTestVoice,
}: {
	key?: string;
	item: UnifiedVoiceItem;
	isSelected: boolean;
	isPlaying: boolean;
	onSelect: (item: UnifiedVoiceItem) => void;
	onTestVoice: (item: UnifiedVoiceItem) => void;
}) {
	return (
		<div
			onClick={() => onSelect(item)}
			className={`px-2.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-1.5 shadow-xs ${
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
					{renderGenderIcon(item.gender)}
				</div>

				<div className="min-w-0 flex-1 flex items-center gap-1">
					<span className={`text-xs font-bold truncate ${isSelected ? 'text-primary font-black' : 'text-on-surface'}`}>{item.name}</span>
					{isSelected && <Check size={12} strokeWidth={3} className="text-primary shrink-0" />}
				</div>
			</div>

			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onTestVoice(item);
				}}
				className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-90 cursor-pointer ${
					isPlaying ? 'bg-primary text-on-primary shadow-xs' : 'bg-white/10 hover:bg-white/20 border border-white/15 text-on-surface'
				}`}
				title={isPlaying ? 'Dừng phát' : 'Nghe thử'}
			>
				{isPlaying ? <Square size={10} className="fill-current" /> : <Play size={10} className="fill-current ml-0.5" />}
			</button>
		</div>
	);
}

export function VoiceCardsListHeader({ isUpdating }: { isUpdating: boolean }) {
	return (
		<div className="flex items-center justify-between px-1">
			<div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
				<Volume2 size={14} className="text-primary" />
				<span>Danh sách giọng đọc</span>
			</div>

			{isUpdating && (
				<div className="flex items-center gap-1 text-[10px] text-primary font-bold">
					<Loader2 size={11} className="animate-spin" />
					<span>Đang cập nhật...</span>
				</div>
			)}
		</div>
	);
}

export function VoiceCardsList({
	isInitialLoading,
	filteredVoices,
	isVoiceActive,
	isTestingAudio,
	playingVoiceKey,
	onSelectVoice,
	onTestVoice,
}: {
	isInitialLoading: boolean;
	filteredVoices: UnifiedVoiceItem[];
	isVoiceActive: (item: UnifiedVoiceItem) => boolean;
	isTestingAudio: boolean;
	playingVoiceKey: string | null;
	onSelectVoice: (item: UnifiedVoiceItem) => void;
	onTestVoice: (item: UnifiedVoiceItem) => void;
}) {
	if (isInitialLoading) {
		return (
			<div className="p-8 text-center bg-white/5 border border-white/10 rounded-2xl shadow-xs">
				<Loader2 size={22} className="animate-spin text-primary mx-auto mb-2" />
				<p className="text-xs text-on-surface-variant font-medium">Đang tải danh sách giọng đọc...</p>
			</div>
		);
	}
	if (filteredVoices.length === 0) {
		return (
			<div className="p-6 text-center bg-white/5 border border-white/10 rounded-2xl space-y-1.5 shadow-xs">
				<AlertCircle size={20} className="text-on-surface-variant/50 mx-auto" />
				<p className="text-xs text-on-surface font-bold">Không tìm thấy giọng đọc nào</p>
				<p className="text-[11px] text-on-surface-variant">Kiểm tra kết nối mạng hoặc máy chủ VieNeu AI</p>
			</div>
		);
	}
	return (
		<div className="grid grid-cols-2 gap-1.5">
			{filteredVoices.map((item) => (
				<VoiceCard
					key={item.id}
					item={item}
					isSelected={isVoiceActive(item)}
					isPlaying={isTestingAudio && playingVoiceKey === item.id}
					onSelect={onSelectVoice}
					onTestVoice={onTestVoice}
				/>
			))}
		</div>
	);
}

export function VoiceSpeedCard({ speechRate, setSpeechRate }: { speechRate: number; setSpeechRate: (r: number) => void }) {
	return (
		<div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 shadow-xs">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
					<Gauge size={14} className="text-primary" />
					<span>Tốc độ đọc</span>
				</div>

				<div className="flex items-center gap-1.5">
					<span className="px-2 py-0.5 rounded-lg bg-primary/20 text-primary border border-primary/30 font-mono font-bold text-xs">
						{speechRate.toFixed(2)}x
					</span>
				</div>
			</div>

			<input
				type="range"
				min={0.5}
				max={3.0}
				step={0.05}
				value={speechRate}
				onChange={(e) => setSpeechRate(Number(e.target.value))}
				className="w-full accent-primary cursor-pointer h-1.5 bg-white/10 rounded-lg"
			/>

			<div className="flex items-center justify-between gap-1 pt-0.5">
				<div className="flex items-center gap-1 flex-1">
					{SPEED_PRESETS.map((preset) => {
						const isCurrent = Math.abs(speechRate - preset) < 0.03;
						return (
							<button
								key={preset}
								type="button"
								onClick={() => {
									triggerHaptic('light');
									setSpeechRate(preset);
								}}
								className={`flex-1 py-1 rounded-xl text-[11px] font-mono font-bold transition-all active:scale-95 cursor-pointer border ${
									isCurrent
										? 'bg-primary/25 border-primary/50 text-primary shadow-xs'
										: 'bg-white/5 hover:bg-white/10 border-white/10 text-on-surface-variant hover:text-on-surface'
								}`}
							>
								{preset}x
							</button>
						);
					})}
				</div>

				<div className="flex items-center gap-0.5 bg-white/10 p-0.5 rounded-xl border border-white/15 shrink-0 ml-1">
					<button
						type="button"
						onClick={() => {
							triggerHaptic('light');
							setSpeechRate(Math.max(0.5, Number((speechRate - 0.05).toFixed(2))));
						}}
						disabled={speechRate <= 0.5}
						className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 disabled:opacity-30 text-on-surface flex items-center justify-center font-bold cursor-pointer"
						title="Giảm 0.05x"
					>
						<Minus size={11} />
					</button>
					<button
						type="button"
						onClick={() => {
							triggerHaptic('light');
							setSpeechRate(Math.min(3.0, Number((speechRate + 0.05).toFixed(2))));
						}}
						disabled={speechRate >= 3.0}
						className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 disabled:opacity-30 text-on-surface flex items-center justify-center font-bold cursor-pointer"
						title="Tăng 0.05x"
					>
						<Plus size={11} />
					</button>
				</div>
			</div>
		</div>
	);
}

export function VoiceErrorAlert({ testError, onDismiss }: { testError: string | null; onDismiss: () => void }) {
	if (!testError) return null;
	return (
		<div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200 shadow-xs">
			<div className="flex items-center gap-2 min-w-0">
				<AlertCircle size={14} className="shrink-0" />
				<span className="truncate font-semibold">{testError}</span>
			</div>
			<button
				type="button"
				onClick={onDismiss}
				className="text-xs font-bold text-rose-400/80 hover:text-rose-400 px-1.5 py-0.5 rounded-lg hover:bg-rose-500/20 cursor-pointer shrink-0"
			>
				Đóng
			</button>
		</div>
	);
}
