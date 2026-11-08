import { useCallback, useEffect, useRef, useState } from 'react';

import { computeSubtleBgmVolume } from '@/hooks/useEdgeReadAloudBgm';
import { getAssetUrl } from '@/shared/utils/assetUrl';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

export function createFallbackAmbientBuffer(ctx: AudioContext): AudioBuffer {
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

function getAudioContextClass(): typeof AudioContext | undefined {
	return window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
}

async function fetchAudioBuffer(ctx: AudioContext, resolvedUrl: string): Promise<AudioBuffer> {
	const res = await fetch(resolvedUrl);
	if (res.ok === false) throw new Error(`HTTP error ${res.status}`);
	const contentType = res.headers?.get ? res.headers.get('content-type') || '' : '';
	if (contentType.includes('text/html')) {
		throw new Error('Received HTML instead of audio');
	}
	const arrayBuffer = await res.arrayBuffer();
	return ctx.decodeAudioData(arrayBuffer);
}

async function loadBufferOrFallback(ctx: AudioContext, resolvedUrl: string): Promise<AudioBuffer> {
	try {
		return await fetchAudioBuffer(ctx, resolvedUrl);
	} catch (err) {
		console.warn('[BgmSettingsTab] Load audio file failed, using fallback:', err);
		return createFallbackAmbientBuffer(ctx);
	}
}

function applyRealtimeVolume(ctx: AudioContext, gain: GainNode, bgmVolume: number) {
	const safeVolume = computeSubtleBgmVolume(bgmVolume);
	const now = ctx.currentTime;
	try {
		if (typeof gain.gain.setValueAtTime === 'function') {
			gain.gain.setValueAtTime(safeVolume, now);
			return;
		}
		gain.gain.value = safeVolume;
	} catch {
		// intentionally empty — WebAudio API may throw if context is already closed
	}
}

export function useBgmPreview(bgmVolume: number, bgmAudioUrl: string) {
	const [isPreviewing, setIsPreviewing] = useState(false);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);

	const previewAudioCtxRef = useRef<AudioContext | null>(null);
	const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
	const previewGainRef = useRef<GainNode | null>(null);

	const setIsBgmPreviewing = useReaderConfigStore((state) => state.setIsBgmPreviewing);

	const stopPreview = useCallback(() => {
		if (previewSourceRef.current) {
			try {
				previewSourceRef.current.stop();
				previewSourceRef.current.disconnect();
			} catch {
				// intentionally empty — node may already be stopped/disconnected
			}
			previewSourceRef.current = null;
		}
		if (previewGainRef.current) {
			try {
				previewGainRef.current.disconnect();
			} catch {
				// intentionally empty — node may already be disconnected
			}
			previewGainRef.current = null;
		}
		if (previewAudioCtxRef.current && previewAudioCtxRef.current.state !== 'closed') {
			void previewAudioCtxRef.current.close();
			previewAudioCtxRef.current = null;
		}
		setIsPreviewing(false);
		setIsLoadingPreview(false);
		setIsBgmPreviewing?.(false);
	}, [setIsBgmPreviewing]);

	useEffect(() => {
		return () => {
			stopPreview();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- placeholder removed below
	}, []);

	// Cập nhật âm lượng realtime khi đang phát preview
	useEffect(() => {
		const ctx = previewAudioCtxRef.current;
		const gain = previewGainRef.current;
		if (!ctx || !gain) return;
		applyRealtimeVolume(ctx, gain, bgmVolume);
	}, [bgmVolume]);

	const startPreview = async (urlToPlay?: string) => {
		stopPreview();

		try {
			setIsLoadingPreview(true);
			setIsBgmPreviewing?.(true);

			const AudioContextClass = getAudioContextClass();
			if (!AudioContextClass) {
				setIsLoadingPreview(false);
				return;
			}

			const ctx = new AudioContextClass();
			previewAudioCtxRef.current = ctx;
			if (ctx.state === 'suspended') {
				void ctx.resume();
			}

			const resolvedUrl = getAssetUrl(urlToPlay || bgmAudioUrl);
			const buffer = await loadBufferOrFallback(ctx, resolvedUrl);

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

	return { isPreviewing, isLoadingPreview, stopPreview, startPreview, togglePreview };
}
