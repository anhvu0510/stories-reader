import { useEffect, useState, useMemo } from 'react';

import { EdgeTTSService, type EdgeVoice, DEFAULT_EDGE_VOICES } from '@/services/edgeTtsService';
import { NativeTTSService, type NativeVoice, type NativeTTSEngine } from '@/services/nativeTtsService';
import { TTSService, type VieNeuVoice, type VieNeuModel } from '@/services/ttsService';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

import { CONFIG_DEFAULTS, extractVieneuConfig } from './voiceSettingsHelpers';

export function useEdgeVoices(activeDomainUrl?: string) {
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

export function useVieNeuData(serverUrl: string, currentModel: string, setModel: (m: string) => void) {
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

export function useNativeVoicesData() {
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

export function useVoiceSettingsConfig() {
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
