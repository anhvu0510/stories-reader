import React, { useState, useRef, useMemo } from 'react';

import { NativeTTSService } from '@/services/nativeTtsService';
import { TTSService } from '@/services/ttsService';
import { useAppStore } from '@/stores/useAppStore';
import { showToast } from '@/stores/useToastStore';

import { useEdgeVoices, useNativeVoicesData, useVieNeuData, useVoiceSettingsConfig } from './voice-settings/useVoiceSettingsData';
import { VoiceAdvancedAccordion } from './voice-settings/VoiceAdvancedAccordion';
import {
	VoiceCardsList,
	VoiceCardsListHeader,
	VoiceCategorySwitcher,
	VoiceErrorAlert,
	VoiceSpeedCard,
} from './voice-settings/VoiceCardsSection';
import {
	applyVoiceSelection,
	buildUnifiedVoices,
	checkVoiceActive,
	executeVoiceTest,
	resolveEdgeBufferMode,
	resolveInitialEngineCategory,
	type EngineCategory,
	type UnifiedVoiceItem,
	type VieneuFullConfig,
} from './voice-settings/voiceSettingsHelpers';

function useVoicePreviewTest(speechRate: number, activeDomainUrl: string | undefined, vieneuFullConfig: VieneuFullConfig) {
	const [isTestingAudio, setIsTestingAudio] = useState(false);
	const [playingVoiceKey, setPlayingVoiceKey] = useState<string | null>(null);
	const [testError, setTestError] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const stopCurrentAudio = () => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current = null;
		}
		NativeTTSService.stop().catch(() => {});
		setIsTestingAudio(false);
		setPlayingVoiceKey(null);
	};

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
			const audio = await executeVoiceTest(item, speechRate, activeDomainUrl, vieneuFullConfig, onEnd, onError);
			if (audio) {
				audioRef.current = audio;
			}
		} catch (err: unknown) {
			console.error('[VoiceSettingsTab] Error testing voice:', err);
			const message = err instanceof Error ? err.message : 'Lỗi phát âm thanh thử nghiệm';
			onError(message);
		}
	};

	return {
		isTestingAudio,
		playingVoiceKey,
		testError,
		setTestError,
		handleTestVoice,
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

	const { isTestingAudio, playingVoiceKey, testError, setTestError, handleTestVoice } = useVoicePreviewTest(
		config.speechRate,
		activeDomain?.url,
		config.vieneuFullConfig
	);

	const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
	const [showAdvancedParams, setShowAdvancedParams] = useState(false);
	const [isPingTesting, setIsPingTesting] = useState(false);

	const activeEdgeBufferMode = resolveEdgeBufferMode(config.edgeBufferMode);

	const unifiedVoices = useMemo<UnifiedVoiceItem[]>(() => {
		return buildUnifiedVoices(edgeVoices, vieneuVoices, nativeVoices);
	}, [edgeVoices, vieneuVoices, nativeVoices]);

	const filteredVoices = useMemo(() => {
		return unifiedVoices.filter((item) => item.engine === activeFilter);
	}, [unifiedVoices, activeFilter]);

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

	return (
		<div className="space-y-3 text-on-surface select-none pb-4">
			<VoiceCategorySwitcher activeFilter={activeFilter} setActiveFilter={setActiveFilter} counts={counts} />

			<div className="space-y-2">
				<VoiceCardsListHeader isUpdating={isLoadingEdge || isLoadingVieNeu || isLoadingNative} />

				<VoiceCardsList
					isInitialLoading={isLoadingEdge && isLoadingVieNeu && isLoadingNative}
					filteredVoices={filteredVoices}
					isVoiceActive={(item) => checkVoiceActive(item, config.ttsEngine, config.edgeVoiceUri, config.voiceUri)}
					isTestingAudio={isTestingAudio}
					playingVoiceKey={playingVoiceKey}
					onSelectVoice={(item) => applyVoiceSelection(item, config.setTTSEngine, config.setEdgeVoiceUri, config.setVoiceUri)}
					onTestVoice={handleTestVoice}
				/>
			</div>

			<VoiceSpeedCard speechRate={config.speechRate} setSpeechRate={config.setSpeechRate} />

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

			<VoiceErrorAlert testError={testError} onDismiss={() => setTestError(null)} />
		</div>
	);
}
