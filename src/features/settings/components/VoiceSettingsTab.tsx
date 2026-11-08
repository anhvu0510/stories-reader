import {
	Volume2,
	Zap,
	Sparkles,
	Smartphone,
	Play,
	Square,
	User,
	Mic,
	Check,
	RotateCcw,
	Radio,
	Gauge,
	Settings2,
	ChevronDown,
	ChevronUp,
	AlertCircle,
	Loader2,
	Minus,
	Plus,
	Server,
} from 'lucide-react';
import React, { useEffect, useState, useRef, useMemo } from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';
import { EdgeTTSService, type EdgeVoice, DEFAULT_EDGE_VOICES } from '@/services/edgeTtsService';
import { NativeTTSService, type NativeVoice, type NativeTTSEngine } from '@/services/nativeTtsService';
import { TTSService, type VieNeuVoice, type VieNeuModel, DEFAULT_VIENEU_SERVER_URL } from '@/services/ttsService';
import { useAppStore } from '@/stores/useAppStore';
import { useReaderConfigStore, type ReaderConfig } from '@/stores/useReaderConfigStore';
import { showToast } from '@/stores/useToastStore';

import type { EdgeBufferMode } from '@/shared/types';

const SPEED_PRESETS = [0.8, 1.0, 1.25, 1.5, 1.8, 2.0];

const EDGE_BUFFER_MODES: Array<{
	value: EdgeBufferMode;
	title: string;
	subtitle: string;
	badge: string;
	description: string;
}> = [
	{
		value: 'file',
		title: 'Tệp tin tạm (Disk)',
		subtitle: 'Ghi file MP3 đĩa',
		badge: 'Disk Cache (Tệp tin)',
		description: '• Mode Disk: Lưu file mp3 tạm vào bộ nhớ thiết bị theo cơ chế cuốn chiếu tiêu chuẩn.',
	},
	{
		value: 'memory',
		title: 'Bộ nhớ RAM (Memory)',
		subtitle: 'MediaDataSource 0ms I/O',
		badge: 'In-Memory (RAM)',
		description: '• Mode RAM: Bỏ qua ghi đĩa, nạp trực tiếp vào RAM qua MediaDataSource để tối ưu độ trễ và giảm hao mòn bộ nhớ.',
	},
	{
		value: 'media3',
		title: 'Media3 Native',
		subtitle: 'Progressive + nền',
		badge: 'Media3 Native',
		description:
			'• Mode Media3: Phát progressive từ byte đầu tiên, giữ phiên đọc nền và tự fallback sang file hoàn chỉnh nếu decoder không tương thích.',
	},
];

type EngineCategory = 'edge' | 'vieneu' | 'browser';

interface UnifiedVoiceItem {
	id: string;
	engine: 'edge' | 'vieneu' | 'browser';
	name: string;
	gender: 'female' | 'male' | 'device';
	rawVoiceId: string;
}

function resolveInitialEngineCategory(ttsEngine?: string): EngineCategory {
	if (ttsEngine === 'browser') return 'browser';
	if (ttsEngine === 'vieneu') return 'vieneu';
	return 'edge';
}

function checkVoiceActive(item: UnifiedVoiceItem, ttsEngine: string, edgeVoiceUri: string, voiceUri: string): boolean {
	if (item.engine !== ttsEngine) return false;
	if (item.engine === 'edge') return item.rawVoiceId === edgeVoiceUri;
	if (item.engine === 'vieneu') return item.rawVoiceId === voiceUri;
	if (item.engine === 'browser') return item.rawVoiceId === voiceUri || (!voiceUri && item.rawVoiceId === '');
	return false;
}

function buildUnifiedVoices(edgeVoices: EdgeVoice[], vieneuVoices: VieNeuVoice[], nativeVoices: NativeVoice[]): UnifiedVoiceItem[] {
	const list: UnifiedVoiceItem[] = [];

	edgeVoices.forEach((voice) => {
		const isFemale = voice.gender === 'female' || voice.id.includes('HoaiMy');
		list.push({
			id: `edge:${voice.id}`,
			engine: 'edge',
			name: voice.name.replace(/Microsoft | Online \(Natural\)| Neural/g, '').trim(),
			gender: isFemale ? 'female' : 'male',
			rawVoiceId: voice.id,
		});
	});

	vieneuVoices.forEach((voice) => {
		const isFemale = voice.gender === 'female';
		list.push({
			id: `vieneu:${voice.id}`,
			engine: 'vieneu',
			name: voice.name || voice.id,
			gender: isFemale ? 'female' : 'male',
			rawVoiceId: voice.id,
		});
	});

	list.push({
		id: 'browser:default',
		engine: 'browser',
		name: 'Mặc định thiết bị',
		gender: 'device',
		rawVoiceId: '',
	});

	const viNative = NativeTTSService.getVietnameseVoices(nativeVoices);
	viNative.forEach((voice) => {
		list.push({
			id: `browser:${voice.name}`,
			engine: 'browser',
			name: voice.displayName || voice.name,
			gender: 'device',
			rawVoiceId: voice.name,
		});
	});

	return list;
}

function applyVoiceSelection(
	item: UnifiedVoiceItem,
	setTTSEngine: (e: EngineCategory) => void,
	setEdgeVoiceUri: (uri: string) => void,
	setVoiceUri: (uri: string) => void
) {
	triggerHaptic('light');
	setTTSEngine(item.engine);
	if (item.engine === 'edge') {
		setEdgeVoiceUri(item.rawVoiceId);
	} else if (item.engine === 'vieneu' || item.engine === 'browser') {
		setVoiceUri(item.rawVoiceId);
	}
}

async function playEdgePreview(
	voiceId: string,
	speechRate: number,
	domainUrl: string | undefined,
	onEnd: () => void,
	onError: (err: string) => void
): Promise<HTMLAudioElement> {
	const blob = await EdgeTTSService.synthesizeSpeech(
		'Xin chào bạn, đây là bản đọc thử nghiệm từ Microsoft Edge TTS.',
		voiceId || 'vi-VN-HoaiMyNeural',
		speechRate,
		domainUrl
	);
	const audioUrl = URL.createObjectURL(blob);
	const audio = new Audio(audioUrl);
	audio.onended = () => {
		onEnd();
		URL.revokeObjectURL(audioUrl);
	};
	audio.onerror = () => {
		onError('Không thể phát âm thanh Edge TTS');
		URL.revokeObjectURL(audioUrl);
	};
	await audio.play();
	return audio;
}

async function playVieNeuPreview(
	item: UnifiedVoiceItem,
	speechRate: number,
	serverUrl: string,
	model: string,
	params: Record<string, unknown>,
	onEnd: () => void,
	onError: (err: string) => void
): Promise<HTMLAudioElement> {
	const blob = await TTSService.synthesizeSpeech(
		'Xin chào bạn, đây là bản đọc thử nghiệm từ mô hình VieNeu AI.',
		item.rawVoiceId,
		speechRate,
		serverUrl,
		undefined,
		model || undefined,
		params
	);
	const audioUrl = TTSService.createAudioUrl(blob);
	const audio = new Audio(audioUrl);
	audio.onended = () => {
		onEnd();
		TTSService.revokeAudioUrl(audioUrl);
	};
	audio.onerror = () => {
		onError('Không thể phát âm thanh VieNeu AI');
		TTSService.revokeAudioUrl(audioUrl);
	};
	await audio.play();
	return audio;
}

interface VieneuFullConfig {
	serverUrl: string;
	model: string;
	temperature: number;
	topK: number;
	topP: number;
	maxNewFrames: number;
	repetitionPenalty: number;
	repetitionWindow: number;
	steps: number;
	cfg: number;
	sway: number;
	maxChars: number;
	denoise: boolean;
	useRefCodes: boolean;
	applyWatermark: boolean;
	outputSampleRate: number;
}

const VIENEU_CONFIG_DEFAULTS = {
	vieneuServerUrl: DEFAULT_VIENEU_SERVER_URL,
	vieneuModel: '',
	vieneuTemperature: 0.8,
	vieneuTopK: 25,
	vieneuTopP: 0.95,
	vieneuMaxNewFrames: 300,
	vieneuRepetitionPenalty: 1.2,
	vieneuRepetitionWindow: 80,
	vieneuSteps: 8,
	vieneuCfg: 2,
	vieneuSway: -1,
	vieneuMaxChars: 140,
	vieneuDenoise: true,
	vieneuUseRefCodes: true,
	vieneuApplyWatermark: true,
	vieneuOutputSampleRate: 0,
};

function extractVieneuConfig(store: ReturnType<typeof useReaderConfigStore.getState>): VieneuFullConfig {
	const c = { ...VIENEU_CONFIG_DEFAULTS, ...store };
	return {
		serverUrl: c.vieneuServerUrl,
		model: c.vieneuModel,
		temperature: c.vieneuTemperature,
		topK: c.vieneuTopK,
		topP: c.vieneuTopP,
		maxNewFrames: c.vieneuMaxNewFrames,
		repetitionPenalty: c.vieneuRepetitionPenalty,
		repetitionWindow: c.vieneuRepetitionWindow,
		steps: c.vieneuSteps,
		cfg: c.vieneuCfg,
		sway: c.vieneuSway,
		maxChars: c.vieneuMaxChars,
		denoise: c.vieneuDenoise,
		useRefCodes: c.vieneuUseRefCodes,
		applyWatermark: c.vieneuApplyWatermark,
		outputSampleRate: c.vieneuOutputSampleRate,
	};
}

async function executeVoiceTest(
	item: UnifiedVoiceItem,
	speechRate: number,
	activeDomainUrl: string | undefined,
	vieneuConfig: VieneuFullConfig,
	onEnd: () => void,
	onError: (msg: string) => void
): Promise<HTMLAudioElement | null> {
	if (item.engine === 'browser') {
		await NativeTTSService.speak({
			text: 'Xin chào, đây là giọng đọc thử nghiệm từ thiết bị của bạn.',
			voice: item.rawVoiceId,
			rate: speechRate,
			onDone: onEnd,
			onError: (err) => onError('Không thể phát giọng đọc thiết bị: ' + (typeof err === 'string' ? err : 'Lỗi thiết bị')),
		});
		return null;
	}

	if (item.engine === 'edge') {
		return await playEdgePreview(item.rawVoiceId, speechRate, activeDomainUrl, onEnd, onError);
	}

	if (item.engine === 'vieneu') {
		const params = {
			temperature: vieneuConfig.temperature,
			top_k: vieneuConfig.topK,
			top_p: vieneuConfig.topP,
			max_new_frames: vieneuConfig.maxNewFrames,
			repetition_penalty: vieneuConfig.repetitionPenalty,
			repetition_window: vieneuConfig.repetitionWindow,
			steps: vieneuConfig.steps,
			cfg: vieneuConfig.cfg,
			sway: vieneuConfig.sway,
			max_chars: vieneuConfig.maxChars,
			denoise: vieneuConfig.denoise,
			use_ref_codes: vieneuConfig.useRefCodes,
			apply_watermark: vieneuConfig.applyWatermark,
			...(vieneuConfig.outputSampleRate ? { output_sample_rate: vieneuConfig.outputSampleRate as 24000 | 48000 } : {}),
		};
		return await playVieNeuPreview(item, speechRate, vieneuConfig.serverUrl, vieneuConfig.model, params, onEnd, onError);
	}

	return null;
}

function useEdgeVoices(activeDomainUrl?: string) {
	const [edgeVoices, setEdgeVoices] = useState<EdgeVoice[]>(DEFAULT_EDGE_VOICES);
	const [isLoadingEdge, setIsLoadingEdge] = useState(false);

	useEffect(() => {
		let isMounted = true;
		setIsLoadingEdge(true);

		EdgeTTSService.fetchVoices(activeDomainUrl)
			.then((voices) => {
				if (!isMounted) return;
				const viVoices = voices.filter((v) => v.language === 'vi-VN' || v.id.startsWith('vi-VN'));
				setEdgeVoices(viVoices.length > 0 ? viVoices : DEFAULT_EDGE_VOICES);
			})
			.catch(() => {
				if (isMounted) setEdgeVoices(DEFAULT_EDGE_VOICES);
			})
			.finally(() => {
				if (isMounted) setIsLoadingEdge(false);
			});

		return () => {
			isMounted = false;
		};
	}, [activeDomainUrl]);

	return { edgeVoices, isLoadingEdge };
}

function useVieNeuData(serverUrl: string, currentModel: string, setModel: (m: string) => void) {
	const [vieneuVoices, setVieneuVoices] = useState<VieNeuVoice[]>([]);
	const [vieneuModels, setVieneuModels] = useState<VieNeuModel[]>([]);
	const [isLoadingVieNeu, setIsLoadingVieNeu] = useState(false);

	useEffect(() => {
		let isMounted = true;
		setIsLoadingVieNeu(true);

		TTSService.fetchModels(serverUrl)
			.then((models) => {
				if (!isMounted) return;
				setVieneuModels(models);
				const selected = models.find((m) => m.id === currentModel) || models.find((m) => m.active) || models[0];
				if (selected && selected.id !== currentModel) {
					setModel(selected.id);
				}
			})
			.catch(() => {
				if (isMounted) setVieneuModels([]);
			});

		TTSService.fetchVoices(serverUrl, currentModel || undefined)
			.then((voices) => {
				if (!isMounted) return;
				setVieneuVoices(voices);
			})
			.catch(() => {
				if (isMounted) setVieneuVoices([]);
			})
			.finally(() => {
				if (isMounted) setIsLoadingVieNeu(false);
			});

		return () => {
			isMounted = false;
		};
	}, [serverUrl, currentModel, setModel]);

	return { vieneuVoices, vieneuModels, isLoadingVieNeu };
}

function useNativeVoicesData() {
	const [nativeVoices, setNativeVoices] = useState<NativeVoice[]>([]);
	const [nativeEngines, setNativeEngines] = useState<NativeTTSEngine[]>([]);
	const [activeNativeEngine, setActiveNativeEngine] = useState<string>('');
	const [isLoadingNative, setIsLoadingNative] = useState(false);

	useEffect(() => {
		let isMounted = true;
		const loadNativeVoices = async () => {
			setIsLoadingNative(true);
			try {
				if (NativeTTSService.isNative()) {
					const engineData = await NativeTTSService.getEngines();
					if (!isMounted) return;
					setNativeEngines(engineData.engines || []);
					if (engineData.defaultEngine) {
						setActiveNativeEngine(engineData.defaultEngine);
					}
				}
				const voices = await NativeTTSService.getVoices();
				if (isMounted) setNativeVoices(voices);
			} catch (err) {
				console.warn('[VoiceSettingsTab] Error loading native voices:', err);
			} finally {
				if (isMounted) setIsLoadingNative(false);
			}
		};

		loadNativeVoices();

		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			window.speechSynthesis.onvoiceschanged = loadNativeVoices;
		}

		return () => {
			isMounted = false;
		};
	}, []);

	return {
		nativeVoices,
		setNativeVoices,
		nativeEngines,
		activeNativeEngine,
		setActiveNativeEngine,
		isLoadingNative,
		setIsLoadingNative,
	};
}

function renderGenderIcon(gender: 'female' | 'male' | 'device') {
	if (gender === 'female') return <Mic size={12} />;
	if (gender === 'male') return <User size={12} />;
	return <Smartphone size={12} />;
}

function VoiceCategorySwitcher({
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

function VoiceCardsListHeader({ isUpdating }: { isUpdating: boolean }) {
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

function VoiceCardsList({
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

function VoiceSpeedCard({ speechRate, setSpeechRate }: { speechRate: number; setSpeechRate: (r: number) => void }) {
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

			{/* Range Slider */}
			<input
				type="range"
				min={0.5}
				max={3.0}
				step={0.05}
				value={speechRate}
				onChange={(e) => setSpeechRate(Number(e.target.value))}
				className="w-full accent-primary cursor-pointer h-1.5 bg-white/10 rounded-lg"
			/>

			{/* Quick Speed Presets + Stepper */}
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

				{/* Micro Stepper (- / +) */}
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

interface VoiceAdvancedAccordionProps {
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

function VoiceAdvancedAccordion({
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
					{/* VieNeu Server Config */}
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

					{/* VieNeu Model Selector */}
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

					{/* Native Android TTS Engines */}
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

					{/* Edge TTS Storage / Buffer Mode Selector */}
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

					{/* Tham số kỹ thuật AI */}
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

function VoiceErrorAlert({ testError, onDismiss }: { testError: string | null; onDismiss: () => void }) {
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

const CONFIG_DEFAULTS = {
	edgeVoiceUri: 'vi-VN-HoaiMyNeural',
	edgeBufferMode: 'file' as EdgeBufferMode,
	ttsEngine: 'edge' as EngineCategory,
};

function resolveEdgeBufferMode(mode?: EdgeBufferMode) {
	const found = EDGE_BUFFER_MODES.find((m) => m.value === mode);
	if (found) return found;
	return EDGE_BUFFER_MODES[0];
}

function useVoiceSettingsConfig() {
	const store = useReaderConfigStore();
	const merged = { ...CONFIG_DEFAULTS, ...store };
	const vieneuFullConfig = useMemo(() => extractVieneuConfig(store), [store]);

	return {
		voiceUri: merged.voiceUri,
		setVoiceUri: merged.setVoiceUri,
		edgeVoiceUri: merged.edgeVoiceUri,
		setEdgeVoiceUri: merged.setEdgeVoiceUri,
		edgeBufferMode: merged.edgeBufferMode,
		setEdgeBufferMode: merged.setEdgeBufferMode,
		speechRate: merged.speechRate,
		setSpeechRate: merged.setSpeechRate,
		ttsEngine: merged.ttsEngine,
		setTTSEngine: merged.setTTSEngine,
		vieneuServerUrl: vieneuFullConfig.serverUrl,
		setVieneuServerUrl: merged.setVieneuServerUrl,
		vieneuModel: vieneuFullConfig.model,
		setVieneuModel: merged.setVieneuModel,
		vieneuTemperature: vieneuFullConfig.temperature,
		vieneuTopK: vieneuFullConfig.topK,
		vieneuTopP: vieneuFullConfig.topP,
		vieneuMaxNewFrames: vieneuFullConfig.maxNewFrames,
		vieneuSteps: vieneuFullConfig.steps,
		vieneuCfg: vieneuFullConfig.cfg,
		setVieneuParameter: merged.setVieneuParameter,
		vieneuFullConfig,
	};
}

export function VoiceSettingsTab() {
	const activeDomain = useAppStore((state) => state.activeDomain);
	const config = useVoiceSettingsConfig();

	const [activeFilter, setActiveFilter] = useState<EngineCategory>(() => resolveInitialEngineCategory(config.ttsEngine));
	const { edgeVoices, isLoadingEdge } = useEdgeVoices(activeDomain?.url);
	const { vieneuVoices, vieneuModels, isLoadingVieNeu } = useVieNeuData(config.vieneuServerUrl, config.vieneuModel, config.setVieneuModel);
	const { nativeVoices, setNativeVoices, nativeEngines, activeNativeEngine, setActiveNativeEngine, isLoadingNative, setIsLoadingNative } =
		useNativeVoicesData();

	const [isTestingAudio, setIsTestingAudio] = useState(false);
	const [playingVoiceKey, setPlayingVoiceKey] = useState<string | null>(null);
	const [testError, setTestError] = useState<string | null>(null);

	const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
	const [showAdvancedParams, setShowAdvancedParams] = useState(false);
	const [isPingTesting, setIsPingTesting] = useState(false);

	const audioRef = useRef<HTMLAudioElement | null>(null);
	const activeEdgeBufferMode = resolveEdgeBufferMode(config.edgeBufferMode);

	// Dừng âm thanh đang phát
	const stopCurrentAudio = () => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current = null;
		}
		NativeTTSService.stop().catch(() => {});
		setIsTestingAudio(false);
		setPlayingVoiceKey(null);
	};

	// Xây dựng danh sách thống nhất cho toàn bộ giọng đọc
	const unifiedVoices = useMemo<UnifiedVoiceItem[]>(() => {
		return buildUnifiedVoices(edgeVoices, vieneuVoices, nativeVoices);
	}, [edgeVoices, vieneuVoices, nativeVoices]);

	// Danh sách sau khi áp dụng filter chip
	const filteredVoices = useMemo(() => {
		return unifiedVoices.filter((item) => item.engine === activeFilter);
	}, [unifiedVoices, activeFilter]);

	// Kiểm tra card có đang được chọn làm giọng chính không
	const isVoiceActive = (item: UnifiedVoiceItem): boolean => {
		return checkVoiceActive(item, config.ttsEngine, config.edgeVoiceUri, config.voiceUri);
	};

	// Xử lý chọn giọng đọc
	const handleSelectVoice = (item: UnifiedVoiceItem) => {
		applyVoiceSelection(item, config.setTTSEngine, config.setEdgeVoiceUri, config.setVoiceUri);
	};

	// Xử lý nghe thử giọng đọc (Preview)
	const handleTestVoice = async (item: UnifiedVoiceItem) => {
		setTestError(null);

		if (isTestingAudio && playingVoiceKey === item.id) {
			stopCurrentAudio();
			return;
		}

		stopCurrentAudio();
		setPlayingVoiceKey(item.id);
		setIsTestingAudio(true);

		const onEnd = () => {
			setIsTestingAudio(false);
			setPlayingVoiceKey(null);
		};
		const onError = (msg: string) => {
			setIsTestingAudio(false);
			setPlayingVoiceKey(null);
			setTestError(msg);
		};

		try {
			const audio = await executeVoiceTest(item, config.speechRate, activeDomain?.url, config.vieneuFullConfig, onEnd, onError);
			if (audio) {
				audioRef.current = audio;
			}
		} catch (err: unknown) {
			console.error('[VoiceSettingsTab] Error testing voice:', err);
			const message = err instanceof Error ? err.message : 'Lỗi phát âm thanh thử nghiệm';
			onError(message);
		}
	};

	const handleTestConnection = async () => {
		setIsPingTesting(true);
		try {
			const voices = await TTSService.fetchVoices(config.vieneuServerUrl);
			const msg = voices && voices.length > 0 ? `Kết nối tốt! (${voices.length} giọng)` : 'Kết nối máy chủ thành công!';
			showToast(msg, 'success');
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ';
			showToast(message, 'error');
		} finally {
			setIsPingTesting(false);
		}
	};

	const handleSwitchNativeEngine = async (engineName: string) => {
		setActiveNativeEngine(engineName);
		setIsLoadingNative(true);
		await NativeTTSService.setEngine(engineName);
		const voices = await NativeTTSService.getVoices();
		setNativeVoices(voices);
		setIsLoadingNative(false);
	};

	const counts = useMemo(() => {
		return {
			edge: unifiedVoices.filter((v) => v.engine === 'edge').length,
			vieneu: unifiedVoices.filter((v) => v.engine === 'vieneu').length,
			browser: unifiedVoices.filter((v) => v.engine === 'browser').length,
		};
	}, [unifiedVoices]);

	const isInitialLoading = isLoadingEdge && isLoadingVieNeu && isLoadingNative;
	const isUpdating = isLoadingEdge || isLoadingVieNeu || isLoadingNative;

	return (
		<div className="space-y-3 text-on-surface select-none pb-4">
			{/* 1. Category Switcher (Glassmorphic Segmented Control) */}
			<VoiceCategorySwitcher activeFilter={activeFilter} setActiveFilter={setActiveFilter} counts={counts} />

			{/* 2. Unified Voice Cards Grid */}
			<div className="space-y-2">
				<VoiceCardsListHeader isUpdating={isUpdating} />

				<VoiceCardsList
					isInitialLoading={isInitialLoading}
					filteredVoices={filteredVoices}
					isVoiceActive={isVoiceActive}
					isTestingAudio={isTestingAudio}
					playingVoiceKey={playingVoiceKey}
					onSelectVoice={handleSelectVoice}
					onTestVoice={handleTestVoice}
				/>
			</div>

			{/* 3. Tốc độ đọc (Glassmorphic Card chuẩn các tab khác) */}
			<VoiceSpeedCard speechRate={config.speechRate} setSpeechRate={config.setSpeechRate} />

			{/* 4. Cài đặt nâng cao & Máy chủ (Glassmorphic Accordion) */}
			<VoiceAdvancedAccordion
				showAdvancedSettings={showAdvancedSettings}
				setShowAdvancedSettings={setShowAdvancedSettings}
				vieneuServerUrl={config.vieneuServerUrl}
				setVieneuServerUrl={config.setVieneuServerUrl}
				onTestConnection={handleTestConnection}
				isPingTesting={isPingTesting}
				vieneuModels={vieneuModels}
				vieneuModel={config.vieneuModel}
				setVieneuModel={config.setVieneuModel}
				setVoiceUri={config.setVoiceUri}
				nativeEngines={nativeEngines}
				activeNativeEngine={activeNativeEngine}
				onSwitchNativeEngine={handleSwitchNativeEngine}
				activeEdgeBufferMode={activeEdgeBufferMode}
				edgeBufferMode={config.edgeBufferMode}
				setEdgeBufferMode={config.setEdgeBufferMode}
				showAdvancedParams={showAdvancedParams}
				setShowAdvancedParams={setShowAdvancedParams}
				vieneuTemperature={config.vieneuTemperature}
				vieneuTopK={config.vieneuTopK}
				vieneuTopP={config.vieneuTopP}
				vieneuMaxNewFrames={config.vieneuMaxNewFrames}
				vieneuSteps={config.vieneuSteps}
				vieneuCfg={config.vieneuCfg}
				setVieneuParameter={config.setVieneuParameter}
			/>

			{/* Error Alert Box */}
			<VoiceErrorAlert testError={testError} onDismiss={() => setTestError(null)} />
		</div>
	);
}
