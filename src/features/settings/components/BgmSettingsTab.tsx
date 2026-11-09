import { RotateCcw } from 'lucide-react';
import React, { useState } from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

import { BgmAdvancedCard, BgmMasterCard, BgmPresetGrid, BgmVolumeCard } from './bgm-settings/BgmSettingsCards';
import { useBgmPreview } from './useBgmPreview';

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
		setBgmParameter,
	} = useReaderConfigStore();

	const [customUrl, setCustomUrl] = useState(bgmAudioUrl);
	const [showAdvanced, setShowAdvanced] = useState(false);

	const { isPreviewing, isLoadingPreview, stopPreview, startPreview, togglePreview } = useBgmPreview(bgmVolume, bgmAudioUrl);

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

	return (
		<div className="space-y-2.5 text-on-surface select-none pb-4">
			<BgmMasterCard
				bgmEnabled={bgmEnabled}
				setBgmEnabled={setBgmEnabled}
				isPreviewing={isPreviewing}
				isLoadingPreview={isLoadingPreview}
				togglePreview={togglePreview}
			/>

			<BgmVolumeCard bgmEnabled={bgmEnabled} bgmVolume={bgmVolume} setBgmVolume={setBgmVolume} />

			<BgmPresetGrid bgmEnabled={bgmEnabled} bgmAudioUrl={bgmAudioUrl} isPreviewing={isPreviewing} onSelectPreset={handleSelectPreset} />

			<BgmAdvancedCard
				bgmEnabled={bgmEnabled}
				showAdvanced={showAdvanced}
				setShowAdvanced={setShowAdvanced}
				customUrl={customUrl}
				setCustomUrl={setCustomUrl}
				onBlurCustomUrl={handleCustomUrlBlur}
				bgmFadeInMs={bgmFadeInMs}
				bgmFadeOutMs={bgmFadeOutMs}
				bgmStopDelayMs={bgmStopDelayMs}
				bgmOnlyOnEdgeReadAloud={bgmOnlyOnEdgeReadAloud}
				setBgmParameter={setBgmParameter}
			/>

			<div className="flex justify-end pt-0.5">
				<button
					type="button"
					onClick={() => {
						triggerHaptic('light');
						handleResetDefaults();
					}}
					className="px-2.5 py-1 text-xs font-bold text-on-surface-variant hover:text-on-surface bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 flex items-center justify-between gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
				>
					<RotateCcw size={12} />
					<span>Mặc định</span>
				</button>
			</div>
		</div>
	);
}
