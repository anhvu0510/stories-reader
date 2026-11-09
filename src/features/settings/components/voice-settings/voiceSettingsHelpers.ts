import { triggerHaptic } from '@/hooks/useHaptic';
import { EdgeTTSService, type EdgeVoice } from '@/services/edgeTtsService';
import { NativeTTSService, type NativeVoice } from '@/services/nativeTtsService';
import { TTSService, type VieNeuVoice, DEFAULT_VIENEU_SERVER_URL } from '@/services/ttsService';

import type { EdgeBufferMode } from '@/shared/types';
import type { useReaderConfigStore } from '@/stores/useReaderConfigStore';

export const SPEED_PRESETS = [0.8, 1.0, 1.25, 1.5, 1.8, 2.0];

export const EDGE_BUFFER_MODES: Array<{
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

export type EngineCategory = 'edge' | 'vieneu' | 'browser';

export interface UnifiedVoiceItem {
	id: string;
	engine: 'edge' | 'vieneu' | 'browser';
	name: string;
	gender: 'female' | 'male' | 'device';
	rawVoiceId: string;
}

export interface VieneuFullConfig {
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

export const VIENEU_CONFIG_DEFAULTS = {
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

export const CONFIG_DEFAULTS = {
	edgeVoiceUri: 'vi-VN-HoaiMyNeural',
	edgeBufferMode: 'file' as EdgeBufferMode,
	ttsEngine: 'edge' as EngineCategory,
};

export function resolveEdgeBufferMode(mode?: EdgeBufferMode) {
	const found = EDGE_BUFFER_MODES.find((m) => m.value === mode);
	if (found) return found;
	return EDGE_BUFFER_MODES[0];
}

export function resolveInitialEngineCategory(ttsEngine?: string): EngineCategory {
	if (ttsEngine === 'browser') return 'browser';
	if (ttsEngine === 'vieneu') return 'vieneu';
	return 'edge';
}

export function checkVoiceActive(item: UnifiedVoiceItem, ttsEngine: string, edgeVoiceUri: string, voiceUri: string): boolean {
	if (item.engine !== ttsEngine) return false;
	if (item.engine === 'edge') return item.rawVoiceId === edgeVoiceUri;
	if (item.engine === 'vieneu') return item.rawVoiceId === voiceUri;
	if (item.engine === 'browser') return item.rawVoiceId === voiceUri || (!voiceUri && item.rawVoiceId === '');
	return false;
}

export function buildUnifiedVoices(edgeVoices: EdgeVoice[], vieneuVoices: VieNeuVoice[], nativeVoices: NativeVoice[]): UnifiedVoiceItem[] {
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

export function applyVoiceSelection(
	item: UnifiedVoiceItem,
	setTTSEngine: (e: EngineCategory) => void,
	setEdgeVoiceUri: (uri: string) => void,
	setVoiceUri: (uri: string) => void
) {
	triggerHaptic('light');
	setTTSEngine(item.engine);
	if (item.engine === 'edge') {
		setEdgeVoiceUri(item.rawVoiceId);
		return;
	}
	setVoiceUri(item.rawVoiceId);
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

export function extractVieneuConfig(store: ReturnType<typeof useReaderConfigStore.getState>): VieneuFullConfig {
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

export async function executeVoiceTest(
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
