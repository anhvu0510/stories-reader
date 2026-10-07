import { useMemo } from 'react';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { DEFAULT_VIENEU_SERVER_URL } from '@/services/ttsService';

export function useVieNeuReadingConfig() {
	const vieneuServerUrl = useReaderConfigStore((state) => state.vieneuServerUrl || DEFAULT_VIENEU_SERVER_URL);
	const vieneuModel = useReaderConfigStore((state) => state.vieneuModel || undefined);
	const vieneuTemperature = useReaderConfigStore((state) => state.vieneuTemperature ?? 0.8);
	const vieneuTopK = useReaderConfigStore((state) => state.vieneuTopK ?? 25);
	const vieneuTopP = useReaderConfigStore((state) => state.vieneuTopP ?? 0.95);
	const vieneuMaxNewFrames = useReaderConfigStore((state) => state.vieneuMaxNewFrames ?? 300);
	const vieneuRepetitionPenalty = useReaderConfigStore((state) => state.vieneuRepetitionPenalty ?? 1.2);
	const vieneuRepetitionWindow = useReaderConfigStore((state) => state.vieneuRepetitionWindow ?? 80);
	const vieneuSteps = useReaderConfigStore((state) => state.vieneuSteps ?? 8);
	const vieneuCfg = useReaderConfigStore((state) => state.vieneuCfg ?? 2.0);
	const vieneuSway = useReaderConfigStore((state) => state.vieneuSway ?? -1.0);
	const vieneuMaxChars = useReaderConfigStore((state) => state.vieneuMaxChars ?? 140);
	const vieneuDenoise = useReaderConfigStore((state) => state.vieneuDenoise ?? true);
	const vieneuUseRefCodes = useReaderConfigStore((state) => state.vieneuUseRefCodes ?? true);
	const vieneuApplyWatermark = useReaderConfigStore((state) => state.vieneuApplyWatermark ?? true);
	const vieneuOutputSampleRate = useReaderConfigStore((state) => state.vieneuOutputSampleRate ?? 0);
	const vieneuOptions = useMemo(
		() => ({
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
		}),
		[
			vieneuTemperature,
			vieneuTopK,
			vieneuTopP,
			vieneuMaxNewFrames,
			vieneuRepetitionPenalty,
			vieneuRepetitionWindow,
			vieneuSteps,
			vieneuCfg,
			vieneuSway,
			vieneuMaxChars,
			vieneuDenoise,
			vieneuUseRefCodes,
			vieneuApplyWatermark,
			vieneuOutputSampleRate
		]
	);

	const getVieneuOptionsForSegment = (text: string) => ({
		...vieneuOptions,
		// max_chars is also used by the model as its text budget. Never let the
		// configured default truncate a complete source line selected by marker.
		max_chars: Math.min(512, Math.max(vieneuOptions.max_chars ?? 140, text.length))
	});

	return { vieneuServerUrl, vieneuModel, vieneuOptions, getVieneuOptionsForSegment };
}
