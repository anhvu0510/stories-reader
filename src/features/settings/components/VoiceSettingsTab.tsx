import React, { useEffect, useState, useRef, useMemo } from 'react';
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
	Server
} from 'lucide-react';

import { EdgeTTSService, EdgeVoice, DEFAULT_EDGE_VOICES } from '@/services/edgeTtsService';
import { NativeTTSService, NativeVoice, NativeTTSEngine } from '@/services/nativeTtsService';
import { TTSService, VieNeuVoice, VieNeuModel, DEFAULT_VIENEU_SERVER_URL } from '@/services/ttsService';
import { triggerHaptic } from '@/hooks/useHaptic';
import { useAppStore } from '@/stores/useAppStore';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { showToast } from '@/stores/useToastStore';

const SPEED_PRESETS = [0.8, 1.0, 1.25, 1.5, 1.8, 2.0];

type EngineCategory = 'edge' | 'vieneu' | 'browser';

interface UnifiedVoiceItem {
	id: string;
	engine: 'edge' | 'vieneu' | 'browser';
	name: string;
	gender: 'female' | 'male' | 'device';
	rawVoiceId: string;
}

export function VoiceSettingsTab() {
	const activeDomain = useAppStore((state) => state.activeDomain);
	const {
		voiceUri,
		setVoiceUri,
		edgeVoiceUri = 'vi-VN-HoaiMyNeural',
		setEdgeVoiceUri,
		speechRate,
		setSpeechRate,
		ttsEngine = 'edge',
		setTTSEngine,
		vieneuServerUrl = DEFAULT_VIENEU_SERVER_URL,
		setVieneuServerUrl,
		vieneuModel = '',
		setVieneuModel,
		vieneuTemperature = 0.8,
		vieneuTopK = 25,
		vieneuTopP = 0.95,
		vieneuMaxNewFrames = 300,
		vieneuRepetitionPenalty = 1.2,
		vieneuRepetitionWindow = 80,
		vieneuSteps = 8,
		vieneuCfg = 2,
		vieneuSway = -1,
		vieneuMaxChars = 140,
		vieneuDenoise = true,
		vieneuUseRefCodes = true,
		vieneuApplyWatermark = true,
		vieneuOutputSampleRate = 0,
		setVieneuParameter
	} = useReaderConfigStore();

	const [activeFilter, setActiveFilter] = useState<EngineCategory>(() =>
		ttsEngine === 'browser' || ttsEngine === 'vieneu' ? ttsEngine : 'edge'
	);
	const [vieneuVoices, setVieneuVoices] = useState<VieNeuVoice[]>([]);
	const [vieneuModels, setVieneuModels] = useState<VieNeuModel[]>([]);
	const [edgeVoices, setEdgeVoices] = useState<EdgeVoice[]>(DEFAULT_EDGE_VOICES);
	const [nativeVoices, setNativeVoices] = useState<NativeVoice[]>([]);
	const [nativeEngines, setNativeEngines] = useState<NativeTTSEngine[]>([]);
	const [activeNativeEngine, setActiveNativeEngine] = useState<string>('');

	const [isLoadingEdge, setIsLoadingEdge] = useState(false);
	const [isLoadingVieNeu, setIsLoadingVieNeu] = useState(false);
	const [isLoadingNative, setIsLoadingNative] = useState(false);

	const [isTestingAudio, setIsTestingAudio] = useState(false);
	const [playingVoiceKey, setPlayingVoiceKey] = useState<string | null>(null);
	const [testError, setTestError] = useState<string | null>(null);

	const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
	const [showAdvancedParams, setShowAdvancedParams] = useState(false);
	const [isPingTesting, setIsPingTesting] = useState(false);

	const audioRef = useRef<HTMLAudioElement | null>(null);

	// 1. Tải song song danh sách Edge voices
	useEffect(() => {
		let isMounted = true;
		setIsLoadingEdge(true);

		EdgeTTSService.fetchVoices(activeDomain?.url)
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
	}, [activeDomain?.url]);

	// 2. Tải VieNeu models & voices
	useEffect(() => {
		let isMounted = true;
		setIsLoadingVieNeu(true);

		TTSService.fetchModels(vieneuServerUrl)
			.then((models) => {
				if (!isMounted) return;
				setVieneuModels(models);
				const selected = models.find((m) => m.id === vieneuModel) || models.find((m) => m.active) || models[0];
				if (selected && selected.id !== vieneuModel) {
					setVieneuModel(selected.id);
				}
			})
			.catch(() => {
				if (isMounted) setVieneuModels([]);
			});

		TTSService.fetchVoices(vieneuServerUrl, vieneuModel || undefined)
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
	}, [vieneuServerUrl, vieneuModel, setVieneuModel]);

	// 3. Tải Native voices từ thiết bị
	useEffect(() => {
		let isMounted = true;

		const loadNativeVoices = async () => {
			setIsLoadingNative(true);
			try {
				if (NativeTTSService.isNative()) {
					const engineData = await NativeTTSService.getEngines();
					if (isMounted) {
						setNativeEngines(engineData.engines || []);
						if (engineData.defaultEngine) setActiveNativeEngine(engineData.defaultEngine);
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
		const list: UnifiedVoiceItem[] = [];

		// A. Edge TTS Voices
		edgeVoices.forEach((voice) => {
			const isFemale = voice.gender === 'Female' || voice.id.includes('HoaiMy');
			list.push({
				id: `edge:${voice.id}`,
				engine: 'edge',
				name: voice.name.replace(/Microsoft | Online \(Natural\)| Neural/g, '').trim(),
				gender: isFemale ? 'female' : 'male',
				rawVoiceId: voice.id
			});
		});

		// B. VieNeu AI Voices
		vieneuVoices.forEach((voice) => {
			const isFemale = voice.gender === 'female';
			list.push({
				id: `vieneu:${voice.id}`,
				engine: 'vieneu',
				name: voice.name || voice.id,
				gender: isFemale ? 'female' : 'male',
				rawVoiceId: voice.id
			});
		});

		// C. Native Voices (Chỉ lấy tiếng Việt & mặc định máy)
		list.push({
			id: 'browser:default',
			engine: 'browser',
			name: 'Mặc định thiết bị',
			gender: 'device',
			rawVoiceId: ''
		});

		const viNative = NativeTTSService.getVietnameseVoices(nativeVoices);
		viNative.forEach((voice) => {
			list.push({
				id: `browser:${voice.name}`,
				engine: 'browser',
				name: voice.displayName || voice.name,
				gender: 'device',
				rawVoiceId: voice.name
			});
		});

		return list;
	}, [edgeVoices, vieneuVoices, nativeVoices]);

	// Danh sách sau khi áp dụng filter chip
	const filteredVoices = useMemo(() => {
		return unifiedVoices.filter((item) => item.engine === activeFilter);
	}, [unifiedVoices, activeFilter]);

	// Kiểm tra card có đang được chọn làm giọng chính không
	const isVoiceActive = (item: UnifiedVoiceItem): boolean => {
		if (item.engine !== ttsEngine) return false;
		if (item.engine === 'edge') return item.rawVoiceId === edgeVoiceUri;
		if (item.engine === 'vieneu') return item.rawVoiceId === voiceUri;
		if (item.engine === 'browser') return item.rawVoiceId === voiceUri || (!voiceUri && item.rawVoiceId === '');
		return false;
	};

	// Xử lý chọn giọng đọc
	const handleSelectVoice = (item: UnifiedVoiceItem) => {
		triggerHaptic('light');
		setTTSEngine(item.engine);

		if (item.engine === 'edge') {
			setEdgeVoiceUri(item.rawVoiceId);
		} else if (item.engine === 'vieneu') {
			setVoiceUri(item.rawVoiceId);
		} else if (item.engine === 'browser') {
			setVoiceUri(item.rawVoiceId);
		}
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

		try {
			if (item.engine === 'browser') {
				await NativeTTSService.speak({
					text: 'Xin chào, đây là giọng đọc thử nghiệm từ thiết bị của bạn.',
					voice: item.rawVoiceId,
					rate: speechRate,
					onDone: () => {
						setIsTestingAudio(false);
						setPlayingVoiceKey(null);
					},
					onError: (err) => {
						setIsTestingAudio(false);
						setPlayingVoiceKey(null);
						setTestError('Không thể phát giọng đọc thiết bị: ' + (typeof err === 'string' ? err : 'Lỗi thiết bị'));
					}
				});
				return;
			}

			if (item.engine === 'edge') {
				const blob = await EdgeTTSService.synthesizeSpeech(
					'Xin chào bạn, đây là bản đọc thử nghiệm từ Microsoft Edge TTS.',
					item.rawVoiceId || 'vi-VN-HoaiMyNeural',
					speechRate,
					activeDomain?.url
				);
				const audioUrl = URL.createObjectURL(blob);
				const audio = new Audio(audioUrl);
				audioRef.current = audio;

				audio.onended = () => {
					setIsTestingAudio(false);
					setPlayingVoiceKey(null);
					URL.revokeObjectURL(audioUrl);
				};
				audio.onerror = () => {
					setIsTestingAudio(false);
					setPlayingVoiceKey(null);
					setTestError('Không thể phát âm thanh Edge TTS');
					URL.revokeObjectURL(audioUrl);
				};
				await audio.play();
				return;
			}

			if (item.engine === 'vieneu') {
				const blob = await TTSService.synthesizeSpeech(
					'Xin chào bạn, đây là bản đọc thử nghiệm từ mô hình VieNeu AI.',
					item.rawVoiceId,
					speechRate,
					vieneuServerUrl,
					undefined,
					vieneuModel || undefined,
					{
						temperature: vieneuTemperature,
						top_k: vieneuTopK,
						top_p: vieneuTopP,
						max_new_frames: vieneuMaxNewFrames,
						repetition_penalty: vieneuRepetitionPenalty,
						repetition_window: vieneuRepetitionWindow,
						steps: vieneuSteps,
						cfg: vieneuCfg,
						sway: vieneuSway,
						max_chars: vieneuMaxChars,
						denoise: vieneuDenoise,
						use_ref_codes: vieneuUseRefCodes,
						apply_watermark: vieneuApplyWatermark,
						...(vieneuOutputSampleRate ? { output_sample_rate: vieneuOutputSampleRate as 24000 | 48000 } : {})
					}
				);
				const audioUrl = TTSService.createAudioUrl(blob);
				const audio = new Audio(audioUrl);
				audioRef.current = audio;

				audio.onended = () => {
					setIsTestingAudio(false);
					setPlayingVoiceKey(null);
					TTSService.revokeAudioUrl(audioUrl);
				};
				audio.onerror = () => {
					setIsTestingAudio(false);
					setPlayingVoiceKey(null);
					setTestError('Không thể phát âm thanh VieNeu AI');
					TTSService.revokeAudioUrl(audioUrl);
				};
				await audio.play();
			}
		} catch (err: any) {
			console.error('[VoiceSettingsTab] Error testing voice:', err);
			setTestError(err.message || 'Lỗi phát âm thanh thử nghiệm');
			setIsTestingAudio(false);
			setPlayingVoiceKey(null);
		}
	};

	const handleTestConnection = async () => {
		setIsPingTesting(true);
		try {
			const voices = await TTSService.fetchVoices(vieneuServerUrl);
			if (voices && voices.length > 0) {
				showToast(`Kết nối tốt! (${voices.length} giọng)`, 'success');
			} else {
				showToast('Kết nối máy chủ thành công!', 'success');
			}
		} catch (err: any) {
			showToast(err.message || 'Lỗi kết nối máy chủ', 'error');
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
			browser: unifiedVoices.filter((v) => v.engine === 'browser').length
		};
	}, [unifiedVoices]);

	const isInitialLoading = isLoadingEdge && isLoadingVieNeu && isLoadingNative;

	return (
		<div className="space-y-3 text-on-surface select-none pb-4">
			{/* 1. Category Switcher (Glassmorphic Segmented Control) */}
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

			{/* 2. Unified Voice Cards Grid */}
			<div className="space-y-2">
				<div className="flex items-center justify-between px-1">
					<div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
						<Volume2 size={14} className="text-primary" />
						<span>Danh sách giọng đọc</span>
					</div>

					{(isLoadingEdge || isLoadingVieNeu || isLoadingNative) && (
						<div className="flex items-center gap-1 text-[10px] text-primary font-bold">
							<Loader2 size={11} className="animate-spin" />
							<span>Đang cập nhật...</span>
						</div>
					)}
				</div>

				{isInitialLoading ? (
					<div className="p-8 text-center bg-white/5 border border-white/10 rounded-2xl shadow-xs">
						<Loader2 size={22} className="animate-spin text-primary mx-auto mb-2" />
						<p className="text-xs text-on-surface-variant font-medium">Đang tải danh sách giọng đọc...</p>
					</div>
				) : filteredVoices.length === 0 ? (
					<div className="p-6 text-center bg-white/5 border border-white/10 rounded-2xl space-y-1.5 shadow-xs">
						<AlertCircle size={20} className="text-on-surface-variant/50 mx-auto" />
						<p className="text-xs text-on-surface font-bold">Không tìm thấy giọng đọc nào</p>
						<p className="text-[11px] text-on-surface-variant">Kiểm tra kết nối mạng hoặc máy chủ VieNeu AI</p>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-1.5">
						{filteredVoices.map((item) => {
							const isSelected = isVoiceActive(item);
							const isPlaying = isTestingAudio && playingVoiceKey === item.id;

							return (
								<div
									key={item.id}
									onClick={() => handleSelectVoice(item)}
									className={`px-2.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-1.5 shadow-xs ${
										isSelected
											? 'bg-primary/20 border-primary/60 text-primary shadow-xs'
											: 'bg-white/5 hover:bg-white/10 border-white/10 text-on-surface'
									}`}
								>
									{/* Avatar & Voice Name */}
									<div className="flex items-center gap-2 min-w-0 flex-1">
										<div
											className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
												isSelected
													? 'bg-primary/30 border-primary/50 text-primary'
													: 'bg-white/10 border-white/15 text-on-surface-variant'
											}`}
										>
											{item.gender === 'female' ? (
												<Mic size={12} />
											) : item.gender === 'male' ? (
												<User size={12} />
											) : (
												<Smartphone size={12} />
											)}
										</div>

										<div className="min-w-0 flex-1 flex items-center gap-1">
											<span className={`text-xs font-bold truncate ${isSelected ? 'text-primary font-black' : 'text-on-surface'}`}>
												{item.name}
											</span>
											{isSelected && <Check size={12} strokeWidth={3} className="text-primary shrink-0" />}
										</div>
									</div>

									{/* Mini Play/Stop button */}
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											handleTestVoice(item);
										}}
										className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-90 cursor-pointer ${
											isPlaying
												? 'bg-primary text-on-primary shadow-xs'
												: 'bg-white/10 hover:bg-white/20 border border-white/15 text-on-surface'
										}`}
										title={isPlaying ? 'Dừng phát' : 'Nghe thử'}
									>
										{isPlaying ? (
											<Square size={10} className="fill-current" />
										) : (
											<Play size={10} className="fill-current ml-0.5" />
										)}
									</button>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* 3. Tốc độ đọc (Glassmorphic Card chuẩn các tab khác) */}
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

			{/* 4. Cài đặt nâng cao & Máy chủ (Glassmorphic Accordion) */}
			<div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden shadow-xs">
				<button
					type="button"
					onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
					className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-on-surface hover:bg-white/5 transition-colors cursor-pointer"
				>
					<div className="flex items-center gap-2">
						<Settings2 size={14} className="text-primary" />
						<span>Cài đặt máy chủ & kỹ thuật</span>
					</div>
					{showAdvancedSettings ? <ChevronUp size={14} className="text-on-surface-variant" /> : <ChevronDown size={14} className="text-on-surface-variant" />}
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
									onClick={handleTestConnection}
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
									onChange={(e) => handleSwitchNativeEngine(e.target.value)}
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

						{/* Tham số kỹ thuật AI */}
						<div className="pt-1">
							<button
								type="button"
								onClick={() => setShowAdvancedParams(!showAdvancedParams)}
								className="text-[10px] font-mono font-bold text-on-surface-variant/80 hover:text-on-surface flex items-center gap-1 cursor-pointer"
							>
								<span>{showAdvancedParams ? '▼ Thu gọn tham số máy học' : '▶ Tham số kỹ thuật AI (Temperature, Steps...)'}</span>
							</button>

							{showAdvancedParams && (
								<div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 mt-1.5 text-[10px]">
									{vieneuModel?.endsWith('turbo') ? (
										<>
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
										</>
									) : (
										<>
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
										</>
									)}
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Error Alert Box */}
			{testError && (
				<div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200 shadow-xs">
					<div className="flex items-center gap-2 min-w-0">
						<AlertCircle size={14} className="shrink-0" />
						<span className="truncate font-semibold">{testError}</span>
					</div>
					<button
						type="button"
						onClick={() => setTestError(null)}
						className="text-xs font-bold text-rose-400/80 hover:text-rose-400 px-1.5 py-0.5 rounded-lg hover:bg-rose-500/20 cursor-pointer shrink-0"
					>
						Đóng
					</button>
				</div>
			)}
		</div>
	);
}
